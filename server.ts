import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import { GoogleGenAI, Type } from '@google/genai';
import { createServer as createViteServer } from 'vite';

dotenv.config();

const PORT = 3000;

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

// Fallback models chain: use distinct models with separate quotas
const FALLBACK_MODELS = ['gemini-3.8-flash', 'gemini-3.1-flash-lite'];

async function generateWithFallback(
  ai: GoogleGenAI,
  options: { contents: any; config: any }
) {
  let lastError: any = null;

  for (let i = 0; i < FALLBACK_MODELS.length; i++) {
    const model = FALLBACK_MODELS[i];
    try {
      console.log(`Attempting Gemini call with model: ${model}`);
      const response = await ai.models.generateContent({
        model,
        contents: options.contents,
        config: options.config,
      });
      return response;
    } catch (err: any) {
      lastError = err;
      const errMsg = err?.message || String(err);
      const isTransient =
        errMsg.includes('503') ||
        errMsg.includes('UNAVAILABLE') ||
        errMsg.includes('high demand') ||
        errMsg.includes('429') ||
        errMsg.includes('RESOURCE_EXHAUSTED') ||
        errMsg.includes('quota') ||
        errMsg.includes('overloaded');

      console.warn(`Model ${model} failed (transient: ${isTransient}):`, errMsg);

      // If transient or rate-limited, immediately switch to the next fallback model (e.g. gemini-3.1-flash-lite)
      if (isTransient && i < FALLBACK_MODELS.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 300));
        continue;
      }

      if (!isTransient) {
        throw err;
      }
    }
  }

  throw lastError;
}

function formatGeminiError(error: any): string {
  if (!error) return 'An unexpected error occurred while analyzing the transaction.';
  const msg = error.message || (typeof error === 'string' ? error : JSON.stringify(error));

  if (
    msg.includes('503') ||
    msg.includes('UNAVAILABLE') ||
    msg.includes('high demand') ||
    msg.includes('overloaded')
  ) {
    return 'The AI service is currently experiencing temporary high demand. Please try again in a few moments, or enter details manually.';
  }
  if (msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED') || msg.includes('quota')) {
    return 'AI request limit reached. Please wait a moment and try again.';
  }
  if (msg.includes('GEMINI_API_KEY') || msg.includes('API key')) {
    return 'Gemini API key is not configured or invalid. Please check your environment settings.';
  }

  // Attempt to parse nested JSON error message if returned by SDK
  try {
    const parsed = JSON.parse(msg);
    if (parsed?.error?.message) {
      return parsed.error.message;
    }
  } catch {
    // ignore
  }

  return msg;
}

async function startServer() {
  const app = express();

  // Increase payload limit for receipt photos / scans
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Receipt & Transaction Auto-Categorization API
  app.post('/api/analyze-receipt', async (req, res) => {
    try {
      const { imageBase64, mimeType = 'image/jpeg', text, preferredCurrency = 'USD' } = req.body;

      if (!imageBase64 && !text) {
        return res.status(400).json({
          error: 'Please provide either an image of the receipt/transaction or transaction text.',
        });
      }

      const ai = getGeminiClient();
      const todayIso = new Date().toISOString().slice(0, 10);

      const prompt = `You are an expert personal financial receipt and transaction parser for an Android expense tracking application.
Analyze the provided receipt image or transaction message text.
Current date reference: ${todayIso}.
User's preferred currency fallback: ${preferredCurrency}.

Auto-categorize the transaction into exactly ONE of these primary categories:
- 'Food & Dining' (restaurants, coffee, cafes, takeout, fast food, food delivery)
- 'Groceries' (supermarkets, fresh produce, bakeries, butcher)
- 'Transportation' (fuel, petrol, taxi, Grab, Uber, bus, train, tolls, parking)
- 'Shopping' (clothing, electronics, online shopping, household items, gear)
- 'Utilities & Bills' (electricity, water, phone, internet, mobile reload, subscriptions)
- 'Entertainment' (movies, games, concerts, hobbies, clubs)
- 'Health & Medical' (pharmacy, medicine, doctor, dental, optical)
- 'Personal Care' (salon, haircut, spa, skincare, cosmetics)
- 'Education & Books' (courses, books, supplies, tuition)
- 'Travel & Lodging' (flights, hotels, Airbnb, vacations)
- 'Work & Business' (stationery, client meals, office supplies)
- 'Other' (miscellaneous expenses)

Extract the information accurately. If any item is unclear or not present, make the most reasonable estimate or leave empty.
For amount, ensure it is a valid positive floating point number (e.g. 15.50).`;

      const contentsParts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [];

      if (imageBase64) {
        // Strip data:image/...;base64, prefix if present
        let cleanBase64 = imageBase64;
        let detectedMime = mimeType;
        if (imageBase64.includes(';base64,')) {
          const parts = imageBase64.split(';base64,');
          detectedMime = parts[0].replace('data:', '');
          cleanBase64 = parts[1];
        }

        contentsParts.push({
          inlineData: {
            mimeType: detectedMime,
            data: cleanBase64,
          },
        });
      }

      if (text) {
        contentsParts.push({
          text: `Transaction description/text to analyze:\n${text}`,
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
              merchant: {
                type: Type.STRING,
                description: 'Store or vendor name (e.g., Starbucks, Target, Shell, Grab, Trader Joe\'s).',
              },
              amount: {
                type: Type.NUMBER,
                description: 'Total transaction amount as a positive number.',
              },
              currency: {
                type: Type.STRING,
                description: '3-letter currency code (e.g. USD, MYR, EUR, GBP, SGD, JPY).',
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
                description: 'Payment method: Credit Card, Debit Card, Cash, E-Wallet, Bank Transfer, or Other.',
              },
              items: {
                type: Type.ARRAY,
                description: 'Itemized line items from the receipt.',
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
                description: 'Concise 1-sentence note of the purchase.',
              },
              tags: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: '2 to 4 relevant keyword tags.',
              },
            },
            required: ['merchant', 'amount', 'category', 'date'],
          },
        },
      });

      const responseText = response.text || '{}';
      let parsed;
      try {
        parsed = JSON.parse(responseText);
      } catch (err) {
        console.error('Failed to parse Gemini JSON output:', responseText);
        parsed = {
          merchant: 'Unknown Merchant',
          amount: 0,
          currency: preferredCurrency,
          date: todayIso,
          category: 'Other',
          summary: 'Receipt uploaded',
          tags: ['receipt'],
        };
      }

      // Fill in default values if missing
      if (!parsed.currency) parsed.currency = preferredCurrency;
      if (!parsed.date) parsed.date = todayIso;
      if (typeof parsed.amount !== 'number' || isNaN(parsed.amount)) {
        parsed.amount = Number(parsed.amount) || 0;
      }

      res.json({
        success: true,
        data: parsed,
      });
    } catch (error: any) {
      console.error('Error analyzing receipt:', error);
      res.status(500).json({
        success: false,
        error: formatGeminiError(error),
      });
    }
  });

  // Quick category suggestion for manually typed expenses
  app.post('/api/suggest-category', async (req, res) => {
    try {
      const { text } = req.body;
      if (!text) {
        return res.status(400).json({ error: 'Text is required' });
      }

      const ai = getGeminiClient();
      const response = await generateWithFallback(ai, {
        contents: `Based on the expense description "${text}", identify the best category:
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
      console.error('Suggest category error:', error);
      res.status(500).json({ success: false, error: formatGeminiError(error) });
    }
  });

  // AI Financial Insights generation using aggregated summary metrics
  app.post('/api/financial-insights', async (req, res) => {
    try {
      const { summary, daysRemaining = 15 } = req.body;
      if (!summary) {
        return res.status(400).json({ error: 'Aggregated financial summary is required' });
      }

      const ai = getGeminiClient();
      const currencySymbol = summary.currencySymbol || 'RM';

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

Aggregated statistics for Month ${summary.currentMonthKey}:
${JSON.stringify(summary, null, 2)}
Days remaining in month: ${daysRemaining}`;

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
      console.warn('Financial insights error (falling back to deterministic calculation):', error?.message || error);
      res.json({
        success: true,
        fallback: true,
        data: { insights: [] },
        message: formatGeminiError(error),
      });
    }
  });

  // Vite middleware for development or Static serving for production

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
