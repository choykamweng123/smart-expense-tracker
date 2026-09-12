import express from 'express';
import http from 'http';
import path from 'path';
import dotenv from 'dotenv';
import { GoogleGenAI, Type } from '@google/genai';
import { createServer as createViteServer } from 'vite';

dotenv.config();

const PORT = 3000;

// Security: Disallow printing or returning API key or internal secrets
function sanitizeErrorMessage(msg: string): string {
  if (!msg) return 'An unexpected error occurred.';
  // Scrub Google API keys (AIza...)
  let sanitized = msg.replace(/AIza[0-9A-Za-z_-]{35}/g, '[REDACTED_KEY]');
  // Scrub Authorization tokens
  sanitized = sanitized.replace(/Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi, 'Bearer [REDACTED]');
  // Scrub internal paths like /workspace/... or /home/...
  sanitized = sanitized.replace(/(?:\/[a-zA-Z0-9._-]+){3,}/g, (match) => {
    if (match.startsWith('/api') || match.startsWith('/src')) return match;
    return '[REDACTED_PATH]';
  });
  return sanitized;
}

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

// Fallback models chain: gemini-3.1-flash-lite has separate quota and fast latency, followed by gemini-3.8-flash
const FALLBACK_MODELS = ['gemini-3.1-flash-lite', 'gemini-3.8-flash'];

// Server Overload Protection: Concurrency Limiter
// Restricts simultaneous heavy Gemini requests to prevent memory exhaustion and CPU spiking
class AIConcurrencyLimiter {
  private active = 0;
  private readonly maxConcurrent: number;
  private queue: Array<() => void> = [];

  constructor(maxConcurrent = 3) {
    this.maxConcurrent = maxConcurrent;
  }

  async acquire(timeoutMs = 8000): Promise<() => void> {
    if (this.active < this.maxConcurrent) {
      this.active++;
      return () => this.release();
    }

    if (this.queue.length >= 10) {
      throw new Error('SERVER_OVERLOAD');
    }

    return new Promise<() => void>((resolve, reject) => {
      let timer: NodeJS.Timeout | null = null;

      const ticket = () => {
        if (timer) clearTimeout(timer);
        this.active++;
        resolve(() => this.release());
      };

      timer = setTimeout(() => {
        const idx = this.queue.indexOf(ticket);
        if (idx !== -1) {
          this.queue.splice(idx, 1);
        }
        reject(new Error('SERVER_QUEUE_TIMEOUT'));
      }, timeoutMs);

      this.queue.push(ticket);
    });
  }

  private release() {
    this.active--;
    if (this.queue.length > 0 && this.active < this.maxConcurrent) {
      const next = this.queue.shift();
      if (next) next();
    }
  }
}

const aiLimiter = new AIConcurrencyLimiter(3);

// Server Overload Protection: Sliding Window Rate Limiter
interface RateLimitBucket {
  count: number;
  resetTime: number;
}

function createRateLimiter(options: { windowMs: number; maxRequests: number; message: string }) {
  const ipMap = new Map<string, RateLimitBucket>();

  // Periodic garbage collection to prevent memory leak
  const gcInterval = setInterval(() => {
    const now = Date.now();
    for (const [ip, bucket] of ipMap.entries()) {
      if (now > bucket.resetTime) {
        ipMap.delete(ip);
      }
    }
  }, 60000);
  if (gcInterval.unref) gcInterval.unref();

  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const ip =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0].trim() ||
      req.socket.remoteAddress ||
      'unknown-client';
    const now = Date.now();
    let bucket = ipMap.get(ip);

    if (!bucket || now > bucket.resetTime) {
      bucket = { count: 1, resetTime: now + options.windowMs };
      ipMap.set(ip, bucket);
    } else {
      bucket.count += 1;
    }

    const remaining = Math.max(0, options.maxRequests - bucket.count);
    const retryAfterSeconds = Math.max(1, Math.ceil((bucket.resetTime - now) / 1000));

    res.setHeader('RateLimit-Limit', String(options.maxRequests));
    res.setHeader('RateLimit-Remaining', String(remaining));
    res.setHeader('RateLimit-Reset', String(retryAfterSeconds));

    if (bucket.count > options.maxRequests) {
      res.setHeader('Retry-After', String(retryAfterSeconds));
      return res.status(429).json({
        success: false,
        error: options.message,
        retryAfter: retryAfterSeconds,
      });
    }

    next();
  };
}

// Timeout wrapper to avoid hanging AI requests
async function withTimeout<T>(promise: Promise<T>, timeoutMs = 14000): Promise<T> {
  let timer: NodeJS.Timeout;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('AI_REQUEST_TIMEOUT')), timeoutMs);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => {
    clearTimeout(timer);
  });
}

async function generateWithFallback(
  ai: GoogleGenAI,
  options: { contents: any; config: any }
) {
  let lastError: any = null;

  for (let i = 0; i < FALLBACK_MODELS.length; i++) {
    const model = FALLBACK_MODELS[i];
    // If it's a 429 quota error, maxAttempts should be 1 so we move to next model immediately
    const maxAttempts = 1;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        console.log(`Executing Gemini call with model: ${model} (attempt ${attempt}/${maxAttempts})`);
        const response = await withTimeout(
          ai.models.generateContent({
            model,
            contents: options.contents,
            config: options.config,
          }),
          14000
        );
        return response;
      } catch (err: any) {
        lastError = err;
        const errMsg = err?.message || String(err);
        const isQuota =
          errMsg.includes('429') ||
          errMsg.includes('RESOURCE_EXHAUSTED') ||
          errMsg.includes('quota');
        const isTransient =
          isQuota ||
          errMsg.includes('503') ||
          errMsg.includes('UNAVAILABLE') ||
          errMsg.includes('high demand') ||
          errMsg.includes('overloaded') ||
          errMsg.includes('AI_REQUEST_TIMEOUT') ||
          errMsg.includes('SERVER_QUEUE_TIMEOUT') ||
          errMsg.includes('DEADLINE_EXCEEDED') ||
          errMsg.includes('ETIMEDOUT') ||
          errMsg.includes('timeout') ||
          errMsg.includes('fetch failed');

        console.warn(`Model ${model} warning (attempt ${attempt}, transient: ${isTransient}):`, sanitizeErrorMessage(errMsg));

        // If it's quota or transient, immediately switch to the next fallback model in FALLBACK_MODELS
        if (isTransient && i < FALLBACK_MODELS.length - 1) {
          break; // break inner attempt loop to move to next model immediately
        }

        if (!isTransient) {
          throw err;
        }
      }
    }
  }

  throw lastError;
}

function formatGeminiError(error: any): string {
  if (!error) return 'An unexpected error occurred while analyzing the transaction.';
  const rawMsg = error.message || (typeof error === 'string' ? error : JSON.stringify(error));
  const msg = sanitizeErrorMessage(rawMsg);

  if (msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED') || msg.includes('quota')) {
    return 'Free AI daily quota limit reached. You can review and adjust the fields manually or try again later.';
  }
  if (
    msg.includes('503') ||
    msg.includes('UNAVAILABLE') ||
    msg.includes('high demand') ||
    msg.includes('overloaded') ||
    msg.includes('SERVER_OVERLOAD')
  ) {
    return 'The AI service is currently busy. Please review fields manually or try again in a moment.';
  }
  if (msg.includes('AI_REQUEST_TIMEOUT') || msg.includes('SERVER_QUEUE_TIMEOUT') || msg.includes('DEADLINE_EXCEEDED')) {
    return 'AI took too long to respond. You can enter details manually or retry.';
  }
  if (msg.includes('GEMINI_API_KEY') || msg.includes('API key')) {
    return 'Gemini API key is not configured or invalid. Please check your environment settings.';
  }

  // Attempt to parse nested JSON error message if returned by SDK safely
  try {
    const parsed = JSON.parse(rawMsg);
    if (parsed?.error?.message) {
      return sanitizeErrorMessage(parsed.error.message);
    }
  } catch {
    // ignore
  }

  return msg;
}

// Whitelist of supported receipt image MIME types
const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
  'image/gif',
  'application/pdf',
]);

async function startServer() {
  const app = express();

  // Security: Remove X-Powered-By header to prevent fingerprinting
  app.disable('x-powered-by');

  // Security: HTTP Response Headers to prevent MIME sniffing, clickjacking, and data leakage
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('X-XSS-Protection', '0');
    // Allow embedding in AI Studio and Google preview environments while restricting arbitrary third parties
    res.setHeader(
      'Content-Security-Policy',
      "frame-ancestors 'self' https://ai.studio https://*.google.com https://*.run.app https://*.aistudio.google.com"
    );
    next();
  });

  // Server Overload Prevention: Enforce strict 10MB payload limit (lowered from 50MB)
  // High-res receipts compressed client-side are strictly <5MB (base64 ~6.6MB).
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Safe error handling for oversized or malformed JSON payloads
  app.use((err: any, _req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (err?.type === 'entity.too.large' || err?.status === 413) {
      return res.status(413).json({
        success: false,
        error: 'Payload size exceeds the 10MB limit. Please upload an image under 5MB.',
      });
    }
    if (err instanceof SyntaxError && (err as any).status === 400 && 'body' in err) {
      return res.status(400).json({
        success: false,
        error: 'Malformed JSON payload.',
      });
    }
    next(err);
  });

  // Health check
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Rate limiters
  const analyzeReceiptLimiter = createRateLimiter({
    windowMs: 60 * 1000,
    maxRequests: 20, // 20 receipt scans per minute per IP
    message: 'Too many receipt analysis requests. Please wait a moment before scanning more receipts.',
  });

  const suggestCategoryLimiter = createRateLimiter({
    windowMs: 60 * 1000,
    maxRequests: 60, // 60 category suggestions per minute per IP
    message: 'Too many category suggestions requested. Please slow down.',
  });

  const financialInsightsLimiter = createRateLimiter({
    windowMs: 60 * 1000,
    maxRequests: 20, // 20 insights per minute per IP
    message: 'Too many financial insights requests. Please wait a moment.',
  });

  const quickAddLimiter = createRateLimiter({
    windowMs: 60 * 1000,
    maxRequests: 40, // 40 quick adds per minute per IP
    message: 'Too many quick add requests. Please wait a moment.',
  });

  // Receipt & Transaction Auto-Categorization API
  app.post('/api/analyze-receipt', analyzeReceiptLimiter, async (req, res) => {
    let releaseTicket: (() => void) | null = null;
    try {
      const { imageBase64, mimeType = 'image/jpeg', text, preferredCurrency = 'USD' } = req.body;

      // Input Validation
      if (!imageBase64 && !text) {
        return res.status(400).json({
          success: false,
          error: 'Please provide either an image of the receipt/transaction or transaction text.',
        });
      }

      // Validate image payload size and format
      if (imageBase64) {
        if (typeof imageBase64 !== 'string' || imageBase64.length > 12000000) {
          return res.status(400).json({
            success: false,
            error: 'Receipt image data is invalid or exceeds safe size limit.',
          });
        }
      }

      // Validate MIME type
      const normalizedMime = typeof mimeType === 'string' ? mimeType.toLowerCase().trim() : 'image/jpeg';
      if (!ALLOWED_MIME_TYPES.has(normalizedMime)) {
        return res.status(400).json({
          success: false,
          error: 'Unsupported image format. Allowed formats: JPEG, PNG, WebP, GIF, HEIC, PDF.',
        });
      }

      // Validate text input length
      if (text && (typeof text !== 'string' || text.length > 4000)) {
        return res.status(400).json({
          success: false,
          error: 'Transaction text exceeds the 4,000 character limit.',
        });
      }

      // Sanitize preferred currency
      const sanitizedCurrency =
        typeof preferredCurrency === 'string'
          ? preferredCurrency.replace(/[^A-Za-z0-9]/g, '').slice(0, 5).toUpperCase() || 'USD'
          : 'USD';

      // Concurrency guard to prevent container memory exhaustion
      releaseTicket = await aiLimiter.acquire(8000);

      const ai = getGeminiClient();
      const todayIso = new Date().toISOString().slice(0, 10);

      const prompt = `You are an expert personal finance and transaction parser for an Android expense tracking application.
Analyze the provided receipt image, e-wallet transaction history screenshot, bank statement, or transaction message text.
Current date reference: ${todayIso}.
User's preferred currency fallback: ${sanitizedCurrency}.

IMPORTANT INSTRUCTIONS FOR TRANSACTION STATEMENTS & E-WALLETS (e.g. Touch 'n Go eWallet, GrabPay, Boost, Apple Pay, Online Banking, SMS):
1. If the image/text contains a transaction history or multiple transactions (such as a Touch 'n Go eWallet History screen, bank statement, or multiple line items):
   - Extract EVERY SINGLE individual transaction visible on the screen. Do NOT omit any transaction. Do NOT combine them into one.
   - For Touch 'n Go (TNG) eWallet history:
     * Dates like "08 Sep, 21:31" under header "SEPTEMBER 26" or range "01 Sep 26 - 08 Sep 26" belong to year 2026 -> Date: 2026-09-08, Time: 21:31.
     * Items with minus (e.g. "-RM16.69", "-RM2.50", "-RM4.20", "-RM2.00", "Payment", "PayDirect Payment", "Transfer to Wallet") are EXPENSES ('expense').
     * Items with plus (e.g. "+RM2.50", "+RM7.50", "Receive from HON CHENG YIN", "Receive from Wallet") are INCOME ('income').
     * Exit Toll items (e.g. "Exit Toll: PANTAI", "Exit Toll: DAMANSARA") -> Category: 'Transportation'.
     * Online retail (e.g. "TAOBAO", "Shopee", "Lazada") -> Category: 'Shopping'.
     * Person transfers (e.g. "Transfer to GAN YONG SENG", "Receive from HON CHENG YIN") -> Category: 'Other' or 'Gift'.
     * Set paymentMethod to 'E-Wallet'.
     * For currency "RM", output "MYR".
2. If the image is a single physical paper receipt (e.g. restaurant, grocery, coffee shop):
   - Extract that single transaction into the 'transactions' array with 1 item.
   - Extract line items if visible.

For every transaction in 'transactions':
- 'merchant': Vendor, merchant, toll, or recipient/sender name (e.g. 'TAOBAO', 'Exit Toll: PANTAI', 'HON CHENG YIN', 'GAN YONG SENG').
- 'amount': Positive floating-point number (e.g. 16.69, 2.50, 4.20). Do not include minus or currency signs in the amount.
- 'type': 'expense' if money left the account / payment / purchase; 'income' if money was received / reload / refund / salary.
- 'currency': 3-letter currency code (e.g. MYR, USD, SGD, EUR, GBP). Convert 'RM' to 'MYR'.
- 'date': YYYY-MM-DD format.
- 'time': HH:mm format if available.
- 'category': Exactly ONE of:
  * 'Food & Dining' (restaurants, cafes, food delivery)
  * 'Groceries' (supermarkets, grocery stores)
  * 'Transportation' (tolls, Grab, taxi, parking, petrol, trains, buses)
  * 'Shopping' (retail, Taobao, clothing, electronics)
  * 'Utilities & Bills' (electricity, water, phone, internet, subscriptions)
  * 'Entertainment' (games, movies, concerts)
  * 'Health & Medical' (pharmacy, doctor, dental)
  * 'Personal Care' (haircut, spa, cosmetics)
  * 'Education & Books' (tuition, courses, books)
  * 'Travel & Lodging' (flights, hotels)
  * 'Work & Business' (stationery, office)
  * 'Other' (miscellaneous, person-to-person transfers)
- 'paymentMethod': One of: 'E-Wallet', 'Credit Card', 'Debit Card', 'Cash', 'Bank Transfer', or 'Other'.
- 'summary': Short clean summary.
- 'tags': 2 to 3 relevant tags (e.g. ['tng', 'toll'], ['tng', 'taobao']).`;

      const contentsParts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [];

      if (imageBase64) {
        // Strip data:image/...;base64, prefix if present
        let cleanBase64 = imageBase64;
        let detectedMime = normalizedMime;
        if (imageBase64.includes(';base64,')) {
          const parts = imageBase64.split(';base64,');
          detectedMime = parts[0].replace('data:', '');
          cleanBase64 = parts[1];
        }

        contentsParts.push({
          inlineData: {
            mimeType: ALLOWED_MIME_TYPES.has(detectedMime) ? detectedMime : 'image/jpeg',
            data: cleanBase64,
          },
        });
      }

      if (text) {
        contentsParts.push({
          text: `Transaction description/text to analyze:\n${text.slice(0, 4000)}`,
        });
      }

      contentsParts.push({
        text: prompt,
      });

      const response = await generateWithFallback(ai, {
        contents: { parts: contentsParts as any },
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              statementSource: {
                type: Type.STRING,
                description: 'Detected source if applicable (e.g. Touch n Go eWallet, GrabPay, Bank Statement, Single Receipt).',
              },
              isMultipleTransactions: {
                type: Type.BOOLEAN,
                description: 'True if multiple transactions were detected.',
              },
              transactions: {
                type: Type.ARRAY,
                description: 'Array of all transactions extracted. Even for a single receipt, include it as 1 item here.',
                items: {
                  type: Type.OBJECT,
                  properties: {
                    merchant: {
                      type: Type.STRING,
                      description: 'Store or vendor name, recipient, or toll station.',
                    },
                    amount: {
                      type: Type.NUMBER,
                      description: 'Total transaction amount as a positive number.',
                    },
                    type: {
                      type: Type.STRING,
                      description: 'Either "expense" or "income".',
                    },
                    currency: {
                      type: Type.STRING,
                      description: '3-letter currency code (e.g. MYR, USD, EUR). If RM is seen, use MYR.',
                    },
                    date: {
                      type: Type.STRING,
                      description: 'Date in YYYY-MM-DD format.',
                    },
                    time: {
                      type: Type.STRING,
                      description: 'Time in HH:mm format if identifiable, or empty string.',
                    },
                    category: {
                      type: Type.STRING,
                      description: 'One of the specified expense categories.',
                    },
                    confidence: {
                      type: Type.STRING,
                      description: 'Confidence rating: high, medium, or low.',
                    },
                    paymentMethod: {
                      type: Type.STRING,
                      description: 'Payment method: E-Wallet, Credit Card, Debit Card, Cash, Bank Transfer, or Other.',
                    },
                    items: {
                      type: Type.ARRAY,
                      description: 'Itemized line items from the receipt if applicable.',
                      items: {
                        type: Type.OBJECT,
                        properties: {
                          name: { type: Type.STRING },
                          quantity: { type: Type.NUMBER },
                          price: { type: Type.NUMBER },
                        },
                        required: ['name'],
                      },
                    },
                    tax: {
                      type: Type.NUMBER,
                      description: 'Tax or VAT amount if shown, or 0.',
                    },
                    tip: {
                      type: Type.NUMBER,
                      description: 'Tip amount if shown, or 0.',
                    },
                    summary: {
                      type: Type.STRING,
                      description: 'Concise 1-sentence note of the transaction.',
                    },
                    tags: {
                      type: Type.ARRAY,
                      items: { type: Type.STRING },
                      description: '2 to 4 relevant keyword tags.',
                    },
                  },
                  required: ['merchant', 'amount', 'type', 'category', 'date'],
                },
              },
            },
            required: ['transactions'],
          },
        },
      });

      const responseText = response.text || '{}';
      let parsed: any;
      try {
        parsed = JSON.parse(responseText);
      } catch {
        parsed = {
          transactions: [
            {
              merchant: 'Unknown Merchant',
              amount: 0,
              type: 'expense',
              currency: sanitizedCurrency,
              date: todayIso,
              category: 'Other',
              summary: 'Receipt uploaded',
              tags: ['receipt'],
            },
          ],
        };
      }

      // Normalize transactions array
      if (!Array.isArray(parsed.transactions) || parsed.transactions.length === 0) {
        // Build single transaction from top-level fields if transactions array wasn't populated
        parsed.transactions = [
          {
            merchant: parsed.merchant || 'Unknown Merchant',
            amount: Number(parsed.amount) || 0,
            type: parsed.type === 'income' ? 'income' : 'expense',
            currency: parsed.currency || sanitizedCurrency,
            date: parsed.date || todayIso,
            time: parsed.time || '',
            category: parsed.category || 'Other',
            paymentMethod: parsed.paymentMethod || 'Credit Card',
            summary: parsed.summary || 'Uploaded transaction',
            tags: Array.isArray(parsed.tags) ? parsed.tags : ['receipt'],
          },
        ];
      }

      // Sanitize each transaction
      parsed.transactions = parsed.transactions.map((tx: any) => {
        let cur = (tx.currency || sanitizedCurrency).trim().toUpperCase();
        if (cur === 'RM') cur = 'MYR';

        return {
          merchant: (tx.merchant || 'Unknown Merchant').trim(),
          amount: Math.abs(Number(tx.amount)) || 0,
          type: tx.type === 'income' ? 'income' : 'expense',
          currency: cur,
          date: tx.date || todayIso,
          time: tx.time || '',
          category: tx.category || 'Other',
          confidence: tx.confidence || 'high',
          paymentMethod: tx.paymentMethod || 'E-Wallet',
          summary: (tx.summary || `${tx.type === 'income' ? 'Received' : 'Paid'} ${cur} ${tx.amount}`).trim(),
          items: Array.isArray(tx.items) ? tx.items : undefined,
          tax: Number(tx.tax) || 0,
          tip: Number(tx.tip) || 0,
          tags: Array.isArray(tx.tags) && tx.tags.length > 0 ? tx.tags : [cur.toLowerCase(), tx.type || 'expense'],
        };
      });

      parsed.isMultipleTransactions = parsed.transactions.length > 1;

      // Populate top-level fields for backwards compatibility
      const first = parsed.transactions[0];
      parsed.merchant = first.merchant;
      parsed.amount = first.amount;
      parsed.type = first.type;
      parsed.currency = first.currency;
      parsed.date = first.date;
      parsed.time = first.time;
      parsed.category = first.category;
      parsed.paymentMethod = first.paymentMethod;
      parsed.summary = first.summary;
      parsed.tags = first.tags;

      res.json({
        success: true,
        data: parsed,
      });
    } catch (error: any) {
      console.error('Error analyzing receipt:', sanitizeErrorMessage(error?.message || ''));
      const status = error?.message === 'SERVER_OVERLOAD' ? 503 : 500;
      res.status(status).json({
        success: false,
        error: formatGeminiError(error),
      });
    } finally {
      if (releaseTicket) releaseTicket();
    }
  });

  // Quick category suggestion for manually typed expenses
  app.post('/api/suggest-category', suggestCategoryLimiter, async (req, res) => {
    let releaseTicket: (() => void) | null = null;
    try {
      const { text } = req.body;
      if (!text || typeof text !== 'string') {
        return res.status(400).json({ success: false, error: 'Text description is required.' });
      }

      // Validate input length
      const cleanText = text.trim().slice(0, 500);
      if (!cleanText) {
        return res.status(400).json({ success: false, error: 'Valid text is required.' });
      }

      releaseTicket = await aiLimiter.acquire(6000);

      const ai = getGeminiClient();
      const response = await generateWithFallback(ai, {
        contents: `Based on the expense description "${cleanText}", identify the best category:
Categories: Food & Dining, Groceries, Transportation, Shopping, Utilities & Bills, Entertainment, Health & Medical, Personal Care, Education & Books, Travel & Lodging, Work & Business, Other.
Return JSON with { "category": string, "suggestedTags": string[] }`,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              category: { type: Type.STRING },
              suggestedTags: { type: Type.ARRAY, items: { type: Type.STRING } },
            },
            required: ['category'],
          },
        },
      });

      const data = JSON.parse(response.text || '{}');
      res.json({ success: true, data });
    } catch (error: any) {
      console.error('Suggest category error:', sanitizeErrorMessage(error?.message || ''));
      const status = error?.message === 'SERVER_OVERLOAD' ? 503 : 500;
      res.status(status).json({ success: false, error: formatGeminiError(error) });
    } finally {
      if (releaseTicket) releaseTicket();
    }
  });

  // Natural Language Quick Add Expense API
  app.post('/api/quick-add-expense', quickAddLimiter, async (req, res) => {
    let releaseTicket: (() => void) | null = null;
    try {
      const { text, preferredCurrency = 'MYR', referenceDate } = req.body;
      if (!text || typeof text !== 'string') {
        return res.status(400).json({ success: false, error: 'Text description is required.' });
      }

      const cleanText = text.trim().slice(0, 1000);
      if (!cleanText) {
        return res.status(400).json({ success: false, error: 'Valid text is required.' });
      }

      const todayIso =
        referenceDate && /^\d{4}-\d{2}-\d{2}$/.test(referenceDate)
          ? referenceDate
          : new Date().toISOString().slice(0, 10);

      const sanitizedCurrency =
        typeof preferredCurrency === 'string'
          ? preferredCurrency.replace(/[^A-Za-z0-9]/g, '').slice(0, 5).toUpperCase() || 'MYR'
          : 'MYR';

      releaseTicket = await aiLimiter.acquire(6000);

      const ai = getGeminiClient();

      const prompt = `You are an expert natural language expense and transaction parser.
The user wants to record an expense or income by typing naturally in a conversational chat input.
Reference date today: ${todayIso}.
User's default currency: ${sanitizedCurrency}.

User input: "${cleanText}"

Extract the transaction details into JSON:
- 'merchant': Vendor, merchant, shop, person, or income source name (e.g. "McDonald's", "Grab", "Starbucks", "Monthly Salary").
- 'amount': Floating-point number (e.g. 18.50). Must be positive.
- 'type': 'expense' if it's spending/payment/purchase/cost; 'income' if it's salary/reload/refund/earnings/dividend. Defaults to 'expense'.
- 'currency': 3-letter currency code (e.g. MYR, USD, SGD, EUR). If "RM" or "$" is detected, map appropriately (RM -> MYR; $ defaults to user's currency or USD).
- 'category': Exactly ONE of:
  * 'Food & Dining' (restaurants, cafe, lunch, dinner, breakfast, drinks, McDonald's, KFC, Starbucks)
  * 'Groceries' (supermarket, vegetables, mart, Village Grocer, Lotus)
  * 'Transportation' (Grab, taxi, MRT, bus, petrol, fuel, parking, toll)
  * 'Shopping' (clothes, electronics, Shopee, Lazada, retail)
  * 'Utilities & Bills' (electricity, water, phone, internet, wifi, unifi, rent, subscription)
  * 'Entertainment' (movies, games, cinema, Netflix)
  * 'Health & Medical' (pharmacy, clinic, doctor, medicine)
  * 'Personal Care' (haircut, spa, skincare)
  * 'Education & Books' (books, courses, tuition)
  * 'Travel & Lodging' (hotel, flight, Airbnb)
  * 'Work & Business' (stationery, software, office)
  * 'Salary' (monthly salary, wages)
  * 'Freelance' (freelance, contract, gig)
  * 'Investment' (dividend, stocks, crypto)
  * 'Gift' (gift, angpow)
  * 'Other' (miscellaneous)
- 'date': YYYY-MM-DD format. Handle relative dates like "today" -> ${todayIso}, "yesterday", "2 days ago", or specific dates.
- 'time': HH:mm format if specified, or current time if available.
- 'paymentMethod': One of: 'Credit Card', 'Debit Card', 'Cash', 'E-Wallet', 'Bank Transfer', or 'Other'. If e-wallet, TNG, Touch n Go, GrabPay, Apple Pay is mentioned, use 'E-Wallet'. If card or credit card, use 'Credit Card'. If cash, use 'Cash'.
- 'summary': Short clean summary of what was purchased or received.
- 'tags': Array of 2 to 4 relevant keyword tags.`;

      const response = await generateWithFallback(ai, {
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              merchant: { type: Type.STRING },
              amount: { type: Type.NUMBER },
              type: { type: Type.STRING },
              currency: { type: Type.STRING },
              category: { type: Type.STRING },
              date: { type: Type.STRING },
              time: { type: Type.STRING },
              paymentMethod: { type: Type.STRING },
              summary: { type: Type.STRING },
              tags: { type: Type.ARRAY, items: { type: Type.STRING } },
            },
            required: ['merchant', 'amount', 'category', 'date'],
          },
        },
      });

      const parsed = JSON.parse(response.text || '{}');

      let cur = (parsed.currency || sanitizedCurrency).trim().toUpperCase();
      if (cur === 'RM') cur = 'MYR';

      const result = {
        merchant: (parsed.merchant || 'Unknown Merchant').trim(),
        amount: Math.abs(Number(parsed.amount)) || 0,
        type: parsed.type === 'income' ? 'income' : 'expense',
        currency: cur,
        category: parsed.category || 'Food & Dining',
        date: parsed.date || todayIso,
        time: parsed.time || new Date().toTimeString().slice(0, 5),
        paymentMethod: parsed.paymentMethod || 'E-Wallet',
        summary: parsed.summary || cleanText,
        tags: Array.isArray(parsed.tags) ? parsed.tags : [cur.toLowerCase()],
      };

      res.json({ success: true, data: result });
    } catch (error: any) {
      console.error('Quick add expense error:', sanitizeErrorMessage(error?.message || ''));
      const status = error?.message === 'SERVER_OVERLOAD' ? 503 : 500;
      res.status(status).json({ success: false, error: formatGeminiError(error) });
    } finally {
      if (releaseTicket) releaseTicket();
    }
  });

  // AI Financial Insights generation using aggregated summary metrics
  app.post('/api/financial-insights', financialInsightsLimiter, async (req, res) => {
    let releaseTicket: (() => void) | null = null;
    try {
      const { summary, daysRemaining = 15 } = req.body;
      if (!summary || typeof summary !== 'object') {
        return res.status(400).json({ success: false, error: 'Aggregated financial summary object is required.' });
      }

      const summaryStr = JSON.stringify(summary);
      if (summaryStr.length > 50000) {
        return res.status(400).json({ success: false, error: 'Summary payload exceeds safe size limit.' });
      }

      const safeDays = Math.max(0, Math.min(31, Number(daysRemaining) || 15));
      const currencySymbol = String(summary.currencySymbol || 'RM').slice(0, 5);

      releaseTicket = await aiLimiter.acquire(8000);

      const ai = getGeminiClient();

      const prompt = `You are an expert personal financial insights advisor for a privacy-first expense management app.
Analyze the provided deterministic financial statistics and generate 3 to 5 concise, highly actionable, human-friendly financial observations.

STRICT ACCURACY RULES:
- Never invent or fabricate financial numbers. Use the exact numbers, percentages, and currencies provided in the statistics.
- Frame observations with non-prescriptive, friendly language: "Based on your spending pattern...", "Your current spending rate suggests...", "You spent X% more on...", "You saved RM...".
- Never give strict financial or investment advice.
- Balance constructive warnings with positive reinforcement and achievements.

Categories of insight:
- spending_increase (e.g., spent more on category compared to last month)
- spending_decrease (e.g., spent less or saved on category)
- unusual_spending (e.g., higher than normal single transaction)
- budget_warning (e.g., used 80%+ of budget or projected to exceed)
- budget_exceeded (e.g., currently over budget)
- positive (e.g., staying within budget, spending reductions)
- saving_opportunity (e.g., potential area to trim)

Severity levels:
- info (neutral observation)
- positive (good financial behavior)
- warning (approaching limit or rate spike)
- critical (exceeded budget limit)

Aggregated statistics for Month ${String(summary.currentMonthKey || '').slice(0, 10)}:
${summaryStr}
Days remaining in month: ${safeDays}`;

      const response = await generateWithFallback(ai, {
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              insights: {
                type: Type.ARRAY,
                description: 'List of 3-5 concise financial insights.',
                items: {
                  type: Type.OBJECT,
                  properties: {
                    type: {
                      type: Type.STRING,
                      description: 'One of: spending_increase, spending_decrease, unusual_spending, budget_warning, budget_exceeded, positive, saving_opportunity',
                    },
                    title: { type: Type.STRING, description: 'Short 3-5 word title' },
                    description: { type: Type.STRING, description: '1-2 sentence friendly observation with exact numbers' },
                    category: { type: Type.STRING, description: 'Category name if relevant' },
                    severity: { type: Type.STRING, description: 'info, positive, warning, or critical' },
                    value: { type: Type.NUMBER, description: 'Relevant numeric value (percentage or amount)' },
                    metric: { type: Type.STRING, description: 'Short badge metric e.g. +18% MoM or 82% used' },
                    recommendation: { type: Type.STRING, description: 'Optional 1-sentence tip or actionable suggestion' },
                  },
                  required: ['type', 'title', 'description', 'severity'],
                },
              },
            },
            required: ['insights'],
          },
        },
      });

      const parsed = JSON.parse(response.text || '{"insights":[]}');
      const formattedInsights = (parsed.insights || []).map((ins: any, idx: number) => ({
        ...ins,
        id: `ai-insight-${idx}-${Date.now()}`,
        calculatedAt: Date.now(),
      }));

      res.json({ success: true, data: { insights: formattedInsights } });
    } catch (error: any) {
      console.warn('Financial insights warning (falling back):', sanitizeErrorMessage(error?.message || ''));
      res.json({
        success: true,
        fallback: true,
        data: { insights: [] },
        message: formatGeminiError(error),
      });
    } finally {
      if (releaseTicket) releaseTicket();
    }
  });

  const SERVER_START_TIME = new Date().toISOString();

  // Version check endpoint for PWA client update detection
  app.get('/api/version', (_req, res) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.json({
      version: '2.5.0',
      buildTime: SERVER_START_TIME,
      timestamp: Date.now(),
    });
  });

  // Create the HTTP server so Vite HMR can share the same port/WebSocket upgrade path.
  const httpServer = http.createServer(app);

  // Vite middleware for development or Static serving for production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        // Attach HMR to the Express HTTP server so the client WebSocket connects
        // over the same host/port (required behind proxied preview environments).
        hmr: {
          server: httpServer,
        },
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    // Security & Cache Control: Ensure Service Worker and HTML are NEVER stuck in cache
    app.use(
      express.static(distPath, {
        dotfiles: 'ignore',
        setHeaders: (res, filePath) => {
          const lower = filePath.toLowerCase();
          // Service Worker scripts and Web App Manifests must ALWAYS be fetched fresh
          if (
            lower.endsWith('sw.js') ||
            lower.endsWith('registersw.js') ||
            lower.includes('workbox-') ||
            lower.endsWith('.webmanifest') ||
            lower.endsWith('manifest.json')
          ) {
            res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
            res.setHeader('Pragma', 'no-cache');
            res.setHeader('Expires', '0');
          } else if (lower.endsWith('index.html')) {
            // HTML entry point must always revalidate to avoid loading outdated hashed JS bundles
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
            res.setHeader('Pragma', 'no-cache');
            res.setHeader('Expires', '0');
          } else if (filePath.includes(path.sep + 'assets' + path.sep) || filePath.match(/\.[a-f0-9]{8,}\./i)) {
            // Vite hashed bundle chunks can be safely cached
            res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
          } else {
            // Images, icons, and other assets
            res.setHeader('Cache-Control', 'public, max-age=3600, must-revalidate');
          }
        },
      })
    );

    // Fallback for SPA navigation - must also enforce no-cache for index.html
    app.get('*', (_req, res) => {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running securely on http://0.0.0.0:${PORT}`);
  });
}

startServer();
