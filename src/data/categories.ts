import {
  Utensils,
  ShoppingCart,
  Car,
  ShoppingBag,
  Zap,
  Film,
  HeartPulse,
  Sparkles,
  GraduationCap,
  Plane,
  Briefcase,
  HelpCircle,
  Banknote,
  Laptop,
  TrendingUp,
  Gift,
  Home,
  Coffee,
  Dumbbell,
  Dog,
  Music,
  Smartphone,
  Baby,
  Fuel,
  Hammer,
  Wallet,
  Receipt,
  PiggyBank,
  Smile,
  type LucideIcon,
} from 'lucide-react';
import { ExpenseCategory, CurrencyConfig, CategoryItem, TransactionType } from '../types';

export interface CategoryMeta {
  name: string;
  icon: LucideIcon;
  color: string;
  bgColor: string;
  borderColor: string;
  badgeColor: string;
}

export const ICON_MAP: Record<string, LucideIcon> = {
  Utensils,
  ShoppingCart,
  Car,
  ShoppingBag,
  Zap,
  Film,
  HeartPulse,
  Sparkles,
  GraduationCap,
  Plane,
  Briefcase,
  HelpCircle,
  Banknote,
  Laptop,
  TrendingUp,
  Gift,
  Home,
  Coffee,
  Dumbbell,
  Dog,
  Music,
  Smartphone,
  Baby,
  Fuel,
  Hammer,
  Wallet,
  Receipt,
  PiggyBank,
  Smile,
};

export const COLOR_PALETTES = [
  {
    name: 'Emerald (Income/Green)',
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-500/10',
    borderColor: 'border-emerald-500/20',
    badgeColor: 'bg-emerald-500/20 text-emerald-300',
  },
  {
    name: 'Amber (Warm Gold)',
    color: 'text-amber-400',
    bgColor: 'bg-amber-500/10',
    borderColor: 'border-amber-500/20',
    badgeColor: 'bg-amber-500/20 text-amber-300',
  },
  {
    name: 'Sky (Blue)',
    color: 'text-sky-400',
    bgColor: 'bg-sky-500/10',
    borderColor: 'border-sky-500/20',
    badgeColor: 'bg-sky-500/20 text-sky-300',
  },
  {
    name: 'Indigo (Deep Blue)',
    color: 'text-indigo-400',
    bgColor: 'bg-indigo-500/10',
    borderColor: 'border-indigo-500/20',
    badgeColor: 'bg-indigo-500/20 text-indigo-300',
  },
  {
    name: 'Purple (Violet)',
    color: 'text-purple-400',
    bgColor: 'bg-purple-500/10',
    borderColor: 'border-purple-500/20',
    badgeColor: 'bg-purple-500/20 text-purple-300',
  },
  {
    name: 'Rose (Red/Pink)',
    color: 'text-rose-400',
    bgColor: 'bg-rose-500/10',
    borderColor: 'border-rose-500/20',
    badgeColor: 'bg-rose-500/20 text-rose-300',
  },
  {
    name: 'Teal (Cyan)',
    color: 'text-teal-400',
    bgColor: 'bg-teal-500/10',
    borderColor: 'border-teal-500/20',
    badgeColor: 'bg-teal-500/20 text-teal-300',
  },
  {
    name: 'Yellow (Bright)',
    color: 'text-yellow-400',
    bgColor: 'bg-yellow-500/10',
    borderColor: 'border-yellow-500/20',
    badgeColor: 'bg-yellow-500/20 text-yellow-300',
  },
  {
    name: 'Slate (Neutral)',
    color: 'text-slate-400',
    bgColor: 'bg-slate-500/10',
    borderColor: 'border-slate-500/20',
    badgeColor: 'bg-slate-500/20 text-slate-300',
  },
];

export const DEFAULT_CATEGORIES: CategoryItem[] = [
  // Expenses
  {
    id: 'cat-food',
    name: 'Food & Dining',
    iconName: 'Utensils',
    color: 'text-amber-400',
    bgColor: 'bg-amber-500/10',
    borderColor: 'border-amber-500/20',
    badgeColor: 'bg-amber-500/20 text-amber-300',
    type: 'expense',
  },
  {
    id: 'cat-groceries',
    name: 'Groceries',
    iconName: 'ShoppingCart',
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-500/10',
    borderColor: 'border-emerald-500/20',
    badgeColor: 'bg-emerald-500/20 text-emerald-300',
    type: 'expense',
  },
  {
    id: 'cat-transport',
    name: 'Transportation',
    iconName: 'Car',
    color: 'text-sky-400',
    bgColor: 'bg-sky-500/10',
    borderColor: 'border-sky-500/20',
    badgeColor: 'bg-sky-500/20 text-sky-300',
    type: 'expense',
  },
  {
    id: 'cat-shopping',
    name: 'Shopping',
    iconName: 'ShoppingBag',
    color: 'text-rose-400',
    bgColor: 'bg-rose-500/10',
    borderColor: 'border-rose-500/20',
    badgeColor: 'bg-rose-500/20 text-rose-300',
    type: 'expense',
  },
  {
    id: 'cat-bills',
    name: 'Utilities & Bills',
    iconName: 'Zap',
    color: 'text-yellow-400',
    bgColor: 'bg-yellow-500/10',
    borderColor: 'border-yellow-500/20',
    badgeColor: 'bg-yellow-500/20 text-yellow-300',
    type: 'expense',
  },
  {
    id: 'cat-entertainment',
    name: 'Entertainment',
    iconName: 'Film',
    color: 'text-purple-400',
    bgColor: 'bg-purple-500/10',
    borderColor: 'border-purple-500/20',
    badgeColor: 'bg-purple-500/20 text-purple-300',
    type: 'expense',
  },
  {
    id: 'cat-health',
    name: 'Health & Medical',
    iconName: 'HeartPulse',
    color: 'text-rose-400',
    bgColor: 'bg-rose-500/10',
    borderColor: 'border-rose-500/20',
    badgeColor: 'bg-rose-500/20 text-rose-300',
    type: 'expense',
  },
  {
    id: 'cat-personal',
    name: 'Personal Care',
    iconName: 'Sparkles',
    color: 'text-teal-400',
    bgColor: 'bg-teal-500/10',
    borderColor: 'border-teal-500/20',
    badgeColor: 'bg-teal-500/20 text-teal-300',
    type: 'expense',
  },
  {
    id: 'cat-education',
    name: 'Education & Books',
    iconName: 'GraduationCap',
    color: 'text-indigo-400',
    bgColor: 'bg-indigo-500/10',
    borderColor: 'border-indigo-500/20',
    badgeColor: 'bg-indigo-500/20 text-indigo-300',
    type: 'expense',
  },
  {
    id: 'cat-travel',
    name: 'Travel & Lodging',
    iconName: 'Plane',
    color: 'text-cyan-400',
    bgColor: 'bg-cyan-500/10',
    borderColor: 'border-cyan-500/20',
    badgeColor: 'bg-cyan-500/20 text-cyan-300',
    type: 'expense',
  },
  {
    id: 'cat-work',
    name: 'Work & Business',
    iconName: 'Briefcase',
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500/20',
    badgeColor: 'bg-blue-500/20 text-blue-300',
    type: 'expense',
  },
  // Income Categories
  {
    id: 'cat-salary',
    name: 'Salary',
    iconName: 'Banknote',
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-500/10',
    borderColor: 'border-emerald-500/20',
    badgeColor: 'bg-emerald-500/20 text-emerald-300',
    type: 'income',
  },
  {
    id: 'cat-freelance',
    name: 'Freelance',
    iconName: 'Laptop',
    color: 'text-sky-400',
    bgColor: 'bg-sky-500/10',
    borderColor: 'border-sky-500/20',
    badgeColor: 'bg-sky-500/20 text-sky-300',
    type: 'income',
  },
  {
    id: 'cat-investment',
    name: 'Investment',
    iconName: 'TrendingUp',
    color: 'text-teal-400',
    bgColor: 'bg-teal-500/10',
    borderColor: 'border-teal-500/20',
    badgeColor: 'bg-teal-500/20 text-teal-300',
    type: 'income',
  },
  {
    id: 'cat-bonus',
    name: 'Bonus',
    iconName: 'Gift',
    color: 'text-amber-400',
    bgColor: 'bg-amber-500/10',
    borderColor: 'border-amber-500/20',
    badgeColor: 'bg-amber-500/20 text-amber-300',
    type: 'income',
  },
  {
    id: 'cat-rental',
    name: 'Rental',
    iconName: 'Home',
    color: 'text-indigo-400',
    bgColor: 'bg-indigo-500/10',
    borderColor: 'border-indigo-500/20',
    badgeColor: 'bg-indigo-500/20 text-indigo-300',
    type: 'income',
  },
  {
    id: 'cat-other',
    name: 'Other',
    iconName: 'HelpCircle',
    color: 'text-slate-400',
    bgColor: 'bg-slate-500/10',
    borderColor: 'border-slate-500/20',
    badgeColor: 'bg-slate-500/20 text-slate-300',
    type: 'both',
  },
];

export const CATEGORIES: Record<string, CategoryMeta> = DEFAULT_CATEGORIES.reduce((acc, item) => {
  acc[item.name] = {
    name: item.name,
    icon: ICON_MAP[item.iconName] || HelpCircle,
    color: item.color,
    bgColor: item.bgColor,
    borderColor: item.borderColor,
    badgeColor: item.badgeColor,
  };
  return acc;
}, {} as Record<string, CategoryMeta>);

export function getCategoryMeta(
  categoryName: string,
  customCategories: CategoryItem[] = []
): CategoryMeta {
  // Check custom categories first
  const custom = customCategories.find((c) => c.name === categoryName);
  if (custom) {
    return {
      name: custom.name,
      icon: ICON_MAP[custom.iconName] || HelpCircle,
      color: custom.color,
      bgColor: custom.bgColor,
      borderColor: custom.borderColor,
      badgeColor: custom.badgeColor,
    };
  }

  // Check default categories
  if (CATEGORIES[categoryName]) {
    return CATEGORIES[categoryName];
  }

  // Fallback
  return {
    name: categoryName || 'Other',
    icon: HelpCircle,
    color: 'text-slate-400',
    bgColor: 'bg-slate-500/10',
    borderColor: 'border-slate-500/20',
    badgeColor: 'bg-slate-500/20 text-slate-300',
  };
}

export const CATEGORY_LIST: ExpenseCategory[] = DEFAULT_CATEGORIES.map((c) => c.name);

// Map category text color classes to high-contrast solid bar background classes and hex colors
export function getCategoryBarColor(
  categoryName: string,
  customCategories: CategoryItem[] = []
): { bgClass: string; hex: string } {
  const meta = getCategoryMeta(categoryName, customCategories);
  const colorClass = meta.color || '';

  if (colorClass.includes('amber')) return { bgClass: 'bg-amber-500', hex: '#f59e0b' };
  if (colorClass.includes('emerald')) return { bgClass: 'bg-emerald-500', hex: '#10b981' };
  if (colorClass.includes('sky')) return { bgClass: 'bg-sky-500', hex: '#0ea5e9' };
  if (colorClass.includes('rose')) return { bgClass: 'bg-rose-500', hex: '#f43f5e' };
  if (colorClass.includes('yellow')) return { bgClass: 'bg-yellow-500', hex: '#eab308' };
  if (colorClass.includes('purple')) return { bgClass: 'bg-purple-500', hex: '#a855f7' };
  if (colorClass.includes('teal')) return { bgClass: 'bg-teal-500', hex: '#14b8a6' };
  if (colorClass.includes('indigo')) return { bgClass: 'bg-indigo-500', hex: '#6366f1' };
  if (colorClass.includes('pink')) return { bgClass: 'bg-pink-500', hex: '#ec4899' };

  return { bgClass: 'bg-slate-500', hex: '#64748b' };
}

// MYR (Malaysian Ringgit) as Default First Currency!
export const SUPPORTED_CURRENCIES: CurrencyConfig[] = [
  { code: 'MYR', symbol: 'RM', name: 'Malaysian Ringgit (RM)' },
  { code: 'USD', symbol: '$', name: 'US Dollar ($)' },
  { code: 'SGD', symbol: 'S$', name: 'Singapore Dollar (S$)' },
  { code: 'EUR', symbol: '€', name: 'Euro (€)' },
  { code: 'GBP', symbol: '£', name: 'British Pound (£)' },
  { code: 'AUD', symbol: 'A$', name: 'Australian Dollar (A$)' },
  { code: 'CAD', symbol: 'C$', name: 'Canadian Dollar (C$)' },
  { code: 'JPY', symbol: '¥', name: 'Japanese Yen (¥)' },
  { code: 'INR', symbol: '₹', name: 'Indian Rupee (₹)' },
  { code: 'IDR', symbol: 'Rp', name: 'Indonesian Rupiah (Rp)' },
  { code: 'THB', symbol: '฿', name: 'Thai Baht (฿)' },
];
