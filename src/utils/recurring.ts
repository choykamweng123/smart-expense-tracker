import { RecurringExpense, RecurringInterval } from '../types';

/**
 * Calculates the next due date based on the current due date and interval.
 * Accurately handles month-end days (e.g., Jan 31 -> Feb 28/29).
 */
export function calculateNextDueDate(
  currentDateStr: string,
  interval: RecurringInterval
): string {
  const parts = currentDateStr.split('-').map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) {
    const fallback = new Date();
    return fallback.toISOString().slice(0, 10);
  }

  const [year, month, day] = parts;

  if (interval === 'daily') {
    const d = new Date(year, month - 1, day);
    d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
  }

  if (interval === 'weekly') {
    const d = new Date(year, month - 1, day);
    d.setDate(d.getDate() + 7);
    return d.toISOString().slice(0, 10);
  }

  // Monthly interval
  let targetYear = year;
  let targetMonth = month + 1; // 1-indexed
  if (targetMonth > 12) {
    targetYear += 1;
    targetMonth = 1;
  }

  // Find max days in the target month (passing day 0 of month+1 gives last day of month)
  const maxDaysInTargetMonth = new Date(targetYear, targetMonth, 0).getDate();
  const targetDay = Math.min(day, maxDaysInTargetMonth);

  const mm = String(targetMonth).padStart(2, '0');
  const dd = String(targetDay).padStart(2, '0');
  return `${targetYear}-${mm}-${dd}`;
}

/**
 * Returns a human-friendly label for a due date relative to today
 */
export function formatDueDateLabel(dueDateStr: string): {
  label: string;
  isOverdue: boolean;
  isToday: boolean;
  colorClass: string;
} {
  const todayStr = new Date().toISOString().slice(0, 10);
  if (dueDateStr === todayStr) {
    return {
      label: 'Due Today',
      isOverdue: false,
      isToday: true,
      colorClass: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
    };
  }

  const today = new Date(todayStr + 'T00:00:00');
  const due = new Date(dueDateStr + 'T00:00:00');
  const diffTime = due.getTime() - today.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    const overdueDays = Math.abs(diffDays);
    return {
      label: `${overdueDays} day${overdueDays > 1 ? 's' : ''} overdue`,
      isOverdue: true,
      isToday: false,
      colorClass: 'text-rose-400 bg-rose-500/10 border-rose-500/30',
    };
  }

  if (diffDays === 1) {
    return {
      label: 'Due Tomorrow',
      isOverdue: false,
      isToday: false,
      colorClass: 'text-sky-400 bg-sky-500/10 border-sky-500/30',
    };
  }

  if (diffDays <= 7) {
    return {
      label: `In ${diffDays} days`,
      isOverdue: false,
      isToday: false,
      colorClass: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/30',
    };
  }

  return {
    label: dueDateStr,
    isOverdue: false,
    isToday: false,
    colorClass: 'text-slate-400 bg-slate-500/10 border-slate-500/20',
  };
}

/**
 * Calculates estimated monthly cost of active recurring items
 */
export function calculateEstimatedMonthlyCost(recurringList: RecurringExpense[]): {
  totalExpense: number;
  totalIncome: number;
  net: number;
} {
  let totalExpense = 0;
  let totalIncome = 0;

  recurringList
    .filter((r) => r.isActive)
    .forEach((r) => {
      let monthlyEquivalent = r.amount;
      if (r.interval === 'daily') {
        monthlyEquivalent = r.amount * 30.41;
      } else if (r.interval === 'weekly') {
        monthlyEquivalent = r.amount * 4.33;
      }

      if (r.type === 'income') {
        totalIncome += monthlyEquivalent;
      } else {
        totalExpense += monthlyEquivalent;
      }
    });

  return {
    totalExpense,
    totalIncome,
    net: totalIncome - totalExpense,
  };
}

export interface RecurringPreset {
  name: string;
  type: 'expense' | 'income';
  defaultAmount: number;
  category: string;
  paymentMethod: string;
  interval: RecurringInterval;
  summary: string;
}

export const POPULAR_RECURRING_PRESETS: RecurringPreset[] = [
  {
    name: 'Netflix Subscription',
    type: 'expense',
    defaultAmount: 55.0,
    category: 'Entertainment',
    paymentMethod: 'Credit Card',
    interval: 'monthly',
    summary: 'Standard 4K stream plan',
  },
  {
    name: 'House / Room Rental',
    type: 'expense',
    defaultAmount: 1200.0,
    category: 'Utilities & Bills',
    paymentMethod: 'Bank Transfer',
    interval: 'monthly',
    summary: 'Monthly residential lease payment',
  },
  {
    name: 'Home Fiber Internet (TIME/Unifi)',
    type: 'expense',
    defaultAmount: 139.0,
    category: 'Utilities & Bills',
    paymentMethod: 'Credit Card',
    interval: 'monthly',
    summary: '500Mbps high-speed broadband bill',
  },
  {
    name: 'Coway / Water Purifier',
    type: 'expense',
    defaultAmount: 85.0,
    category: 'Utilities & Bills',
    paymentMethod: 'Bank Transfer',
    interval: 'monthly',
    summary: 'Water dispenser monthly rental & service',
  },
  {
    name: 'Spotify Premium Family',
    type: 'expense',
    defaultAmount: 24.9,
    category: 'Entertainment',
    paymentMethod: 'Credit Card',
    interval: 'monthly',
    summary: 'Family audio stream plan',
  },
  {
    name: 'Gym Membership',
    type: 'expense',
    defaultAmount: 169.0,
    category: 'Health & Medical',
    paymentMethod: 'Debit Card',
    interval: 'monthly',
    summary: 'Monthly fitness club access',
  },
  {
    name: 'Car Loan Installment',
    type: 'expense',
    defaultAmount: 650.0,
    category: 'Transportation',
    paymentMethod: 'Bank Transfer',
    interval: 'monthly',
    summary: 'Hire purchase auto loan',
  },
  {
    name: 'Weekly Groceries Budget',
    type: 'expense',
    defaultAmount: 150.0,
    category: 'Groceries',
    paymentMethod: 'E-Wallet',
    interval: 'weekly',
    summary: 'Weekly pantry & fresh produce stock up',
  },
  {
    name: 'Daily Subway Commute (MRT/LRT)',
    type: 'expense',
    defaultAmount: 5.0,
    category: 'Transportation',
    paymentMethod: 'E-Wallet',
    interval: 'daily',
    summary: 'Daily Touch n Go public transit travel',
  },
  {
    name: 'Monthly Salary (Employer)',
    type: 'income',
    defaultAmount: 4500.0,
    category: 'Salary',
    paymentMethod: 'Bank Transfer',
    interval: 'monthly',
    summary: 'Monthly company payroll direct deposit',
  },
];
