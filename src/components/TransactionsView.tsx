import React, { useMemo } from 'react';
import {
  Search,
  Receipt,
  Calendar,
  Camera,
  Plus,
  ArrowUpRight,
  ArrowDownLeft,
  Repeat,
  X,
  SlidersHorizontal,
  FileSpreadsheet,
} from 'lucide-react';
import { Expense, ExpenseCategory, TransactionType, CategoryItem } from '../types';
import { ExpenseCard } from './ExpenseCard';

export type DateFilterType = 'all' | 'today' | 'week' | 'month';
export type TxTypeFilter = 'all' | 'expense' | 'income' | 'recurring';

interface TransactionsViewProps {
  expenses: Expense[];
  currencySymbol: string;
  categories: CategoryItem[];
  searchQuery: string;
  onSearchChange: (q: string) => void;
  selectedCategory: ExpenseCategory | 'All';
  onCategoryChange: (cat: ExpenseCategory | 'All') => void;
  dateFilter: DateFilterType;
  onDateFilterChange: (df: DateFilterType) => void;
  txTypeFilter: TxTypeFilter;
  onTxTypeFilterChange: (tf: TxTypeFilter) => void;
  onSelectExpense: (exp: Expense) => void;
  onEditExpense: (exp: Expense) => void;
  onDeleteExpense: (id: string) => void;
  onOpenScanner: () => void;
  onOpenAddExpense: () => void;
  onOpenRecurring: () => void;
  onOpenExcelImport?: () => void;
  recurringExpensesCount: number;
  dueRecurringCount: number;
  isDark?: boolean;
}

export const TransactionsView: React.FC<TransactionsViewProps> = ({
  expenses,
  currencySymbol,
  categories,
  searchQuery,
  onSearchChange,
  selectedCategory,
  onCategoryChange,
  dateFilter,
  onDateFilterChange,
  txTypeFilter,
  onTxTypeFilterChange,
  onSelectExpense,
  onEditExpense,
  onDeleteExpense,
  onOpenScanner,
  onOpenAddExpense,
  onOpenRecurring,
  onOpenExcelImport,
  recurringExpensesCount,
  dueRecurringCount,
  isDark = true,
}) => {
  // Count recurring items in expense ledger
  const recurringExpensesInLedgerCount = useMemo(() => {
    return expenses.filter((e) => e.isRecurring || e.tags?.includes('recurring')).length;
  }, [expenses]);

  // Filtered transactions
  const filteredExpenses = useMemo(() => {
    const todayStr = new Date().toISOString().slice(0, 10);
    const now = new Date();
    const currentDay = now.getDay();
    const distanceToMonday = (currentDay + 6) % 7;
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - distanceToMonday);
    startOfWeek.setHours(0, 0, 0, 0);

    const currentYearMonth = todayStr.slice(0, 7);

    return expenses.filter((exp) => {
      // Type filter
      if (txTypeFilter === 'recurring') {
        if (!exp.isRecurring && !exp.tags?.includes('recurring')) return false;
      } else if (txTypeFilter !== 'all') {
        const itemType = exp.type || 'expense';
        if (itemType !== txTypeFilter) return false;
      }

      // Category filter
      if (selectedCategory !== 'All' && exp.category !== selectedCategory) {
        return false;
      }

      // Date range filter
      if (dateFilter === 'today' && exp.date !== todayStr) {
        return false;
      }
      if (dateFilter === 'week') {
        const expDate = new Date(exp.date);
        if (expDate < startOfWeek) return false;
      }
      if (dateFilter === 'month' && !exp.date.startsWith(currentYearMonth)) {
        return false;
      }

      // Search query filter (merchant, summary, tags, items)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesMerchant = exp.merchant.toLowerCase().includes(q);
        const matchesSummary = exp.summary?.toLowerCase().includes(q);
        const matchesTags = exp.tags?.some((t) => t.toLowerCase().includes(q));
        const matchesItems = exp.items?.some((it) => it.name.toLowerCase().includes(q));
        if (!matchesMerchant && !matchesSummary && !matchesTags && !matchesItems) {
          return false;
        }
      }

      return true;
    });
  }, [expenses, txTypeFilter, selectedCategory, dateFilter, searchQuery]);

  // Group filtered expenses by Date for clean daily timeline
  const groupedExpenses = useMemo(() => {
    const groups: {
      date: string;
      displayDate: string;
      totalExpense: number;
      totalIncome: number;
      items: Expense[];
    }[] = [];
    const todayStr = new Date().toISOString().slice(0, 10);

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().slice(0, 10);

    // Sort descending by date & time
    const sorted = [...filteredExpenses].sort((a, b) => {
      if (b.date !== a.date) {
        return b.date.localeCompare(a.date);
      }
      return (b.time || '').localeCompare(a.time || '');
    });

    sorted.forEach((exp) => {
      let group = groups.find((g) => g.date === exp.date);
      if (!group) {
        let displayDate = exp.date;
        if (exp.date === todayStr) {
          displayDate = 'Today';
        } else if (exp.date === yesterdayStr) {
          displayDate = 'Yesterday';
        } else {
          try {
            const parsed = new Date(exp.date + 'T00:00:00');
            displayDate = parsed.toLocaleDateString(undefined, {
              weekday: 'short',
              month: 'short',
              day: 'numeric',
            });
          } catch (e) {
            displayDate = exp.date;
          }
        }

        group = {
          date: exp.date,
          displayDate,
          totalExpense: 0,
          totalIncome: 0,
          items: [],
        };
        groups.push(group);
      }
      group.items.push(exp);
      if (exp.type === 'income') {
        group.totalIncome += exp.amount;
      } else {
        group.totalExpense += exp.amount;
      }
    });

    return groups;
  }, [filteredExpenses]);

  const hasActiveFilters =
    searchQuery.trim() !== '' ||
    selectedCategory !== 'All' ||
    dateFilter !== 'all' ||
    txTypeFilter !== 'all';

  const handleClearFilters = () => {
    onSearchChange('');
    onCategoryChange('All');
    onDateFilterChange('all');
    onTxTypeFilterChange('all');
  };

  return (
    <div className="space-y-3.5">
      {/* View Title & Recurring shortcut */}
      <div className="flex items-center justify-between px-1">
        <div>
          <h2 className={`text-base font-bold tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
            Transaction History
          </h2>
          <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            {filteredExpenses.length} of {expenses.length} records shown
          </p>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Import Excel / CSV button */}
          {onOpenExcelImport && (
            <button
              type="button"
              id="btn-import-excel-transactions"
              onClick={onOpenExcelImport}
              className={`min-h-[44px] flex items-center gap-1.5 px-3 py-1.5 rounded-2xl border text-xs font-semibold transition active:scale-95 ${
                isDark
                  ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20'
                  : 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
              }`}
              title="Upload Excel (.xlsx) or CSV Bank Statement"
            >
              <FileSpreadsheet className="h-3.5 w-3.5" />
              <span>Import</span>
            </button>
          )}

          {/* Recurring button */}
          <button
            type="button"
            id="btn-recurring-transactions"
            onClick={onOpenRecurring}
            className={`min-h-[44px] flex items-center gap-1.5 px-3 py-1.5 rounded-2xl border text-xs font-semibold transition active:scale-95 ${
              dueRecurringCount > 0
                ? 'border-rose-500/40 bg-rose-500/10 text-rose-300 animate-pulse'
                : isDark
                ? 'border-white/10 bg-white/5 text-purple-300 hover:bg-white/10'
                : 'border-slate-200 bg-slate-100 text-purple-700 hover:bg-slate-200'
            }`}
            title="Recurring Expenses & Subscriptions"
          >
            <Repeat className="h-3.5 w-3.5" />
            <span>Recurring</span>
            {dueRecurringCount > 0 ? (
              <span className="flex h-4 min-w-[16px] items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-bold text-white">
                {dueRecurringCount} due
              </span>
            ) : recurringExpensesCount > 0 ? (
              <span className="text-[10px] opacity-75">({recurringExpensesCount})</span>
            ) : null}
          </button>
        </div>
      </div>

      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search merchant, notes, tags..."
          className={`w-full min-h-[44px] rounded-2xl border pl-9 pr-9 py-2.5 text-xs focus:outline-none transition-colors ${
            isDark
              ? 'border-white/10 bg-white/5 text-white placeholder:text-slate-500 focus:border-indigo-400'
              : 'border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus:border-indigo-500'
          }`}
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => onSearchChange('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-xs text-slate-400 hover:text-white"
          >
            ✕
          </button>
        )}
      </div>

      {/* Type Selector (All, Expenses, Income, Recurring) */}
      <div
        className={`grid grid-cols-4 gap-1 rounded-2xl p-1 border transition-colors ${
          isDark ? 'border-white/10 bg-white/5' : 'border-slate-200 bg-slate-100'
        }`}
      >
        <button
          type="button"
          onClick={() => onTxTypeFilterChange('all')}
          className={`min-h-[40px] py-1.5 text-xs font-semibold rounded-xl transition ${
            txTypeFilter === 'all'
              ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow'
              : isDark
              ? 'text-slate-400 hover:text-white'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          All
        </button>
        <button
          type="button"
          onClick={() => onTxTypeFilterChange('expense')}
          className={`min-h-[40px] flex items-center justify-center gap-1 py-1.5 text-xs font-semibold rounded-xl transition ${
            txTypeFilter === 'expense'
              ? 'bg-rose-600 text-white shadow'
              : isDark
              ? 'text-slate-400 hover:text-white'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <ArrowUpRight className="h-3.5 w-3.5" />
          Expenses
        </button>
        <button
          type="button"
          onClick={() => onTxTypeFilterChange('income')}
          className={`min-h-[40px] flex items-center justify-center gap-1 py-1.5 text-xs font-semibold rounded-xl transition ${
            txTypeFilter === 'income'
              ? 'bg-emerald-600 text-white shadow'
              : isDark
              ? 'text-slate-400 hover:text-white'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <ArrowDownLeft className="h-3.5 w-3.5" />
          Income
        </button>
        <button
          type="button"
          onClick={() => onTxTypeFilterChange('recurring')}
          className={`min-h-[40px] flex items-center justify-center gap-1 py-1.5 text-xs font-semibold rounded-xl transition ${
            txTypeFilter === 'recurring'
              ? 'bg-purple-600 text-white shadow'
              : isDark
              ? 'text-purple-300 hover:text-white'
              : 'text-purple-700 hover:text-purple-900'
          }`}
        >
          <Repeat className="h-3.5 w-3.5" />
          <span>Recurring</span>
          {recurringExpensesInLedgerCount > 0 && (
            <span className="text-[10px] opacity-80">({recurringExpensesInLedgerCount})</span>
          )}
        </button>
      </div>

      {/* Date Filter & Active Category / Reset Banner */}
      <div className="flex items-center justify-between gap-1 overflow-x-auto pb-0.5 text-xs">
        <div
          className={`flex items-center gap-1 rounded-2xl p-1 border transition-colors shrink-0 ${
            isDark ? 'bg-white/5 border-white/10' : 'bg-slate-100 border-slate-200'
          }`}
        >
          {(['all', 'today', 'week', 'month'] as DateFilterType[]).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => onDateFilterChange(tab)}
              className={`min-h-[36px] rounded-xl px-3 py-1 font-medium capitalize transition ${
                dateFilter === tab
                  ? 'bg-indigo-600 text-white font-semibold shadow-md'
                  : isDark
                  ? 'text-slate-400 hover:text-white'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab === 'all' ? 'All Time' : tab}
            </button>
          ))}
        </div>

        {/* Active Category Filter chip */}
        {selectedCategory !== 'All' && (
          <button
            type="button"
            onClick={() => onCategoryChange('All')}
            className="flex items-center gap-1.5 rounded-xl bg-indigo-500/20 border border-indigo-500/30 px-2.5 py-1.5 text-[11px] text-indigo-300 font-medium shrink-0"
          >
            <span>{selectedCategory}</span>
            <X className="h-3 w-3" />
          </button>
        )}

        {/* Reset All Filters button if multiple filters active */}
        {hasActiveFilters && (
          <button
            type="button"
            onClick={handleClearFilters}
            className="text-[11px] text-slate-400 hover:text-white shrink-0 px-2 py-1"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Daily Expense Timeline List */}
      <div className="space-y-4 pt-1">
        {groupedExpenses.length > 0 && (
          <div
            className={`flex items-center justify-between px-2 text-[10px] ${
              isDark ? 'text-slate-400' : 'text-slate-500'
            }`}
          >
            <span>Swipe left on any record to Edit or Remove</span>
            <span className="font-medium text-indigo-400">← Swipe gesture active</span>
          </div>
        )}

        {groupedExpenses.length === 0 ? (
          <div
            className={`flex flex-col items-center justify-center rounded-3xl border border-dashed py-12 px-4 text-center transition-colors ${
              isDark ? 'border-white/10 bg-white/5' : 'border-slate-300 bg-white'
            }`}
          >
            <div
              className={`mb-3 flex h-12 w-12 items-center justify-center rounded-2xl ${
                isDark ? 'bg-white/10 text-indigo-400' : 'bg-slate-100 text-indigo-600'
              }`}
            >
              <Receipt className="h-6 w-6" />
            </div>
            <p className={`text-sm font-semibold mb-1 ${isDark ? 'text-white' : 'text-slate-900'}`}>
              No transactions found
            </p>
            <p className={`text-xs max-w-xs mb-4 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              {hasActiveFilters
                ? 'No transactions match your current search and filters.'
                : 'Your ledger is empty. Scan a receipt or add a transaction to begin.'}
            </p>
            <div className="flex gap-2">
              {hasActiveFilters ? (
                <button
                  type="button"
                  onClick={handleClearFilters}
                  className="min-h-[44px] px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow transition"
                >
                  Clear All Filters
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={onOpenScanner}
                    className="min-h-[44px] flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 px-4 py-2 text-xs font-semibold text-white shadow-lg"
                  >
                    <Camera className="h-3.5 w-3.5" />
                    Scan Receipt
                  </button>
                  <button
                    type="button"
                    onClick={onOpenAddExpense}
                    className={`min-h-[44px] flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-xs font-medium transition ${
                      isDark
                        ? 'border-white/10 bg-white/5 text-slate-200 hover:bg-white/10'
                        : 'border-slate-200 bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add Expense
                  </button>
                </>
              )}
            </div>
          </div>
        ) : (
          groupedExpenses.map((group) => (
            <div key={group.date} className="space-y-2">
              {/* Date Header with Daily Subtotals */}
              <div className="flex items-center justify-between px-1 text-xs">
                <span
                  className={`font-semibold tracking-wide flex items-center gap-1.5 ${
                    isDark ? 'text-slate-300' : 'text-slate-700'
                  }`}
                >
                  <Calendar className="h-3 w-3 text-indigo-400" />
                  {group.displayDate}
                </span>

                <div className="flex items-center gap-2 text-[11px] font-mono">
                  {group.totalIncome > 0 && (
                    <span className="font-semibold text-emerald-400">
                      +{currencySymbol}
                      {group.totalIncome.toFixed(2)}
                    </span>
                  )}
                  {group.totalExpense > 0 && (
                    <span className={`font-semibold ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                      -{currencySymbol}
                      {group.totalExpense.toFixed(2)}
                    </span>
                  )}
                </div>
              </div>

              {/* List of swipeable transactions for this date */}
              <div className="space-y-2">
                {group.items.map((expense) => (
                  <ExpenseCard
                    key={expense.id}
                    expense={expense}
                    currencySymbol={currencySymbol}
                    customCategories={categories}
                    isDark={isDark}
                    onClick={() => onSelectExpense(expense)}
                    onEdit={() => onEditExpense(expense)}
                    onDelete={() => onDeleteExpense(expense.id)}
                  />
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
