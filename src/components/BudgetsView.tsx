import React, { useState } from 'react';
import {
  Wallet,
  Plus,
  Trash2,
  Edit2,
  Check,
  RotateCcw,
  ShieldAlert,
  ArrowRight,
  PiggyBank,
  TrendingUp,
  AlertTriangle,
  Info,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Expense, CategoryItem, CategoryBudgetConfig, RolloverType, UserSettings } from '../types';
import { getCategoryMeta, getCategoryBarColor } from '../data/categories';
import { computeCategoryBudgets, getPreviousMonthKey } from '../utils/budgetRollover';

interface BudgetsViewProps {
  expenses: Expense[];
  settings: UserSettings;
  categories: CategoryItem[];
  onUpdateSettings: (newSettings: Partial<UserSettings>) => void;
  onUpdateCategoryBudgetConfig: (categoryName: string, config: Partial<CategoryBudgetConfig>) => void;
  onOpenAddSavingsTransfer?: () => void;
  isDark?: boolean;
}

export const BudgetsView: React.FC<BudgetsViewProps> = ({
  expenses,
  settings,
  categories,
  onUpdateSettings,
  onUpdateCategoryBudgetConfig,
  onOpenAddSavingsTransfer,
  isDark = true,
}) => {
  const sym = settings.currencySymbol || 'RM';
  const now = new Date();
  const currentYearMonth = now.toISOString().slice(0, 7);
  const prevYearMonth = getPreviousMonthKey(currentYearMonth);

  // Helper for integer cents
  const toCents = (n: number) => Math.round((Number(n) || 0) * 100);

  const formatMoney = (amount: number): string => {
    const rounded = Math.round((Number(amount) || 0) * 100) / 100;
    if (rounded % 1 === 0) {
      return `${sym}${rounded.toLocaleString('en-US')}`;
    }
    return `${sym}${rounded.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  // Editing overall monthly budget
  const [isEditingOverall, setIsEditingOverall] = useState(false);
  const [overallInput, setOverallInput] = useState(String(settings.monthlyBudget || ''));

  // Editing monthly savings target
  const [isEditingSavings, setIsEditingSavings] = useState(false);
  const [savingsInput, setSavingsInput] = useState(String(settings.savingsTarget || ''));

  // Category Wallets
  const categoryBudgets = settings.categoryBudgets || {};
  const categoryBudgetConfigs = settings.categoryBudgetConfigs || {};

  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [editBaseBudget, setEditBaseBudget] = useState<string>('');
  const [editRolloverEnabled, setEditRolloverEnabled] = useState<boolean>(false);
  const [editRolloverType, setEditRolloverType] = useState<RolloverType>('unlimited');
  const [editRolloverCap, setEditRolloverCap] = useState<string>('');
  const [editAllowNegative, setEditAllowNegative] = useState<boolean>(false);

  // New Wallet Form
  const [isAddingWallet, setIsAddingWallet] = useState(false);
  const [selectedNewCategory, setSelectedNewCategory] = useState<string>('');
  const [newWalletAmount, setNewWalletAmount] = useState<string>('300');
  const [newRolloverEnabled, setNewRolloverEnabled] = useState<boolean>(true);
  const [newRolloverType, setNewRolloverType] = useState<RolloverType>('unlimited');
  const [newRolloverCap, setNewRolloverCap] = useState<string>('200');

  // Compute category budgets with rollover
  const computedBudgets = computeCategoryBudgets(
    expenses,
    categoryBudgets,
    categoryBudgetConfigs,
    currentYearMonth
  );

  // Monthly Expenses
  const monthlyExpenses = expenses.filter(
    (e) => (e.type || 'expense') === 'expense' && e.date?.startsWith(currentYearMonth)
  );

  const totalSpentCents = monthlyExpenses.reduce((sum, e) => sum + toCents(e.amount), 0);
  const totalSpent = totalSpentCents / 100;
  const overallBudgetCents = toCents(settings.monthlyBudget);
  const overallBudget = overallBudgetCents / 100;
  const isOverBudget = overallBudgetCents > 0 && totalSpentCents > overallBudgetCents;
  const overallPct = overallBudgetCents > 0 ? Math.min(Math.round((totalSpentCents / overallBudgetCents) * 100), 100) : 0;
  const overallRemaining = Math.max(0, (overallBudgetCents - totalSpentCents) / 100);
  const overallOver = isOverBudget ? (totalSpentCents - overallBudgetCents) / 100 : 0;

  // Monthly Savings contributions (explicitly tagged or categorized as Savings/Investment)
  const savingsContributionsCents = expenses
    .filter(
      (e) =>
        e.date?.startsWith(currentYearMonth) &&
        (e.category === 'Savings' ||
          e.category === 'Investment' ||
          e.tags?.some((t) => t.toLowerCase().includes('saving')))
    )
    .reduce((sum, e) => sum + toCents(e.amount), 0);
  const savingsContributions = savingsContributionsCents / 100;
  const savingsTargetCents = toCents(settings.savingsTarget || 0);
  const savingsTarget = savingsTargetCents / 100;
  const savingsPct = savingsTargetCents > 0 ? Math.min(Math.round((savingsContributionsCents / savingsTargetCents) * 100), 100) : 0;

  // Available categories to add
  const availableCategories = categories
    .filter((c) => c.type !== 'income')
    .map((c) => c.name)
    .filter((name) => !(name in categoryBudgets));

  const handleSaveOverallBudget = () => {
    const val = parseFloat(overallInput);
    if (!isNaN(val) && val >= 0) {
      onUpdateSettings({ monthlyBudget: val });
    }
    setIsEditingOverall(false);
  };

  const handleSaveSavingsTarget = () => {
    const val = parseFloat(savingsInput);
    if (!isNaN(val) && val >= 0) {
      onUpdateSettings({ savingsTarget: val });
    }
    setIsEditingSavings(false);
  };

  const handleStartEditCategory = (catName: string) => {
    const computed = computedBudgets[catName];
    const config = categoryBudgetConfigs[catName] || {
      category: catName,
      baseBudget: categoryBudgets[catName] || 0,
      rolloverEnabled: false,
      rolloverType: 'none',
      allowNegativeRollover: false,
    };

    setEditingCategory(catName);
    setEditBaseBudget(String(computed ? computed.baseBudget : categoryBudgets[catName] || 0));
    setEditRolloverEnabled(!!config.rolloverEnabled);
    setEditRolloverType(config.rolloverType || (config.rolloverEnabled ? 'unlimited' : 'none'));
    setEditRolloverCap(config.rolloverCap ? String(config.rolloverCap) : '');
    setEditAllowNegative(!!config.allowNegativeRollover);
  };

  const handleSaveEditCategory = (catName: string) => {
    const val = parseFloat(editBaseBudget);
    if (!isNaN(val) && val >= 0) {
      const capVal = parseFloat(editRolloverCap);
      const updatedConfig: Partial<CategoryBudgetConfig> = {
        baseBudget: val,
        rolloverEnabled: editRolloverEnabled,
        rolloverType: editRolloverEnabled ? editRolloverType : 'none',
        rolloverCap: !isNaN(capVal) && capVal > 0 ? capVal : undefined,
        allowNegativeRollover: editAllowNegative,
      };

      onUpdateCategoryBudgetConfig(catName, updatedConfig);
      onUpdateSettings({
        categoryBudgets: {
          ...categoryBudgets,
          [catName]: val,
        },
      });
    }
    setEditingCategory(null);
  };

  const handleDeleteWallet = (catName: string) => {
    const updated = { ...categoryBudgets };
    delete updated[catName];
    onUpdateSettings({ categoryBudgets: updated });
  };

  const handleCreateWallet = () => {
    if (!selectedNewCategory) return;
    const val = parseFloat(newWalletAmount);
    if (isNaN(val) || val <= 0) return;

    const capVal = parseFloat(newRolloverCap);
    const config: CategoryBudgetConfig = {
      category: selectedNewCategory,
      baseBudget: val,
      rolloverEnabled: newRolloverEnabled,
      rolloverType: newRolloverEnabled ? newRolloverType : 'none',
      rolloverCap: !isNaN(capVal) && capVal > 0 ? capVal : undefined,
      allowNegativeRollover: false,
    };

    onUpdateCategoryBudgetConfig(selectedNewCategory, config);
    onUpdateSettings({
      categoryBudgets: {
        ...categoryBudgets,
        [selectedNewCategory]: val,
      },
    });

    setIsAddingWallet(false);
    setSelectedNewCategory('');
  };

  return (
    <div className="space-y-4">
      {/* View Title */}
      <div className="flex items-center justify-between px-1">
        <div>
          <h2 className={`text-base font-bold tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
            Budgets & Savings
          </h2>
          <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            {now.toLocaleString('default', { month: 'long', year: 'numeric' })}
          </p>
        </div>
      </div>

      {/* 1. Overall Monthly Budget Card */}
      <div
        className={`rounded-3xl border p-4 sm:p-5 transition-all shadow-sm ${
          isDark
            ? 'border-white/10 bg-white/5 backdrop-blur-2xl text-slate-100'
            : 'border-slate-200 bg-white text-slate-800'
        }`}
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
              <Wallet className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Monthly Spending Budget
              </h3>
              <div className="flex items-center gap-1.5">
                <span className={`text-base sm:text-lg font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  {overallBudget > 0 ? formatMoney(overallBudget) : 'No limit set'}
                </span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              setOverallInput(String(settings.monthlyBudget || ''));
              setIsEditingOverall(!isEditingOverall);
            }}
            className={`min-h-[44px] px-3 py-1.5 rounded-xl border text-xs font-semibold transition active:scale-95 ${
              isDark
                ? 'border-white/10 bg-white/5 text-indigo-300 hover:bg-white/10'
                : 'border-slate-200 bg-slate-50 text-indigo-600 hover:bg-slate-100'
            }`}
          >
            {isEditingOverall ? 'Cancel' : 'Edit Budget'}
          </button>
        </div>

        {/* Edit Overall Budget Inline */}
        {isEditingOverall && (
          <div className="mb-3.5 p-3 rounded-2xl border border-indigo-500/30 bg-indigo-500/10 space-y-2">
            <label className="text-xs font-semibold text-indigo-300">
              Set monthly budget limit ({sym})
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="0"
                step="10"
                value={overallInput}
                onChange={(e) => setOverallInput(e.target.value)}
                placeholder="e.g. 2500"
                className={`flex-1 rounded-xl border px-3 py-2 text-xs font-semibold ${
                  isDark
                    ? 'border-white/15 bg-slate-900 text-white'
                    : 'border-slate-300 bg-white text-slate-900'
                }`}
              />
              <button
                type="button"
                onClick={handleSaveOverallBudget}
                className="min-h-[44px] px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition"
              >
                Save
              </button>
            </div>
          </div>
        )}

        {/* Budget Metrics */}
        {overallBudget > 0 && (
          <div className="space-y-2 pt-1">
            <div className="flex items-center justify-between text-xs">
              <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>
                Spent: <strong className={isDark ? 'text-white' : 'text-slate-800'}>{formatMoney(totalSpent)}</strong>
              </span>
              <span className="font-semibold">
                {isOverBudget ? (
                  <span className="text-rose-400">Over budget by {formatMoney(overallOver)}</span>
                ) : (
                  <span className="text-emerald-400">{formatMoney(overallRemaining)} remaining</span>
                )}
              </span>
            </div>

            {/* Progress Bar */}
            <div className={`h-2.5 w-full rounded-full overflow-hidden ${isDark ? 'bg-white/10' : 'bg-slate-200'}`}>
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  isOverBudget
                    ? 'bg-rose-500'
                    : overallPct > 80
                    ? 'bg-amber-400'
                    : 'bg-indigo-500'
                }`}
                style={{ width: `${overallPct}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* 2. Savings Target Card */}
      <div
        className={`rounded-3xl border p-4 sm:p-5 transition-all shadow-sm ${
          isDark
            ? 'border-white/10 bg-white/5 backdrop-blur-2xl text-slate-100'
            : 'border-slate-200 bg-white text-slate-800'
        }`}
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              <PiggyBank className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Monthly Savings Target
              </h3>
              <div className="flex items-center gap-1.5">
                <span className={`text-base sm:text-lg font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  {savingsTarget > 0 ? formatMoney(savingsTarget) : 'No target set'}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => {
                setSavingsInput(String(settings.savingsTarget || ''));
                setIsEditingSavings(!isEditingSavings);
              }}
              className={`min-h-[44px] px-3 py-1.5 rounded-xl border text-xs font-semibold transition active:scale-95 ${
                isDark
                  ? 'border-white/10 bg-white/5 text-emerald-300 hover:bg-white/10'
                  : 'border-slate-200 bg-slate-50 text-emerald-600 hover:bg-slate-100'
              }`}
            >
              {isEditingSavings ? 'Cancel' : 'Set Target'}
            </button>
          </div>
        </div>

        {/* Edit Savings Target Inline */}
        {isEditingSavings && (
          <div className="mb-3.5 p-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 space-y-2">
            <label className="text-xs font-semibold text-emerald-300">
              Monthly savings goal ({sym})
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="0"
                step="50"
                value={savingsInput}
                onChange={(e) => setSavingsInput(e.target.value)}
                placeholder="e.g. 500"
                className={`flex-1 rounded-xl border px-3 py-2 text-xs font-semibold ${
                  isDark
                    ? 'border-white/15 bg-slate-900 text-white'
                    : 'border-slate-300 bg-white text-slate-900'
                }`}
              />
              <button
                type="button"
                onClick={handleSaveSavingsTarget}
                className="min-h-[44px] px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition"
              >
                Save
              </button>
            </div>
          </div>
        )}

        {/* Savings Progress */}
        <div className="space-y-2 pt-1">
          <div className="flex items-center justify-between text-xs">
            <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>
              Recorded Savings: <strong className="text-emerald-400">{formatMoney(savingsContributions)}</strong>
            </span>
            {savingsTarget > 0 && (
              <span className="font-semibold text-slate-300">{savingsPct}% of target</span>
            )}
          </div>

          {savingsTarget > 0 && (
            <div className={`h-2.5 w-full rounded-full overflow-hidden ${isDark ? 'bg-white/10' : 'bg-slate-200'}`}>
              <div
                className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                style={{ width: `${savingsPct}%` }}
              />
            </div>
          )}

          {/* Log Savings Transfer Button */}
          {onOpenAddSavingsTransfer && (
            <div className="pt-2">
              <button
                type="button"
                onClick={onOpenAddSavingsTransfer}
                className={`w-full min-h-[44px] flex items-center justify-center gap-1.5 rounded-2xl border text-xs font-semibold transition active:scale-98 ${
                  isDark
                    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20'
                    : 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                }`}
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Record Savings Contribution</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 3. Category Budgets & Wallets Section */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center justify-between px-1">
          <div>
            <h3 className={`text-sm font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
              Category Budget Wallets
            </h3>
            <p className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              Enforce per-category limits and month-to-month rollover
            </p>
          </div>

          {!isAddingWallet && availableCategories.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setSelectedNewCategory(availableCategories[0] || '');
                setIsAddingWallet(true);
              }}
              className="min-h-[44px] flex items-center gap-1 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow transition active:scale-95"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Add Budget</span>
            </button>
          )}
        </div>

        {/* Add Wallet Inline Card */}
        {isAddingWallet && (
          <div
            className={`rounded-3xl border p-4 space-y-3 ${
              isDark ? 'border-indigo-500/40 bg-[#0c1533]' : 'border-indigo-200 bg-indigo-50/50'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-indigo-400 uppercase tracking-wider">
                New Category Budget
              </span>
              <button
                type="button"
                onClick={() => setIsAddingWallet(false)}
                className="text-xs text-slate-400 hover:text-white"
              >
                Cancel
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-medium text-slate-400 mb-1 block">Category</label>
                <select
                  value={selectedNewCategory}
                  onChange={(e) => setSelectedNewCategory(e.target.value)}
                  className={`w-full rounded-xl border px-3 py-2 text-xs ${
                    isDark ? 'border-white/10 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-900'
                  }`}
                >
                  {availableCategories.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[11px] font-medium text-slate-400 mb-1 block">
                  Monthly Limit ({sym})
                </label>
                <input
                  type="number"
                  min="1"
                  step="10"
                  value={newWalletAmount}
                  onChange={(e) => setNewWalletAmount(e.target.value)}
                  className={`w-full rounded-xl border px-3 py-2 text-xs ${
                    isDark ? 'border-white/10 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-900'
                  }`}
                />
              </div>
            </div>

            {/* Rollover Toggle */}
            <div className="flex items-center justify-between pt-1">
              <label className="text-xs text-slate-300 flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={newRolloverEnabled}
                  onChange={(e) => setNewRolloverEnabled(e.target.checked)}
                  className="rounded border-white/20 text-indigo-600 focus:ring-indigo-500"
                />
                <span>Enable rollover from previous month</span>
              </label>

              <button
                type="button"
                onClick={handleCreateWallet}
                className="min-h-[44px] px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition"
              >
                Create Budget
              </button>
            </div>
          </div>
        )}

        {/* Wallets List */}
        {Object.keys(categoryBudgets).length === 0 ? (
          <div
            className={`rounded-3xl border border-dashed p-6 text-center space-y-2 ${
              isDark ? 'border-white/10 bg-white/5' : 'border-slate-300 bg-slate-50'
            }`}
          >
            <p className="text-xs font-semibold text-slate-300">No category budgets created yet</p>
            <p className="text-[11px] text-slate-400 max-w-xs mx-auto">
              Allocate budgets to specific categories (e.g. Groceries, Dining, Fuel) to monitor spending limits.
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {Object.entries(categoryBudgets).map(([catName, rawBaseBudget]) => {
              const baseBudgetNum = Number(rawBaseBudget) || 0;
              const computed = computedBudgets[catName] || {
                category: catName,
                baseBudget: baseBudgetNum,
                availableBudget: baseBudgetNum,
                spentThisMonth: 0,
                eligibleRollover: 0,
                remainingBudget: baseBudgetNum,
                percentUsed: 0,
                isOver: false,
                isNearLimit: false,
                rolloverEnabled: false,
                rolloverType: 'none' as const,
                allowNegativeRollover: false,
                previousMonthKey: '',
                previousUnusedAmount: 0,
              };

              const availableBudgetNum = Number(computed.availableBudget) || baseBudgetNum;
              const eligibleRollover = Number(computed.eligibleRollover) || 0;
              const spentThisMonth = Number(computed.spentThisMonth) || 0;

              const meta = getCategoryMeta(catName);
              const Icon = meta.icon;
              const isEditingThis = editingCategory === catName;
              const isOver = spentThisMonth > availableBudgetNum;
              const pct = availableBudgetNum > 0
                ? Math.min(Math.round((spentThisMonth / availableBudgetNum) * 100), 100)
                : 0;

              return (
                <div
                  key={catName}
                  className={`rounded-2xl border p-3.5 transition-all ${
                    isDark ? 'border-white/10 bg-white/5' : 'border-slate-200 bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border ${meta.bgColor} ${meta.color} ${meta.borderColor}`}
                      >
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-xs text-white truncate">{catName}</span>
                          {eligibleRollover !== 0 && (
                            <span
                              className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${
                                eligibleRollover > 0
                                  ? 'bg-emerald-500/20 text-emerald-300'
                                  : 'bg-rose-500/20 text-rose-300'
                              }`}
                            >
                              {eligibleRollover > 0 ? '+' : ''}
                              {formatMoney(eligibleRollover)} carryover
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {formatMoney(spentThisMonth)} of {formatMoney(availableBudgetNum)} limit
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => (isEditingThis ? setEditingCategory(null) : handleStartEditCategory(catName))}
                        className="p-2 text-slate-400 hover:text-white transition rounded-lg"
                        title="Edit wallet"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteWallet(catName)}
                        className="p-2 text-rose-400/80 hover:text-rose-400 transition rounded-lg"
                        title="Delete wallet"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Inline Edit form */}
                  {isEditingThis && (
                    <div className="mb-2.5 pt-2 border-t border-white/10 space-y-2">
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min="0"
                          step="10"
                          value={editBaseBudget}
                          onChange={(e) => setEditBaseBudget(e.target.value)}
                          className={`flex-1 rounded-xl border px-3 py-1.5 text-xs ${
                            isDark ? 'border-white/15 bg-slate-900 text-white' : 'border-slate-300 bg-white text-slate-900'
                          }`}
                        />
                        <button
                          type="button"
                          onClick={() => handleSaveEditCategory(catName)}
                          className="min-h-[44px] px-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold"
                        >
                          Save
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Progress bar */}
                  <div className={`h-2 w-full rounded-full overflow-hidden ${isDark ? 'bg-white/10' : 'bg-slate-200'}`}>
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        isOver
                          ? 'bg-rose-500'
                          : pct > 80
                          ? 'bg-amber-400'
                          : 'bg-indigo-500'
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footnote */}
      <div className="pt-2 text-center">
        <p className="text-[11px] text-slate-500">
          Budgets and savings are based on recorded transactions, not external bank balances.
        </p>
      </div>
    </div>
  );
};
