import * as XLSX from 'xlsx';
import { ExpenseCategory, PaymentMethod, TransactionType, Expense } from '../types';
import { detectCategoryFromText, detectPaymentMethodFromText } from './localOcr';
import { ParsedCsvTransaction } from './csvParser';
import { CATEGORY_LIST } from '../data/categories';

/**
 * Standard table column format specification for Excel and CSV imports
 */
export interface SpreadsheetColumnSpec {
  name: string;
  required: boolean;
  example: string;
  description: string;
  aliases: string[];
}

export const SPREADSHEET_TABLE_FORMAT: SpreadsheetColumnSpec[] = [
  {
    name: 'Date',
    required: true,
    example: '2026-09-08',
    description: 'Transaction date (YYYY-MM-DD, DD/MM/YYYY, or MM/DD/YYYY)',
    aliases: ['date', 'tarikh', 'trans_date', 'transaction_date', 'posting_date', 'txn_date'],
  },
  {
    name: 'Merchant',
    required: true,
    example: 'Village Grocer',
    description: 'Store, payee, client, or merchant name / description',
    aliases: ['merchant', 'description', 'payee', 'vendor', 'name', 'details', 'particulars', 'item', 'source'],
  },
  {
    name: 'Amount',
    required: true,
    example: '88.50',
    description: 'Transaction value (number or formatted currency)',
    aliases: ['amount', 'jumlah', 'total', 'price', 'value', 'nominal', 'debit/credit'],
  },
  {
    name: 'Type',
    required: false,
    example: 'Expense',
    description: 'Expense or Income (defaults to Expense unless positive or marked Income/Credit)',
    aliases: ['type', 'jenis', 'status', 'tx_type', 'transaction_type', 'cr/dr', 'dr/cr'],
  },
  {
    name: 'Category',
    required: false,
    example: 'Groceries',
    description: 'Category name (auto-detected if blank)',
    aliases: ['category', 'kategori', 'cat', 'group', 'classification'],
  },
  {
    name: 'Payment Method',
    required: false,
    example: 'Credit Card',
    description: 'Cash, Credit Card, Debit Card, E-Wallet, Bank Transfer, Other',
    aliases: ['payment method', 'payment_method', 'method', 'cara bayaran', 'account', 'wallet', 'bank'],
  },
  {
    name: 'Time',
    required: false,
    example: '14:30',
    description: 'Time of transaction (HH:MM in 24h format)',
    aliases: ['time', 'masa', 'trans_time', 'txn_time'],
  },
  {
    name: 'Currency',
    required: false,
    example: 'MYR',
    description: '3-letter currency code (e.g. MYR, USD, SGD, EUR)',
    aliases: ['currency', 'mata wang', 'curr', 'ccy'],
  },
  {
    name: 'Summary',
    required: false,
    example: 'Weekly fresh grocery restocking',
    description: 'Optional remarks or detailed notes',
    aliases: ['summary', 'notes', 'remark', 'remarks', 'memo', 'nota'],
  },
  {
    name: 'Tags',
    required: false,
    example: 'groceries, food, family',
    description: 'Comma-separated tags for custom filtering',
    aliases: ['tags', 'tag', 'labels', 'label'],
  },
];

/**
 * Format Excel serial date number (e.g. 45200) into YYYY-MM-DD
 */
function parseExcelDate(val: any): { dateStr: string; timeStr: string } {
  const todayStr = new Date().toISOString().slice(0, 10);
  if (!val) return { dateStr: todayStr, timeStr: '' };

  if (typeof val === 'number') {
    // Excel date serial number (days since 1900-01-01)
    const dateObj = new Date(Math.round((val - 25569) * 86400 * 1000));
    if (!isNaN(dateObj.getTime())) {
      const year = dateObj.getUTCFullYear();
      const month = String(dateObj.getUTCMonth() + 1).padStart(2, '0');
      const day = String(dateObj.getUTCDate()).padStart(2, '0');
      const hours = String(dateObj.getUTCHours()).padStart(2, '0');
      const mins = String(dateObj.getUTCMinutes()).padStart(2, '0');
      const hasTime = hours !== '00' || mins !== '00';
      return {
        dateStr: `${year}-${month}-${day}`,
        timeStr: hasTime ? `${hours}:${mins}` : '',
      };
    }
  }

  if (val instanceof Date) {
    if (!isNaN(val.getTime())) {
      const year = val.getFullYear();
      const month = String(val.getMonth() + 1).padStart(2, '0');
      const day = String(val.getDate()).padStart(2, '0');
      const hours = String(val.getHours()).padStart(2, '0');
      const mins = String(val.getMinutes()).padStart(2, '0');
      return {
        dateStr: `${year}-${month}-${day}`,
        timeStr: `${hours}:${mins}`,
      };
    }
  }

  const str = String(val).trim();
  let formattedDate = todayStr;
  let formattedTime = '';

  // YYYY-MM-DD or YYYY/MM/DD
  const ymdMatch = str.match(/(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  // DD-MM-YYYY or DD/MM/YYYY
  const dmyMatch = str.match(/(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);

  if (ymdMatch) {
    formattedDate = `${ymdMatch[1]}-${ymdMatch[2].padStart(2, '0')}-${ymdMatch[3].padStart(2, '0')}`;
  } else if (dmyMatch) {
    formattedDate = `${dmyMatch[3]}-${dmyMatch[2].padStart(2, '0')}-${dmyMatch[1].padStart(2, '0')}`;
  }

  const timeMatch = str.match(/(\d{1,2}:\d{2}(?::\d{2})?)/);
  if (timeMatch) {
    formattedTime = timeMatch[1].slice(0, 5);
  }

  return { dateStr: formattedDate, timeStr: formattedTime };
}

/**
 * Parse any Excel (.xlsx, .xls) or CSV / TSV file buffer into structured transactions
 */
export async function parseSpreadsheetFile(
  file: File,
  defaultCurrency = 'MYR'
): Promise<{ transactions: ParsedCsvTransaction[]; sheetName: string; totalRows: number }> {
  const arrayBuffer = await file.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer, { type: 'array', cellDates: true });

  if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
    throw new Error('The spreadsheet contains no readable sheets.');
  }

  const firstSheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];

  // Convert worksheet to raw 2D array of strings/numbers
  const rows: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });

  if (rows.length < 2) {
    throw new Error('Spreadsheet has no data rows. Please ensure it has at least a header row and 1 transaction.');
  }

  // Find header row (usually row 0, or first row with at least 2 non-empty cells)
  let headerRowIdx = 0;
  for (let r = 0; r < Math.min(rows.length, 10); r++) {
    const row = rows[r];
    const filledCount = row.filter((c) => c !== undefined && String(c).trim().length > 0).length;
    if (filledCount >= 2) {
      // Check if any cell looks like date/merchant/amount
      const text = row.map((c) => String(c).toLowerCase()).join(' ');
      if (
        text.includes('date') ||
        text.includes('amount') ||
        text.includes('merchant') ||
        text.includes('description') ||
        text.includes('total') ||
        text.includes('tarikh') ||
        text.includes('jumlah')
      ) {
        headerRowIdx = r;
        break;
      }
    }
  }

  const headers = rows[headerRowIdx].map((h: any) => String(h || '').toLowerCase().trim());
  const todayStr = new Date().toISOString().slice(0, 10);
  const nowTime = new Date().toTimeString().slice(0, 5);

  // Match columns to aliases
  const findColIndex = (aliases: string[]): number => {
    return headers.findIndex((h: string) => aliases.some((a) => h.includes(a)));
  };

  const dateIdx = findColIndex(['date', 'tarikh', 'time', 'posting_date', 'trans_date', 'txn_date']);
  const merchantIdx = findColIndex(['merchant', 'description', 'payee', 'vendor', 'name', 'details', 'particulars', 'item', 'source', 'trans']);
  const amountIdx = findColIndex(['amount', 'jumlah', 'price', 'total', 'value', 'nominal', 'net']);
  const debitIdx = findColIndex(['debit', 'dr', 'out', 'payment', 'keluar']);
  const creditIdx = findColIndex(['credit', 'cr', 'in', 'deposit', 'masuk']);
  const typeIdx = findColIndex(['type', 'jenis', 'status', 'cr/dr', 'dr/cr']);
  const categoryIdx = findColIndex(['category', 'kategori', 'cat', 'group']);
  const paymentMethodIdx = findColIndex(['payment method', 'payment_method', 'method', 'cara', 'account', 'wallet', 'bank']);
  const timeIdx = findColIndex(['time', 'masa', 'clock']);
  const currencyIdx = findColIndex(['currency', 'mata wang', 'curr', 'ccy']);
  const summaryIdx = findColIndex(['summary', 'notes', 'remark', 'remarks', 'memo', 'nota']);
  const tagsIdx = findColIndex(['tags', 'tag', 'labels', 'label']);

  const transactions: ParsedCsvTransaction[] = [];

  for (let r = headerRowIdx + 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row || row.length === 0) continue;

    // Check if entire row is empty
    const hasData = row.some((c) => c !== undefined && String(c).trim().length > 0);
    if (!hasData) continue;

    // Extract Date
    const rawDateVal = dateIdx !== -1 ? row[dateIdx] : todayStr;
    const { dateStr, timeStr: parsedTimeStr } = parseExcelDate(rawDateVal);

    // Extract Time
    const explicitTime = timeIdx !== -1 ? String(row[timeIdx] || '').trim() : '';
    const finalTime = explicitTime || parsedTimeStr || nowTime;

    // Extract Merchant
    let rawMerchant = merchantIdx !== -1 ? String(row[merchantIdx] || '').trim() : '';
    if (!rawMerchant) {
      rawMerchant = 'Spreadsheet Transaction';
    }

    // Extract Amount and determine Type (Debit/Credit/Expense/Income)
    let finalAmount = 0;
    let finalType: TransactionType = 'expense';

    if (debitIdx !== -1 && creditIdx !== -1) {
      // Split Debit / Credit columns
      const rawDebit = parseFloat(String(row[debitIdx] || '0').replace(/[^0-9.-]/g, '')) || 0;
      const rawCredit = parseFloat(String(row[creditIdx] || '0').replace(/[^0-9.-]/g, '')) || 0;

      if (rawCredit > 0) {
        finalAmount = rawCredit;
        finalType = 'income';
      } else if (rawDebit > 0) {
        finalAmount = rawDebit;
        finalType = 'expense';
      } else if (amountIdx !== -1) {
        const rawAmt = parseFloat(String(row[amountIdx] || '0').replace(/[^0-9.-]/g, '')) || 0;
        finalAmount = Math.abs(rawAmt);
        finalType = rawAmt < 0 ? 'expense' : 'income';
      }
    } else if (amountIdx !== -1) {
      const rawAmtStr = String(row[amountIdx] || '0').trim();
      const rawAmt = parseFloat(rawAmtStr.replace(/[^0-9.-]/g, '')) || 0;
      finalAmount = Math.abs(rawAmt);

      const rawTypeStr = typeIdx !== -1 ? String(row[typeIdx] || '').toLowerCase() : '';

      const isExplicitIncome =
        /credit|cr|income|in|deposit|reload|top.?up|salary|refund|bonus/i.test(rawTypeStr) ||
        /salary|refund|deposit|cashback|dividend|interest/i.test(rawMerchant);

      const isExplicitExpense =
        /debit|dr|expense|out|payment|withdraw|bill|toll/i.test(rawTypeStr) ||
        rawAmtStr.startsWith('-') ||
        rawAmt < 0;

      if (isExplicitIncome && !isExplicitExpense) {
        finalType = 'income';
      } else {
        finalType = 'expense';
      }
    }

    if (finalAmount <= 0) {
      continue; // Skip zero or invalid amounts
    }

    // Extract Category
    const rawCategory = categoryIdx !== -1 ? String(row[categoryIdx] || '').trim() : '';
    let category: ExpenseCategory = 'Other';
    if (rawCategory && detectCategoryFromText(rawCategory) !== 'Other') {
      category = detectCategoryFromText(rawCategory);
    } else {
      category = detectCategoryFromText(rawMerchant);
    }

    // Extract Payment Method
    const rawPayment = paymentMethodIdx !== -1 ? String(row[paymentMethodIdx] || '').trim() : '';
    let paymentMethod: PaymentMethod = 'Credit Card';
    if (rawPayment && detectPaymentMethodFromText(rawPayment) !== 'Cash') {
      paymentMethod = detectPaymentMethodFromText(rawPayment);
    } else {
      paymentMethod = detectPaymentMethodFromText(`${rawMerchant} ${row.join(' ')}`);
    }

    // Extract Currency
    const rawCurrency = currencyIdx !== -1 ? String(row[currencyIdx] || '').toUpperCase().trim() : '';
    const finalCurrency = rawCurrency.length === 3 ? rawCurrency : defaultCurrency;

    // Extract Summary / Notes
    const rawSummary = summaryIdx !== -1 ? String(row[summaryIdx] || '').trim() : '';
    const finalSummary =
      rawSummary ||
      (finalType === 'income'
        ? `Received ${finalCurrency} ${finalAmount.toFixed(2)} (${rawMerchant})`
        : `Paid ${finalCurrency} ${finalAmount.toFixed(2)} (${rawMerchant})`);

    // Extract Tags
    const rawTags = tagsIdx !== -1 ? String(row[tagsIdx] || '').trim() : '';
    const tagsList: string[] = rawTags
      ? rawTags
          .split(/[,;|]/)
          .map((t) => t.trim().toLowerCase())
          .filter((t) => t.length > 0)
      : ['spreadsheet-import', finalType];

    transactions.push({
      date: dateStr,
      time: finalTime,
      merchant: rawMerchant.slice(0, 120),
      amount: finalAmount,
      type: finalType,
      currency: finalCurrency,
      category,
      paymentMethod,
      summary: finalSummary,
      tags: tagsList,
    });
  }

  return {
    transactions,
    sheetName: firstSheetName,
    totalRows: rows.length - (headerRowIdx + 1),
  };
}

/**
 * Generate a pre-formatted Excel Workbook (.xlsx) template with sample data and guides
 */
export function generateExcelTemplate(currency = 'MYR'): Blob {
  const wb = XLSX.utils.book_new();

  // Sample transactions
  const sampleData = [
    {
      Date: '2026-09-08',
      Time: '12:30',
      Merchant: 'Village Grocer',
      Amount: 88.50,
      Type: 'Expense',
      Category: 'Groceries',
      'Payment Method': 'Credit Card',
      Currency: currency,
      Summary: 'Fresh organic vegetables, fruits, and milk',
      Tags: 'groceries, food, weekly',
    },
    {
      Date: '2026-09-08',
      Time: '14:15',
      Merchant: 'Starbucks Coffee',
      Amount: 18.00,
      Type: 'Expense',
      Category: 'Food & Dining',
      'Payment Method': 'E-Wallet',
      Currency: currency,
      Summary: 'Iced Caffe Latte and butter croissant',
      Tags: 'coffee, cafe',
    },
    {
      Date: '2026-09-07',
      Time: '09:00',
      Merchant: 'Tech Company Monthly Salary',
      Amount: 4500.00,
      Type: 'Income',
      Category: 'Salary',
      'Payment Method': 'Bank Transfer',
      Currency: currency,
      Summary: 'Monthly full-time payroll direct deposit',
      Tags: 'salary, payroll, income',
    },
    {
      Date: '2026-09-06',
      Time: '18:45',
      Merchant: 'Petronas Petrol Station',
      Amount: 60.00,
      Type: 'Expense',
      Category: 'Transportation',
      'Payment Method': 'Debit Card',
      Currency: currency,
      Summary: 'Car RON 95 petrol full tank refuel',
      Tags: 'petrol, transport, car',
    },
    {
      Date: '2026-09-05',
      Time: '20:00',
      Merchant: 'TNB Electric Utility Bill',
      Amount: 135.20,
      Type: 'Expense',
      Category: 'Utilities',
      'Payment Method': 'Bank Transfer',
      Currency: currency,
      Summary: 'Home electricity utility monthly payment',
      Tags: 'bills, utilities, home',
    },
  ];

  const ws = XLSX.utils.json_to_sheet(sampleData, {
    header: [
      'Date',
      'Time',
      'Merchant',
      'Amount',
      'Type',
      'Category',
      'Payment Method',
      'Currency',
      'Summary',
      'Tags',
    ],
  });

  // Set column widths for comfortable editing
  ws['!cols'] = [
    { wch: 12 }, // Date
    { wch: 8 },  // Time
    { wch: 28 }, // Merchant
    { wch: 12 }, // Amount
    { wch: 10 }, // Type
    { wch: 18 }, // Category
    { wch: 16 }, // Payment Method
    { wch: 10 }, // Currency
    { wch: 38 }, // Summary
    { wch: 24 }, // Tags
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'Transactions Template');

  // Reference Sheet with Categories and Options
  const categoriesData = CATEGORY_LIST.map((cat) => ({
    Category: cat,
  }));
  const wsRef = XLSX.utils.json_to_sheet(categoriesData);
  wsRef['!cols'] = [{ wch: 24 }];
  XLSX.utils.book_append_sheet(wb, wsRef, 'Valid Categories');

  const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  return new Blob([excelBuffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

/**
 * Generate standard CSV template
 */
export function generateCsvTemplate(currency = 'MYR'): Blob {
  const headers = [
    'Date',
    'Time',
    'Merchant',
    'Amount',
    'Type',
    'Category',
    'Payment Method',
    'Currency',
    'Summary',
    'Tags',
  ];

  const rows = [
    ['2026-09-08', '12:30', 'Village Grocer', '88.50', 'Expense', 'Groceries', 'Credit Card', currency, 'Fresh vegetables and milk', 'groceries, food'],
    ['2026-09-08', '14:15', 'Starbucks Coffee', '18.00', 'Expense', 'Food & Dining', 'E-Wallet', currency, 'Iced Latte', 'coffee, cafe'],
    ['2026-09-07', '09:00', 'Tech Company Salary', '4500.00', 'Income', 'Salary', 'Bank Transfer', currency, 'Monthly payroll deposit', 'salary, income'],
    ['2026-09-06', '18:45', 'Petronas Petrol Station', '60.00', 'Expense', 'Transportation', 'Debit Card', currency, 'Fuel refuel', 'car, petrol'],
    ['2026-09-05', '20:00', 'TNB Electricity Bill', '135.20', 'Expense', 'Utilities', 'Bank Transfer', currency, 'Monthly utility payment', 'utilities, bills'],
  ];

  const csvLines = [headers.join(',')];
  rows.forEach((row) => {
    const formattedRow = row.map((cell) => `"${cell.replace(/"/g, '""')}"`);
    csvLines.push(formattedRow.join(','));
  });

  return new Blob([csvLines.join('\n')], { type: 'text/csv;charset=utf-8;' });
}

/**
 * Trigger immediate browser download of the Excel template
 */
export function downloadExcelTemplate(currency = 'MYR') {
  const blob = generateExcelTemplate(currency);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Daily_Expenses_Template.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Trigger immediate browser download of the CSV template
 */
export function downloadCsvTemplate(currency = 'MYR') {
  const blob = generateCsvTemplate(currency);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Daily_Expenses_Template.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Export full transaction history as a multi-sheet Excel Workbook (.xlsx)
 */
export function exportExpensesToExcel(expenses: Expense[], currencySymbol = '$') {
  const wb = XLSX.utils.book_new();

  const formattedRows = expenses.map((e) => ({
    Type: e.type === 'income' ? 'Income' : 'Expense',
    Date: e.date,
    Time: e.time || '',
    Merchant: e.merchant,
    Category: e.category,
    Amount: e.amount,
    'Signed Amount': e.type === 'income' ? e.amount : -e.amount,
    Currency: e.currency,
    'Payment Method': e.paymentMethod,
    Summary: e.summary || '',
    Tags: (e.tags || []).join(', '),
    Recurring: e.isRecurring ? e.recurringInterval || 'Yes' : 'No',
  }));

  const ws = XLSX.utils.json_to_sheet(formattedRows);
  ws['!cols'] = [
    { wch: 10 }, // Type
    { wch: 12 }, // Date
    { wch: 8 },  // Time
    { wch: 28 }, // Merchant
    { wch: 18 }, // Category
    { wch: 12 }, // Amount
    { wch: 14 }, // Signed Amount
    { wch: 10 }, // Currency
    { wch: 16 }, // Payment Method
    { wch: 36 }, // Summary
    { wch: 22 }, // Tags
    { wch: 12 }, // Recurring
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'All Transactions');

  const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([excelBuffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Daily_Expenses_Export_${new Date().toISOString().slice(0, 10)}.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
