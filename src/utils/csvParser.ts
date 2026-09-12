import { ExpenseCategory, PaymentMethod, TransactionType } from '../types';
import { detectCategoryFromText, detectPaymentMethodFromText } from './localOcr';

export interface ParsedCsvTransaction {
  date: string;
  time: string;
  merchant: string;
  amount: number;
  type: TransactionType;
  currency: string;
  category: ExpenseCategory;
  paymentMethod: PaymentMethod;
  summary: string;
  tags: string[];
}

/**
 * Parses any standard bank statement, e-wallet, or expense CSV text into transactions
 */
export function parseBankCsv(csvText: string, defaultCurrency = 'MYR'): ParsedCsvTransaction[] {
  const lines = csvText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length < 2) return [];

  // Parse CSV line taking quotes into account
  const parseLine = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"' || char === "'") {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim().replace(/^["']|["']$/g, ''));
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim().replace(/^["']|["']$/g, ''));
    return result;
  };

  const headers = parseLine(lines[0]).map((h) => h.toLowerCase());
  const todayStr = new Date().toISOString().slice(0, 10);

  // Column index finders
  let dateIdx = headers.findIndex((h) => h.includes('date') || h.includes('tarikh') || h.includes('time'));
  let merchantIdx = headers.findIndex((h) => h.includes('merchant') || h.includes('description') || h.includes('payee') || h.includes('details') || h.includes('source') || h.includes('trans') || h.includes('name'));
  let amountIdx = headers.findIndex((h) => h.includes('amount') || h.includes('jumlah') || h.includes('price') || h.includes('total') || h.includes('value'));
  let typeIdx = headers.findIndex((h) => h.includes('type') || h.includes('cr/dr') || h.includes('status'));
  let categoryIdx = headers.findIndex((h) => h.includes('category') || h.includes('kategori'));
  let currencyIdx = headers.findIndex((h) => h.includes('currency') || h.includes('mata wang'));

  if (amountIdx === -1) {
    // If no explicit amount header, find the first numeric column
    amountIdx = 1;
  }
  if (dateIdx === -1) dateIdx = 0;
  if (merchantIdx === -1) merchantIdx = dateIdx === 0 ? 1 : 0;

  const results: ParsedCsvTransaction[] = [];

  for (let r = 1; r < lines.length; r++) {
    const cols = parseLine(lines[r]);
    if (cols.length < 2) continue;

    const rawDate = cols[dateIdx] || todayStr;
    const rawMerchant = cols[merchantIdx] || 'Bank Transaction';
    const rawAmountStr = cols[amountIdx] || '0';
    const rawType = typeIdx !== -1 ? cols[typeIdx] : '';
    const rawCategory = categoryIdx !== -1 ? cols[categoryIdx] : '';
    const rawCurrency = currencyIdx !== -1 ? cols[currencyIdx] : defaultCurrency;

    // Parse numeric amount
    const cleanAmt = parseFloat(rawAmountStr.replace(/[^0-9.-]/g, ''));
    if (isNaN(cleanAmt) || cleanAmt === 0) continue;

    const isNegative = cleanAmt < 0 || /debit|dr|expense|out/i.test(rawType) || /^-/.test(rawAmountStr);
    const isIncome = !isNegative && (/credit|cr|income|in|deposit|reload/i.test(rawType) || cleanAmt > 0 && /salary|deposit|refund/i.test(rawMerchant));
    const finalType: TransactionType = isIncome ? 'income' : 'expense';
    const absAmount = Math.abs(cleanAmt);

    // Format date
    let formattedDate = todayStr;
    let formattedTime = '';
    const dateMatch = rawDate.match(/(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
    const dmyMatch = rawDate.match(/(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);
    if (dateMatch) {
      formattedDate = `${dateMatch[1]}-${dateMatch[2].padStart(2, '0')}-${dateMatch[3].padStart(2, '0')}`;
    } else if (dmyMatch) {
      formattedDate = `${dmyMatch[3]}-${dmyMatch[2].padStart(2, '0')}-${dmyMatch[1].padStart(2, '0')}`;
    }

    const timeMatch = rawDate.match(/(\d{1,2}:\d{2}(?::\d{2})?)/);
    if (timeMatch) {
      formattedTime = timeMatch[1];
    }

    const category = (rawCategory && detectCategoryFromText(rawCategory) !== 'Other')
      ? detectCategoryFromText(rawCategory)
      : detectCategoryFromText(rawMerchant);

    const paymentMethod = detectPaymentMethodFromText(rawMerchant + ' ' + (cols.join(' ')));

    results.push({
      date: formattedDate,
      time: formattedTime,
      merchant: rawMerchant.slice(0, 100).trim(),
      amount: absAmount,
      type: finalType,
      currency: rawCurrency.toUpperCase().trim() || defaultCurrency,
      category,
      paymentMethod,
      summary: `${finalType === 'income' ? 'Received' : 'Paid'} ${absAmount.toFixed(2)} (${rawMerchant})`,
      tags: ['csv-import', finalType],
    });
  }

  return results;
}
