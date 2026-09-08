import { Expense, CategoryBudgetConfig } from '../types';

export interface MonthCategorySpending {
  monthKey: string; // YYYY-MM
  category: string;
  totalSpent: number;
  transactionCount: number;
}

export interface ComputedCategoryBudget {
  category: string;
  baseBudget: number;
  rolloverEnabled: boolean;
  rolloverType: 'none' | 'unlimited' | 'capped';
  rolloverCap?: number;
  allowNegativeRollover: boolean;
  previousMonthKey: string; // e.g., 2026-08
  previousUnusedAmount: number; // Previous Available - Previous Spent
  eligibleRollover: number; // Signed number (+ or - if negative allowed)
  availableBudget: number; // baseBudget + eligibleRollover
  spentThisMonth: number;
  remainingBudget: number; // Math.max(0, availableBudget - spentThisMonth) or negative
  percentUsed: number;
  isOver: boolean;
  isNearLimit: boolean;
}

/**
 * Gets the previous month in YYYY-MM format from a given YYYY-MM
 */
export function getPreviousMonthKey(yearMonth: string): string {
  const parts = yearMonth.split('-').map(Number);
  if (parts.length !== 2 || isNaN(parts[0]) || isNaN(parts[1])) {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().slice(0, 7);
  }
  let [year, month] = parts;
  month -= 1;
  if (month < 1) {
    month = 12;
    year -= 1;
  }
  return `${year}-${String(month).padStart(2, '0')}`;
}

/**
 * Calculates deterministic spending for any given category in a specific month
 */
export function getCategorySpendingForMonth(
  expenses: Expense[],
  category: string,
  yearMonth: string
): number {
  return expenses
    .filter(
      (exp) =>
        exp.type !== 'income' &&
        exp.category === category &&
        exp.date &&
        exp.date.startsWith(yearMonth)
    )
    .reduce((sum, exp) => sum + (Number(exp.amount) || 0), 0);
}

/**
 * Computes the complete budget rollover and status for all active category wallets
 * Handles base budget, previous month's spending vs budget, caps, and optional negative rollover.
 */
export function computeCategoryBudgets(
  expenses: Expense[],
  categoryBudgets: Record<string, number> = {},
  categoryBudgetConfigs: Record<string, CategoryBudgetConfig> = {},
  targetYearMonth?: string
): Record<string, ComputedCategoryBudget> {
  const currentYearMonth = targetYearMonth || new Date().toISOString().slice(0, 7);
  const prevMonthKey = getPreviousMonthKey(currentYearMonth);

  const result: Record<string, ComputedCategoryBudget> = {};
  const categories = Object.keys(categoryBudgets);

  categories.forEach((catName) => {
    const baseBudget = categoryBudgets[catName] || 0;
    const config = categoryBudgetConfigs[catName] || {
      category: catName,
      baseBudget,
      rolloverEnabled: false,
      rolloverType: 'none',
      allowNegativeRollover: false,
    };

    const rolloverEnabled = !!config.rolloverEnabled;
    const rolloverType = config.rolloverType || (rolloverEnabled ? 'unlimited' : 'none');
    const rolloverCap = config.rolloverCap;
    const allowNegativeRollover = !!config.allowNegativeRollover;

    // Previous month spending & base budget
    const prevSpent = getCategorySpendingForMonth(expenses, catName, prevMonthKey);
    // Previous base budget defaults to the configured base budget
    const prevBaseBudget = baseBudget;
    const prevUnused = prevBaseBudget - prevSpent;

    let eligibleRollover = 0;

    if (rolloverEnabled) {
      if (prevUnused > 0) {
        // Positive rollover
        if (rolloverType === 'capped' && typeof rolloverCap === 'number' && rolloverCap > 0) {
          eligibleRollover = Math.min(prevUnused, rolloverCap);
        } else {
          eligibleRollover = prevUnused;
        }
      } else if (prevUnused < 0) {
        // Negative rollover (overspent last month)
        if (allowNegativeRollover) {
          eligibleRollover = prevUnused; // negative value
        } else {
          eligibleRollover = 0;
        }
      }
    }

    const availableBudget = Math.max(0, baseBudget + eligibleRollover);
    const spentThisMonth = getCategorySpendingForMonth(expenses, catName, currentYearMonth);
    const remainingBudget = availableBudget - spentThisMonth;
    const percentUsed =
      availableBudget > 0 ? Math.round((spentThisMonth / availableBudget) * 100) : 0;
    const isOver = spentThisMonth > availableBudget;
    const isNearLimit = !isOver && availableBudget > 0 && percentUsed >= 80;

    result[catName] = {
      category: catName,
      baseBudget,
      rolloverEnabled,
      rolloverType,
      rolloverCap,
      allowNegativeRollover,
      previousMonthKey: prevMonthKey,
      previousUnusedAmount: prevUnused,
      eligibleRollover,
      availableBudget,
      spentThisMonth,
      remainingBudget,
      percentUsed,
      isOver,
      isNearLimit,
    };
  });

  return result;
}
