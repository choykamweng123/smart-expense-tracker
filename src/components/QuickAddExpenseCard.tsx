import React, { useState } from 'react';
import {
  Sparkles,
  Send,
  Check,
  Edit3,
  X,
  Loader2,
  Calendar,
  Store,
  CheckCircle2,
  MessageSquare,
  AlertCircle,
  Maximize2,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Expense, ExpenseCategory, CategoryItem } from '../types';
import { getCategoryMeta, CATEGORY_LIST } from '../data/categories';
import { parseNaturalExpense, QuickAddExtractedExpense } from '../utils/naturalExpenseParser';

interface QuickAddExpenseCardProps {
  onSaveExpense: (expense: Omit<Expense, 'id' | 'createdAt'>) => void;
  onOpenFullEdit?: (draft: Partial<Expense>) => void;
  onOpenFullChatModal?: () => void;
  defaultCurrency: string;
  customCategories?: CategoryItem[];
  isDark?: boolean;
}

const QUICK_EXAMPLES = [
  "Lunch at McDonald's today for RM18.50",
  "Grab ride to office RM15",
  "Starbucks latte RM16.50",
  "Groceries at Village Grocer RM85",
];

export const QuickAddExpenseCard: React.FC<QuickAddExpenseCardProps> = ({
  onSaveExpense,
  onOpenFullEdit,
  onOpenFullChatModal,
  defaultCurrency,
  customCategories = [],
  isDark = true,
}) => {
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [parsedExpense, setParsedExpense] = useState<QuickAddExtractedExpense | null>(null);
  const [isEditingInline, setIsEditingInline] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState<string | null>(null);

  // Inline edit fields
  const [editMerchant, setEditMerchant] = useState('');
  const [editAmount, setEditAmount] = useState('');
  const [editCategory, setEditCategory] = useState<ExpenseCategory>('Food & Dining');
  const [editDate, setEditDate] = useState('');

  const handleParse = async (textToParse?: string) => {
    const query = (textToParse ?? inputText).trim();
    if (!query) return;

    setIsLoading(true);
    setError(null);
    setSavedSuccess(null);
    setIsEditingInline(false);

    try {
      const extracted = await parseNaturalExpense(query, defaultCurrency);
      setParsedExpense(extracted);
      setEditMerchant(extracted.merchant);
      setEditAmount(extracted.amount.toString());
      setEditCategory(extracted.category);
      setEditDate(extracted.date);
    } catch (err: any) {
      console.error('Failed to parse natural expense:', err);
      setError(err?.message || 'Could not parse expense. Please try again or rephrase.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirm = () => {
    if (!parsedExpense) return;

    const amountNum = parseFloat(editAmount) || parsedExpense.amount;
    if (isNaN(amountNum) || amountNum <= 0) {
      setError('Please provide a valid expense amount greater than 0.');
      return;
    }

    const merchantFinal = editMerchant.trim() || parsedExpense.merchant || 'Expense';

    const finalExpense: Omit<Expense, 'id' | 'createdAt'> = {
      merchant: merchantFinal,
      amount: Math.round(amountNum * 100) / 100,
      currency: parsedExpense.currency || defaultCurrency,
      category: editCategory || parsedExpense.category,
      type: parsedExpense.type || 'expense',
      date: editDate || parsedExpense.date || new Date().toISOString().slice(0, 10),
      time: parsedExpense.time || new Date().toTimeString().slice(0, 5),
      paymentMethod: parsedExpense.paymentMethod || 'E-Wallet',
      summary: parsedExpense.summary || inputText || merchantFinal,
      tags: parsedExpense.tags || ['quick-add'],
    };

    onSaveExpense(finalExpense);

    // Provide confirmation feedback & reset
    setSavedSuccess(`Saved ${finalExpense.currency} ${finalExpense.amount.toFixed(2)} at ${finalExpense.merchant}`);
    setParsedExpense(null);
    setInputText('');
    setIsEditingInline(false);
    setError(null);

    // Clear success message after 4 seconds
    setTimeout(() => {
      setSavedSuccess(null);
    }, 4000);
  };

  const handleCancel = () => {
    setParsedExpense(null);
    setIsEditingInline(false);
    setError(null);
  };

  const handleOpenFullForm = () => {
    if (!parsedExpense) return;
    const amountNum = parseFloat(editAmount) || parsedExpense.amount;
    const draft: Partial<Expense> = {
      merchant: editMerchant || parsedExpense.merchant,
      amount: isNaN(amountNum) ? 0 : amountNum,
      currency: parsedExpense.currency || defaultCurrency,
      category: editCategory || parsedExpense.category,
      type: parsedExpense.type || 'expense',
      date: editDate || parsedExpense.date,
      time: parsedExpense.time,
      paymentMethod: parsedExpense.paymentMethod,
      summary: parsedExpense.summary || inputText,
      tags: parsedExpense.tags,
    };
    if (onOpenFullEdit) {
      onOpenFullEdit(draft);
      setParsedExpense(null);
    }
  };

  // Category visual metadata
  const currentCategoryName = isEditingInline ? editCategory : parsedExpense?.category || 'Food & Dining';
  const categoryMeta = getCategoryMeta(currentCategoryName, customCategories);
  const CategoryIcon = categoryMeta.icon;

  // Format date readable
  const formatDateDisplay = (isoDate: string) => {
    const today = new Date().toISOString().slice(0, 10);
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    if (isoDate === today) return 'Today';
    if (isoDate === yesterday) return 'Yesterday';
    return isoDate;
  };

  return (
    <section
      id="quick-add-expense-card"
      aria-label="Quick Add Expense"
      className={`rounded-3xl border p-4 transition-all duration-200 shadow-lg ${
        isDark
          ? 'border-indigo-500/20 bg-gradient-to-b from-[#0f172a] to-[#0b1120] text-slate-100 shadow-black/40'
          : 'border-indigo-100 bg-gradient-to-b from-white to-slate-50 text-slate-800 shadow-slate-200/50'
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-2.5">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-600 text-white shadow-sm">
            <Sparkles className="h-3.5 w-3.5" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-400">
                Quick Add Expense
              </h3>
              <span className="rounded-md bg-indigo-500/10 px-1.5 py-0.5 text-[9px] font-semibold text-indigo-400 border border-indigo-500/20">
                Natural Text
              </span>
            </div>
          </div>
        </div>

        {onOpenFullChatModal && (
          <button
            type="button"
            onClick={onOpenFullChatModal}
            className={`flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-xl transition ${
              isDark
                ? 'text-slate-400 hover:text-white hover:bg-white/5'
                : 'text-slate-600 hover:text-indigo-600 hover:bg-indigo-50'
            }`}
            title="Open conversational chat modal"
          >
            <MessageSquare className="h-3 w-3" />
            <span>Chat View</span>
            <Maximize2 className="h-3 w-3 ml-0.5 opacity-60" />
          </button>
        )}
      </div>

      {/* Success Notification Alert */}
      <AnimatePresence>
        {savedSuccess && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="mb-3 p-3 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs flex items-center gap-2.5"
          >
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
            <span className="font-semibold">{savedSuccess}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error Alert */}
      {error && (
        <div className="mb-3 p-2.5 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-3.5 w-3.5 shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={() => setError(null)}
            className="text-rose-400 hover:text-rose-200 p-0.5"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Natural Language Chat Input Form */}
      {!parsedExpense && (
        <div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleParse();
            }}
            className="relative flex items-center"
          >
            <input
              type="text"
              id="quick-add-natural-input"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="e.g. I had lunch at McDonald's today for RM18.50"
              disabled={isLoading}
              className={`w-full h-12 pl-3.5 pr-12 rounded-2xl text-xs sm:text-sm border transition focus:outline-none focus:ring-2 focus:ring-indigo-500/40 ${
                isDark
                  ? 'bg-slate-900/90 border-white/10 text-white placeholder-slate-500'
                  : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400 shadow-inner'
              }`}
            />
            <button
              type="submit"
              id="quick-add-submit-btn"
              disabled={isLoading || !inputText.trim()}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 h-9 w-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-600 text-white flex items-center justify-center shadow-md disabled:opacity-40 disabled:cursor-not-allowed transition hover:opacity-95 active:scale-95"
              title="Parse expense with AI"
              aria-label="Parse expense"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </button>
          </form>

          {/* Prompt description */}
          <p className={`mt-1.5 text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            Type naturally with merchant, amount, or category. You'll review and confirm before saving.
          </p>

          {/* Quick Example Chips */}
          <div className="mt-2.5 flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-[11px]">
            <span className={`shrink-0 text-[10px] uppercase font-bold tracking-wider ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
              Try:
            </span>
            {QUICK_EXAMPLES.map((example, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  setInputText(example);
                  handleParse(example);
                }}
                disabled={isLoading}
                className={`shrink-0 px-2.5 py-1 rounded-xl border text-[11px] transition active:scale-95 whitespace-nowrap ${
                  isDark
                    ? 'border-white/5 bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white'
                    : 'border-slate-200 bg-slate-100 text-slate-700 hover:bg-indigo-50 hover:text-indigo-600'
                }`}
              >
                {example}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Review Expense Confirmation Card */}
      <AnimatePresence>
        {parsedExpense && (
          <motion.div
            initial={{ opacity: 0, scale: 0.98, y: 6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: 6 }}
            className={`mt-1 rounded-2xl border p-4 shadow-xl transition relative ${
              isDark
                ? 'bg-slate-900/95 border-indigo-500/30 text-white'
                : 'bg-white border-indigo-200 text-slate-900'
            }`}
          >
            {/* Header: Review Expense */}
            <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-3.5">
              <div className="flex items-center gap-2">
                <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-indigo-500/20 text-indigo-400">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                </div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-400">
                  Review Expense
                </h4>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                  {parsedExpense.source === 'ai' ? 'AI Extracted' : 'Quick Parsed'}
                </span>
                <button
                  type="button"
                  onClick={handleCancel}
                  className="p-1 rounded-lg text-slate-400 hover:text-white transition"
                  title="Discard this draft"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {/* Content Fields Display / Inline Edit */}
            {!isEditingInline ? (
              <div className="space-y-3">
                {/* Merchant & Amount Row */}
                <div className="flex items-baseline justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
                      Merchant
                    </p>
                    <p className="text-base font-bold text-white truncate">
                      {editMerchant || parsedExpense.merchant}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
                      Amount
                    </p>
                    <p className="text-lg font-extrabold text-rose-400">
                      {parsedExpense.currency} {(parseFloat(editAmount) || parsedExpense.amount).toFixed(2)}
                    </p>
                  </div>
                </div>

                {/* Category & Date Row */}
                <div className="grid grid-cols-2 gap-2 pt-1 border-t border-white/5">
                  <div>
                    <p className="text-[10px] uppercase font-bold tracking-wider text-slate-400 mb-1">
                      Category
                    </p>
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-white/5 border border-white/10 text-xs font-semibold text-slate-200">
                      <CategoryIcon className={`h-3.5 w-3.5 ${categoryMeta.color}`} />
                      <span className="truncate">{currentCategoryName}</span>
                    </div>
                  </div>

                  <div>
                    <p className="text-[10px] uppercase font-bold tracking-wider text-slate-400 mb-1">
                      Date
                    </p>
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-white/5 border border-white/10 text-xs font-semibold text-slate-200">
                      <Calendar className="h-3.5 w-3.5 text-indigo-400" />
                      <span>{formatDateDisplay(editDate || parsedExpense.date)}</span>
                    </div>
                  </div>
                </div>

                {/* Payment Method & Summary (if present) */}
                <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
                  <span>Method: <strong className="text-slate-200">{parsedExpense.paymentMethod || 'E-Wallet'}</strong></span>
                  {parsedExpense.summary && (
                    <span className="truncate max-w-[180px] italic">"{parsedExpense.summary}"</span>
                  )}
                </div>
              </div>
            ) : (
              /* Inline Editable Form */
              <div className="space-y-2.5">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                    Merchant Name
                  </label>
                  <div className="relative">
                    <Store className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                    <input
                      type="text"
                      value={editMerchant}
                      onChange={(e) => setEditMerchant(e.target.value)}
                      className="w-full h-9 pl-8 pr-3 rounded-xl text-xs bg-black/30 border border-white/10 text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                      Amount ({parsedExpense.currency})
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={editAmount}
                      onChange={(e) => setEditAmount(e.target.value)}
                      className="w-full h-9 px-3 rounded-xl text-xs bg-black/30 border border-white/10 text-white font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                      Date
                    </label>
                    <input
                      type="date"
                      value={editDate}
                      onChange={(e) => setEditDate(e.target.value)}
                      className="w-full h-9 px-3 rounded-xl text-xs bg-black/30 border border-white/10 text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                    Category
                  </label>
                  <select
                    value={editCategory}
                    onChange={(e) => setEditCategory(e.target.value as ExpenseCategory)}
                    className="w-full h-9 px-2.5 rounded-xl text-xs bg-slate-800 border border-white/10 text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    {CATEGORY_LIST.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {/* Action Buttons: [Confirm] [Edit] */}
            <div className="mt-4 pt-3 border-t border-white/10 flex items-center gap-2">
              <button
                type="button"
                id="quick-add-confirm-btn"
                onClick={handleConfirm}
                className="flex-1 min-h-[44px] flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold shadow-lg shadow-emerald-500/20 transition active:scale-95"
              >
                <Check className="h-4 w-4 stroke-[2.5]" />
                <span>Confirm & Save</span>
              </button>

              {!isEditingInline ? (
                <button
                  type="button"
                  id="quick-add-edit-btn"
                  onClick={() => setIsEditingInline(true)}
                  className={`min-h-[44px] px-3.5 rounded-2xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition active:scale-95 ${
                    isDark
                      ? 'border-white/15 bg-white/5 text-slate-200 hover:bg-white/10'
                      : 'border-slate-200 bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                  title="Edit details"
                >
                  <Edit3 className="h-3.5 w-3.5" />
                  <span>Edit</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsEditingInline(false)}
                  className="min-h-[44px] px-3 rounded-2xl border border-white/15 bg-white/5 text-xs font-semibold text-slate-300 hover:text-white"
                >
                  Done
                </button>
              )}

              {onOpenFullEdit && (
                <button
                  type="button"
                  onClick={handleOpenFullForm}
                  className={`min-h-[44px] px-2.5 rounded-2xl border text-[11px] transition text-slate-400 hover:text-white ${
                    isDark ? 'border-white/10 hover:bg-white/5' : 'border-slate-200 hover:bg-slate-100'
                  }`}
                  title="Open in full form modal"
                >
                  Full Form
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
};
