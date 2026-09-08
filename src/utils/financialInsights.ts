import { Expense, FinancialInsight, UserSettings } from '../types';
import { computeCategoryBudgets, getPreviousMonthKey } from './budgetRollover';

export interface DeterministicFinancialSummary {
  currentMonthKey: string;
  previousMonthKey: string;
  currencySymbol: string;
  currentMonthIncome: number;
  currentMonthExpenses: number;
  currentMonthNet: number;
  previousMonthExpenses: number;
  monthOverMonthExpenseChangePct: number | null; // e.g. +18 or -12
  historicalMonthlyAverage: number | null; // 3-month or all historical average
  highestSpendingCategory: { name: string; amount: number; pctOfTotal: number } | null;
  categoryComparisons: Array<{
    category: string;
    current: number;
    previous: number;
    difference: number;
    changePct: number | null;
  }>;
  budgetStatuses: Array<{
    category: string;
    baseBudget: number;
    availableBudget: number;
    spent: number;
    remaining: number;
    percentUsed: number;
    isOver: boolean;
    isNearLimit: boolean;
    projectedEndSpend: number;
    projectedOverage: number;
  }>;
  unusualTransactions: Array<{
    id: string;
    merchant: string;
    amount: number;
    category: string;
    date: string;
    normalCategoryAvg: number;
    ratio: number;
  }>;
  positiveAchievements: string[];
}

/**
 * Deterministically computes statistics and generates baseline insights
 */
export function calculateFinancialStats(
  expenses: Expense[],
  settings: UserSettings,
  targetDate?: Date
): DeterministicFinancialSummary {
  const now = targetDate || new Date();
  const todayIso = now.toISOString().slice(0, 10);
  const currentMonthKey = todayIso.slice(0, 7);
  const prevMonthKey = getPreviousMonthKey(currentMonthKey);
  const currencySymbol = settings.currencySymbol || 'RM';

  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const currentDay = now.getDate();
  const daysRemaining = Math.max(0, daysInMonth - currentDay);

  let currentMonthIncome = 0;
  let currentMonthExpenses = 0;
  let previousMonthExpenses = 0;

  const currentCategoryMap: Record<string, number> = {};
  const prevCategoryMap: Record<string, number> = {};
  const historicalMonthTotals: Record<string, number> = {};
  const categoryTxList: Record<string, number[]> = {};

  expenses.forEach((exp) => {
    const isIncome = exp.type === 'income';
    const amount = Number(exp.amount) || 0;
    const date = exp.date || '';
    const mKey = date.slice(0, 7);

    if (mKey === currentMonthKey) {
      if (isIncome) {
        currentMonthIncome += amount;
      } else {
        currentMonthExpenses += amount;
        currentCategoryMap[exp.category] = (currentCategoryMap[exp.category] || 0) + amount;
      }
    } else if (mKey === prevMonthKey) {
      if (!isIncome) {
        previousMonthExpenses += amount;
        prevCategoryMap[exp.category] = (prevCategoryMap[exp.category] || 0) + amount;
      }
    }

    if (!isIncome && mKey) {
      historicalMonthTotals[mKey] = (historicalMonthTotals[mKey] || 0) + amount;
      if (!categoryTxList[exp.category]) {
        categoryTxList[exp.category] = [];
      }
      categoryTxList[exp.category].push(amount);
    }
  });

  // Calculate MoM overall difference
  let monthOverMonthExpenseChangePct: number | null = null;
  if (previousMonthExpenses > 0) {
    monthOverMonthExpenseChangePct = Math.round(
      ((currentMonthExpenses - previousMonthExpenses) / previousMonthExpenses) * 100
    );
  }

  // Calculate historical monthly average (excluding current incomplete month if historical exists)
  const pastMonths = Object.keys(historicalMonthTotals).filter((k) => k !== currentMonthKey);
  let historicalMonthlyAverage: number | null = null;
  if (pastMonths.length > 0) {
    const sum = pastMonths.reduce((acc, k) => acc + historicalMonthTotals[k], 0);
    historicalMonthlyAverage = Math.round(sum / pastMonths.length);
  }

  // Highest spending category this month
  let highestSpendingCategory: { name: string; amount: number; pctOfTotal: number } | null = null;
  const currentCatEntries = Object.entries(currentCategoryMap);
  if (currentCatEntries.length > 0) {
    currentCatEntries.sort((a, b) => b[1] - a[1]);
    const top = currentCatEntries[0];
    const pct = currentMonthExpenses > 0 ? Math.round((top[1] / currentMonthExpenses) * 100) : 0;
    highestSpendingCategory = {
      name: top[0],
      amount: top[1],
      pctOfTotal: pct,
    };
  }

  // Category comparisons (current vs previous)
  const allCategories = Array.from(
    new Set([...Object.keys(currentCategoryMap), ...Object.keys(prevCategoryMap)])
  );
  const categoryComparisons = allCategories.map((cat) => {
    const curr = currentCategoryMap[cat] || 0;
    const prev = prevCategoryMap[cat] || 0;
    const diff = curr - prev;
    let changePct: number | null = null;
    if (prev > 0) {
      changePct = Math.round(((curr - prev) / prev) * 100);
    }
    return {
      category: cat,
      current: curr,
      previous: prev,
      difference: diff,
      changePct,
    };
  });

  // Computed budget wallets with rollover support
  const computedBudgets = computeCategoryBudgets(
    expenses,
    settings.categoryBudgets || {},
    settings.categoryBudgetConfigs || {},
    currentMonthKey
  );

  const budgetStatuses = Object.values(computedBudgets).map((b) => {
    // Project spending rate: current / currentDay * daysInMonth
    const dailyRate = currentDay > 0 ? b.spentThisMonth / currentDay : 0;
    const projectedEndSpend = Math.round(dailyRate * daysInMonth);
    const projectedOverage = Math.max(0, projectedEndSpend - b.availableBudget);

    return {
      category: b.category,
      baseBudget: b.baseBudget,
      availableBudget: b.availableBudget,
      spent: b.spentThisMonth,
      remaining: b.remainingBudget,
      percentUsed: b.percentUsed,
      isOver: b.isOver,
      isNearLimit: b.isNearLimit,
      projectedEndSpend,
      projectedOverage,
    };
  });

  // Unusual transactions detection:
  // Transaction > 2.5x of typical category mean, and amount >= RM 50
  const unusualTransactions: DeterministicFinancialSummary['unusualTransactions'] = [];
  const currentMonthTx = expenses.filter(
    (exp) => exp.type !== 'income' && exp.date && exp.date.startsWith(currentMonthKey)
  );

  // Calculate median / average per category excluding the outlier itself
  const catAverages: Record<string, number> = {};
  Object.keys(categoryTxList).forEach((cat) => {
    const list = categoryTxList[cat];
    if (list.length >= 2) {
      const avg = list.reduce((a, b) => a + b, 0) / list.length;
      catAverages[cat] = avg;
    }
  });

  currentMonthTx.forEach((tx) => {
    const catAvg = catAverages[tx.category];
    if (catAvg && catAvg > 0 && tx.amount >= 50) {
      const ratio = tx.amount / catAvg;
      if (ratio >= 2.5) {
        unusualTransactions.push({
          id: tx.id,
          merchant: tx.merchant,
          amount: tx.amount,
          category: tx.category,
          date: tx.date,
          normalCategoryAvg: Math.round(catAvg),
          ratio: Math.round(ratio * 10) / 10,
        });
      }
    }
  });

  // Positive achievements
  const positiveAchievements: string[] = [];
  if (settings.monthlyBudget > 0 && currentMonthExpenses < settings.monthlyBudget) {
    const under = settings.monthlyBudget - currentMonthExpenses;
    positiveAchievements.push(
      `You're currently under your overall monthly budget by ${currencySymbol} ${under.toFixed(2)}.`
    );
  }

  // Any category with decreased spending compared to last month
  categoryComparisons
    .filter((c) => c.previous > 50 && c.difference < -20)
    .forEach((c) => {
      positiveAchievements.push(
        `You spent ${currencySymbol} ${Math.abs(c.difference).toFixed(2)} less on ${c.category} than last month.`
      );
    });

  return {
    currentMonthKey,
    previousMonthKey: prevMonthKey,
    currencySymbol,
    currentMonthIncome,
    currentMonthExpenses,
    currentMonthNet: currentMonthIncome - currentMonthExpenses,
    previousMonthExpenses,
    monthOverMonthExpenseChangePct,
    historicalMonthlyAverage,
    highestSpendingCategory,
    categoryComparisons,
    budgetStatuses,
    unusualTransactions,
    positiveAchievements,
  };
}

/**
 * Deterministic generation of insights that guarantees fast, offline-ready insights
 * even when the AI API is unavailable.
 */
export function generateDeterministicInsights(
  stats: DeterministicFinancialSummary,
  daysRemaining: number
): FinancialInsight[] {
  const insights: FinancialInsight[] = [];
  const sym = stats.currencySymbol;

  // 1. Budget Exceeded / Warning Insights
  stats.budgetStatuses.forEach((b) => {
    if (b.isOver) {
      const overAmount = b.spent - b.availableBudget;
      insights.push({
        id: `det-budget-exceeded-${b.category}`,
        type: 'budget_exceeded',
        title: `${b.category} budget exceeded`,
        description: `You've exceeded your ${b.category} budget by ${sym} ${overAmount.toFixed(2)} (${b.percentUsed}% used).`,
        category: b.category,
        severity: 'critical',
        value: b.percentUsed,
        recommendation: `Consider adjusting spending in ${b.category} or reallocating budget from other categories.`,
        metric: `+${sym} ${overAmount.toFixed(2)} over`,
        calculatedAt: Date.now(),
      });
    } else if (b.isNearLimit) {
      insights.push({
        id: `det-budget-warning-${b.category}`,
        type: 'budget_warning',
        title: `${b.category} budget almost reached`,
        description: `You have used ${b.percentUsed}% of your ${b.category} budget with ${daysRemaining} day${daysRemaining === 1 ? '' : 's'} remaining (${sym} ${b.remaining.toFixed(2)} left).`,
        category: b.category,
        severity: 'warning',
        value: b.percentUsed,
        recommendation: `Pace your ${b.category} spending to make the remaining ${sym} ${b.remaining.toFixed(2)} last through the month.`,
        metric: `${b.percentUsed}% used`,
        calculatedAt: Date.now(),
      });
    } else if (b.projectedOverage > 0 && b.percentUsed > 50 && daysRemaining > 5) {
      insights.push({
        id: `det-budget-projected-${b.category}`,
        type: 'budget_warning',
        title: `${b.category} spending pace alert`,
        description: `At your current spending rate, your ${b.category} budget may be exceeded by approximately ${sym} ${b.projectedOverage.toFixed(0)}.`,
        category: b.category,
        severity: 'warning',
        value: b.projectedOverage,
        recommendation: `Reducing daily spending by ~${sym} ${(b.projectedOverage / daysRemaining).toFixed(1)}/day will keep you within budget.`,
        metric: `Est. over: ${sym} ${b.projectedOverage}`,
        calculatedAt: Date.now(),
      });
    }
  });

  // 2. Unusual Spending Detection
  if (stats.unusualTransactions.length > 0) {
    const topUnusual = stats.unusualTransactions[0];
    insights.push({
      id: `det-unusual-${topUnusual.id}`,
      type: 'unusual_spending',
      title: 'Unusual spending detected',
      description: `A ${sym} ${topUnusual.amount.toFixed(2)} transaction at ${topUnusual.merchant} is noticeably higher than your normal ~${sym} ${topUnusual.normalCategoryAvg} average for ${topUnusual.category}.`,
      category: topUnusual.category,
      severity: 'info',
      value: topUnusual.amount,
      recommendation: `Keep an eye on large one-off purchases to avoid unexpected budget strains.`,
      metric: `${topUnusual.ratio}x normal avg`,
      calculatedAt: Date.now(),
    });
  }

  // 3. Category Spending Trends (Significant Increases)
  const significantIncrease = stats.categoryComparisons
    .filter((c) => c.changePct !== null && c.changePct >= 20 && c.difference >= 30)
    .sort((a, b) => (b.changePct || 0) - (a.changePct || 0))[0];

  if (significantIncrease && significantIncrease.changePct !== null) {
    insights.push({
      id: `det-spending-increase-${significantIncrease.category}`,
      type: 'spending_increase',
      title: `${significantIncrease.category} spending increased`,
      description: `You've spent ${significantIncrease.changePct}% more on ${significantIncrease.category} this month (${sym} ${significantIncrease.current.toFixed(2)}) compared to last month (${sym} ${significantIncrease.previous.toFixed(2)}).`,
      category: significantIncrease.category,
      severity: 'warning',
      value: significantIncrease.changePct,
      metric: `+${significantIncrease.changePct}% MoM`,
      calculatedAt: Date.now(),
    });
  }

  // 4. Category Spending Trends (Significant Decreases / Savings)
  const significantDecrease = stats.categoryComparisons
    .filter((c) => c.changePct !== null && c.changePct <= -15 && c.difference <= -40)
    .sort((a, b) => (a.changePct || 0) - (b.changePct || 0))[0];

  if (significantDecrease && significantDecrease.changePct !== null) {
    insights.push({
      id: `det-spending-decrease-${significantDecrease.category}`,
      type: 'spending_decrease',
      title: `${significantDecrease.category} savings`,
      description: `Your ${significantDecrease.category} spending is ${Math.abs(significantDecrease.changePct)}% lower than last month, saving you ${sym} ${Math.abs(significantDecrease.difference).toFixed(2)}.`,
      category: significantDecrease.category,
      severity: 'positive',
      value: Math.abs(significantDecrease.changePct),
      metric: `${significantDecrease.changePct}% MoM`,
      calculatedAt: Date.now(),
    });
  }

  // 5. Highest Spending Category
  if (stats.highestSpendingCategory && stats.highestSpendingCategory.amount > 0) {
    insights.push({
      id: `det-highest-cat`,
      type: 'info' as any,
      title: 'Top spending category',
      description: `${stats.highestSpendingCategory.name} is currently your highest spending category at ${sym} ${stats.highestSpendingCategory.amount.toFixed(2)} (${stats.highestSpendingCategory.pctOfTotal}% of total expenses).`,
      category: stats.highestSpendingCategory.name,
      severity: 'info',
      value: stats.highestSpendingCategory.amount,
      metric: `${stats.highestSpendingCategory.pctOfTotal}% of total`,
      calculatedAt: Date.now(),
    });
  }

  // 6. Positive Insights / Achievements
  if (stats.positiveAchievements.length > 0) {
    insights.push({
      id: `det-positive-budget`,
      type: 'positive',
      title: 'Positive budget status',
      description: stats.positiveAchievements[0],
      severity: 'positive',
      metric: 'On track',
      calculatedAt: Date.now(),
    });
  }

  // Deduplicate by ID and return top insights
  return insights.slice(0, 6);
}
