import React, { useState } from 'react';
import {
  X,
  Plus,
  Repeat,
  Calendar,
  Clock,
  Check,
  Trash2,
  Edit2,
  RefreshCw,
  Sparkles,
  ArrowDownLeft,
  ArrowUpRight,
  AlertCircle,
  Play,
  Pause,
  Sliders,
  DollarSign,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { RecurringExpense, RecurringInterval, ExpenseCategory, PaymentMethod, CategoryItem, TransactionType } from '../types';
import { getCategoryMeta } from '../data/categories';
import {
  formatDueDateLabel,
  calculateEstimatedMonthlyCost,
  calculateNextDueDate,
  POPULAR_RECURRING_PRESETS,
  RecurringPreset,
} from '../utils/recurring';

interface RecurringExpensesModalProps {
  isOpen: boolean;
  onClose: () => void;
  recurringExpenses: RecurringExpense[];
  onAddRecurring: (
    rule: Omit<RecurringExpense, 'id' | 'createdAt' | 'nextDueDate'> & {
      initialNextDueDate?: string;
      generateFirstNow?: boolean;
    }
  ) => void;
  onUpdateRecurring: (id: string, updated: Partial<RecurringExpense>) => void;
  onDeleteRecurring: (id: string) => void;
  onToggleActive: (id: string) => void;
  onProcessDue: () => { generatedCount: number; generatedItems: string[] };
  currencySymbol: string;
  defaultCurrency: string;
  customCategories?: CategoryItem[];
  isDark?: boolean;
}

export const RecurringExpensesModal: React.FC<RecurringExpensesModalProps> = ({
  isOpen,
  onClose,
  recurringExpenses,
  onAddRecurring,
  onUpdateRecurring,
  onDeleteRecurring,
  onToggleActive,
  onProcessDue,
  currencySymbol,
  defaultCurrency,
  customCategories = [],
  isDark = true,
}) => {
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  const [processFeedback, setProcessFeedback] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Form states
  const [formType, setFormType] = useState<TransactionType>('expense');
  const [formMerchant, setFormMerchant] = useState('');
  const [formAmount, setFormAmount] = useState('');
  const [formInterval, setFormInterval] = useState<RecurringInterval>('monthly');
  const [formCategory, setFormCategory] = useState<ExpenseCategory>('Utilities & Bills');
  const [formPaymentMethod, setFormPaymentMethod] = useState<PaymentMethod>('Bank Transfer');
  const [formStartDate, setFormStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [formGenerateNow, setFormGenerateNow] = useState(false);
  const [formSummary, setFormSummary] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  if (!isOpen) return null;

  const monthlyEstimates = calculateEstimatedMonthlyCost(recurringExpenses);
  const todayStr = new Date().toISOString().slice(0, 10);
  const dueCount = recurringExpenses.filter(
    (r) => r.isActive && r.nextDueDate <= todayStr
  ).length;

  const resetForm = () => {
    setFormType('expense');
    setFormMerchant('');
    setFormAmount('');
    setFormInterval('monthly');
    setFormCategory('Utilities & Bills');
    setFormPaymentMethod('Bank Transfer');
    setFormStartDate(new Date().toISOString().slice(0, 10));
    setFormGenerateNow(false);
    setFormSummary('');
    setFormError(null);
    setEditingRuleId(null);
  };

  const handleOpenEdit = (rule: RecurringExpense) => {
    setEditingRuleId(rule.id);
    setFormType(rule.type);
    setFormMerchant(rule.merchant);
    setFormAmount(rule.amount.toString());
    setFormInterval(rule.interval);
    setFormCategory(rule.category);
    setFormPaymentMethod(rule.paymentMethod);
    setFormStartDate(rule.nextDueDate);
    setFormGenerateNow(false);
    setFormSummary(rule.summary || '');
    setFormError(null);
    setShowAddForm(true);
  };

  const handleSelectPreset = (preset: RecurringPreset) => {
    setFormType(preset.type);
    setFormMerchant(preset.name);
    setFormAmount(preset.defaultAmount.toString());
    setFormCategory(preset.category as ExpenseCategory);
    setFormPaymentMethod(preset.paymentMethod as PaymentMethod);
    setFormInterval(preset.interval);
    setFormSummary(preset.summary);
    setFormError(null);
  };

  const handleSubmitForm = (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = parseFloat(formAmount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setFormError('Please enter a valid positive amount.');
      return;
    }
    if (!formMerchant.trim()) {
      setFormError('Please enter a title or subscription merchant.');
      return;
    }

    if (editingRuleId) {
      onUpdateRecurring(editingRuleId, {
        type: formType,
        merchant: formMerchant.trim(),
        amount: numAmount,
        interval: formInterval,
        category: formCategory,
        paymentMethod: formPaymentMethod,
        nextDueDate: formStartDate,
        summary: formSummary.trim(),
      });
      setProcessFeedback(`Updated "${formMerchant.trim()}"`);
    } else {
      onAddRecurring({
        type: formType,
        merchant: formMerchant.trim(),
        amount: numAmount,
        currency: defaultCurrency,
        interval: formInterval,
        category: formCategory,
        paymentMethod: formPaymentMethod,
        startDate: formStartDate,
        initialNextDueDate: formStartDate,
        generateFirstNow: formGenerateNow,
        summary: formSummary.trim(),
        isActive: true,
      });
      setProcessFeedback(
        formGenerateNow
          ? `Created "${formMerchant.trim()}" & logged entry for today!`
          : `Scheduled recurring "${formMerchant.trim()}"`
      );
    }

    setTimeout(() => setProcessFeedback(null), 4000);
    resetForm();
    setShowAddForm(false);
  };

  const handleManualProcessDue = () => {
    setIsProcessing(true);
    try {
      const result = onProcessDue();
      if (result.generatedCount > 0) {
        setProcessFeedback(
          `Logged ${result.generatedCount} recurring entr${
            result.generatedCount > 1 ? 'ies' : 'y'
          }: ${result.generatedItems.join(', ')}`
        );
      } else {
        setProcessFeedback('All recurring items are up to date! None due right now.');
      }
    } catch (e) {
      console.error(e);
      setProcessFeedback('Error checking due entries');
    } finally {
      setIsProcessing(false);
      setTimeout(() => setProcessFeedback(null), 5000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-2xl overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className={`relative w-full max-w-lg my-auto rounded-3xl border shadow-2xl overflow-hidden flex flex-col max-h-[92vh] transition-colors ${
          isDark
            ? 'border-white/15 bg-[#0b132b]/95 text-slate-100'
            : 'border-slate-200 bg-white text-slate-800'
        }`}
      >
        {/* Header */}
        <div
          className={`flex items-center justify-between border-b px-5 py-4 ${
            isDark ? 'border-white/10 bg-white/5' : 'border-slate-100 bg-slate-50'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-purple-500/20 text-purple-400 border border-purple-500/30 shadow-inner">
              <Repeat className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold flex items-center gap-2">
                <span>Recurring Expenses</span>
                {dueCount > 0 && (
                  <span className="rounded-full bg-rose-500/20 border border-rose-500/30 px-2 py-0.5 text-[10px] font-semibold text-rose-400">
                    {dueCount} Due
                  </span>
                )}
              </h2>
              <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                Fixed subscriptions, rent, and auto-generated bills
              </p>
            </div>
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

        {/* Feedback Alert Toast */}
        {processFeedback && (
          <div className="mx-5 mt-4 rounded-2xl border border-indigo-500/40 bg-indigo-950/50 p-3 text-xs text-indigo-200 flex items-center justify-between shadow-lg">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-indigo-400 shrink-0 animate-pulse" />
              <span>{processFeedback}</span>
            </div>
            <button
              onClick={() => setProcessFeedback(null)}
              className="text-slate-400 hover:text-white ml-2 text-xs"
            >
              ✕
            </button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Top Monthly Fixed Cost Summary Cards */}
          <div
            className={`rounded-3xl border p-4 shadow-sm transition-colors ${
              isDark ? 'border-white/10 bg-white/5' : 'border-slate-200 bg-slate-50'
            }`}
          >
            <div className="flex items-center justify-between mb-3">
              <span
                className={`text-xs font-semibold uppercase tracking-wider ${
                  isDark ? 'text-slate-400' : 'text-slate-500'
                }`}
              >
                Estimated Monthly Commitments
              </span>
              <button
                type="button"
                onClick={handleManualProcessDue}
                disabled={isProcessing}
                className="inline-flex items-center gap-1.5 rounded-xl bg-purple-500/20 border border-purple-500/30 px-2.5 py-1 text-[11px] font-semibold text-purple-300 hover:bg-purple-500/30 transition active:scale-95"
                title="Check and process any due entries right now"
              >
                <RefreshCw className={`h-3 w-3 ${isProcessing ? 'animate-spin' : ''}`} />
                <span>Process Due Now</span>
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-center">
              <div
                className={`rounded-2xl border p-3 ${
                  isDark ? 'border-white/5 bg-white/5' : 'border-slate-200 bg-white'
                }`}
              >
                <span className={`text-[11px] block mb-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  Fixed Monthly Expenses
                </span>
                <span className="text-base font-bold text-rose-400">
                  {currencySymbol}
                  {monthlyEstimates.totalExpense.toFixed(2)}
                </span>
              </div>

              <div
                className={`rounded-2xl border p-3 ${
                  isDark ? 'border-white/5 bg-white/5' : 'border-slate-200 bg-white'
                }`}
              >
                <span className={`text-[11px] block mb-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  Active Subscriptions
                </span>
                <span className={`text-base font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  {recurringExpenses.filter((r) => r.isActive).length} active
                </span>
              </div>
            </div>
          </div>

          {/* Quick Add Toggle Button */}
          {!showAddForm && (
            <button
              type="button"
              onClick={() => {
                resetForm();
                setShowAddForm(true);
              }}
              className="w-full flex items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-indigo-500/40 p-3 text-xs font-semibold text-indigo-400 hover:border-indigo-400 hover:bg-indigo-500/10 transition active:scale-98"
            >
              <Plus className="h-4 w-4" />
              <span>+ Add Subscription or Fixed Bill</span>
            </button>
          )}

          {/* Add / Edit Form Modal Segment */}
          <AnimatePresence>
            {showAddForm && (
              <motion.form
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                onSubmit={handleSubmitForm}
                className={`rounded-3xl border p-4 space-y-3.5 shadow-lg overflow-hidden transition-colors ${
                  isDark ? 'border-indigo-500/30 bg-[#0f172a]' : 'border-indigo-200 bg-indigo-50/40'
                }`}
              >
                <div className="flex items-center justify-between border-b pb-2.5 border-white/10">
                  <h3 className="text-xs font-bold flex items-center gap-1.5 text-indigo-400">
                    <Repeat className="h-3.5 w-3.5" />
                    <span>
                      {editingRuleId ? 'Edit Recurring Rule' : 'New Recurring Expense or Income'}
                    </span>
                  </h3>
                  <button
                    type="button"
                    onClick={() => {
                      resetForm();
                      setShowAddForm(false);
                    }}
                    className="text-slate-400 hover:text-white text-xs"
                  >
                    Cancel
                  </button>
                </div>

                {formError && (
                  <div className="rounded-xl border border-rose-500/30 bg-rose-950/40 p-2 text-xs text-rose-300">
                    {formError}
                  </div>
                )}

                {/* Popular Presets Quick Selector */}
                {!editingRuleId && (
                  <div>
                    <label className={`text-[11px] font-medium block mb-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                      Quick Presets:
                    </label>
                    <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
                      {POPULAR_RECURRING_PRESETS.map((preset) => (
                        <button
                          key={preset.name}
                          type="button"
                          onClick={() => handleSelectPreset(preset)}
                          className={`rounded-lg border px-2 py-0.5 text-[11px] transition ${
                            formMerchant === preset.name
                              ? 'border-indigo-500 bg-indigo-500/20 text-indigo-300 font-semibold'
                              : isDark
                              ? 'border-white/10 bg-white/5 text-slate-400 hover:text-slate-200'
                              : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-100'
                          }`}
                        >
                          + {preset.name} ({currencySymbol}
                          {preset.defaultAmount})
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Expense vs Income Type */}
                <div className="grid grid-cols-2 gap-2 p-0.5 rounded-xl border border-white/10 bg-white/5 text-xs font-semibold">
                  <button
                    type="button"
                    onClick={() => setFormType('expense')}
                    className={`py-1.5 rounded-lg transition ${
                      formType === 'expense'
                        ? 'bg-rose-600 text-white shadow'
                        : isDark
                        ? 'text-slate-400'
                        : 'text-slate-600'
                    }`}
                  >
                    Expense (-)
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormType('income')}
                    className={`py-1.5 rounded-lg transition ${
                      formType === 'income'
                        ? 'bg-emerald-600 text-white shadow'
                        : isDark
                        ? 'text-slate-400'
                        : 'text-slate-600'
                    }`}
                  >
                    Income (+)
                  </button>
                </div>

                {/* Merchant & Amount */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="text-[11px] font-medium text-slate-400 block mb-1">
                      Title / Subscription
                    </label>
                    <input
                      type="text"
                      required
                      value={formMerchant}
                      onChange={(e) => setFormMerchant(e.target.value)}
                      placeholder="e.g. Netflix, House Rent, Gym"
                      className={`w-full rounded-xl border px-3 py-2 text-xs focus:outline-none ${
                        isDark
                          ? 'border-white/10 bg-white/5 text-white'
                          : 'border-slate-300 bg-white text-slate-900'
                      }`}
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-medium text-slate-400 block mb-1">
                      Amount ({currencySymbol})
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={formAmount}
                      onChange={(e) => setFormAmount(e.target.value)}
                      placeholder="0.00"
                      className={`w-full rounded-xl border px-3 py-2 text-xs focus:outline-none font-bold ${
                        formType === 'income' ? 'text-emerald-400' : 'text-rose-400'
                      } ${
                        isDark
                          ? 'border-white/10 bg-white/5'
                          : 'border-slate-300 bg-white'
                      }`}
                    />
                  </div>
                </div>

                {/* Interval Segmented Buttons: Daily, Weekly, Monthly */}
                <div>
                  <label className="text-[11px] font-medium text-slate-400 block mb-1">
                    Repeat Interval
                  </label>
                  <div className="grid grid-cols-3 gap-1.5 rounded-xl border border-white/10 bg-white/5 p-1 text-xs">
                    {(['daily', 'weekly', 'monthly'] as RecurringInterval[]).map((int) => (
                      <button
                        key={int}
                        type="button"
                        onClick={() => setFormInterval(int)}
                        className={`py-1.5 rounded-lg capitalize font-semibold transition ${
                          formInterval === int
                            ? 'bg-purple-600 text-white shadow'
                            : isDark
                            ? 'text-slate-400 hover:text-white'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        {int}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Category & Payment Method */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[11px] font-medium text-slate-400 block mb-1">
                      Category
                    </label>
                    <select
                      value={formCategory}
                      onChange={(e) => setFormCategory(e.target.value as ExpenseCategory)}
                      className={`w-full rounded-xl border px-2.5 py-1.5 text-xs focus:outline-none ${
                        isDark
                          ? 'border-white/10 bg-[#0f172a] text-white'
                          : 'border-slate-300 bg-white text-slate-900'
                      }`}
                    >
                      <option value="Utilities & Bills">Utilities & Bills</option>
                      <option value="Entertainment">Entertainment</option>
                      <option value="Food & Dining">Food & Dining</option>
                      <option value="Groceries">Groceries</option>
                      <option value="Transportation">Transportation</option>
                      <option value="Health & Medical">Health & Medical</option>
                      <option value="Shopping">Shopping</option>
                      <option value="Salary">Salary</option>
                      <option value="Rental">Rental</option>
                      <option value="Other">Other</option>
                      {customCategories.map((c) => (
                        <option key={c.id} value={c.name}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] font-medium text-slate-400 block mb-1">
                      Payment Method
                    </label>
                    <select
                      value={formPaymentMethod}
                      onChange={(e) => setFormPaymentMethod(e.target.value as PaymentMethod)}
                      className={`w-full rounded-xl border px-2.5 py-1.5 text-xs focus:outline-none ${
                        isDark
                          ? 'border-white/10 bg-[#0f172a] text-white'
                          : 'border-slate-300 bg-white text-slate-900'
                      }`}
                    >
                      <option value="Credit Card">Credit Card</option>
                      <option value="Bank Transfer">Bank Transfer</option>
                      <option value="Debit Card">Debit Card</option>
                      <option value="E-Wallet">E-Wallet</option>
                      <option value="Cash">Cash</option>
                    </select>
                  </div>
                </div>

                {/* Due Date & Generate Immediate Option */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="text-[11px] font-medium text-slate-400 block mb-1">
                      Next Due Date
                    </label>
                    <input
                      type="date"
                      required
                      value={formStartDate}
                      onChange={(e) => setFormStartDate(e.target.value)}
                      className={`w-full rounded-xl border px-2.5 py-1.5 text-xs focus:outline-none ${
                        isDark
                          ? 'border-white/10 bg-white/5 text-white'
                          : 'border-slate-300 bg-white text-slate-900'
                      }`}
                    />
                  </div>

                  {!editingRuleId && (
                    <div className="flex items-center pt-5">
                      <label className="flex items-center gap-2 cursor-pointer text-xs select-none">
                        <input
                          type="checkbox"
                          checked={formGenerateNow}
                          onChange={(e) => setFormGenerateNow(e.target.checked)}
                          className="rounded border-white/20 text-indigo-600 focus:ring-0 h-4 w-4"
                        />
                        <span className={isDark ? 'text-slate-300' : 'text-slate-700'}>
                          Log first entry today
                        </span>
                      </label>
                    </div>
                  )}
                </div>

                {/* Summary / Notes */}
                <div>
                  <input
                    type="text"
                    value={formSummary}
                    onChange={(e) => setFormSummary(e.target.value)}
                    placeholder="Notes (optional, e.g. Autopay active on 15th)"
                    className={`w-full rounded-xl border px-3 py-1.5 text-xs focus:outline-none ${
                      isDark
                        ? 'border-white/10 bg-white/5 text-white'
                        : 'border-slate-300 bg-white text-slate-900'
                    }`}
                  />
                </div>

                {/* Submit Buttons */}
                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      resetForm();
                      setShowAddForm(false);
                    }}
                    className="rounded-xl px-3 py-1.5 text-xs text-slate-400 hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex items-center gap-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 px-4 py-1.5 text-xs font-semibold text-white shadow-md active:scale-95 transition"
                  >
                    <Check className="h-3.5 w-3.5" />
                    <span>{editingRuleId ? 'Save Changes' : 'Save Recurring'}</span>
                  </button>
                </div>
              </motion.form>
            )}
          </AnimatePresence>

          {/* List of Recurring Expenses */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between px-1 text-xs">
              <span className={`font-semibold ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                Active & Scheduled ({recurringExpenses.length})
              </span>
              <span className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                Auto-generates entries on due date
              </span>
            </div>

            {recurringExpenses.length === 0 ? (
              <div
                className={`flex flex-col items-center justify-center rounded-3xl border border-dashed py-8 px-4 text-center ${
                  isDark ? 'border-white/10 bg-white/5' : 'border-slate-300 bg-white'
                }`}
              >
                <Repeat className="h-8 w-8 text-slate-500 mb-2" />
                <p className={`text-xs font-semibold mb-1 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  No recurring expenses set
                </p>
                <p className={`text-[11px] max-w-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  Add your fixed monthly expenses like rent, Netflix, gym or phone bill so they are automatically recorded.
                </p>
              </div>
            ) : (
              recurringExpenses.map((item) => {
                const meta = getCategoryMeta(item.category, customCategories);
                const Icon = meta.icon;
                const dueStatus = formatDueDateLabel(item.nextDueDate);
                const isIncome = item.type === 'income';

                return (
                  <div
                    key={item.id}
                    className={`rounded-2xl border p-3.5 transition-colors shadow-sm ${
                      !item.isActive
                        ? isDark
                          ? 'border-white/5 bg-white/2 opacity-60'
                          : 'border-slate-200 bg-slate-100 opacity-60'
                        : isDark
                        ? 'border-white/10 bg-[#0a1128]/90 hover:border-white/20'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      {/* Left: Icon & Info */}
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div
                          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${meta.bgColor} ${meta.color} border ${meta.borderColor} shadow-inner`}
                        >
                          <Icon className="h-5 w-5" />
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <h4
                              className={`text-sm font-semibold truncate ${
                                isDark ? 'text-white' : 'text-slate-900'
                              }`}
                            >
                              {item.merchant}
                            </h4>

                            {/* Interval Badge */}
                            <span className="rounded-md bg-purple-500/15 border border-purple-500/30 px-1.5 py-0.5 text-[9px] font-semibold text-purple-300 uppercase tracking-wider shrink-0">
                              {item.interval}
                            </span>
                          </div>

                          <div
                            className={`flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] mt-0.5 ${
                              isDark ? 'text-slate-400' : 'text-slate-500'
                            }`}
                          >
                            <span>{item.category}</span>
                            <span>•</span>
                            <span>{item.paymentMethod}</span>
                            {item.summary && (
                              <>
                                <span>•</span>
                                <span className="truncate max-w-[150px]">{item.summary}</span>
                              </>
                            )}
                          </div>

                          {/* Due Date Indicator */}
                          <div className="flex items-center gap-2 mt-1.5">
                            <span
                              className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-semibold border ${dueStatus.colorClass}`}
                            >
                              <Clock className="h-3 w-3" />
                              <span>{dueStatus.label}</span>
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono">
                              ({item.nextDueDate})
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Right: Amount & Controls */}
                      <div className="flex flex-col items-end gap-2 shrink-0">
                        <span
                          className={`text-sm sm:text-base font-bold ${
                            isIncome
                              ? 'text-emerald-400'
                              : isDark
                              ? 'text-white'
                              : 'text-slate-900'
                          }`}
                        >
                          {isIncome ? '+' : '-'}
                          {currencySymbol}
                          {item.amount.toFixed(2)}
                        </span>

                        <div className="flex items-center gap-1">
                          {/* Active / Pause Toggle Button */}
                          <button
                            type="button"
                            onClick={() => onToggleActive(item.id)}
                            className={`p-1.5 rounded-lg border transition ${
                              item.isActive
                                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'
                                : 'border-slate-500/30 bg-slate-500/10 text-slate-400 hover:bg-slate-500/20'
                            }`}
                            title={item.isActive ? 'Active (Click to pause)' : 'Paused (Click to resume)'}
                          >
                            {item.isActive ? (
                              <Pause className="h-3.5 w-3.5" />
                            ) : (
                              <Play className="h-3.5 w-3.5" />
                            )}
                          </button>

                          {/* Edit */}
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(item)}
                            className={`p-1.5 rounded-lg border transition ${
                              isDark
                                ? 'border-white/10 bg-white/5 text-slate-400 hover:text-white hover:bg-white/10'
                                : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                            }`}
                            title="Edit rule"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>

                          {/* Delete */}
                          <button
                            type="button"
                            onClick={() => onDeleteRecurring(item.id)}
                            className="p-1.5 rounded-lg border border-rose-500/20 bg-rose-500/5 text-rose-400 hover:bg-rose-500/20 transition"
                            title="Delete recurring subscription"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Footer */}
        <div
          className={`border-t px-5 py-3 flex items-center justify-between text-xs ${
            isDark ? 'border-white/10 bg-white/5 text-slate-400' : 'border-slate-200 bg-slate-50 text-slate-600'
          }`}
        >
          <span>Auto-checks on app open & runs locally</span>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl px-4 py-2 text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-500 transition"
          >
            Done
          </button>
        </div>
      </motion.div>
    </div>
  );
};
