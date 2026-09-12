import { Expense, UserSettings } from '../types';
import { computeCategoryBudgets } from './budgetRollover';

export interface SpendingAlert {
  id: string;
  signature: string;
  type: 'budget_exceeded' | 'budget_approaching' | 'unusual_transaction';
  severity: 'critical' | 'warning' | 'info';
  priority: 1 | 2 | 3; // 1: Exceeded (highest), 2: Approaching, 3: Unusual
  title: string;
  supportingText: string;
  statusText: string;
  category?: string;
  transaction?: Expense;
  spentAmount?: number;
  budgetAmount?: number;
  overAmount?: number;
  remainingAmount?: number;
  ratio?: number;
  medianAmount?: number;
  sampleCount?: number;
  filterMonth?: string;
}

/**
 * Format money with standard integer vs decimal cents display
 */
export function formatMoney(amount: number, symbol: string = 'RM'): string {
  const rounded = Math.round((Number(amount) || 0) * 100) / 100;
  if (rounded % 1 === 0) {
    return `${symbol}${rounded.toLocaleString('en-US')}`;
  }
  return `${symbol}${rounded.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/**
 * Helper to calculate median of a number array
 */
export function calculateMedian(numbers: number[]): number {
  if (numbers.length === 0) return 0;
  const sorted = [...numbers].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }
  return sorted[mid];
}

/**
 * Create a deterministic hash/key for unusual transaction acknowledgement
 */
export function getTransactionAlertSignature(tx: Expense): string {
  const cleanAmount = (Number(tx.amount) || 0).toFixed(2);
  const cleanCat = (tx.category || '').trim();
  const cleanDate = (tx.date || '').trim();
  return `unusual:${tx.id}:${cleanAmount}:${cleanCat}:${cleanDate}`;
}

/**
 * Main pure function to compute spending alerts based purely on local recorded data
 */
export function calculateSpendingAlerts(
  expenses: Expense[],
  settings: UserSettings,
  targetMonthKey?: string,
  acknowledgedSignatures: Set<string> = new Set()
): SpendingAlert[] {
  const alerts: SpendingAlert[] = [];
  const sym = settings.currencySymbol || 'RM';
  const now = new Date();
  const currentMonthKey = targetMonthKey || now.toISOString().slice(0, 7);

  // Helper for integer cents conversions
  const toCents = (num: number) => Math.round((Number(num) || 0) * 100);

  // Only consider 'expense' type (exclude income, savings transfers)
  const isExpenseType = (exp: Expense) => (exp.type || 'expense') === 'expense';

  const monthlyExpenses = expenses.filter(
    (exp) => isExpenseType(exp) && exp.date && exp.date.startsWith(currentMonthKey)
  );

  // -------------------------------------------------------------
  // 1 & 2: Evaluate Category & Overall Budgets
  // -------------------------------------------------------------
  const categoryBudgetsMap = settings.categoryBudgets || {};
  const categoryConfigsMap = settings.categoryBudgetConfigs || {};

  // Compute category budgets with rollover if configured
  const computedCategoryWallets = computeCategoryBudgets(
    expenses,
    categoryBudgetsMap,
    categoryConfigsMap,
    currentMonthKey
  );

  // Track categories that have an exceeded alert to prevent duplicate approaching alerts
  const categoriesWithExceeded = new Set<string>();

  // A. Category Budgets Check
  Object.values(computedCategoryWallets).forEach((wallet) => {
    const budgetCents = toCents(wallet.availableBudget > 0 ? wallet.availableBudget : wallet.baseBudget);
    if (budgetCents <= 0) return; // Unset budget: ignore

    const spentCents = toCents(wallet.spentThisMonth);
    const spentAmount = wallet.spentThisMonth;
    const budgetAmount = wallet.availableBudget > 0 ? wallet.availableBudget : wallet.baseBudget;

    if (spentCents > budgetCents) {
      // Exceeded (> 100%) - show only exceeded alert
      categoriesWithExceeded.add(wallet.category);
      const overCents = spentCents - budgetCents;
      const overAmount = overCents / 100;

      alerts.push({
        id: `budget-exceeded-cat-${wallet.category}`,
        signature: `budget_exceeded:${wallet.category}:${currentMonthKey}`,
        type: 'budget_exceeded',
        severity: 'critical',
        priority: 1,
        title: `${wallet.category} budget exceeded`,
        supportingText: `${formatMoney(spentAmount, sym)} spent vs ${formatMoney(budgetAmount, sym)} budget`,
        statusText: `${formatMoney(overAmount, sym)} over budget`,
        category: wallet.category,
        spentAmount,
        budgetAmount,
        overAmount,
        filterMonth: currentMonthKey,
      });
    } else if (spentCents >= Math.round(budgetCents * 0.8) && spentCents <= budgetCents) {
      // Approaching or fully used (80% to 100%)
      const remainingCents = Math.max(0, budgetCents - spentCents);
      const remainingAmount = remainingCents / 100;
      const isExactlyFull = spentCents === budgetCents;

      alerts.push({
        id: `budget-approaching-cat-${wallet.category}`,
        signature: `budget_approaching:${wallet.category}:${currentMonthKey}`,
        type: 'budget_approaching',
        severity: 'warning',
        priority: 2,
        title: isExactlyFull
          ? `${wallet.category} budget fully used`
          : `${wallet.category} approaching budget limit`,
        supportingText: `${formatMoney(spentAmount, sym)} of ${formatMoney(budgetAmount, sym)} limit`,
        statusText: isExactlyFull ? 'Budget fully used' : `${formatMoney(remainingAmount, sym)} remaining`,
        category: wallet.category,
        spentAmount,
        budgetAmount,
        remainingAmount,
        filterMonth: currentMonthKey,
      });
    }
  });

  // B. Overall Monthly Budget Check
  const overallBudgetCents = toCents(settings.monthlyBudget);
  if (overallBudgetCents > 0) {
    const totalSpentCents = monthlyExpenses.reduce(
      (sum, exp) => sum + toCents(exp.amount),
      0
    );
    const totalSpentAmount = totalSpentCents / 100;
    const overallBudgetAmount = overallBudgetCents / 100;

    if (totalSpentCents > overallBudgetCents) {
      // Exceeded overall
      const overCents = totalSpentCents - overallBudgetCents;
      const overAmount = overCents / 100;

      alerts.push({
        id: `budget-exceeded-overall`,
        signature: `budget_exceeded:overall:${currentMonthKey}`,
        type: 'budget_exceeded',
        severity: 'critical',
        priority: 1,
        title: `Overall budget exceeded`,
        supportingText: `${formatMoney(totalSpentAmount, sym)} spent vs ${formatMoney(overallBudgetAmount, sym)} budget`,
        statusText: `${formatMoney(overAmount, sym)} over budget`,
        spentAmount: totalSpentAmount,
        budgetAmount: overallBudgetAmount,
        overAmount,
        filterMonth: currentMonthKey,
      });
    } else if (
      totalSpentCents >= Math.round(overallBudgetCents * 0.8) &&
      totalSpentCents <= overallBudgetCents
    ) {
      // Approaching overall: avoid near-duplicate warning if a category is already approaching/exceeded
      const hasCategoryWarning = alerts.some(
        (a) => a.type === 'budget_exceeded' || a.type === 'budget_approaching'
      );

      // Only add overall approaching if no specific category warning exists (prefer more actionable category alert)
      if (!hasCategoryWarning) {
        const remainingCents = Math.max(0, overallBudgetCents - totalSpentCents);
        const remainingAmount = remainingCents / 100;
        const isExactlyFull = totalSpentCents === overallBudgetCents;

        alerts.push({
          id: `budget-approaching-overall`,
          signature: `budget_approaching:overall:${currentMonthKey}`,
          type: 'budget_approaching',
          severity: 'warning',
          priority: 2,
          title: isExactlyFull
            ? `Overall budget fully used`
            : `Overall budget approaching limit`,
          supportingText: `${formatMoney(totalSpentAmount, sym)} of ${formatMoney(overallBudgetAmount, sym)} limit`,
          statusText: isExactlyFull ? 'Budget fully used' : `${formatMoney(remainingAmount, sym)} remaining`,
          spentAmount: totalSpentAmount,
          budgetAmount: overallBudgetAmount,
          remainingAmount,
          filterMonth: currentMonthKey,
        });
      }
    }
  }

  // -------------------------------------------------------------
  // 3: Unusual Transaction Check
  // -------------------------------------------------------------
  // Sort all expenses by date descending
  const sortedExpenses = [...expenses].filter(isExpenseType).sort((a, b) => {
    const dateComp = (b.date || '').localeCompare(a.date || '');
    if (dateComp !== 0) return dateComp;
    return (b.createdAt || 0) - (a.createdAt || 0);
  });

  // Check recent transactions (e.g. from current month or recent 30 days)
  const candidateTransactions = sortedExpenses.filter((tx) => {
    if (!tx.date || Number(tx.amount) <= 0) return false;
    // Check if in current month or within last 30 days
    return tx.date.startsWith(currentMonthKey);
  });

  candidateTransactions.forEach((tx) => {
    const txSignature = getTransactionAlertSignature(tx);
    // Skip if acknowledged
    if (acknowledgedSignatures.has(txSignature)) return;

    const txDate = new Date(tx.date);
    const txTime = txDate.getTime();
    const ninetyDaysMs = 90 * 24 * 60 * 60 * 1000;

    // Find preceding 90 days expenses in same category excluding this transaction
    const priorExpenses = sortedExpenses.filter((other) => {
      if (other.id === tx.id) return false;
      if (other.category !== tx.category) return false;
      if (!other.date) return false;

      const otherTime = new Date(other.date).getTime();
      // Must be earlier or equal date, and within preceding 90 days
      const isPreceding =
        other.date < tx.date ||
        (other.date === tx.date && (other.createdAt || 0) < (tx.createdAt || 0));
      const isWithin90Days = txTime - otherTime >= 0 && txTime - otherTime <= ninetyDaysMs;

      return isPreceding && isWithin90Days && Number(other.amount) > 0;
    });

    // Require at least 10 previous comparable expenses
    if (priorExpenses.length >= 10) {
      const priorAmounts = priorExpenses.map((p) => Number(p.amount) || 0);
      const median = calculateMedian(priorAmounts);

      if (median > 0 && tx.amount >= 3 * median) {
        const ratio = Math.round((tx.amount / median) * 10) / 10;

        alerts.push({
          id: `unusual-tx-${tx.id}`,
          signature: txSignature,
          type: 'unusual_transaction',
          severity: 'warning',
          priority: 3,
          title: 'Check this transaction',
          supportingText: `${tx.merchant} • ${formatMoney(tx.amount, sym)} on ${tx.date}`,
          statusText: `${formatMoney(tx.amount, sym)} is ${ratio}× the median of your ${priorExpenses.length} previous ${tx.category.toLowerCase()} expenses.`,
          category: tx.category,
          transaction: tx,
          spentAmount: tx.amount,
          ratio,
          medianAmount: median,
          sampleCount: priorExpenses.length,
          filterMonth: tx.date.slice(0, 7),
        });
      }
    }
  });

  // Sort alerts by priority (1: Exceeded -> 2: Approaching -> 3: Unusual)
  alerts.sort((a, b) => {
    if (a.priority !== b.priority) {
      return a.priority - b.priority;
    }
    // If same priority, sort by larger overage or ratio
    const aVal = a.overAmount || a.ratio || a.spentAmount || 0;
    const bVal = b.overAmount || b.ratio || b.spentAmount || 0;
    return bVal - aVal;
  });

  return alerts;
}
