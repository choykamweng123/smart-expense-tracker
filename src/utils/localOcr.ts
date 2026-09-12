import Tesseract from 'tesseract.js';
import { ExpenseCategory, ParsedReceiptData, PaymentMethod, TransactionType } from '../types';

export interface LocalOCRResult {
  statementSource?: string;
  isMultipleTransactions?: boolean;
  transactions: ParsedReceiptData[];
  rawText: string;
  ocrConfidenceScore: number; // 0 to 100%
  characterConfidence: number; // Raw Tesseract OCR character recognition score (0-100%)
  hasValidAmount: boolean;
  hasValidMerchant: boolean;
  hasValidDate: boolean;
}

export const LOCAL_OCR_CONFIDENCE_THRESHOLD = 70; // 70% confidence threshold for local OCR acceptance

// Keyword-based category classification dictionary
const CATEGORY_KEYWORDS: Record<ExpenseCategory, string[]> = {
  'Food & Dining': [
    'kopitiam', 'cafe', 'coffee', 'starbucks', 'mcdonald', 'kfc', 'restaurant',
    'bistro', 'food', 'bakery', 'tea', 'nasi', 'mee', 'pizza', 'burger',
    'roti', 'toast', 'dining', 'kitchen', 'bar', 'sushi', 'ramen', 'snack',
  ],
  'Groceries': [
    'grocer', 'supermarket', 'mart', 'hypermarket', 'jaya grocer', 'village grocer',
    'lotus', 'aeon', 'giant', 'mydin', 'fresh', 'vegetable', 'fruit', 'market',
    'convenience', '7-eleven', '99 speedmart', 'family mart', 'kk mart',
  ],
  'Transportation': [
    'toll', 'pantai', 'damansara', 'plus', 'paydirect', 'touch n go', 'tng',
    'grab', 'taxi', 'petronas', 'shell', 'caltex', 'petron', 'fuel', 'petrol',
    'mrt', 'lrt', 'ktm', 'rapid', 'parking', 'touch \'n go', 'transit',
  ],
  'Shopping': [
    'taobao', 'shopee', 'lazada', 'amazon', 'retail', 'clothing', 'fashion',
    'uniqlo', 'zara', 'h&m', 'electronics', 'gadget', 'watsons', 'guardian',
    'decathlon', 'ikea', 'store', 'mall',
  ],
  'Utilities & Bills': [
    'tnb', 'tenaga', 'water', 'air selangor', 'syabas', 'unifi', 'maxis',
    'celcom', 'digi', 'umobile', 'time internet', 'astro', 'electricity',
    'bill', 'coway', 'cuckoo', 'rental', 'rent', 'maintenance',
  ],
  'Entertainment': [
    'netflix', 'spotify', 'cinema', 'gsc', 'tgv', 'steam', 'game', 'playstation',
    'movie', 'disney', 'youtube', 'concert', 'karaoke',
  ],
  'Health & Medical': [
    'pharmacy', 'clinic', 'klinik', 'hospital', 'doctor', 'dental', 'dentist',
    'optical', 'caring', 'alpro', 'medicine', 'health', 'lab',
  ],
  'Personal Care': [
    'salon', 'haircut', 'barber', 'spa', 'massage', 'cosmetics', 'beauty',
    'skincare', 'fitness', 'gym',
  ],
  'Education & Books': [
    'popular', 'kinokuniya', 'mph', 'book', 'stationery', 'tuition', 'course',
    'udemy', 'school', 'university', 'exam',
  ],
  'Travel & Lodging': [
    'hotel', 'resort', 'airbnb', 'flight', 'airasia', 'malaysia airlines',
    'agoda', 'booking.com', 'travel', 'trip',
  ],
  'Work & Business': [
    'office', 'coworking', 'software', 'adobe', 'google', 'aws', 'domain',
    'zoom', 'github', 'subscription',
  ],
  'Other': [],
};

export function detectCategoryFromText(text: string): ExpenseCategory {
  const lower = text.toLowerCase();
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (category === 'Other') continue;
    for (const kw of keywords) {
      if (lower.includes(kw)) {
        return category as ExpenseCategory;
      }
    }
  }
  return 'Other';
}

export function detectPaymentMethodFromText(text: string): PaymentMethod {
  const lower = text.toLowerCase();
  if (lower.includes('tng') || lower.includes('touch') || lower.includes('wallet') || lower.includes('grabpay') || lower.includes('boost') || lower.includes('paydirect') || lower.includes('apple pay') || lower.includes('google pay')) {
    return 'E-Wallet';
  }
  if (lower.includes('visa') || lower.includes('mastercard') || lower.includes('credit card') || lower.includes('amex')) {
    return 'Credit Card';
  }
  if (lower.includes('debit') || lower.includes('mydebit')) {
    return 'Debit Card';
  }
  if (lower.includes('fpx') || lower.includes('transfer') || lower.includes('duitnow') || lower.includes('maybank') || lower.includes('cimb') || lower.includes('public bank')) {
    return 'Bank Transfer';
  }
  if (lower.includes('cash') || lower.includes('tunai') || lower.includes('change')) {
    return 'Cash';
  }
  return 'E-Wallet';
}

/**
 * Parses raw text extracted by local OCR into structured transaction(s)
 */
export function parseOcrTextToTransactions(rawText: string, defaultCurrency = 'MYR'): LocalOCRResult {
  const lines = rawText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const todayStr = new Date().toISOString().slice(0, 10);
  const nowTime = new Date().toTimeString().slice(0, 5);

  let detectedCurrency = defaultCurrency;
  if (/RM\s*\d|MYR/i.test(rawText)) detectedCurrency = 'MYR';
  else if (/\$\s*\d|USD/i.test(rawText)) detectedCurrency = 'USD';
  else if (/SGD/i.test(rawText)) detectedCurrency = 'SGD';
  else if (/EUR|€/i.test(rawText)) detectedCurrency = 'EUR';
  else if (/GBP|£/i.test(rawText)) detectedCurrency = 'GBP';

  // 1. Detect if this is an e-wallet multi-transaction statement (like Touch 'n Go)
  const isTngStatement = /touch\s*['’n\s]*go|tng\s*ewallet|paydirect|transfer to wallet|receive from/i.test(rawText);
  const statementTransactions: ParsedReceiptData[] = [];

  // Look for lines formatted like: "08 Sep, 21:31" or "08 Sep 26" or "TAOBAO -RM16.69"
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Pattern: -RM16.69 or +RM2.50 or - 16.69 or + 2.50
    const amountMatch = line.match(/([+-])\s*(?:RM|MYR|\$)?\s*([0-9]+[.,][0-9]{2})/i);
    if (amountMatch) {
      const sign = amountMatch[1];
      const amt = parseFloat(amountMatch[2].replace(',', '.'));
      const isIncome = sign === '+';

      // Find nearby merchant name (current line or previous line)
      let merchantName = line.replace(/([+-])\s*(?:RM|MYR|\$)?\s*([0-9]+[.,][0-9]{2})/i, '').trim();
      if (!merchantName && i > 0) {
        merchantName = lines[i - 1];
      }
      if (!merchantName || merchantName.length < 2) {
        merchantName = isIncome ? 'Transfer In / Receive' : 'E-Wallet Payment';
      }

      // Clean up common prefixes
      merchantName = merchantName
        .replace(/^payment\s*-\s*/i, '')
        .replace(/^paydirect\s*-\s*/i, '')
        .trim();

      const cat = detectCategoryFromText(merchantName);
      statementTransactions.push({
        merchant: merchantName,
        amount: amt,
        type: (isIncome ? 'income' : 'expense') as TransactionType,
        currency: detectedCurrency,
        date: todayStr,
        time: nowTime,
        category: cat,
        confidence: 'medium',
        paymentMethod: 'E-Wallet',
        summary: `${isIncome ? 'Received' : 'Paid'} ${detectedCurrency} ${amt.toFixed(2)} (${merchantName})`,
        tags: [detectedCurrency.toLowerCase(), isIncome ? 'income' : 'expense', 'local-ocr'],
      });
    }
  }

  if (statementTransactions.length > 1) {
    return {
      statementSource: isTngStatement ? "Touch 'n Go eWallet" : 'E-Wallet Statement',
      isMultipleTransactions: true,
      transactions: statementTransactions,
      rawText,
      ocrConfidenceScore: 88,
      characterConfidence: 85,
      hasValidAmount: true,
      hasValidMerchant: true,
      hasValidDate: true,
    };
  }

  // 2. Single receipt parsing logic
  let bestMerchant = '';
  let bestAmount = 0;
  let detectedDate = todayStr;
  let detectedTime = nowTime;
  let hasValidDate = false;
  const lineItems: Array<{ name: string; quantity?: number; price?: number }> = [];

  // Find date (e.g. 2026-09-08, 08/09/2026, 08-09-2026, 08 Sep 2026)
  const dateMatch = rawText.match(/(\d{4}[-/.]\d{2}[-/.]\d{2})|(\d{2}[-/.]\d{2}[-/.]\d{4})|(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{2,4})/i);
  if (dateMatch) {
    const rawDate = dateMatch[0];
    try {
      const parsedD = new Date(rawDate);
      if (!isNaN(parsedD.getTime())) {
        detectedDate = parsedD.toISOString().slice(0, 10);
        hasValidDate = true;
      }
    } catch {
      // keep today
    }
  }

  // Find time (e.g. 14:30, 02:15 PM)
  const timeMatch = rawText.match(/(\d{1,2}:\d{2}(?::\d{2})?(?:\s*[AP]M)?)/i);
  if (timeMatch) {
    detectedTime = timeMatch[1].trim();
  }

  // Extract candidate amounts and find TOTAL / GRAND TOTAL
  let foundTotal = false;
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i];
    if (/total|grand\s*total|amount\s*due|net\s*amount|jumlah/i.test(line)) {
      const numMatch = line.match(/(?:RM|MYR|\$)?\s*([0-9]+[.,][0-9]{2})/i);
      if (numMatch) {
        bestAmount = parseFloat(numMatch[1].replace(',', '.'));
        foundTotal = true;
        break;
      }
    }
  }

  // Fallback if no line with "TOTAL" keyword
  if (!foundTotal || bestAmount === 0) {
    const allAmounts: number[] = [];
    const numRegex = /(?:RM|MYR|\$)?\s*([0-9]+[.,][0-9]{2})/gi;
    let match;
    while ((match = numRegex.exec(rawText)) !== null) {
      const val = parseFloat(match[1].replace(',', '.'));
      if (val > 0 && val < 50000) {
        allAmounts.push(val);
      }
    }
    if (allAmounts.length > 0) {
      // Highest number is often the grand total on receipts
      bestAmount = Math.max(...allAmounts);
    }
  }

  // Find merchant name (usually top non-empty line without date/numbers)
  for (let i = 0; i < Math.min(lines.length, 5); i++) {
    const line = lines[i];
    // Ignore lines that look like receipts headers, dates, or tel numbers
    if (
      line.length > 2 &&
      !/^[\d\s\-./:]+$/.test(line) &&
      !/tax invoice|receipt|welcome|cash bill|official receipt/i.test(line)
    ) {
      bestMerchant = line;
      break;
    }
  }

  const hasValidMerchant = Boolean(bestMerchant && bestMerchant.length >= 3);
  if (!bestMerchant) {
    bestMerchant = 'Receipt / Store';
  }

  const hasValidAmount = bestAmount > 0;
  const category = detectCategoryFromText(rawText + ' ' + bestMerchant);
  const paymentMethod = detectPaymentMethodFromText(rawText);

  // Compute composite extraction confidence
  let extractionScore = 0;
  if (hasValidAmount) extractionScore += 45;
  if (foundTotal) extractionScore += 15;
  if (hasValidMerchant) extractionScore += 20;
  if (hasValidDate) extractionScore += 20;

  return {
    statementSource: 'Physical Receipt (Local OCR)',
    isMultipleTransactions: false,
    transactions: [
      {
        merchant: bestMerchant,
        amount: bestAmount,
        type: 'expense',
        currency: detectedCurrency,
        date: detectedDate,
        time: detectedTime,
        category,
        confidence: extractionScore >= 70 ? 'high' : 'medium',
        paymentMethod,
        summary: `Local OCR: ${bestMerchant}`,
        items: lineItems,
        tags: ['local-ocr', category.toLowerCase()],
      },
    ],
    rawText,
    ocrConfidenceScore: extractionScore,
    characterConfidence: 75,
    hasValidAmount,
    hasValidMerchant,
    hasValidDate,
  };
}

/**
 * Perform 100% on-device OCR using Tesseract.js (no API key or network required)
 */
export async function performLocalOCR(
  imageSource: string | File | Blob,
  onProgress?: (progress: number, statusText: string) => void,
  defaultCurrency = 'MYR'
): Promise<LocalOCRResult> {
  if (onProgress) {
    onProgress(10, 'Initializing local OCR engine...');
  }

  try {
    const result = await Tesseract.recognize(imageSource, 'eng', {
      logger: (m) => {
        if (m.status === 'recognizing text' && onProgress) {
          const pct = Math.round((m.progress || 0) * 80) + 15;
          onProgress(Math.min(95, pct), `Reading receipt text locally (${Math.round((m.progress || 0) * 100)}%)...`);
        }
      },
    });

    if (onProgress) {
      onProgress(98, 'Parsing transaction details...');
    }

    const text = result?.data?.text || '';
    const rawConfidence = typeof result?.data?.confidence === 'number' ? result.data.confidence : 75;
    const parsed = parseOcrTextToTransactions(text, defaultCurrency);

    // Compute composite overall OCR confidence score (0 to 100%)
    // 50% from Tesseract character recognition confidence + 50% from structured field extraction
    const combinedScore = Math.round(
      (rawConfidence * 0.45) + (parsed.ocrConfidenceScore * 0.55)
    );

    parsed.characterConfidence = Math.round(rawConfidence);
    parsed.ocrConfidenceScore = Math.min(100, Math.max(10, combinedScore));

    if (onProgress) {
      onProgress(100, 'OCR Complete');
    }

    return parsed;
  } catch (error: any) {
    console.error('Local OCR execution failed:', error);
    throw new Error(error?.message || 'Local OCR failed to process image.');
  }
}
