import { useState, useEffect, useRef } from 'react';
import {
  Expense,
  UserSettings,
  CategoryItem,
  TransactionType,
  RecurringExpense,
  RecurringInterval,
  CategoryBudgetConfig,
} from '../types';
import { DEFAULT_CATEGORIES } from '../data/categories';
import { calculateNextDueDate } from '../utils/recurring';

const STORAGE_KEY_EXPENSES = 'daily_expenses_tracker_v2';
const STORAGE_KEY_SETTINGS = 'daily_expenses_settings_v2';
const STORAGE_KEY_CATEGORIES = 'daily_expenses_categories_v2';
const STORAGE_KEY_RECURRING = 'daily_expenses_recurring_v2';

const DEFAULT_CATEGORY_BUDGETS: Record<string, number> = {
  'Food & Dining': 800,
  'Groceries': 600,
  'Transportation': 350,
  'Shopping': 400,
  'Utilities & Bills': 1000,
  'Entertainment': 200,
  'Health & Medical': 150,
};

const DEFAULT_SETTINGS: UserSettings = {
  currency: 'MYR',
  currencySymbol: 'RM',
  monthlyBudget: 3500,
  categoryBudgets: DEFAULT_CATEGORY_BUDGETS,
  hapticFeedback: true,
  theme: 'dark',
};

function getInitialExpenses(): Expense[] {
  // Check v2 key first, then fallback to v1 migration
  const saved = localStorage.getItem(STORAGE_KEY_EXPENSES) || localStorage.getItem('daily_expenses_tracker_v1');
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        // Ensure every item has a type ('expense' by default) and proper currency
        return parsed.map((item: any) => ({
          ...item,
          type: item.type || 'expense',
          currency: item.currency === 'USD' ? 'MYR' : (item.currency || 'MYR'),
        }));
      }
    } catch (e) {
      console.error('Failed to parse saved expenses', e);
    }
  }

  // Seed sample initial transactions with MYR and both income & expenses
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().slice(0, 10);

  const threeDaysAgo = new Date(today);
  threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
  const threeDaysAgoStr = threeDaysAgo.toISOString().slice(0, 10);

  return [
    {
      id: 'seed-income-1',
      type: 'income',
      merchant: 'Monthly Salary (Tech Corp)',
      amount: 4500.00,
      currency: 'MYR',
      date: threeDaysAgoStr,
      time: '09:00',
      category: 'Salary',
      paymentMethod: 'Bank Transfer',
      summary: 'Direct monthly payroll deposit',
      tags: ['salary', 'income', 'payroll'],
      createdAt: Date.now() - 1000 * 60 * 60 * 72,
      confidence: 'high',
    },
    {
      id: 'seed-1',
      type: 'expense',
      merchant: 'Kopitiam & Cafe',
      amount: 14.50,
      currency: 'MYR',
      date: todayStr,
      time: '08:45',
      category: 'Food & Dining',
      paymentMethod: 'E-Wallet',
      summary: 'Kopi C peng & kaya butter toast set',
      tags: ['breakfast', 'coffee'],
      items: [
        { name: 'Kopi C Cold', quantity: 1, price: 5.50 },
        { name: 'Kaya Butter Toast (Double)', quantity: 1, price: 5.00 },
        { name: 'Half Boiled Eggs', quantity: 2, price: 4.00 },
      ],
      createdAt: Date.now() - 1000 * 60 * 60 * 3,
      confidence: 'high',
    },
    {
      id: 'seed-2',
      type: 'expense',
      merchant: 'Village Grocer Supermarket',
      amount: 88.60,
      currency: 'MYR',
      date: todayStr,
      time: '12:30',
      category: 'Groceries',
      paymentMethod: 'Credit Card',
      summary: 'Fresh fruits, milk, organic eggs, salmon & veggies',
      tags: ['groceries', 'food'],
      items: [
        { name: 'Fresh Atlantic Salmon', quantity: 1, price: 38.00 },
        { name: 'Organic Pasteurized Eggs 10pk', quantity: 1, price: 14.60 },
        { name: 'Fresh Milk 1L', quantity: 2, price: 16.00 },
        { name: 'Fuji Apples 4pk', quantity: 1, price: 20.00 },
      ],
      createdAt: Date.now() - 1000 * 60 * 60 * 1,
      confidence: 'high',
    },
    {
      id: 'seed-3',
      type: 'expense',
      merchant: 'RapidKL MRT Commute',
      amount: 4.80,
      currency: 'MYR',
      date: yesterdayStr,
      time: '18:15',
      category: 'Transportation',
      paymentMethod: 'E-Wallet',
      summary: 'Daily subway commute Touch \'n Go',
      tags: ['mrt', 'transit'],
      createdAt: Date.now() - 1000 * 60 * 60 * 24,
      confidence: 'high',
    },
    {
      id: 'seed-4',
      type: 'expense',
      merchant: 'Petronas Petrol Station',
      amount: 65.00,
      currency: 'MYR',
      date: yesterdayStr,
      time: '09:20',
      category: 'Transportation',
      paymentMethod: 'Debit Card',
      summary: 'Fuel tank refuel RON 95',
      tags: ['fuel', 'car'],
      createdAt: Date.now() - 1000 * 60 * 60 * 30,
      confidence: 'high',
    },
  ];
}

function getInitialSettings(): UserSettings {
  const saved = localStorage.getItem(STORAGE_KEY_SETTINGS) || localStorage.getItem('daily_expenses_settings_v1');
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      return {
        ...DEFAULT_SETTINGS,
        ...parsed,
        categoryBudgets: parsed.categoryBudgets || DEFAULT_CATEGORY_BUDGETS,
        // Ensure default currency is MYR if not customized or was default USD
        currency: parsed.currency === 'USD' ? 'MYR' : (parsed.currency || 'MYR'),
        currencySymbol: parsed.currency === 'USD' ? 'RM' : (parsed.currencySymbol || 'RM'),
        theme: parsed.theme || 'dark',
      };
    } catch (e) {
      console.error('Failed to parse saved settings', e);
    }
  }
  return DEFAULT_SETTINGS;
}

function getInitialCategories(): CategoryItem[] {
  const saved = localStorage.getItem(STORAGE_KEY_CATEGORIES);
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    } catch (e) {
      console.error('Failed to parse saved categories', e);
    }
  }
  return DEFAULT_CATEGORIES;
}

function getInitialRecurring(): RecurringExpense[] {
  const saved = localStorage.getItem(STORAGE_KEY_RECURRING);
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    } catch (e) {
      console.error('Failed to parse saved recurring expenses', e);
    }
  }

  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');

  return [
    {
      id: 'rec_netflix',
      type: 'expense',
      merchant: 'Netflix Subscription',
      amount: 55.0,
      currency: 'MYR',
      category: 'Entertainment',
      paymentMethod: 'Credit Card',
      interval: 'monthly',
      startDate: `${year}-${month}-05`,
      nextDueDate: `${year}-${month}-05`,
      isActive: true,
      summary: 'Standard 4K stream plan',
      tags: ['streaming', 'subscription', 'monthly'],
      createdAt: Date.now() - 1000 * 60 * 60 * 24 * 30,
    },
    {
      id: 'rec_unifi',
      type: 'expense',
      merchant: 'Home Fiber Internet',
      amount: 139.0,
      currency: 'MYR',
      category: 'Utilities & Bills',
      paymentMethod: 'Credit Card',
      interval: 'monthly',
      startDate: `${year}-${month}-15`,
      nextDueDate: `${year}-${month}-15`,
      isActive: true,
      summary: '500Mbps high-speed home broadband',
      tags: ['wifi', 'bills', 'monthly'],
      createdAt: Date.now() - 1000 * 60 * 60 * 24 * 45,
    },
    {
      id: 'rec_coway',
      type: 'expense',
      merchant: 'Coway Water Purifier',
      amount: 85.0,
      currency: 'MYR',
      category: 'Utilities & Bills',
      paymentMethod: 'Bank Transfer',
      interval: 'monthly',
      startDate: `${year}-${month}-10`,
      nextDueDate: `${year}-${month}-10`,
      isActive: true,
      summary: 'Water dispenser monthly rental & maintenance',
      tags: ['utilities', 'home', 'monthly'],
      createdAt: Date.now() - 1000 * 60 * 60 * 24 * 60,
    },
    {
      id: 'rec_rent',
      type: 'expense',
      merchant: 'House / Room Rental',
      amount: 1200.0,
      currency: 'MYR',
      category: 'Utilities & Bills',
      paymentMethod: 'Bank Transfer',
      interval: 'monthly',
      startDate: `${year}-${month}-01`,
      nextDueDate: `${year}-${month}-01`,
      isActive: true,
      summary: 'Monthly residential rental lease',
      tags: ['rent', 'fixed', 'monthly'],
      createdAt: Date.now() - 1000 * 60 * 60 * 24 * 90,
    },
  ];
}

export function useExpenses() {
  const [expenses, setExpenses] = useState<Expense[]>(getInitialExpenses);
  const [settings, setSettings] = useState<UserSettings>(getInitialSettings);
  const [categories, setCategories] = useState<CategoryItem[]>(getInitialCategories);
  const [recurringExpenses, setRecurringExpenses] = useState<RecurringExpense[]>(getInitialRecurring);
  const [autoGeneratedAlert, setAutoGeneratedAlert] = useState<{ count: number; items: string[] } | null>(null);

  const hasCheckedRecurringRef = useRef(false);

  // Sync to local storage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_EXPENSES, JSON.stringify(expenses));
  }, [expenses]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_CATEGORIES, JSON.stringify(categories));
  }, [categories]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_RECURRING, JSON.stringify(recurringExpenses));
  }, [recurringExpenses]);

  const triggerHaptic = () => {
    if (settings.hapticFeedback && typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(25);
      } catch (e) {
        // Safe ignore
      }
    }
  };

  const addExpense = (newExpense: Omit<Expense, 'id' | 'createdAt'>) => {
    triggerHaptic();
    const expense: Expense = {
      ...newExpense,
      type: newExpense.type || 'expense',
      currency: newExpense.currency || settings.currency,
      id: 'exp_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      createdAt: Date.now(),
    };
    setExpenses((prev) => [expense, ...prev]);
    return expense;
  };

  const addMultipleExpenses = (newExpensesList: Array<Omit<Expense, 'id' | 'createdAt'>>) => {
    if (newExpensesList.length === 0) return [];
    triggerHaptic();
    const createdItems: Expense[] = newExpensesList.map((newExpense, idx) => ({
      ...newExpense,
      type: newExpense.type || 'expense',
      currency: newExpense.currency || settings.currency,
      id: 'exp_' + Date.now() + '_' + idx + '_' + Math.random().toString(36).substring(2, 7),
      createdAt: Date.now() + idx,
    }));
    setExpenses((prev) => [...createdItems, ...prev]);
    return createdItems;
  };

  const updateExpense = (id: string, updatedFields: Partial<Expense>) => {
    triggerHaptic();
    setExpenses((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...updatedFields } : item))
    );
  };

  const deleteExpense = (id: string) => {
    triggerHaptic();
    setExpenses((prev) => prev.filter((item) => item.id !== id));
  };

  const clearAllExpenses = () => {
    triggerHaptic();
    setExpenses([]);
  };

  const updateSettings = (newSettings: Partial<UserSettings>) => {
    setSettings((prev) => ({ ...prev, ...newSettings }));
  };

  const updateCategoryBudgetConfig = (
    categoryName: string,
    config: Partial<CategoryBudgetConfig>
  ) => {
    triggerHaptic();
    setSettings((prev) => {
      const existingConfigs = prev.categoryBudgetConfigs || {};
      const currentConfig = existingConfigs[categoryName] || {
        category: categoryName,
        baseBudget: prev.categoryBudgets?.[categoryName] || 0,
        rolloverEnabled: false,
        rolloverType: 'none',
        allowNegativeRollover: false,
      };

      const updatedConfig: CategoryBudgetConfig = {
        ...currentConfig,
        ...config,
        category: categoryName,
      };

      const updatedConfigs = {
        ...existingConfigs,
        [categoryName]: updatedConfig,
      };

      // Keep legacy categoryBudgets in sync with baseBudget
      const updatedCategoryBudgets = {
        ...(prev.categoryBudgets || {}),
        [categoryName]: updatedConfig.baseBudget,
      };

      return {
        ...prev,
        categoryBudgets: updatedCategoryBudgets,
        categoryBudgetConfigs: updatedConfigs,
      };
    });
  };

  // Toggle Dark Mode
  const toggleTheme = () => {
    triggerHaptic();
    setSettings((prev) => ({
      ...prev,
      theme: prev.theme === 'light' ? 'dark' : 'light',
    }));
  };

  // Custom Categories Management
  const addCategory = (newCat: Omit<CategoryItem, 'id'>) => {
    triggerHaptic();
    const item: CategoryItem = {
      ...newCat,
      id: 'cat_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      isCustom: true,
    };
    setCategories((prev) => [...prev, item]);
    return item;
  };

  const updateCategory = (id: string, updated: Partial<CategoryItem>) => {
    triggerHaptic();
    setCategories((prev) =>
      prev.map((c) => (c.id === id ? { ...c, ...updated } : c))
    );
  };

  const deleteCategory = (id: string) => {
    triggerHaptic();
    setCategories((prev) => prev.filter((c) => c.id !== id));
  };

  const resetCategories = () => {
    triggerHaptic();
    setCategories(DEFAULT_CATEGORIES);
  };

  // Process due recurring expenses and generate transactions
  const processDueRecurring = (manual = false): { generatedCount: number; generatedItems: string[] } => {
    const todayStr = new Date().toISOString().slice(0, 10);
    const newExpensesToCreate: Expense[] = [];
    let updatedRecurringList = [...recurringExpenses];
    let hasChanges = false;
    const generatedNames: string[] = [];

    updatedRecurringList = updatedRecurringList.map((item) => {
      if (!item.isActive) return item;

      let currentDue = item.nextDueDate;
      let lastGen = item.lastGeneratedDate;
      let itemChanged = false;
      let cycles = 0;
      const maxCycles = 12; // safety cap

      // While the due date is today or in the past
      while (currentDue <= todayStr && cycles < maxCycles) {
        cycles++;
        // Check if an entry for this recurring id and date already exists to prevent duplicate
        const alreadyExists = expenses.some(
          (e) => (e.recurringId === item.id || e.id.includes(`rec_gen_${item.id}_${currentDue.replace(/-/g, '')}`)) && e.date === currentDue
        );

        if (!alreadyExists) {
          const newExp: Expense = {
            id: `rec_gen_${item.id}_${currentDue.replace(/-/g, '')}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            type: item.type,
            merchant: item.merchant,
            amount: item.amount,
            currency: item.currency || settings.currency,
            date: currentDue,
            time: '08:00',
            category: item.category,
            paymentMethod: item.paymentMethod,
            summary: item.summary ? `${item.summary} (Auto recurring)` : `Recurring ${item.interval} entry`,
            tags: [...(item.tags || []), 'recurring', item.interval],
            createdAt: Date.now(),
            confidence: 'high',
            isRecurring: true,
            recurringId: item.id,
            recurringInterval: item.interval,
          };
          newExpensesToCreate.push(newExp);
          generatedNames.push(item.merchant);
        }

        lastGen = currentDue;
        currentDue = calculateNextDueDate(currentDue, item.interval);
        itemChanged = true;
      }

      if (itemChanged) {
        hasChanges = true;
        return {
          ...item,
          nextDueDate: currentDue,
          lastGeneratedDate: lastGen,
        };
      }
      return item;
    });

    if (newExpensesToCreate.length > 0) {
      setExpenses((prev) => [...newExpensesToCreate, ...prev]);
      setAutoGeneratedAlert({
        count: newExpensesToCreate.length,
        items: Array.from(new Set(generatedNames)),
      });
      triggerHaptic();
    }

    if (hasChanges) {
      setRecurringExpenses(updatedRecurringList);
    }

    return {
      generatedCount: newExpensesToCreate.length,
      generatedItems: Array.from(new Set(generatedNames)),
    };
  };

  // Run auto-check once upon mounting
  useEffect(() => {
    if (!hasCheckedRecurringRef.current && recurringExpenses.length > 0) {
      hasCheckedRecurringRef.current = true;
      const timer = setTimeout(() => {
        processDueRecurring(false);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [recurringExpenses]);

  const addRecurringExpense = (
    newRule: Omit<RecurringExpense, 'id' | 'createdAt' | 'nextDueDate'> & {
      initialNextDueDate?: string;
      generateFirstNow?: boolean;
    }
  ) => {
    triggerHaptic();
    const todayStr = new Date().toISOString().slice(0, 10);
    const startDate = newRule.startDate || todayStr;
    const initialDue = newRule.initialNextDueDate || startDate;

    const id = 'rec_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
    const rule: RecurringExpense = {
      ...newRule,
      id,
      currency: newRule.currency || settings.currency,
      startDate,
      nextDueDate: initialDue,
      createdAt: Date.now(),
      isActive: newRule.isActive !== undefined ? newRule.isActive : true,
    };

    // If user requested to generate the first entry immediately today:
    if (newRule.generateFirstNow) {
      const firstExp: Expense = {
        id: `rec_gen_${id}_${todayStr.replace(/-/g, '')}_${Date.now()}`,
        type: rule.type,
        merchant: rule.merchant,
        amount: rule.amount,
        currency: rule.currency,
        date: todayStr,
        time: new Date().toTimeString().slice(0, 5),
        category: rule.category,
        paymentMethod: rule.paymentMethod,
        summary: rule.summary ? `${rule.summary} (Initial recurring entry)` : `Initial ${rule.interval} entry`,
        tags: [...(rule.tags || []), 'recurring', rule.interval],
        createdAt: Date.now(),
        confidence: 'high',
        isRecurring: true,
        recurringId: id,
        recurringInterval: rule.interval,
      };
      setExpenses((prev) => [firstExp, ...prev]);
      // Advance next due date since today is generated
      rule.nextDueDate = calculateNextDueDate(todayStr, rule.interval);
      rule.lastGeneratedDate = todayStr;
    }

    setRecurringExpenses((prev) => [rule, ...prev]);
    return rule;
  };

  const updateRecurringExpense = (id: string, updated: Partial<RecurringExpense>) => {
    triggerHaptic();
    setRecurringExpenses((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...updated } : item))
    );
  };

  const deleteRecurringExpense = (id: string) => {
    triggerHaptic();
    setRecurringExpenses((prev) => prev.filter((item) => item.id !== id));
  };

  const toggleRecurringActive = (id: string) => {
    triggerHaptic();
    setRecurringExpenses((prev) =>
      prev.map((item) => (item.id === id ? { ...item, isActive: !item.isActive } : item))
    );
  };

  const clearAutoGeneratedAlert = () => {
    setAutoGeneratedAlert(null);
  };

  const exportCSV = () => {
    if (expenses.length === 0) return;
    const headers = ['Type', 'Date', 'Time', 'Merchant / Source', 'Category', 'Amount', 'Currency', 'Payment Method', 'Summary', 'Tags', 'Recurring'];
    const rows = expenses.map((e) => [
      `"${e.type === 'income' ? 'Income' : 'Expense'}"`,
      `"${e.date}"`,
      `"${e.time || ''}"`,
      `"${e.merchant.replace(/"/g, '""')}"`,
      `"${e.category}"`,
      (e.type === 'income' ? e.amount : -e.amount).toFixed(2),
      `"${e.currency}"`,
      `"${e.paymentMethod}"`,
      `"${(e.summary || '').replace(/"/g, '""')}"`,
      `"${(e.tags || []).join(', ')}"`,
      `"${e.isRecurring ? e.recurringInterval || 'Yes' : 'No'}"`,
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Daily_Expenses_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportJSON = () => {
    const dataStr = JSON.stringify(
      { expenses, settings, categories, recurringExpenses, exportedAt: new Date().toISOString() },
      null,
      2
    );
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Expenses_Backup_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const importJSON = (jsonString: string): boolean => {
    try {
      const data = JSON.parse(jsonString);
      if (Array.isArray(data.expenses)) {
        setExpenses(data.expenses);
        if (data.settings) {
          setSettings((prev) => ({ ...prev, ...data.settings }));
        }
        if (Array.isArray(data.categories)) {
          setCategories(data.categories);
        }
        if (Array.isArray(data.recurringExpenses)) {
          setRecurringExpenses(data.recurringExpenses);
        }
        triggerHaptic();
        return true;
      }
    } catch (e) {
      console.error('Failed to import JSON', e);
    }
    return false;
  };

  return {
    expenses,
    settings,
    categories,
    recurringExpenses,
    autoGeneratedAlert,
    clearAutoGeneratedAlert,
    addExpense,
    addMultipleExpenses,
    updateExpense,
    deleteExpense,
    clearAllExpenses,
    updateSettings,
    updateCategoryBudgetConfig,
    toggleTheme,
    addCategory,
    updateCategory,
    deleteCategory,
    resetCategories,
    addRecurringExpense,
    updateRecurringExpense,
    deleteRecurringExpense,
    toggleRecurringActive,
    processDueRecurring,
    exportCSV,
    exportJSON,
    importJSON,
    triggerHaptic,
  };
}
