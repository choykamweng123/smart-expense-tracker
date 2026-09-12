import React, { useState, useEffect, useRef } from 'react';
import {
  LayoutDashboard,
  Receipt,
  Wallet,
  Settings,
  Plus,
  Camera,
  ArrowUpRight,
  ArrowDownLeft,
  X,
  Sparkles,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export type NavDestination = 'home' | 'transactions' | 'budgets' | 'settings';

interface BottomNavigationProps {
  currentTab: NavDestination;
  onSelectTab: (tab: NavDestination) => void;
  onOpenScanner: () => void;
  onOpenAddExpense: () => void;
  onOpenAddIncome: () => void;
  onOpenQuickAdd?: () => void;
  dueRecurringCount?: number;
  alertsCount?: number;
  isDark?: boolean;
}

export const BottomNavigation: React.FC<BottomNavigationProps> = ({
  currentTab,
  onSelectTab,
  onOpenScanner,
  onOpenAddExpense,
  onOpenAddIncome,
  onOpenQuickAdd,
  dueRecurringCount = 0,
  alertsCount = 0,
  isDark = true,
}) => {
  const [isAddMenuOpen, setIsAddMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsAddMenuOpen(false);
      }
    };
    if (isAddMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isAddMenuOpen]);

  // Close menu on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsAddMenuOpen(false);
      }
    };
    if (isAddMenuOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isAddMenuOpen]);

  const handleAction = (action: () => void) => {
    setIsAddMenuOpen(false);
    action();
  };

  return (
    <nav
      id="bottom-navigation-bar"
      aria-label="Main navigation"
      className="fixed bottom-0 inset-x-0 z-30 max-w-md mx-auto pointer-events-none"
    >
      <div className="relative px-3 pb-3 pt-1 pointer-events-auto" ref={menuRef}>
        {/* Action Menu Popup for Combined Entry */}
        <AnimatePresence>
          {isAddMenuOpen && (
            <>
              {/* Backdrop */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsAddMenuOpen(false)}
                className="fixed inset-0 bg-black/60 backdrop-blur-sm z-30"
              />

              {/* Action Menu Items */}
              <motion.div
                initial={{ opacity: 0, y: 16, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 16, scale: 0.96 }}
                transition={{ duration: 0.18 }}
                className={`absolute bottom-20 left-1/2 -translate-x-1/2 w-[280px] rounded-3xl border p-2.5 shadow-2xl z-40 ${
                  isDark
                    ? 'border-white/15 bg-[#0b132b]/95 text-slate-100 shadow-black/90'
                    : 'border-slate-200 bg-white/95 text-slate-800 shadow-slate-500/30'
                }`}
              >
                <div className="px-3 py-2 border-b border-white/10 flex items-center justify-between mb-1.5">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    New Transaction
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsAddMenuOpen(false)}
                    className="p-1 rounded-lg text-slate-400 hover:text-white"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>

                <div className="space-y-1">
                  {/* Quick Add Expense (Chat & Natural Language) */}
                  {onOpenQuickAdd && (
                    <button
                      type="button"
                      id="menu-btn-quick-add"
                      onClick={() => handleAction(onOpenQuickAdd)}
                      className={`w-full min-h-[48px] flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-left font-medium text-xs transition active:scale-98 ${
                        isDark
                          ? 'bg-indigo-500/10 hover:bg-indigo-500/20 text-slate-100 border border-indigo-500/30'
                          : 'bg-indigo-50/70 hover:bg-indigo-100 text-slate-800 border border-indigo-200'
                      }`}
                    >
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-600 text-white shadow-md">
                        <Sparkles className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-bold text-xs text-indigo-400 flex items-center gap-1.5">
                          <span>Quick Add (Chat)</span>
                          <span className="text-[9px] font-semibold px-1 py-0.2 rounded bg-indigo-500/20 text-indigo-300">
                            Fast
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-400">Type naturally, e.g. Lunch RM18.50</div>
                      </div>
                    </button>
                  )}

                  {/* Scan Receipt */}
                  <button
                    type="button"
                    id="menu-btn-scan-receipt"
                    onClick={() => handleAction(onOpenScanner)}
                    className={`w-full min-h-[48px] flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-left font-medium text-xs transition active:scale-98 ${
                      isDark
                        ? 'hover:bg-indigo-600/20 text-slate-100'
                        : 'hover:bg-indigo-50 text-slate-800'
                    }`}
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-600 text-white shadow-md">
                      <Camera className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-xs text-white">Scan Receipt</div>
                      <div className="text-[10px] text-slate-400">Instant AI receipt or bill parsing</div>
                    </div>
                  </button>

                  {/* Add Expense */}
                  <button
                    type="button"
                    id="menu-btn-add-expense"
                    onClick={() => handleAction(onOpenAddExpense)}
                    className={`w-full min-h-[48px] flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-left font-medium text-xs transition active:scale-98 ${
                      isDark
                        ? 'hover:bg-rose-600/20 text-slate-100'
                        : 'hover:bg-rose-50 text-slate-800'
                    }`}
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-rose-600 text-white shadow-md">
                      <ArrowUpRight className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-xs text-white">Add Expense</div>
                      <div className="text-[10px] text-slate-400">Record a payment or purchase</div>
                    </div>
                  </button>

                  {/* Add Income */}
                  <button
                    type="button"
                    id="menu-btn-add-income"
                    onClick={() => handleAction(onOpenAddIncome)}
                    className={`w-full min-h-[48px] flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-left font-medium text-xs transition active:scale-98 ${
                      isDark
                        ? 'hover:bg-emerald-600/20 text-slate-100'
                        : 'hover:bg-emerald-50 text-slate-800'
                    }`}
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-md">
                      <ArrowDownLeft className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-xs text-white">Add Income</div>
                      <div className="text-[10px] text-slate-400">Salary, freelance, or dividend</div>
                    </div>
                  </button>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* The Bottom Bar Pill Container */}
        <div
          className={`flex items-center justify-between rounded-3xl border px-2 py-1.5 shadow-2xl transition-colors ${
            isDark
              ? 'border-white/15 bg-[#080e21]/95 text-slate-300 backdrop-blur-2xl shadow-black/90'
              : 'border-slate-200 bg-white/95 text-slate-600 backdrop-blur-2xl shadow-slate-400/40'
          }`}
        >
          {/* Destination 1: Home */}
          <button
            type="button"
            id="nav-tab-home"
            onClick={() => onSelectTab('home')}
            className={`flex-1 min-h-[48px] flex flex-col items-center justify-center gap-1 rounded-2xl transition relative active:scale-95 ${
              currentTab === 'home'
                ? isDark
                  ? 'text-white bg-white/10 font-semibold'
                  : 'text-indigo-600 bg-indigo-50/80 font-semibold'
                : 'hover:text-white'
            }`}
          >
            <div className="relative">
              <LayoutDashboard className="h-4 w-4" />
              {alertsCount > 0 && (
                <span className="absolute -top-1 -right-1.5 flex h-2 w-2 rounded-full bg-amber-400 ring-2 ring-[#080e21]" />
              )}
            </div>
            <span className="text-[10px] tracking-tight">Home</span>
          </button>

          {/* Destination 2: Transactions */}
          <button
            type="button"
            id="nav-tab-transactions"
            onClick={() => onSelectTab('transactions')}
            className={`flex-1 min-h-[48px] flex flex-col items-center justify-center gap-1 rounded-2xl transition relative active:scale-95 ${
              currentTab === 'transactions'
                ? isDark
                  ? 'text-white bg-white/10 font-semibold'
                  : 'text-indigo-600 bg-indigo-50/80 font-semibold'
                : 'hover:text-white'
            }`}
          >
            <div className="relative">
              <Receipt className="h-4 w-4" />
              {dueRecurringCount > 0 && (
                <span className="absolute -top-1 -right-2 flex h-3.5 min-w-[14px] items-center justify-center rounded-full bg-rose-500 px-1 text-[8px] font-bold text-white ring-2 ring-[#080e21]">
                  {dueRecurringCount}
                </span>
              )}
            </div>
            <span className="text-[10px] tracking-tight">History</span>
          </button>

          {/* Center Combined Entry Button: "+ Add" */}
          <div className="px-1 relative flex items-center justify-center">
            <button
              type="button"
              id="nav-btn-add"
              onClick={() => setIsAddMenuOpen((prev) => !prev)}
              aria-expanded={isAddMenuOpen}
              aria-haspopup="menu"
              className={`flex items-center justify-center gap-1 min-h-[44px] px-3.5 py-2 rounded-2xl font-bold text-xs shadow-lg transition active:scale-95 ${
                isAddMenuOpen
                  ? 'bg-white text-slate-900 ring-2 ring-indigo-400'
                  : 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-indigo-600/30 hover:from-indigo-500 hover:to-purple-500'
              }`}
            >
              <Plus
                className={`h-4 w-4 transition-transform duration-200 ${
                  isAddMenuOpen ? 'rotate-45' : ''
                }`}
              />
              <span>Add</span>
            </button>
          </div>

          {/* Destination 3: Budgets */}
          <button
            type="button"
            id="nav-tab-budgets"
            onClick={() => onSelectTab('budgets')}
            className={`flex-1 min-h-[48px] flex flex-col items-center justify-center gap-1 rounded-2xl transition relative active:scale-95 ${
              currentTab === 'budgets'
                ? isDark
                  ? 'text-white bg-white/10 font-semibold'
                  : 'text-indigo-600 bg-indigo-50/80 font-semibold'
                : 'hover:text-white'
            }`}
          >
            <Wallet className="h-4 w-4" />
            <span className="text-[10px] tracking-tight">Budgets</span>
          </button>

          {/* Destination 4: Settings */}
          <button
            type="button"
            id="nav-tab-settings"
            onClick={() => onSelectTab('settings')}
            className={`flex-1 min-h-[48px] flex flex-col items-center justify-center gap-1 rounded-2xl transition relative active:scale-95 ${
              currentTab === 'settings'
                ? isDark
                  ? 'text-white bg-white/10 font-semibold'
                  : 'text-indigo-600 bg-indigo-50/80 font-semibold'
                : 'hover:text-white'
            }`}
          >
            <Settings className="h-4 w-4" />
            <span className="text-[10px] tracking-tight">Settings</span>
          </button>
        </div>
      </div>
    </nav>
  );
};
