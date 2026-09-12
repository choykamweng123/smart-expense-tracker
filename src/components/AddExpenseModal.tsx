import React, { useState, useEffect } from 'react';
import {
  X,
  Check,
  Sparkles,
  Loader2,
  Tag,
  ArrowDownLeft,
  ArrowUpRight,
  Plus,
  TrendingUp,
  Receipt,
  Repeat,
} from 'lucide-react';
import { motion } from 'motion/react';
import { Expense, ExpenseCategory, PaymentMethod, CategoryItem, TransactionType, RecurringInterval, RecurringExpense } from '../types';
import { ICON_MAP, getCategoryMeta } from '../data/categories';
import { calculateNextDueDate } from '../utils/recurring';

interface AddExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveExpense: (expense: Omit<Expense, 'id' | 'createdAt'>) => void;
  onUpdateExpense?: (id: string, expense: Partial<Expense>) => void;
  onAddRecurring?: (
    rule: Omit<RecurringExpense, 'id' | 'createdAt' | 'nextDueDate'> & {
      initialNextDueDate?: string;
      generateFirstNow?: boolean;
    }
  ) => void;
  defaultCurrency: string;
  categories?: CategoryItem[];
  onOpenCategoryManager?: () => void;
  initialExpense?: Expense | null;
  initialType?: TransactionType;
  isDark?: boolean;
}

const EXPENSE_QUICK_MERCHANTS = [
  'Kopitiam Cafe',
  'Village Grocer',
  'RapidKL MRT',
  'Petronas Fuel',
  'Shopee Malaysia',
  'Foodpanda',
  'Grab Ride',
];

const INCOME_QUICK_SOURCES = [
  'Monthly Salary',
  'Freelance Project',
  'Client Payment',
  'Bonus / Incentive',
  'Investment Dividend',
  'Rental Income',
  'Side Business',
];

export const AddExpenseModal: React.FC<AddExpenseModalProps> = ({
  isOpen,
  onClose,
  onSaveExpense,
  onUpdateExpense,
  onAddRecurring,
  defaultCurrency,
  categories = [],
  onOpenCategoryManager,
  initialExpense,
  initialType,
  isDark = true,
}) => {
  const [txType, setTxType] = useState<TransactionType>(
    initialExpense?.type || initialType || 'expense'
  );
  const [amount, setAmount] = useState(initialExpense ? initialExpense.amount.toString() : '');
  const [merchant, setMerchant] = useState(initialExpense ? initialExpense.merchant : '');
  const [category, setCategory] = useState<ExpenseCategory>(
    initialExpense
      ? initialExpense.category
      : initialType === 'income'
      ? 'Salary'
      : 'Food & Dining'
  );
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(
    initialExpense
      ? initialExpense.paymentMethod
      : initialType === 'income'
      ? 'Bank Transfer'
      : 'Credit Card'
  );
  const [date, setDate] = useState(
    initialExpense ? initialExpense.date : new Date().toISOString().slice(0, 10)
  );
  const [time, setTime] = useState(
    initialExpense?.time || new Date().toTimeString().slice(0, 5)
  );
  const [summary, setSummary] = useState(initialExpense?.summary || '');
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>(initialExpense?.tags || []);
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isRecurring, setIsRecurring] = useState(initialExpense?.isRecurring || false);
  const [recurringInterval, setRecurringInterval] = useState<RecurringInterval>(
    initialExpense?.recurringInterval || 'monthly'
  );

  // Sync state when initialExpense or initialType changes
  useEffect(() => {
    if (initialExpense) {
      setTxType(initialExpense.type || 'expense');
      setAmount(initialExpense.amount.toString());
      setMerchant(initialExpense.merchant);
      setCategory(initialExpense.category);
      setPaymentMethod(initialExpense.paymentMethod);
      setDate(initialExpense.date);
      setTime(initialExpense.time || new Date().toTimeString().slice(0, 5));
      setSummary(initialExpense.summary || '');
      setTags(initialExpense.tags || []);
    } else {
      const defaultType = initialType || 'expense';
      setTxType(defaultType);
      setAmount('');
      setMerchant('');
      setCategory(defaultType === 'income' ? 'Salary' : 'Food & Dining');
      setPaymentMethod(defaultType === 'income' ? 'Bank Transfer' : 'Credit Card');
      setDate(new Date().toISOString().slice(0, 10));
      setTime(new Date().toTimeString().slice(0, 5));
      setSummary('');
      setTags([]);
    }
    setError(null);
  }, [initialExpense, initialType, isOpen]);

  if (!isOpen) return null;

  // Auto-suggest category based on merchant or note
  const handleSuggestCategory = async () => {
    const textToAnalyze = merchant.trim() || summary.trim();
    if (!textToAnalyze) return;

    setIsSuggesting(true);
    try {
      const res = await fetch('/api/suggest-category', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: textToAnalyze }),
      });
      const json = await res.json();
      if (json.success && json.data?.category) {
        setCategory(json.data.category as ExpenseCategory);
        if (json.data.suggestedTags && Array.isArray(json.data.suggestedTags)) {
          setTags((prev) => Array.from(new Set([...prev, ...json.data.suggestedTags])));
        }
      }
    } catch (e) {
      console.error('Suggest category error', e);
    } finally {
      setIsSuggesting(false);
    }
  };

  const handleAddTag = () => {
    if (tagInput.trim() && !tags.includes(tagInput.trim().toLowerCase())) {
      setTags([...tags, tagInput.trim().toLowerCase()]);
      setTagInput('');
    }
  };

  const handleRemoveTag = (t: string) => {
    setTags(tags.filter((item) => item !== t));
  };

  const handleSelectQuickMerchant = (name: string) => {
    setMerchant(name);
    if (txType === 'income') {
      if (name.includes('Salary')) setCategory('Salary');
      else if (name.includes('Freelance')) setCategory('Freelance');
      else if (name.includes('Dividend')) setCategory('Investment');
      else if (name.includes('Bonus')) setCategory('Bonus');
      else if (name.includes('Rental')) setCategory('Rental');
    } else {
      if (name.includes('Kopitiam')) setCategory('Food & Dining');
      else if (name.includes('Grocer')) setCategory('Groceries');
      else if (name.includes('MRT') || name.includes('Fuel') || name.includes('Grab'))
        setCategory('Transportation');
      else if (name.includes('Shopee')) setCategory('Shopping');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setError('Please enter a valid positive amount.');
      return;
    }
    if (!merchant.trim()) {
      setError(
        txType === 'income'
          ? 'Please enter the income source / payer.'
          : 'Please enter a merchant or expense title.'
      );
      return;
    }

    if (initialExpense && onUpdateExpense) {
      onUpdateExpense(initialExpense.id, {
        type: txType,
        merchant: merchant.trim(),
        amount: numAmount,
        currency: defaultCurrency,
        date,
        time,
        category,
        paymentMethod,
        summary: summary.trim(),
        tags,
        isRecurring,
        recurringInterval: isRecurring ? recurringInterval : undefined,
      });
    } else {
      onSaveExpense({
        type: txType,
        merchant: merchant.trim(),
        amount: numAmount,
        currency: defaultCurrency,
        date,
        time,
        category,
        paymentMethod,
        summary: summary.trim(),
        tags: isRecurring ? Array.from(new Set([...tags, 'recurring', recurringInterval])) : tags,
        isRecurring,
        recurringInterval: isRecurring ? recurringInterval : undefined,
        confidence: 'high',
      });

      // If set as recurring, register a recurring rule for future occurrences
      if (isRecurring && onAddRecurring) {
        onAddRecurring({
          type: txType,
          merchant: merchant.trim(),
          amount: numAmount,
          currency: defaultCurrency,
          interval: recurringInterval,
          category,
          paymentMethod,
          startDate: date,
          initialNextDueDate: calculateNextDueDate(date, recurringInterval),
          summary: summary.trim(),
          tags,
          isActive: true,
        });
      }
    }

    onClose();
  };

  // Filter categories appropriate for transaction type
  const availableCategories = categories.filter((c) => {
    if (txType === 'income') {
      return c.type === 'income' || c.type === 'both';
    }
    return c.type === 'expense' || c.type === 'both';
  });

  const isIncome = txType === 'income';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-2xl overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className={`relative w-full max-w-md my-auto rounded-3xl border shadow-2xl overflow-hidden transition-colors ${
          isDark
            ? 'border-white/15 bg-[#0b132b]/95 text-slate-100'
            : 'border-slate-200 bg-white text-slate-800'
        }`}
      >
        {/* Header with Close */}
        <div
          className={`flex items-center justify-between border-b px-5 py-4 ${
            isDark ? 'border-white/10 bg-white/5' : 'border-slate-100 bg-slate-50'
          }`}
        >
          <div className="flex items-center gap-2">
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-xl border ${
                isIncome
                  ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                  : 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30'
              }`}
            >
              {isIncome ? (
                <ArrowDownLeft className="h-4 w-4" />
              ) : (
                <ArrowUpRight className="h-4 w-4" />
              )}
            </div>
            <h2 className="text-base font-bold">
              {initialExpense
                ? `Edit ${isIncome ? 'Income' : 'Expense'}`
                : isIncome
                ? 'Record Income'
                : 'Add New Expense'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className={`rounded-xl p-1.5 transition ${
              isDark
                ? 'text-slate-400 hover:bg-white/10 hover:text-white'
                : 'text-slate-400 hover:bg-slate-100 hover:text-slate-800'
            }`}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 max-h-[82vh] overflow-y-auto">
          {error && (
            <div className="rounded-xl border border-rose-500/30 bg-rose-950/40 p-2.5 text-xs text-rose-300">
              {error}
            </div>
          )}

          {/* Type Segmented Selector: Expense vs Income */}
          <div className="grid grid-cols-2 gap-2 p-1 rounded-2xl border border-white/10 bg-white/5">
            <button
              type="button"
              onClick={() => {
                setTxType('expense');
                if (isIncome && category === 'Salary') {
                  setCategory('Food & Dining');
                }
              }}
              className={`flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-bold transition ${
                !isIncome
                  ? 'bg-rose-600 text-white shadow-md'
                  : isDark
                  ? 'text-slate-400 hover:text-white'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <ArrowUpRight className="h-4 w-4" />
              <span>Expense (-)</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setTxType('income');
                if (!isIncome && category === 'Food & Dining') {
                  setCategory('Salary');
                }
              }}
              className={`flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-bold transition ${
                isIncome
                  ? 'bg-emerald-600 text-white shadow-md'
                  : isDark
                  ? 'text-slate-400 hover:text-white'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <ArrowDownLeft className="h-4 w-4" />
              <span>Income (+)</span>
            </button>
          </div>

          {/* Amount input */}
          <div
            className={`rounded-2xl border p-4 text-center transition-colors ${
              isIncome
                ? 'border-emerald-500/25 bg-emerald-500/5'
                : isDark
                ? 'border-white/10 bg-white/5'
                : 'border-slate-200 bg-slate-50'
            }`}
          >
            <span
              className={`text-xs font-semibold uppercase tracking-wider block mb-1 ${
                isIncome ? 'text-emerald-400' : isDark ? 'text-slate-400' : 'text-slate-500'
              }`}
            >
              {isIncome ? 'Income Amount' : 'Expense Amount'}
            </span>
            <div className="flex items-center justify-center gap-1">
              <span
                className={`text-2xl font-black ${
                  isIncome ? 'text-emerald-400' : 'text-indigo-400'
                }`}
              >
                {isIncome ? '+' : '-'}
                {defaultCurrency}
              </span>
              <input
                type="number"
                step="0.01"
                required
                autoFocus
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className={`w-44 bg-transparent text-center text-3xl font-black focus:outline-none placeholder:text-slate-500 ${
                  isIncome ? 'text-emerald-400' : isDark ? 'text-white' : 'text-slate-900'
                }`}
              />
            </div>
          </div>

          {/* Quick Merchant / Source Suggestions */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-medium">
                {isIncome ? 'Income Source / From' : 'Where was this spent?'}
              </label>
              {!isIncome && merchant.length > 2 && (
                <button
                  type="button"
                  onClick={handleSuggestCategory}
                  disabled={isSuggesting}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-400 hover:text-indigo-300"
                >
                  {isSuggesting ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Sparkles className="h-3 w-3" />
                  )}
                  AI Auto-Categorize
                </button>
              )}
            </div>

            <input
              type="text"
              required
              value={merchant}
              onChange={(e) => setMerchant(e.target.value)}
              placeholder={
                isIncome
                  ? 'e.g. Monthly Salary, Freelance Client, Investment'
                  : 'e.g. Kopitiam Cafe, Village Grocer, RapidKL'
              }
              className={`w-full rounded-xl border px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40 ${
                isDark
                  ? 'border-white/10 bg-white/5 text-white'
                  : 'border-slate-200 bg-slate-50 text-slate-900'
              }`}
            />

            {/* Quick Suggestions Chips */}
            <div className="flex flex-wrap gap-1 mt-2">
              {(isIncome ? INCOME_QUICK_SOURCES : EXPENSE_QUICK_MERCHANTS).map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => handleSelectQuickMerchant(item)}
                  className={`text-[11px] px-2 py-0.5 rounded-lg border transition ${
                    merchant === item
                      ? isIncome
                        ? 'border-emerald-500 bg-emerald-500/20 text-emerald-300'
                        : 'border-indigo-500 bg-indigo-500/20 text-indigo-300'
                      : isDark
                      ? 'border-white/5 bg-white/5 text-slate-400 hover:text-slate-200'
                      : 'border-slate-200 bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  + {item}
                </button>
              ))}
            </div>
          </div>

          {/* Category Chips Grid */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-medium">Category</label>
              {onOpenCategoryManager && (
                <button
                  type="button"
                  onClick={onOpenCategoryManager}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-400 hover:text-indigo-300 transition"
                >
                  <Tag className="h-3 w-3" />
                  + Manage Categories
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 max-h-40 overflow-y-auto pr-1">
              {availableCategories.map((cat) => {
                const meta = getCategoryMeta(cat.name, categories);
                const isSelected = category === cat.name;
                const Icon = meta.icon;
                return (
                  <button
                    key={cat.id || cat.name}
                    type="button"
                    onClick={() => setCategory(cat.name)}
                    className={`flex items-center gap-2 rounded-xl p-2 text-left text-xs transition border ${
                      isSelected
                        ? isIncome
                          ? 'border-emerald-500 bg-emerald-500/20 text-emerald-300 font-bold'
                          : 'border-indigo-500 bg-indigo-500/20 text-indigo-300 font-bold'
                        : isDark
                        ? 'border-white/5 bg-white/5 text-slate-400 hover:border-white/10 hover:text-slate-200'
                        : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <Icon
                      className={`h-4 w-4 shrink-0 ${
                        isSelected
                          ? isIncome
                            ? 'text-emerald-400'
                            : 'text-indigo-400'
                          : meta.color
                      }`}
                    />
                    <span className="truncate">{cat.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Date, Time & Payment / Deposit Method */}
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="text-[11px] font-medium text-slate-400 block mb-1">Date</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className={`w-full rounded-xl border px-2 py-1.5 text-xs focus:outline-none ${
                  isDark
                    ? 'border-white/10 bg-white/5 text-white'
                    : 'border-slate-200 bg-slate-50 text-slate-900'
                }`}
              />
            </div>
            <div>
              <label className="text-[11px] font-medium text-slate-400 block mb-1">Time</label>
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className={`w-full rounded-xl border px-2 py-1.5 text-xs focus:outline-none ${
                  isDark
                    ? 'border-white/10 bg-white/5 text-white'
                    : 'border-slate-200 bg-slate-50 text-slate-900'
                }`}
              />
            </div>
            <div>
              <label className="text-[11px] font-medium text-slate-400 block mb-1">
                {isIncome ? 'Deposit In' : 'Payment'}
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                className={`w-full rounded-xl border px-2 py-1.5 text-xs focus:outline-none ${
                  isDark
                    ? 'border-white/10 bg-[#0f172a] text-white'
                    : 'border-slate-200 bg-white text-slate-900'
                }`}
              >
                <option value="Bank Transfer">Bank Transfer</option>
                <option value="E-Wallet">E-Wallet (TNG/DuitNow)</option>
                <option value="Cash">Cash</option>
                <option value="Credit Card">Credit Card</option>
                <option value="Debit Card">Debit Card</option>
                <option value="Other">Other</option>
              </select>
            </div>
          </div>

          {/* Recurring Expense Option */}
          <div
            className={`rounded-2xl border p-3 transition-colors ${
              isRecurring
                ? isDark
                  ? 'border-purple-500/40 bg-purple-500/10'
                  : 'border-purple-300 bg-purple-50/70'
                : isDark
                ? 'border-white/5 bg-white/5'
                : 'border-slate-200 bg-slate-50'
            }`}
          >
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold select-none">
                <Repeat className={`h-4 w-4 ${isRecurring ? 'text-purple-400' : 'text-slate-400'}`} />
                <span className={isDark ? 'text-slate-200' : 'text-slate-800'}>
                  Recurring {isIncome ? 'Income' : 'Expense'}
                </span>
              </label>
              <input
                type="checkbox"
                checked={isRecurring}
                onChange={(e) => setIsRecurring(e.target.checked)}
                className="rounded border-white/20 text-purple-600 focus:ring-0 h-4 w-4"
              />
            </div>

            {isRecurring && (
              <div className="mt-2.5 pt-2 border-t border-white/10 flex items-center justify-between gap-2">
                <span className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  Auto-repeats:
                </span>
                <div className="flex gap-1">
                  {(['daily', 'weekly', 'monthly'] as RecurringInterval[]).map((int) => (
                    <button
                      key={int}
                      type="button"
                      onClick={() => setRecurringInterval(int)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold capitalize transition ${
                        recurringInterval === int
                          ? 'bg-purple-600 text-white shadow'
                          : isDark
                          ? 'bg-white/5 text-slate-400 hover:text-white'
                          : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                      }`}
                    >
                      {int}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Notes */}
          <div>
            <label className="text-xs font-medium block mb-1">Notes (Optional)</label>
            <input
              type="text"
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder={
                isIncome
                  ? 'e.g. October payroll direct transfer'
                  : 'e.g. Afternoon tea with colleagues'
              }
              className={`w-full rounded-xl border px-3.5 py-2 text-xs focus:outline-none ${
                isDark
                  ? 'border-white/10 bg-white/5 text-white'
                  : 'border-slate-200 bg-slate-50 text-slate-900'
              }`}
            />
          </div>

          {/* Tags */}
          <div>
            <div className="flex flex-wrap gap-1 mb-1.5">
              {tags.map((t) => (
                <span
                  key={t}
                  className="inline-flex items-center gap-1 rounded-lg bg-white/5 px-2 py-0.5 text-xs text-slate-300 border border-white/10"
                >
                  #{t}
                  <button type="button" onClick={() => handleRemoveTag(t)}>
                    ×
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddTag();
                  }
                }}
                placeholder="Add tag (e.g. salary, tax, lunch)"
                className={`flex-1 rounded-xl border px-3 py-1.5 text-xs focus:outline-none ${
                  isDark
                    ? 'border-white/10 bg-white/5 text-white'
                    : 'border-slate-200 bg-slate-50 text-slate-900'
                }`}
              />
              <button
                type="button"
                onClick={handleAddTag}
                className={`rounded-xl border px-3 py-1.5 text-xs transition ${
                  isDark
                    ? 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'
                    : 'border-slate-200 bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                Add
              </button>
            </div>
          </div>

          {/* Actions */}
          <div className="pt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl px-4 py-2 text-xs font-medium text-slate-400 hover:text-white transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              className={`flex items-center gap-1.5 rounded-xl px-5 py-2 text-xs font-semibold text-white shadow-lg transition active:scale-95 ${
                isIncome
                  ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-500/25'
                  : 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 shadow-indigo-500/25'
              }`}
            >
              <Check className="h-4 w-4" />
              {initialExpense
                ? `Update ${isIncome ? 'Income' : 'Expense'}`
                : isIncome
                ? 'Save Income'
                : 'Save Expense'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};
