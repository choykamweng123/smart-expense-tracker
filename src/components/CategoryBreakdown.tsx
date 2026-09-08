import React, { useState } from 'react';
import { Expense, ExpenseCategory, CategoryItem } from '../types';
import { getCategoryMeta, getCategoryBarColor } from '../data/categories';
import { PieChart, ArrowDownLeft, ArrowUpRight } from 'lucide-react';

interface CategoryBreakdownProps {
  expenses: Expense[];
  currencySymbol: string;
  selectedCategory: ExpenseCategory | 'All';
  onSelectCategory: (cat: ExpenseCategory | 'All') => void;
  customCategories?: CategoryItem[];
  isDark?: boolean;
}

export const CategoryBreakdown: React.FC<CategoryBreakdownProps> = ({
  expenses,
  currencySymbol,
  selectedCategory,
  onSelectCategory,
  customCategories = [],
  isDark = true,
}) => {
  const [breakdownType, setBreakdownType] = useState<'expense' | 'income'>('expense');

  if (expenses.length === 0) return null;

  // Filter by selected breakdown type (expenses or income)
  const filteredTransactions = expenses.filter((e) =>
    breakdownType === 'income' ? e.type === 'income' : e.type !== 'income'
  );

  const hasIncome = expenses.some((e) => e.type === 'income');
  const hasExpenses = expenses.some((e) => e.type !== 'income');

  // Aggregate by category
  const categoryTotals: Partial<Record<ExpenseCategory, { total: number; count: number }>> = {};
  let overallTotal = 0;

  filteredTransactions.forEach((exp) => {
    overallTotal += exp.amount;
    if (!categoryTotals[exp.category]) {
      categoryTotals[exp.category] = { total: 0, count: 0 };
    }
    categoryTotals[exp.category]!.total += exp.amount;
    categoryTotals[exp.category]!.count += 1;
  });

  const sortedCategories = (Object.keys(categoryTotals) as ExpenseCategory[]).sort(
    (a, b) => (categoryTotals[b]?.total || 0) - (categoryTotals[a]?.total || 0)
  );

  return (
    <div
      id="category-breakdown-section"
      className={`rounded-3xl border p-4 space-y-3.5 transition-colors ${
        isDark
          ? 'border-white/10 bg-white/5 backdrop-blur-2xl text-slate-100'
          : 'border-slate-200 bg-white text-slate-800'
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <PieChart className="h-4 w-4 text-indigo-400" />
          <h3
            className={`text-xs font-semibold uppercase tracking-wider ${
              isDark ? 'text-slate-300' : 'text-slate-700'
            }`}
          >
            Category Breakdown
          </h3>
        </div>

        {/* Expense vs Income breakdown toggle */}
        {hasIncome && hasExpenses && (
          <div className="flex items-center gap-1 rounded-xl bg-white/5 border border-white/10 p-0.5 text-[10px]">
            <button
              type="button"
              onClick={() => {
                setBreakdownType('expense');
                onSelectCategory('All');
              }}
              className={`px-2 py-0.5 rounded-lg transition font-medium ${
                breakdownType === 'expense'
                  ? 'bg-rose-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Expense
            </button>
            <button
              type="button"
              onClick={() => {
                setBreakdownType('income');
                onSelectCategory('All');
              }}
              className={`px-2 py-0.5 rounded-lg transition font-medium ${
                breakdownType === 'income'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Income
            </button>
          </div>
        )}

        {selectedCategory !== 'All' && (
          <button
            type="button"
            onClick={() => onSelectCategory('All')}
            className="text-xs text-indigo-400 hover:text-indigo-300 font-medium"
          >
            Show All
          </button>
        )}
      </div>

      {sortedCategories.length === 0 ? (
        <p className={`text-xs text-center py-2 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
          No {breakdownType} records in this view.
        </p>
      ) : (
        <>
          {/* Multi-color distribution meter bar */}
          <div
            className={`h-2.5 w-full rounded-full overflow-hidden flex shadow-inner ${
              isDark ? 'bg-white/10' : 'bg-slate-200'
            }`}
          >
            {sortedCategories.map((cat) => {
              const total = categoryTotals[cat]?.total || 0;
              const pct = overallTotal > 0 ? (total / overallTotal) * 100 : 0;
              if (pct < 1) return null;

              const barColor = getCategoryBarColor(cat, customCategories);

              return (
                <div
                  key={cat}
                  className={`h-full ${barColor.bgClass} transition-all duration-300 hover:opacity-80 cursor-pointer`}
                  style={{ width: `${pct}%` }}
                  title={`${cat}: ${currencySymbol}${total.toFixed(2)} (${pct.toFixed(0)}%)`}
                  onClick={() => onSelectCategory(selectedCategory === cat ? 'All' : cat)}
                />
              );
            })}
          </div>

          {/* Top Categories Pill Badges with Color-Matched Indicators */}
          <div className="flex flex-wrap gap-1.5 pt-1">
            {sortedCategories.slice(0, 8).map((cat) => {
              const total = categoryTotals[cat]?.total || 0;
              const pct = overallTotal > 0 ? Math.round((total / overallTotal) * 100) : 0;
              const meta = getCategoryMeta(cat, customCategories);
              const barColor = getCategoryBarColor(cat, customCategories);
              const isSelected = selectedCategory === cat;
              const Icon = meta.icon;

              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => onSelectCategory(isSelected ? 'All' : cat)}
                  className={`flex items-center gap-1.5 rounded-xl px-2.5 py-1 text-xs transition border ${
                    isSelected
                      ? 'border-indigo-500/40 bg-indigo-500/20 text-white font-semibold shadow-sm'
                      : isDark
                      ? 'border-white/10 bg-white/5 text-slate-300 hover:border-white/20 hover:bg-white/10'
                      : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <span className={`h-2 w-2 rounded-full ${barColor.bgClass} flex-shrink-0 shadow-sm`} />
                  <Icon className={`h-3 w-3 ${meta.color}`} />
                  <span>{cat}</span>
                  <span className="font-mono text-[11px] font-medium opacity-75">
                    {pct}%
                  </span>
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};
