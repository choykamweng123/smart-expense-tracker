import React, { useState } from 'react';
import {
  Wallet,
  X,
  Plus,
  Trash2,
  Edit2,
  Check,
  AlertTriangle,
  RotateCcw,
  ArrowRight,
  ShieldAlert,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Expense, CategoryItem, CategoryBudgetConfig, RolloverType } from '../types';
import { getCategoryMeta, getCategoryBarColor } from '../data/categories';
import { computeCategoryBudgets, getPreviousMonthKey } from '../utils/budgetRollover';

interface BudgetWalletsModalProps {
  isOpen: boolean;
  onClose: () => void;
  expenses: Expense[];
  currencySymbol: string;
  monthlyBudget: number;
  categoryBudgets: Record<string, number>;
  categoryBudgetConfigs?: Record<string, CategoryBudgetConfig>;
  onUpdateCategoryBudgets: (newBudgets: Record<string, number>) => void;
  onUpdateCategoryBudgetConfig: (categoryName: string, config: Partial<CategoryBudgetConfig>) => void;
  categories: CategoryItem[];
  isDark?: boolean;
}

export const BudgetWalletsModal: React.FC<BudgetWalletsModalProps> = ({
  isOpen,
  onClose,
  expenses,
  currencySymbol,
  monthlyBudget,
  categoryBudgets,
  categoryBudgetConfigs = {},
  onUpdateCategoryBudgets,
  onUpdateCategoryBudgetConfig,
  categories,
  isDark = true,
}) => {
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [editBaseBudget, setEditBaseBudget] = useState<string>('');
  const [editRolloverEnabled, setEditRolloverEnabled] = useState<boolean>(false);
  const [editRolloverType, setEditRolloverType] = useState<RolloverType>('unlimited');
  const [editRolloverCap, setEditRolloverCap] = useState<string>('');
  const [editAllowNegative, setEditAllowNegative] = useState<boolean>(false);

  const [isAddingWallet, setIsAddingWallet] = useState(false);
  const [selectedNewCategory, setSelectedNewCategory] = useState<string>('');
  const [newWalletAmount, setNewWalletAmount] = useState<string>('300');
  const [newRolloverEnabled, setNewRolloverEnabled] = useState<boolean>(true);
  const [newRolloverType, setNewRolloverType] = useState<RolloverType>('unlimited');
  const [newRolloverCap, setNewRolloverCap] = useState<string>('200');
  const [newAllowNegative, setNewAllowNegative] = useState<boolean>(false);

  const [expandedSettingsCat, setExpandedSettingsCat] = useState<string | null>(null);

  if (!isOpen) return null;

  const now = new Date();
  const currentYearMonth = now.toISOString().slice(0, 7);
  const prevYearMonth = getPreviousMonthKey(currentYearMonth);

  // Compute budgets with rollover
  const activeCategoryBudgets = categoryBudgets || {};
  const walletCategories = Object.keys(activeCategoryBudgets);
  const computedBudgets = computeCategoryBudgets(
    expenses,
    activeCategoryBudgets,
    categoryBudgetConfigs,
    currentYearMonth
  );

  const totalBaseAllocated = walletCategories.reduce(
    (sum, cat) => sum + (activeCategoryBudgets[cat] || 0),
    0
  );
  const totalAvailableAllocated = walletCategories.reduce(
    (sum, cat) => sum + (computedBudgets[cat]?.availableBudget || 0),
    0
  );
  const totalSpentThisMonth = walletCategories.reduce(
    (sum, cat) => sum + (computedBudgets[cat]?.spentThisMonth || 0),
    0
  );

  const availableCategories = categories
    .filter((c) => c.type !== 'income')
    .map((c) => c.name)
    .filter((name) => !(name in activeCategoryBudgets));

  const handleStartEdit = (categoryName: string) => {
    const computed = computedBudgets[categoryName];
    const config = categoryBudgetConfigs[categoryName] || {
      category: categoryName,
      baseBudget: activeCategoryBudgets[categoryName] || 0,
      rolloverEnabled: false,
      rolloverType: 'none',
      allowNegativeRollover: false,
    };

    setEditingCategory(categoryName);
    setEditBaseBudget(String(computed ? computed.baseBudget : activeCategoryBudgets[categoryName] || 0));
    setEditRolloverEnabled(!!config.rolloverEnabled);
    setEditRolloverType(config.rolloverType || (config.rolloverEnabled ? 'unlimited' : 'none'));
    setEditRolloverCap(config.rolloverCap ? String(config.rolloverCap) : '');
    setEditAllowNegative(!!config.allowNegativeRollover);
  };

  const handleSaveEdit = (categoryName: string) => {
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

      onUpdateCategoryBudgetConfig(categoryName, updatedConfig);
      onUpdateCategoryBudgets({
        ...activeCategoryBudgets,
        [categoryName]: val,
      });
    }
    setEditingCategory(null);
  };

  const handleDeleteWallet = (categoryName: string) => {
    const updated = { ...activeCategoryBudgets };
    delete updated[categoryName];
    onUpdateCategoryBudgets(updated);
  };

  const handleAddWallet = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedNewCategory) return;
    const amount = parseFloat(newWalletAmount);
    if (isNaN(amount) || amount <= 0) return;

    const capVal = parseFloat(newRolloverCap);
    const config: Partial<CategoryBudgetConfig> = {
      baseBudget: amount,
      rolloverEnabled: newRolloverEnabled,
      rolloverType: newRolloverEnabled ? newRolloverType : 'none',
      rolloverCap: newRolloverType === 'capped' && !isNaN(capVal) && capVal > 0 ? capVal : undefined,
      allowNegativeRollover: newAllowNegative,
    };

    onUpdateCategoryBudgetConfig(selectedNewCategory, config);
    onUpdateCategoryBudgets({
      ...activeCategoryBudgets,
      [selectedNewCategory]: amount,
    });

    setIsAddingWallet(false);
    setSelectedNewCategory('');
    setNewWalletAmount('300');
    setNewRolloverEnabled(true);
    setNewRolloverType('unlimited');
    setNewRolloverCap('200');
    setNewAllowNegative(false);
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        />

        {/* Modal Window */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className={`relative w-full max-w-lg max-h-[90vh] overflow-hidden rounded-3xl border shadow-2xl flex flex-col ${
            isDark
              ? 'border-white/15 bg-[#0f172a] text-slate-100'
              : 'border-slate-200 bg-white text-slate-800'
          }`}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                <Wallet className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-sm sm:text-base font-bold leading-tight">
                  Monthly Category Budgets & Rollover
                </h2>
                <p className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  Custom monthly allowances with automated unused rollover carry-forward
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className={`rounded-xl p-2 transition ${
                isDark ? 'hover:bg-white/10 text-slate-400' : 'hover:bg-slate-100 text-slate-500'
              }`}
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Overview Banner */}
          <div
            className={`px-5 py-3.5 border-b grid grid-cols-2 gap-3 text-xs ${
              isDark ? 'border-white/10 bg-white/5' : 'border-slate-200 bg-slate-50'
            }`}
          >
            <div>
              <span className={`block text-[10px] uppercase font-semibold tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                Base Budget Allocated
              </span>
              <p className="text-base font-black text-indigo-400">
                {currencySymbol} {totalBaseAllocated.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </p>
              <span className="text-[10px] text-slate-400">
                Total spent: {currencySymbol} {totalSpentThisMonth.toFixed(2)}
              </span>
            </div>
            <div className="text-right">
              <span className={`block text-[10px] uppercase font-semibold tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                Total Available (with Rollover)
              </span>
              <p className="text-base font-black text-emerald-400">
                {currencySymbol} {totalAvailableAllocated.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </p>
              <span className="text-[10px] text-slate-400">
                {walletCategories.length} category budgets configured
              </span>
            </div>
          </div>

          {/* Content Body */}
          <div className="flex-1 overflow-y-auto p-5 space-y-3.5">
            {/* Add New Wallet Button */}
            {!isAddingWallet ? (
              <button
                type="button"
                onClick={() => {
                  setIsAddingWallet(true);
                  if (availableCategories.length > 0) {
                    setSelectedNewCategory(availableCategories[0]);
                  }
                }}
                disabled={availableCategories.length === 0}
                className={`w-full flex items-center justify-center gap-2 rounded-2xl border border-dashed py-3 text-xs font-semibold transition active:scale-[0.99] ${
                  availableCategories.length === 0
                    ? 'opacity-50 cursor-not-allowed border-slate-500/30 text-slate-500'
                    : isDark
                    ? 'border-indigo-500/40 bg-indigo-500/10 text-indigo-300 hover:bg-indigo-500/20'
                    : 'border-indigo-300 bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
                }`}
              >
                <Plus className="h-4 w-4" />
                <span>
                  {availableCategories.length === 0
                    ? 'All Categories Have Wallets'
                    : '+ Create New Budget Wallet with Rollover'}
                </span>
              </button>
            ) : (
              <form
                onSubmit={handleAddWallet}
                className={`rounded-2xl border p-4 space-y-3 ${
                  isDark ? 'border-indigo-500/30 bg-indigo-950/20' : 'border-indigo-200 bg-indigo-50/50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-indigo-400">Add Category Wallet & Rollover</h4>
                  <button
                    type="button"
                    onClick={() => setIsAddingWallet(false)}
                    className="text-slate-400 hover:text-white text-xs"
                  >
                    Cancel
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] font-semibold uppercase text-slate-400 block mb-1">
                      Category
                    </label>
                    <select
                      value={selectedNewCategory}
                      onChange={(e) => setSelectedNewCategory(e.target.value)}
                      className={`w-full rounded-xl border px-3 py-2 text-xs font-medium outline-none ${
                        isDark ? 'border-white/10 bg-slate-800 text-white' : 'border-slate-300 bg-white text-slate-900'
                      }`}
                      required
                    >
                      {availableCategories.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] font-semibold uppercase text-slate-400 block mb-1">
                      Monthly Base Budget ({currencySymbol})
                    </label>
                    <input
                      type="number"
                      min="0.01"
                      step="any"
                      value={newWalletAmount}
                      onChange={(e) => setNewWalletAmount(e.target.value)}
                      placeholder="e.g. 600.00"
                      className={`w-full rounded-xl border px-3 py-2 text-xs font-medium outline-none ${
                        isDark ? 'border-white/10 bg-slate-800 text-white' : 'border-slate-300 bg-white text-slate-900'
                      }`}
                      required
                    />
                  </div>
                </div>

                {/* Rollover Settings Section */}
                <div className={`p-3 rounded-xl border space-y-2 text-xs ${
                  isDark ? 'bg-black/30 border-white/10 text-slate-200' : 'bg-white border-slate-200 text-slate-800'
                }`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 font-semibold">
                      <RotateCcw className="h-3.5 w-3.5 text-indigo-400" />
                      <span>Budget Rollover (Carry Forward Unused)</span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={newRolloverEnabled}
                        onChange={(e) => setNewRolloverEnabled(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-8 h-4 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-indigo-600"></div>
                    </label>
                  </div>

                  {newRolloverEnabled && (
                    <div className="space-y-2 pt-1 border-t border-white/5">
                      <div className="flex items-center gap-2">
                        <label className="text-[10px] text-slate-400 uppercase font-semibold">Rollover Type:</label>
                        <select
                          value={newRolloverType}
                          onChange={(e) => setNewRolloverType(e.target.value as RolloverType)}
                          className={`rounded-lg border px-2 py-1 text-xs outline-none ${
                            isDark ? 'bg-slate-800 border-white/10 text-white' : 'bg-slate-50 border-slate-300'
                          }`}
                        >
                          <option value="unlimited">Rollover All Unused Amount</option>
                          <option value="capped">Rollover with Maximum Cap</option>
                        </select>
                      </div>

                      {newRolloverType === 'capped' && (
                        <div className="flex items-center gap-2">
                          <label className="text-[10px] text-slate-400 uppercase font-semibold">Max Cap ({currencySymbol}):</label>
                          <input
                            type="number"
                            min="1"
                            step="any"
                            value={newRolloverCap}
                            onChange={(e) => setNewRolloverCap(e.target.value)}
                            placeholder="e.g. 200"
                            className={`w-24 rounded-lg border px-2 py-1 text-xs outline-none ${
                              isDark ? 'bg-slate-800 border-white/10 text-white' : 'bg-slate-50 border-slate-300'
                            }`}
                          />
                        </div>
                      )}

                      <div className="flex items-center justify-between pt-1">
                        <span className="text-[11px] text-slate-400">Negative Rollover (Deduct overspending):</span>
                        <input
                          type="checkbox"
                          checked={newAllowNegative}
                          onChange={(e) => setNewAllowNegative(e.target.checked)}
                          className="rounded text-indigo-600 focus:ring-0"
                        />
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setIsAddingWallet(false)}
                    className="px-3 py-1.5 rounded-xl text-xs text-slate-400 hover:text-slate-200"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow"
                  >
                    Save Wallet
                  </button>
                </div>
              </form>
            )}

            {/* List of Category Wallets with Rollover Information */}
            <div className="space-y-3">
              {walletCategories.length === 0 ? (
                <div className="text-center py-8 text-xs text-slate-400">
                  No category wallets set up yet. Tap above to create your first wallet!
                </div>
              ) : (
                walletCategories.map((catName) => {
                  const b = computedBudgets[catName] || {
                    category: catName,
                    baseBudget: activeCategoryBudgets[catName] || 0,
                    rolloverEnabled: false,
                    rolloverType: 'none',
                    allowNegativeRollover: false,
                    previousMonthKey: prevYearMonth,
                    previousUnusedAmount: 0,
                    eligibleRollover: 0,
                    availableBudget: activeCategoryBudgets[catName] || 0,
                    spentThisMonth: 0,
                    remainingBudget: activeCategoryBudgets[catName] || 0,
                    percentUsed: 0,
                    isOver: false,
                    isNearLimit: false,
                  };

                  const meta = getCategoryMeta(catName, categories);
                  const barColor = getCategoryBarColor(catName, categories);
                  const Icon = meta.icon;

                  const isEditingThis = editingCategory === catName;
                  const isExpandedSettings = expandedSettingsCat === catName;

                  return (
                    <div
                      key={catName}
                      className={`rounded-2xl border p-4 transition-all ${
                        b.isOver
                          ? isDark
                            ? 'border-rose-500/40 bg-rose-950/10'
                            : 'border-rose-300 bg-rose-50/40'
                          : b.isNearLimit
                          ? isDark
                            ? 'border-amber-500/40 bg-amber-950/10'
                            : 'border-amber-300 bg-amber-50/40'
                          : isDark
                          ? 'border-white/10 bg-white/5 hover:border-white/20'
                          : 'border-slate-200 bg-white shadow-sm'
                      }`}
                    >
                      {/* Card Header & Badges */}
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2.5">
                          <div
                            className={`flex h-8 w-8 items-center justify-center rounded-xl border ${meta.bgColor} ${meta.borderColor}`}
                          >
                            <Icon className={`h-4 w-4 ${meta.color}`} />
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <h4 className="text-xs font-bold">{catName}</h4>
                              {b.isOver ? (
                                <span className="inline-flex items-center gap-0.5 rounded-md bg-rose-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-rose-400 border border-rose-500/30">
                                  <AlertTriangle className="h-2.5 w-2.5" /> Exceeded
                                </span>
                              ) : b.isNearLimit ? (
                                <span className="inline-flex items-center gap-0.5 rounded-md bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-amber-400 border border-amber-500/30">
                                  <AlertTriangle className="h-2.5 w-2.5" /> Almost Hit ({b.percentUsed}%)
                                </span>
                              ) : null}

                              {b.rolloverEnabled && b.eligibleRollover > 0 && (
                                <span className="inline-flex items-center gap-0.5 rounded-md bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-400 border border-emerald-500/20">
                                  <RotateCcw className="h-2.5 w-2.5" /> +{currencySymbol} {b.eligibleRollover.toFixed(0)} rollover
                                </span>
                              )}

                              {b.rolloverEnabled && b.eligibleRollover < 0 && (
                                <span className="inline-flex items-center gap-0.5 rounded-md bg-rose-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-rose-400 border border-rose-500/20">
                                  <ShieldAlert className="h-2.5 w-2.5" /> {currencySymbol} {b.eligibleRollover.toFixed(0)} rollover
                                </span>
                              )}
                            </div>
                            <span className={`text-[10px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                              {b.spentThisMonth > 0
                                ? `${currencySymbol} ${b.spentThisMonth.toFixed(2)} spent this month`
                                : 'No spending yet this month'}
                            </span>
                          </div>
                        </div>

                        {/* Top Action Buttons */}
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleStartEdit(catName)}
                            className={`p-1.5 rounded-lg transition ${
                              isDark ? 'hover:bg-white/10 text-slate-400' : 'hover:bg-slate-100 text-slate-500'
                            }`}
                            title="Edit Base Budget & Rollover"
                          >
                            <Edit2 className="h-3 w-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteWallet(catName)}
                            className="p-1.5 rounded-lg transition text-rose-400 hover:bg-rose-500/10"
                            title="Delete Wallet"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      </div>

                      {/* Edit Inline Form if Active */}
                      {isEditingThis ? (
                        <div className={`my-2 p-3 rounded-xl border space-y-2 text-xs ${
                          isDark ? 'bg-slate-900/90 border-indigo-500/40' : 'bg-slate-50 border-indigo-200'
                        }`}>
                          <div className="flex items-center justify-between">
                            <label className="text-[10px] font-semibold uppercase text-slate-400">
                              Base Budget ({currencySymbol})
                            </label>
                            <input
                              type="number"
                              min="0"
                              step="any"
                              value={editBaseBudget}
                              onChange={(e) => setEditBaseBudget(e.target.value)}
                              className="w-24 rounded-lg border border-indigo-500 bg-slate-800 px-2 py-1 text-xs text-white font-mono outline-none"
                            />
                          </div>

                          <div className="flex items-center justify-between pt-1 border-t border-white/5">
                            <span className="text-[11px] font-semibold flex items-center gap-1">
                              <RotateCcw className="h-3 w-3 text-indigo-400" /> Enable Rollover
                            </span>
                            <input
                              type="checkbox"
                              checked={editRolloverEnabled}
                              onChange={(e) => setEditRolloverEnabled(e.target.checked)}
                              className="rounded text-indigo-600 focus:ring-0"
                            />
                          </div>

                          {editRolloverEnabled && (
                            <div className="space-y-1.5 pt-1 text-[11px]">
                              <div className="flex items-center justify-between">
                                <span className="text-slate-400">Mode:</span>
                                <select
                                  value={editRolloverType}
                                  onChange={(e) => setEditRolloverType(e.target.value as RolloverType)}
                                  className={`rounded-lg border px-2 py-1 text-[11px] ${
                                    isDark ? 'bg-slate-800 border-white/10 text-white' : 'bg-white border-slate-300'
                                  }`}
                                >
                                  <option value="unlimited">All unused</option>
                                  <option value="capped">Capped limit</option>
                                </select>
                              </div>

                              {editRolloverType === 'capped' && (
                                <div className="flex items-center justify-between">
                                  <span className="text-slate-400">Max Cap ({currencySymbol}):</span>
                                  <input
                                    type="number"
                                    min="1"
                                    step="any"
                                    value={editRolloverCap}
                                    onChange={(e) => setEditRolloverCap(e.target.value)}
                                    className={`w-20 rounded-lg border px-2 py-0.5 text-xs ${
                                      isDark ? 'bg-slate-800 border-white/10 text-white' : 'bg-white border-slate-300'
                                    }`}
                                  />
                                </div>
                              )}

                              <div className="flex items-center justify-between pt-0.5">
                                <span className="text-slate-400">Negative rollover:</span>
                                <input
                                  type="checkbox"
                                  checked={editAllowNegative}
                                  onChange={(e) => setEditAllowNegative(e.target.checked)}
                                  className="rounded text-indigo-600 focus:ring-0"
                                />
                              </div>
                            </div>
                          )}

                          <div className="flex justify-end gap-2 pt-2 border-t border-white/10">
                            <button
                              type="button"
                              onClick={() => setEditingCategory(null)}
                              className="px-2.5 py-1 rounded-lg text-xs text-slate-400 hover:text-slate-200"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              onClick={() => handleSaveEdit(catName)}
                              className="flex items-center gap-1 px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow"
                            >
                              <Check className="h-3 w-3" /> Save Changes
                            </button>
                          </div>
                        </div>
                      ) : null}

                      {/* 3-Part Budget Breakdown Metric Row */}
                      <div className={`my-2 grid grid-cols-3 gap-1 rounded-xl p-2 text-center text-xs border ${
                        isDark ? 'bg-white/5 border-white/5' : 'bg-slate-50 border-slate-100'
                      }`}>
                        <div>
                          <span className={`block text-[9px] uppercase font-semibold tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                            Base Budget
                          </span>
                          <span className="font-bold tabular-nums">
                            {currencySymbol} {b.baseBudget.toFixed(0)}
                          </span>
                        </div>
                        <div className="border-x border-white/10">
                          <span className={`block text-[9px] uppercase font-semibold tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                            Rollover
                          </span>
                          <span className={`font-bold tabular-nums ${
                            b.eligibleRollover > 0
                              ? 'text-emerald-400'
                              : b.eligibleRollover < 0
                              ? 'text-rose-400'
                              : isDark ? 'text-slate-400' : 'text-slate-500'
                          }`}>
                            {b.eligibleRollover > 0
                              ? `+${currencySymbol} ${b.eligibleRollover.toFixed(0)}`
                              : b.eligibleRollover < 0
                              ? `-${currencySymbol} ${Math.abs(b.eligibleRollover).toFixed(0)}`
                              : `+${currencySymbol} 0`}
                          </span>
                        </div>
                        <div>
                          <span className={`block text-[9px] uppercase font-semibold tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                            Available
                          </span>
                          <span className="font-extrabold text-indigo-400 tabular-nums">
                            {currencySymbol} {b.availableBudget.toFixed(0)}
                          </span>
                        </div>
                      </div>

                      {/* Graphical Progress Bar: Spent / Available Budget */}
                      <div className="space-y-1.5 my-2">
                        <div
                          className={`relative h-3 w-full rounded-full overflow-hidden flex ${
                            isDark ? 'bg-slate-800/80 border border-white/5' : 'bg-slate-100 border border-slate-200'
                          }`}
                        >
                          {/* Used Segment */}
                          <div
                            className={`h-full transition-all duration-500 rounded-l-full relative ${
                              b.isOver
                                ? 'bg-gradient-to-r from-rose-600 to-rose-500'
                                : b.isNearLimit
                                ? 'bg-gradient-to-r from-amber-500 to-amber-400'
                                : barColor.bgClass
                            }`}
                            style={{ width: `${Math.min(b.percentUsed, 100)}%` }}
                          />

                          {/* Remaining / Unused Segment */}
                          {!b.isOver && b.remainingBudget > 0 && (
                            <div
                              className={`h-full transition-all duration-500 rounded-r-full ${
                                isDark ? 'bg-emerald-500/20' : 'bg-emerald-100'
                              }`}
                              style={{ width: `${Math.max(0, 100 - b.percentUsed)}%` }}
                            />
                          )}

                          {/* Over Budget Marker */}
                          {b.isOver && (
                            <div className="absolute right-0 top-0 bottom-0 w-2 bg-white/40 animate-pulse" />
                          )}
                        </div>

                        {/* Visual Breakdown Tags */}
                        <div className="flex items-center justify-between text-[11px] font-medium">
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`inline-block h-2 w-2 rounded-full ${
                                b.isOver
                                  ? 'bg-rose-500'
                                  : b.isNearLimit
                                  ? 'bg-amber-400'
                                  : barColor.bgClass
                              }`}
                            />
                            <span className={b.isOver ? 'text-rose-400 font-bold' : b.isNearLimit ? 'text-amber-400 font-bold' : isDark ? 'text-slate-300' : 'text-slate-700'}>
                              {currencySymbol} {b.spentThisMonth.toFixed(2)} spent ({b.percentUsed}%)
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <span
                              className={`inline-block h-2 w-2 rounded-full ${
                                b.isOver ? 'bg-rose-500' : 'bg-emerald-500'
                              }`}
                            />
                            {b.isOver ? (
                              <span className="text-rose-400 font-bold">
                                +{currencySymbol} {(b.spentThisMonth - b.availableBudget).toFixed(2)} over budget
                              </span>
                            ) : (
                              <span className="text-emerald-400 font-semibold">
                                {currencySymbol} {b.remainingBudget.toFixed(2)} remaining ({Math.max(0, 100 - b.percentUsed)}%)
                              </span>
                            )}
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
          <div className="border-t border-white/10 px-5 py-3 flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 px-5 py-2 text-xs font-semibold text-white shadow hover:from-indigo-500 hover:to-purple-500 transition active:scale-95"
            >
              Done
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
