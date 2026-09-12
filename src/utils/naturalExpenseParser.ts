import { ExpenseCategory, PaymentMethod, TransactionType } from '../types';

export interface QuickAddExtractedExpense {
  merchant: string;
  amount: number;
  currency: string;
  category: ExpenseCategory;
  type: TransactionType;
  date: string;
  time?: string;
  paymentMethod: PaymentMethod;
  summary?: string;
  tags?: string[];
  source: 'ai' | 'local_heuristic';
}

/**
 * Local-First Heuristic Rule-Based Parser
 * Runs offline instantly without network latency or when offline.
 */
export function parseLocalExpenseHeuristic(
  rawInput: string,
  preferredCurrency: string = 'MYR'
): QuickAddExtractedExpense {
  const text = rawInput.trim();
  const lower = text.toLowerCase();

  // 1. Detect Transaction Type (expense vs income)
  let type: TransactionType = 'expense';
  if (
    lower.includes('salary') ||
    lower.includes('received') ||
    lower.includes('earned') ||
    lower.includes('income') ||
    lower.includes('dividend') ||
    lower.includes('bonus') ||
    lower.includes('freelance payment') ||
    lower.includes('got paid') ||
    lower.includes('reload')
  ) {
    type = 'income';
  }

  // 2. Extract Currency & Amount
  let amount = 0;
  let currency = preferredCurrency.toUpperCase();
  if (currency === 'RM') currency = 'MYR';

  // Currency prefixes (RM 18.50, RM18.50, $20, SGD 15, EUR 12.50)
  const currencyMatch = text.match(/(?:RM|MYR|\$|SGD|USD|EUR|GBP)\s*(\d+(?:[.,]\d{1,2})?)/i);
  // Suffixes (18.50 RM, 18.50MYR, 20$)
  const suffixMatch = text.match(/(\d+(?:[.,]\d{1,2})?)\s*(?:RM|MYR|\$|SGD|USD|EUR|GBP)\b/i);
  // Plain number after words like "for", "cost", "total", "spent" (e.g. "for 18.50", "spent 25")
  const forMatch = text.match(/(?:for|cost|spent|worth|total)\s+(?:of\s+)?(?:RM|MYR|\$)?\s*(\d+(?:[.,]\d{1,2})?)/i);
  // Any standalone floating point or number
  const anyNumberMatch = text.match(/\b(\d+(?:[.,]\d{1,2})?)\b/);

  if (currencyMatch) {
    amount = parseFloat(currencyMatch[1].replace(',', '.'));
    if (/RM|MYR/i.test(currencyMatch[0])) currency = 'MYR';
    else if (/\$/i.test(currencyMatch[0])) currency = preferredCurrency || 'USD';
    else if (/SGD/i.test(currencyMatch[0])) currency = 'SGD';
    else if (/EUR/i.test(currencyMatch[0])) currency = 'EUR';
    else if (/GBP/i.test(currencyMatch[0])) currency = 'GBP';
  } else if (suffixMatch) {
    amount = parseFloat(suffixMatch[1].replace(',', '.'));
    if (/RM|MYR/i.test(suffixMatch[0])) currency = 'MYR';
    else if (/\$/i.test(suffixMatch[0])) currency = preferredCurrency || 'USD';
  } else if (forMatch) {
    amount = parseFloat(forMatch[1].replace(',', '.'));
  } else if (anyNumberMatch) {
    amount = parseFloat(anyNumberMatch[1].replace(',', '.'));
  }

  // 3. Extract Date
  const now = new Date();
  let targetDate = now;

  if (lower.includes('yesterday')) {
    targetDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  } else if (lower.includes('day before yesterday')) {
    targetDate = new Date(now.getTime() - 48 * 60 * 60 * 1000);
  } else if (lower.includes('today')) {
    targetDate = now;
  } else {
    // Specific date matches like YYYY-MM-DD, DD/MM/YYYY
    const dateMatchIso = text.match(/(\d{4})-(\d{2})-(\d{2})/);
    const dateMatchSlash = text.match(/(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/);
    if (dateMatchIso) {
      targetDate = new Date(dateMatchIso[0]);
    } else if (dateMatchSlash) {
      const d = parseInt(dateMatchSlash[1], 10);
      const m = parseInt(dateMatchSlash[2], 10) - 1;
      const y = dateMatchSlash[3] ? parseInt(dateMatchSlash[3], 10) : now.getFullYear();
      targetDate = new Date(y < 100 ? 2000 + y : y, m, d);
    }
  }

  const dateStr = !isNaN(targetDate.getTime())
    ? targetDate.toISOString().slice(0, 10)
    : now.toISOString().slice(0, 10);

  const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  // 4. Categorization heuristics
  let category: ExpenseCategory = type === 'income' ? 'Salary' : 'Food & Dining';

  if (type === 'income') {
    if (lower.includes('salary') || lower.includes('wages')) category = 'Salary';
    else if (lower.includes('freelance') || lower.includes('project') || lower.includes('gig')) category = 'Freelance';
    else if (lower.includes('dividend') || lower.includes('interest') || lower.includes('stock')) category = 'Investment';
    else if (lower.includes('bonus')) category = 'Bonus';
    else if (lower.includes('rent') || lower.includes('tenant')) category = 'Rental';
    else if (lower.includes('gift') || lower.includes('angpow') || lower.includes('angpao')) category = 'Gift';
    else category = 'Other';
  } else {
    if (
      lower.includes('mcdonald') ||
      lower.includes('kfc') ||
      lower.includes('starbucks') ||
      lower.includes('lunch') ||
      lower.includes('dinner') ||
      lower.includes('breakfast') ||
      lower.includes('food') ||
      lower.includes('coffee') ||
      lower.includes('kopi') ||
      lower.includes('restaurant') ||
      lower.includes('cafe') ||
      lower.includes('meal') ||
      lower.includes('bak kut teh') ||
      lower.includes('nasi lemak') ||
      lower.includes('roti canai') ||
      lower.includes('boba') ||
      lower.includes('tea')
    ) {
      category = 'Food & Dining';
    } else if (
      lower.includes('grocer') ||
      lower.includes('supermarket') ||
      lower.includes('lotus') ||
      lower.includes('jaya') ||
      lower.includes('aeon') ||
      lower.includes('village grocer') ||
      lower.includes('fruits') ||
      lower.includes('vegetables') ||
      lower.includes('eggs') ||
      lower.includes('milk') ||
      lower.includes('market')
    ) {
      category = 'Groceries';
    } else if (
      lower.includes('grab') ||
      lower.includes('mrt') ||
      lower.includes('lrt') ||
      lower.includes('taxi') ||
      lower.includes('petrol') ||
      lower.includes('fuel') ||
      lower.includes('parking') ||
      lower.includes('toll') ||
      lower.includes('transit') ||
      lower.includes('bus') ||
      lower.includes('train') ||
      lower.includes('touch n go') ||
      lower.includes('tng')
    ) {
      category = 'Transportation';
    } else if (
      lower.includes('shopee') ||
      lower.includes('lazada') ||
      lower.includes('taobao') ||
      lower.includes('clothes') ||
      lower.includes('shoes') ||
      lower.includes('bag') ||
      lower.includes('shopping') ||
      lower.includes('mall') ||
      lower.includes('uniqlo')
    ) {
      category = 'Shopping';
    } else if (
      lower.includes('tnb') ||
      lower.includes('electric') ||
      lower.includes('water') ||
      lower.includes('wifi') ||
      lower.includes('unifi') ||
      lower.includes('bill') ||
      lower.includes('utilities') ||
      lower.includes('phone') ||
      lower.includes('telco') ||
      lower.includes('rent') ||
      lower.includes('subscription')
    ) {
      category = 'Utilities & Bills';
    } else if (
      lower.includes('movie') ||
      lower.includes('cinema') ||
      lower.includes('netflix') ||
      lower.includes('game') ||
      lower.includes('concert') ||
      lower.includes('steam')
    ) {
      category = 'Entertainment';
    } else if (
      lower.includes('clinic') ||
      lower.includes('doctor') ||
      lower.includes('hospital') ||
      lower.includes('pharmacy') ||
      lower.includes('guardian') ||
      lower.includes('watsons') ||
      lower.includes('panadol') ||
      lower.includes('medicine')
    ) {
      category = 'Health & Medical';
    } else if (
      lower.includes('flight') ||
      lower.includes('hotel') ||
      lower.includes('airbnb') ||
      lower.includes('airasia') ||
      lower.includes('travel')
    ) {
      category = 'Travel & Lodging';
    } else if (
      lower.includes('haircut') ||
      lower.includes('salon') ||
      lower.includes('spa') ||
      lower.includes('gym')
    ) {
      category = 'Personal Care';
    } else if (
      lower.includes('book') ||
      lower.includes('tuition') ||
      lower.includes('course') ||
      lower.includes('class')
    ) {
      category = 'Education & Books';
    }
  }

  // 5. Payment Method heuristics
  let paymentMethod: PaymentMethod = 'E-Wallet';
  if (lower.includes('cash')) paymentMethod = 'Cash';
  else if (lower.includes('credit card') || lower.includes('credit')) paymentMethod = 'Credit Card';
  else if (lower.includes('debit card') || lower.includes('debit')) paymentMethod = 'Debit Card';
  else if (lower.includes('transfer') || lower.includes('bank') || lower.includes('fpx')) paymentMethod = 'Bank Transfer';
  else if (lower.includes('tng') || lower.includes('touch n go') || lower.includes('grabpay') || lower.includes('ewallet') || lower.includes('apple pay')) paymentMethod = 'E-Wallet';

  // 6. Merchant Extraction heuristics
  // Patterns like: "at McDonald's", "from Village Grocer", "had lunch at KFC", "bought shoes at Nike"
  let merchant = '';
  const atMatch = text.match(/(?:at|from|to|in)\s+([A-Za-z0-9'&.\s\-]+?)(?:\s+(?:today|yesterday|for|worth|cost|\bRM|\$|\d|paid|with|on)\b|$)/i);
  if (atMatch && atMatch[1].trim()) {
    merchant = atMatch[1].trim();
  }

  // Common Malaysian / Global merchants fallback
  if (!merchant) {
    const knownMerchants = [
      "McDonald's",
      'McD',
      'KFC',
      'Starbucks',
      'Village Grocer',
      'Jaya Grocer',
      'Grab',
      'Foodpanda',
      'Shopee',
      'Lazada',
      'Taobao',
      'Petronas',
      'Shell',
      'Uniqlo',
      'Guardian',
      'Watsons',
      'RapidKL',
      'MRT',
      'FamilyMart',
      '7-Eleven',
      'Netflix',
      'Spotify',
      'Apple',
    ];
    for (const km of knownMerchants) {
      if (new RegExp(`\\b${km}\\b`, 'i').test(text)) {
        merchant = km;
        break;
      }
    }
  }

  if (!merchant) {
    if (type === 'income') {
      merchant = 'Income Source';
    } else {
      // Default to Category name or general description
      merchant = category === 'Food & Dining' ? 'Dining / Cafe' : category;
    }
  }

  return {
    merchant,
    amount,
    currency,
    category,
    type,
    date: dateStr,
    time: timeStr,
    paymentMethod,
    summary: text,
    tags: [category.toLowerCase(), currency.toLowerCase()],
    source: 'local_heuristic',
  };
}

/**
 * Main Natural Expense Parsing Function
 * Tries server-side Gemini first, then falls back seamlessly to local heuristic parser.
 */
export async function parseNaturalExpense(
  text: string,
  preferredCurrency: string = 'MYR',
  referenceDate?: string
): Promise<QuickAddExtractedExpense> {
  const trimmed = text.trim();
  if (!trimmed) {
    throw new Error('Please enter an expense description.');
  }

  try {
    const todayStr = referenceDate || new Date().toISOString().slice(0, 10);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 7000);

    const response = await fetch('/api/quick-add-expense', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: trimmed,
        preferredCurrency,
        referenceDate: todayStr,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (response.ok) {
      const json = await response.json();
      if (json.success && json.data) {
        return {
          ...json.data,
          source: 'ai',
        };
      }
    }
  } catch (error) {
    console.warn('AI Quick Add failed or timed out, using local-first heuristic parser:', error);
  }

  // Graceful local offline fallback
  return parseLocalExpenseHeuristic(trimmed, preferredCurrency);
}
