export type TransactionType = 'expense' | 'income';

export type ExpenseCategory =
  | 'Food & Dining'
  | 'Groceries'
  | 'Transportation'
  | 'Shopping'
  | 'Utilities & Bills'
  | 'Entertainment'
  | 'Health & Medical'
  | 'Personal Care'
  | 'Education & Books'
  | 'Travel & Lodging'
  | 'Work & Business'
  | 'Salary'
  | 'Freelance'
  | 'Investment'
  | 'Bonus'
  | 'Rental'
  | 'Gift'
  | 'Other'
  | string;

export interface CategoryItem {
  id: string;
  name: string;
  iconName: string;
  color: string;
  bgColor: string;
  borderColor: string;
  badgeColor: string;
  type: 'expense' | 'income' | 'both';
  isCustom?: boolean;
}

export type PaymentMethod =
  | 'Credit Card'
  | 'Debit Card'
  | 'Cash'
  | 'E-Wallet'
  | 'Bank Transfer'
  | 'Other'
  | 'Unknown';

export interface ReceiptLineItem {
  name: string;
  quantity?: number;
  price?: number;
}

export type RecurringInterval = 'daily' | 'weekly' | 'monthly';

export interface RecurringExpense {
  id: string;
  type: TransactionType; // 'expense' or 'income'
  merchant: string;
  amount: number;
  currency: string;
  category: ExpenseCategory;
  paymentMethod: PaymentMethod;
  interval: RecurringInterval;
  startDate: string; // YYYY-MM-DD
  nextDueDate: string; // YYYY-MM-DD
  lastGeneratedDate?: string; // YYYY-MM-DD
  isActive: boolean;
  summary?: string;
  tags?: string[];
  createdAt: number;
}

export interface Expense {
  id: string;
  type?: TransactionType; // 'expense' or 'income' (defaults to 'expense')
  merchant: string; // Merchant or Income Source
  amount: number;
  currency: string;
  date: string; // YYYY-MM-DD
  time?: string; // HH:mm
  category: ExpenseCategory;
  paymentMethod: PaymentMethod;
  summary?: string;
  tags?: string[];
  items?: ReceiptLineItem[];
  tax?: number;
  tip?: number;
  receiptImage?: string; // thumbnail or base64
  createdAt: number;
  confidence?: 'high' | 'medium' | 'low';
  isRecurring?: boolean;
  recurringId?: string;
  recurringInterval?: RecurringInterval;
}

export interface ParsedReceiptData {
  type?: TransactionType;
  merchant: string;
  amount: number;
  currency: string;
  date: string;
  time?: string;
  category: ExpenseCategory;
  confidence?: 'high' | 'medium' | 'low';
  paymentMethod?: PaymentMethod;
  items?: ReceiptLineItem[];
  tax?: number;
  tip?: number;
  summary?: string;
  tags?: string[];
}

export interface CurrencyConfig {
  code: string;
  symbol: string;
  name: string;
}

export type RolloverType = 'none' | 'unlimited' | 'capped';

export interface CategoryBudgetConfig {
  category: string;
  baseBudget: number;
  rolloverEnabled?: boolean;
  rolloverType?: RolloverType; // 'none' | 'unlimited' | 'capped'
  rolloverCap?: number;
  allowNegativeRollover?: boolean; // Default false
}

export interface UserSettings {
  currency: string;
  currencySymbol: string;
  monthlyBudget: number;
  categoryBudgets?: Record<string, number>; // Category name -> monthly budget limit (legacy compatibility)
  categoryBudgetConfigs?: Record<string, CategoryBudgetConfig>; // Extended configuration
  hapticFeedback: boolean;
  theme?: 'dark' | 'light';
}

export type InsightType =
  | 'spending_increase'
  | 'spending_decrease'
  | 'unusual_spending'
  | 'budget_warning'
  | 'budget_exceeded'
  | 'positive'
  | 'saving_opportunity';

export type InsightSeverity = 'info' | 'positive' | 'warning' | 'critical';

export interface FinancialInsight {
  id: string;
  type: InsightType;
  title: string;
  description: string;
  category?: string;
  severity: InsightSeverity;
  value?: number;
  recommendation?: string;
  metric?: string;
  calculatedAt: number;
}
