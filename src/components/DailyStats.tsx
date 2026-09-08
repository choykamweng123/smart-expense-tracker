import React, { useState } from 'react';
import {
  Calendar,
  Wallet,
  AlertTriangle,
  Clock,
  LayoutGrid,
  Layers,
  Columns2,
  TrendingUp,
  ArrowDownLeft,
  ArrowUpRight,
  PiggyBank,
  Repeat,
  Info,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { Expense, RecurringExpense } from '../types';

interface DailyStatsProps {
  expenses: Expense[];
  currencySymbol: string;
  monthlyBudget: number;
  recurringExpenses?: RecurringExpense[];
  onOpenBudgetWallets?: () => void;
  isDark?: boolean;
}

export const DailyStats: React.FC<DailyStatsProps> = ({
  expenses,
  currencySymbol,
  monthlyBudget,
  recurringExpenses = [],
  onOpenBudgetWallets,
  isDark = true,
}) => {
  const [showForecastDetails, setShowForecastDetails] = useState(false);

  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);

  // Calculate start of current week (Monday)
  const currentDay = now.getDay();
  const distanceToMonday = (currentDay + 6) % 7;
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - distanceToMonday);
  startOfWeek.setHours(0, 0, 0, 0);

  // Calculate start of current month
  const currentYearMonth = todayStr.slice(0, 7);

  // Totals
  let totalIncome = 0;
  let totalExpense = 0;

  // Today
  let todayIncome = 0;
  let todayExpense = 0;
  let todayExpenseCount = 0;
  let todayIncomeCount = 0;

  // Week
  let weekIncome = 0;
  let weekExpense = 0;
  let weekExpenseCount = 0;
  let weekIncomeCount = 0;

  // Month
  let monthIncome = 0;
  let monthExpense = 0;
  let monthExpenseCount = 0;
  let monthIncomeCount = 0;

  expenses.forEach((exp) => {
    const isIncome = exp.type === 'income';
    const amount = exp.amount;
    const expDate = new Date(exp.date);

    if (isIncome) {
      totalIncome += amount;
    } else {
      totalExpense += amount;
    }

    if (exp.date === todayStr) {
      if (isIncome) {
        todayIncome += amount;
        todayIncomeCount += 1;
      } else {
        todayExpense += amount;
        todayExpenseCount += 1;
      }
    }

    if (expDate >= startOfWeek) {
      if (isIncome) {
        weekIncome += amount;
        weekIncomeCount += 1;
      } else {
        weekExpense += amount;
        weekExpenseCount += 1;
      }
    }

    if (exp.date.startsWith(currentYearMonth)) {
      if (isIncome) {
        monthIncome += amount;
        monthIncomeCount += 1;
      } else {
        monthExpense += amount;
        monthExpenseCount += 1;
      }
    }
  });

  const overallNet = totalIncome - totalExpense;
  const todayNet = todayIncome - todayExpense;
  const weekNet = weekIncome - weekExpense;
  const monthNet = monthIncome - monthExpense;

  // Recurring breakdown & forecast calculations
  const monthLoggedRecurringExpense = expenses
    .filter(
      (exp) =>
        exp.type !== 'income' &&
        (exp.isRecurring || exp.tags?.includes('recurring')) &&
        exp.date.startsWith(currentYearMonth)
    )
    .reduce((sum, exp) => sum + exp.amount, 0);

  const upcomingThisMonthRecurringItems = recurringExpenses.filter(
    (rule) =>
      rule.isActive &&
      rule.type === 'expense' &&
      rule.nextDueDate.startsWith(currentYearMonth) &&
      rule.nextDueDate > todayStr
  );

  const upcomingThisMonthRecurringAmount = upcomingThisMonthRecurringItems.reduce(
    (sum, rule) => sum + rule.amount,
    0
  );

  const projectedMonthExpense = monthExpense + upcomingThisMonthRecurringAmount;
  const projectedBudgetPct =
    monthlyBudget > 0
      ? Math.round((projectedMonthExpense / monthlyBudget) * 100)
      : 0;
  const isProjectedOverBudget = monthlyBudget > 0 && projectedMonthExpense > monthlyBudget;

  const budgetPct =
    monthlyBudget > 0 ? Math.min(Math.round((monthExpense / monthlyBudget) * 100), 100) : 0;
  const isOverBudget = monthlyBudget > 0 && monthExpense > monthlyBudget;

  const formatMoney = (val: number, forceSign = false) => {
    const formatted = `${currencySymbol}${Math.abs(val).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
    if (forceSign) {
      if (val > 0) return `+${formatted}`;
      if (val < 0) return `-${formatted}`;
    }
    return formatted;
  };

  const todayFormatted = now.toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });

  return (
    <div className="space-y-3">
      {/* 3-Part Financial Health Overview (Income vs Expenses vs Net) */}
      <div
        id="daily-stats-summary-card"
        className={`rounded-3xl border p-4 shadow-lg transition-colors ${
          isDark
            ? 'border-white/15 bg-gradient-to-br from-white/10 via-white/5 to-[#0b132b] backdrop-blur-2xl'
            : 'border-slate-200 bg-white'
        }`}
      >
        <div className="grid grid-cols-3 gap-2 text-center divide-x divide-white/10">
          {/* Income Column */}
          <div className="px-1">
            <span className="flex items-center justify-center gap-1 text-[11px] font-semibold text-emerald-400 uppercase tracking-wider mb-0.5">
              <ArrowDownLeft className="h-3 w-3" />
              Income
            </span>
            <p className="text-sm sm:text-base font-bold text-emerald-400 tabular-nums whitespace-nowrap">
              +{formatMoney(totalIncome)}
            </p>
            <span className={`text-[10px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              Total In
            </span>
          </div>

          {/* Expenses Column */}
          <div className="px-1">
            <span className="flex items-center justify-center gap-1 text-[11px] font-semibold text-rose-400 uppercase tracking-wider mb-0.5">
              <ArrowUpRight className="h-3 w-3" />
              Expenses
            </span>
            <p className="text-sm sm:text-base font-bold text-rose-400 tabular-nums whitespace-nowrap">
              -{formatMoney(totalExpense)}
            </p>
            <span className={`text-[10px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              Total Out
            </span>
          </div>

          {/* Net Balance Column */}
          <div className="px-1">
            <span
              className={`flex items-center justify-center gap-1 text-[11px] font-semibold uppercase tracking-wider mb-0.5 ${
                overallNet >= 0 ? 'text-indigo-300' : 'text-amber-400'
              }`}
            >
              <PiggyBank className="h-3 w-3" />
              Net Balance
            </span>
            <p
              className={`text-sm sm:text-base font-black tabular-nums whitespace-nowrap ${
                overallNet >= 0 ? 'text-white' : 'text-amber-400'
              }`}
            >
              {overallNet >= 0 ? '+' : '-'}{formatMoney(Math.abs(overallNet))}
            </p>
            <span
              className={`text-[10px] font-medium ${
                overallNet >= 0 ? 'text-emerald-400' : 'text-amber-400'
              }`}
            >
              {overallNet >= 0 ? 'Net Savings' : 'Deficit'}
            </span>
          </div>
        </div>
      </div>

      {/* Section Header: Spending Summary (Featured View) */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-1.5">
          <span
            className={`text-xs font-semibold uppercase tracking-wider ${
              isDark ? 'text-slate-300' : 'text-slate-600'
            }`}
          >
            Spending Summary
          </span>
        </div>
        <span className="text-[11px] font-medium text-indigo-400">Featured</span>
      </div>

      {/* FEATURED: Hero Today Card + Dual Week/Month Row */}
      <div className="space-y-2.5">
          {/* Today's Spend Hero Card */}
          <div
            className={`relative overflow-hidden rounded-3xl border p-4 sm:p-5 shadow-lg ${
              isDark
                ? 'border-white/15 bg-gradient-to-br from-white/10 via-white/5 to-indigo-950/20 backdrop-blur-2xl'
                : 'border-slate-200 bg-white'
            }`}
          >
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 shadow-inner">
                    <Clock className="h-4 w-4" />
                  </div>
                  <div>
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-indigo-400 block leading-tight">
                      Today's Expenses
                    </span>
                    <span className={`text-[10px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                      {todayFormatted}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  {todayIncome > 0 && (
                    <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-semibold text-emerald-400 border border-emerald-500/30">
                      +{formatMoney(todayIncome)} in
                    </span>
                  )}
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium border ${
                      isDark
                        ? 'bg-white/10 text-slate-200 border-white/10'
                        : 'bg-slate-100 text-slate-700 border-slate-200'
                    }`}
                  >
                    {todayExpenseCount} {todayExpenseCount === 1 ? 'expense' : 'expenses'}
                  </span>
                </div>
              </div>

              {/* Amount Display */}
              <div className="my-2 flex flex-wrap items-baseline gap-2">
                <span
                  className={`text-3xl sm:text-4xl font-black tracking-tight tabular-nums whitespace-nowrap ${
                    isDark ? 'text-white' : 'text-slate-900'
                  }`}
                >
                  {formatMoney(todayExpense)}
                </span>
                {todayExpenseCount > 0 && (
                  <span className={`text-xs font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    (avg {formatMoney(todayExpense / todayExpenseCount)} / item)
                  </span>
                )}
              </div>

              <div
                className={`flex items-center justify-between pt-2 border-t text-[11px] ${
                  isDark ? 'border-white/10 text-slate-300' : 'border-slate-100 text-slate-600'
                }`}
              >
                <span>
                  {todayIncome > 0
                    ? `Net today: ${todayNet >= 0 ? '+' : ''}${formatMoney(todayNet)}`
                    : todayExpenseCount === 0
                    ? 'No expenses recorded yet today'
                    : 'Daily expenses recorded'}
                </span>
                <span className="text-indigo-400 font-medium">Detailed tracking</span>
              </div>
            </div>

            {/* Decorative ambient glass light */}
            <div className="absolute -right-8 -bottom-8 h-32 w-32 rounded-full bg-indigo-500/15 blur-2xl pointer-events-none" />
          </div>

          {/* Secondary 2-Column Row: This Week & This Month */}
          <div className="grid grid-cols-2 gap-2.5">
            {/* This Week */}
            <div
              className={`rounded-3xl border p-3.5 flex flex-col justify-between transition-all ${
                isDark
                  ? 'border-white/10 bg-white/5 backdrop-blur-2xl hover:bg-white/10'
                  : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-800'
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5 text-indigo-400" />
                  <span
                    className={`text-[11px] font-semibold uppercase tracking-wider ${
                      isDark ? 'text-slate-300' : 'text-slate-700'
                    }`}
                  >
                    This Week
                  </span>
                </div>
                <span className={`text-[10px] font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  Mon–Sun
                </span>
              </div>
              <p
                className={`text-lg sm:text-xl font-bold tabular-nums whitespace-nowrap my-1 ${
                  isDark ? 'text-white' : 'text-slate-900'
                }`}
              >
                {formatMoney(weekExpense)}
              </p>
              <div className="flex items-center justify-between text-[10px] text-slate-400">
                <span>{weekExpenseCount} items</span>
                {weekIncome > 0 && (
                  <span className="text-emerald-400 font-medium">+{formatMoney(weekIncome)}</span>
                )}
              </div>
            </div>

            {/* This Month */}
            <div
              className={`rounded-3xl border p-3.5 flex flex-col justify-between transition-all ${
                isDark
                  ? 'border-white/10 bg-white/5 backdrop-blur-2xl hover:bg-white/10'
                  : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-800'
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-1.5">
                  <Wallet className="h-3.5 w-3.5 text-purple-400" />
                  <span
                    className={`text-[11px] font-semibold uppercase tracking-wider ${
                      isDark ? 'text-slate-300' : 'text-slate-700'
                    }`}
                  >
                    This Month
                  </span>
                </div>
                <span className={`text-[10px] font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  {now.toLocaleString('default', { month: 'short' })}
                </span>
              </div>
              <p
                className={`text-lg sm:text-xl font-bold tabular-nums whitespace-nowrap my-1 ${
                  isDark ? 'text-white' : 'text-slate-900'
                }`}
              >
                {formatMoney(monthExpense)}
              </p>
              <div className="flex items-center justify-between text-[10px] text-slate-400">
                <span>{monthExpenseCount} items</span>
                {monthIncome > 0 && (
                  <span className="text-emerald-400 font-medium">+{formatMoney(monthIncome)}</span>
                )}
              </div>
            </div>
          </div>
        </div>

      {/* Monthly Budget Bar with Recurring Expense Forecast & Category Wallets */}
      {monthlyBudget > 0 ? (
        <div
          id="budget-wallet-card"
          className={`rounded-3xl border p-3.5 text-xs transition-all ${
            isDark
              ? 'border-white/10 bg-white/5 backdrop-blur-2xl'
              : 'border-slate-200 bg-white text-slate-800'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span
                className={`font-semibold flex items-center gap-1.5 ${
                  isDark ? 'text-slate-300' : 'text-slate-700'
                }`}
              >
                Monthly Budget Wallets
              </span>
              {isOverBudget ? (
                <span className="inline-flex items-center gap-1 bg-rose-500/20 text-rose-400 px-1.5 py-0.5 rounded-md font-semibold text-[10px]">
                  <AlertTriangle className="h-3 w-3" /> Over budget
                </span>
              ) : isProjectedOverBudget ? (
                <span className="inline-flex items-center gap-1 bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded-md font-semibold text-[10px]" title="Upcoming recurring bills will exceed budget">
                  <AlertTriangle className="h-3 w-3" /> Warning: Due bills will exceed
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded-md font-semibold text-[10px]">
                  On Track
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <span
                className={`font-semibold tabular-nums ${
                  isDark ? 'text-slate-200' : 'text-slate-800'
                }`}
              >
                {formatMoney(monthExpense)} / {formatMoney(monthlyBudget)} ({budgetPct}%)
              </span>
              {onOpenBudgetWallets && (
                <button
                  type="button"
                  id="btn-view-budget-details"
                  onClick={onOpenBudgetWallets}
                  className="inline-flex items-center gap-1 rounded-xl bg-indigo-500/20 border border-indigo-500/40 px-2.5 py-1 text-[11px] font-semibold text-indigo-300 hover:bg-indigo-500/30 hover:text-white transition active:scale-95 shadow-sm"
                >
                  <span>View Details</span>
                  <ArrowUpRight className="h-3 w-3" />
                </button>
              )}
            </div>
          </div>

          {/* Stacked Progress Bar: Actual Spent + Projected Recurring */}
          <div
            className={`h-2.5 w-full rounded-full overflow-hidden flex relative ${
              isDark ? 'bg-white/10' : 'bg-slate-200'
            }`}
          >
            {/* Actual Logged Spent */}
            <div
              className={`h-full transition-all duration-500 rounded-l-full ${
                isOverBudget
                  ? 'bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.4)]'
                  : budgetPct > 80
                  ? 'bg-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.4)]'
                  : 'bg-gradient-to-r from-indigo-500 to-purple-500 shadow-[0_0_10px_rgba(99,102,241,0.4)]'
              }`}
              style={{
                width: `${Math.min(budgetPct, 100)}%`,
                borderTopRightRadius: upcomingThisMonthRecurringAmount === 0 ? '9999px' : '0',
                borderBottomRightRadius: upcomingThisMonthRecurringAmount === 0 ? '9999px' : '0',
              }}
            />

            {/* Upcoming Recurring Forecast Segment */}
            {upcomingThisMonthRecurringAmount > 0 && !isOverBudget && (
              <div
                className="h-full bg-purple-500/70 border-l border-white/20 transition-all duration-500 rounded-r-full relative overflow-hidden"
                style={{
                  width: `${Math.min(
                    Math.round((upcomingThisMonthRecurringAmount / monthlyBudget) * 100),
                    100 - budgetPct
                  )}%`,
                }}
                title={`Upcoming recurring bills this month: +${formatMoney(upcomingThisMonthRecurringAmount)}`}
              >
                <div className="absolute inset-0 bg-[linear-gradient(45deg,rgba(255,255,255,0.2)_25%,transparent_25%,transparent_50%,rgba(255,255,255,0.2)_50%,rgba(255,255,255,0.2)_75%,transparent_75%,transparent)] bg-[length:8px_8px] opacity-70 animate-pulse" />
              </div>
            )}
          </div>

          {/* Recurring Breakdown Toggle & Summary */}
          <div className="mt-2.5 pt-2 border-t border-white/10 flex items-center justify-between text-[11px]">
            <button
              type="button"
              onClick={() => setShowForecastDetails(!showForecastDetails)}
              className={`flex items-center gap-1 font-semibold transition ${
                isDark ? 'text-purple-300 hover:text-purple-200' : 'text-purple-700 hover:text-purple-900'
              }`}
            >
              <Repeat className="h-3 w-3" />
              <span>
                {upcomingThisMonthRecurringAmount > 0
                  ? `+${formatMoney(upcomingThisMonthRecurringAmount)} upcoming bills`
                  : 'Recurring details'}
              </span>
              {showForecastDetails ? (
                <ChevronUp className="h-3 w-3" />
              ) : (
                <ChevronDown className="h-3 w-3" />
              )}
            </button>

            <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>
              Projected: <strong className={isProjectedOverBudget ? 'text-rose-400' : isDark ? 'text-slate-200' : 'text-slate-800'}>{formatMoney(projectedMonthExpense)}</strong> ({projectedBudgetPct}%)
            </span>
          </div>

          {/* Expanded Forecast Details */}
          {showForecastDetails && (
            <div
              className={`mt-2 rounded-2xl p-2.5 space-y-1.5 text-[11px] border ${
                isDark ? 'bg-black/30 border-white/10 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-700'
              }`}
            >
              <div className="flex justify-between">
                <span className="text-slate-400">Already spent (actual ledger):</span>
                <span className="font-semibold">{formatMoney(monthExpense)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">↳ Out of which are recurring bills:</span>
                <span className="text-purple-300 font-semibold">{formatMoney(monthLoggedRecurringExpense)}</span>
              </div>
              {upcomingThisMonthRecurringAmount > 0 && (
                <div className="flex justify-between border-t border-white/5 pt-1">
                  <span className="text-purple-400 flex items-center gap-1">
                    <Repeat className="h-2.5 w-2.5" /> Upcoming bills due this month:
                  </span>
                  <span className="text-purple-300 font-bold">+{formatMoney(upcomingThisMonthRecurringAmount)}</span>
                </div>
              )}
              {upcomingThisMonthRecurringItems.length > 0 && (
                <div className="pt-1 flex flex-wrap gap-1">
                  {upcomingThisMonthRecurringItems.map((item) => (
                    <span
                      key={item.id}
                      className="px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-200 text-[10px] border border-purple-500/30"
                    >
                      {item.merchant} ({formatMoney(item.amount)} on {item.nextDueDate.slice(5)})
                    </span>
                  ))}
                </div>
              )}
              <div className="flex justify-between border-t border-white/10 pt-1 font-bold">
                <span>Month-end total forecast:</span>
                <span className={isProjectedOverBudget ? 'text-rose-400' : 'text-indigo-300'}>
                  {formatMoney(projectedMonthExpense)}
                </span>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* When monthly budget is not configured, show clean prompt with View Details */
        <div
          id="budget-wallet-card"
          className={`rounded-3xl border p-3.5 text-xs transition-all flex items-center justify-between ${
            isDark
              ? 'border-white/10 bg-white/5 backdrop-blur-2xl text-slate-300'
              : 'border-slate-200 bg-white text-slate-700'
          }`}
        >
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
              <Wallet className="h-4 w-4" />
            </div>
            <div>
              <p className="font-semibold text-xs">Monthly Budget Wallets</p>
              <p className={`text-[10px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                Set category budgets for Food, Clothes, Shopping & more
              </p>
            </div>
          </div>
          {onOpenBudgetWallets && (
            <button
              type="button"
              id="btn-view-budget-details"
              onClick={onOpenBudgetWallets}
              className="inline-flex items-center gap-1 rounded-xl bg-indigo-500/20 border border-indigo-500/40 px-3 py-1.5 text-[11px] font-semibold text-indigo-300 hover:bg-indigo-500/30 hover:text-white transition active:scale-95 shadow-sm"
            >
              <span>View Details</span>
              <ArrowUpRight className="h-3 w-3" />
            </button>
          )}
        </div>
      )}
    </div>
  );
};
