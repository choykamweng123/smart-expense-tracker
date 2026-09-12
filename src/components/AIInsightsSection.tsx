import React, { useState, useEffect, useMemo } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  ExternalLink,
  Wallet,
  Plus,
  BellRing,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Expense, UserSettings } from '../types';
import {
  calculateSpendingAlerts,
  SpendingAlert,
  formatMoney,
} from '../utils/spendingAlerts';

interface AIInsightsSectionProps {
  expenses: Expense[];
  settings: UserSettings;
  isDark?: boolean;
  onOpenBudgetWallets?: () => void;
  onViewSpending?: (category?: string, month?: string) => void;
  onReviewTransaction?: (expense: Expense) => void;
  onOpenAddExpense?: () => void;
}

const LOCAL_STORAGE_ACK_KEY = 'spending_alerts_acknowledged_v1';

export const AIInsightsSection: React.FC<AIInsightsSectionProps> = ({
  expenses,
  settings,
  isDark = true,
  onOpenBudgetWallets,
  onViewSpending,
  onReviewTransaction,
  onOpenAddExpense,
}) => {
  const [showAllAlerts, setShowAllAlerts] = useState(false);
  const [acknowledgedSignatures, setAcknowledgedSignatures] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_ACK_KEY);
      if (saved) {
        return new Set(JSON.parse(saved));
      }
    } catch {
      // Ignore JSON error
    }
    return new Set();
  });

  // Persist acknowledgements across reloads
  useEffect(() => {
    try {
      localStorage.setItem(
        LOCAL_STORAGE_ACK_KEY,
        JSON.stringify(Array.from(acknowledgedSignatures))
      );
    } catch {
      // Ignore quota error
    }
  }, [acknowledgedSignatures]);

  // Handle acknowledging an unusual transaction alert
  const handleAcknowledgeAlert = (signature: string) => {
    setAcknowledgedSignatures((prev) => {
      const next = new Set(prev);
      next.add(signature);
      return next;
    });
  };

  // Calculate alerts deterministically with zero AI API calls
  const allAlerts = useMemo(() => {
    return calculateSpendingAlerts(expenses, settings, undefined, acknowledgedSignatures);
  }, [expenses, settings, acknowledgedSignatures]);

  // Initial maximum of 2 alerts
  const visibleAlerts = showAllAlerts ? allAlerts : allAlerts.slice(0, 2);
  const hiddenCount = Math.max(0, allAlerts.length - 2);

  // Check if budgets are set
  const hasAnyBudgetSet =
    (settings.monthlyBudget && settings.monthlyBudget > 0) ||
    (settings.categoryBudgets &&
      Object.values(settings.categoryBudgets).some((b) => (Number(b) || 0) > 0));

  const hasExpenses = expenses.some((e) => (e.type || 'expense') === 'expense');

  return (
    <div
      id="ai-financial-insights-section"
      className={`rounded-3xl border p-4 sm:p-5 transition-all shadow-sm ${
        isDark
          ? 'border-white/10 bg-[#0c142b]/90 backdrop-blur-2xl text-slate-100'
          : 'border-slate-200 bg-white text-slate-800'
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-3 mb-3.5 pb-3 border-b border-white/10">
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border ${
              allAlerts.length > 0
                ? allAlerts.some((a) => a.severity === 'critical')
                  ? 'bg-rose-500/20 text-rose-400 border-rose-500/30'
                  : 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                : 'bg-indigo-500/15 text-indigo-400 border-indigo-500/25'
            }`}
          >
            <BellRing className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-sm sm:text-base font-bold tracking-tight text-white truncate">
                Spending alerts
              </h3>
              {allAlerts.length > 0 && (
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-bold border ${
                    allAlerts.some((a) => a.severity === 'critical')
                      ? 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                      : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                  }`}
                >
                  {allAlerts.length} {allAlerts.length === 1 ? 'alert' : 'alerts'}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Budget wallets shortcut */}
        {onOpenBudgetWallets && (
          <button
            type="button"
            onClick={onOpenBudgetWallets}
            className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition active:scale-95 shrink-0 ${
              isDark
                ? 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white'
                : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
            }`}
          >
            <Wallet className="h-3.5 w-3.5 text-indigo-400" />
            <span>Budgets</span>
          </button>
        )}
      </div>

      {/* Alert Cards or Empty States */}
      {!hasExpenses ? (
        /* Empty State: No recorded expenses yet */
        <div
          className={`rounded-2xl border p-4 text-center space-y-2.5 ${
            isDark ? 'border-white/10 bg-white/5' : 'border-slate-200 bg-slate-50'
          }`}
        >
          <div className="flex justify-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
              <Plus className="h-5 w-5" />
            </div>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-white">Add your first expense</h4>
            <p className="text-xs text-slate-400 mt-0.5">
              Add your first expense to start tracking spending.
            </p>
          </div>
          {onOpenAddExpense && (
            <button
              type="button"
              onClick={onOpenAddExpense}
              className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-500 transition active:scale-95 shadow-md shadow-indigo-600/30"
            >
              <Plus className="h-4 w-4" />
              <span>Add Expense</span>
            </button>
          )}
        </div>
      ) : allAlerts.length === 0 ? (
        /* Empty State: No spending alerts triggered */
        <div
          className={`rounded-2xl border p-4 space-y-2 ${
            isDark ? 'border-white/10 bg-white/5' : 'border-slate-200 bg-slate-50'
          }`}
        >
          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 mt-0.5">
              <CheckCircle2 className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-bold text-white">No spending alerts</h4>
              <p className="text-xs text-slate-300 mt-0.5 leading-relaxed">
                Your recorded spending has not triggered any alerts.
              </p>

              {!hasAnyBudgetSet && onOpenBudgetWallets && (
                <div className="mt-2.5 pt-2 border-t border-white/10 flex items-center justify-between gap-2 flex-wrap">
                  <span className="text-xs text-slate-400">Monthly budgets are not set yet.</span>
                  <button
                    type="button"
                    onClick={onOpenBudgetWallets}
                    className="inline-flex items-center gap-1 text-xs font-bold text-indigo-400 hover:text-indigo-300 hover:underline transition"
                  >
                    <span>Set a budget</span>
                    <ExternalLink className="h-3 w-3" />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* Alerts List */
        <div className="space-y-3">
          <AnimatePresence initial={false}>
            {visibleAlerts.map((alert) => {
              const isCritical = alert.severity === 'critical';
              const isWarning = alert.severity === 'warning';

              const cardClasses = isCritical
                ? isDark
                  ? 'border-rose-500/30 bg-rose-950/20 text-rose-100'
                  : 'border-rose-300 bg-rose-50/80 text-rose-900'
                : isWarning
                ? isDark
                  ? 'border-amber-500/30 bg-amber-950/20 text-amber-100'
                  : 'border-amber-300 bg-amber-50/80 text-amber-900'
                : isDark
                ? 'border-slate-700 bg-slate-800/40 text-slate-100'
                : 'border-slate-200 bg-slate-50 text-slate-800';

              const iconBadgeClasses = isCritical
                ? 'bg-rose-500/20 text-rose-400 border-rose-500/40'
                : isWarning
                ? 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                : 'bg-slate-700 text-slate-300 border-slate-600';

              const statusBadgeClasses = isCritical
                ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                : isWarning
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                : 'bg-slate-800 text-slate-300 border-slate-700';

              return (
                <motion.div
                  key={alert.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.96 }}
                  className={`rounded-2xl border p-3.5 sm:p-4 transition-all ${cardClasses}`}
                >
                  {/* Top Row: Icon + Title + Status Pill */}
                  <div className="flex items-start justify-between gap-2.5">
                    <div className="flex items-start gap-2.5 min-w-0">
                      <div
                        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border mt-0.5 ${iconBadgeClasses}`}
                      >
                        {isCritical ? (
                          <AlertCircle className="h-4 w-4" />
                        ) : (
                          <AlertTriangle className="h-4 w-4" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-xs sm:text-sm font-bold text-white leading-snug break-words">
                          {alert.title}
                        </h4>
                        <p className="text-xs text-slate-300 mt-0.5 leading-normal break-words">
                          {alert.supportingText}
                        </p>
                      </div>
                    </div>

                    {alert.statusText && (
                      <span
                        className={`rounded-lg px-2 py-0.5 text-[11px] font-bold border shrink-0 text-right ${statusBadgeClasses}`}
                      >
                        {alert.statusText}
                      </span>
                    )}
                  </div>

                  {/* Action Buttons Row */}
                  <div className="mt-3 pt-2.5 border-t border-white/10 flex items-center justify-between gap-2 flex-wrap">
                    {/* Primary & Secondary Actions based on alert type */}
                    {alert.type === 'budget_exceeded' && (
                      <div className="flex items-center gap-2 w-full justify-between">
                        <button
                          type="button"
                          onClick={() => {
                            if (onViewSpending) {
                              onViewSpending(alert.category, alert.filterMonth);
                            }
                          }}
                          className="min-h-[44px] px-3 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-xs font-semibold text-white shadow-sm transition active:scale-95 flex items-center gap-1"
                        >
                          <span>View spending</span>
                          <ExternalLink className="h-3 w-3" />
                        </button>

                        {onOpenBudgetWallets && (
                          <button
                            type="button"
                            onClick={onOpenBudgetWallets}
                            className="min-h-[44px] px-3 py-2 text-xs font-semibold text-rose-300 hover:text-white hover:underline transition"
                          >
                            Edit budget
                          </button>
                        )}
                      </div>
                    )}

                    {alert.type === 'budget_approaching' && (
                      <div className="flex items-center gap-2 w-full justify-between flex-wrap">
                        <button
                          type="button"
                          onClick={() => {
                            if (onViewSpending) {
                              onViewSpending(alert.category, alert.filterMonth);
                            }
                          }}
                          className="min-h-[44px] px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-xs font-semibold text-white shadow-sm transition active:scale-95 flex items-center gap-1"
                        >
                          <span>View spending</span>
                          <ExternalLink className="h-3 w-3" />
                        </button>

                        {onOpenBudgetWallets && (
                          <button
                            type="button"
                            onClick={onOpenBudgetWallets}
                            className="min-h-[44px] px-3 py-2 text-xs font-semibold text-amber-300 hover:text-white hover:underline transition"
                          >
                            Edit budget
                          </button>
                        )}
                      </div>
                    )}

                    {alert.type === 'unusual_transaction' && (
                      <div className="flex items-center gap-2 w-full justify-between flex-wrap">
                        {alert.transaction && onReviewTransaction ? (
                          <button
                            type="button"
                            onClick={() => onReviewTransaction(alert.transaction!)}
                            className="min-h-[44px] px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white shadow-sm transition active:scale-95 flex items-center gap-1"
                          >
                            <span>Review transaction</span>
                            <ExternalLink className="h-3 w-3" />
                          </button>
                        ) : (
                          <span />
                        )}

                        <button
                          type="button"
                          onClick={() => handleAcknowledgeAlert(alert.signature)}
                          className="min-h-[44px] px-3 py-2 text-xs font-semibold text-slate-300 hover:text-white hover:underline transition"
                        >
                          This is correct
                        </button>
                      </div>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>

          {/* View all alerts toggle if > 2 alerts */}
          {hiddenCount > 0 && !showAllAlerts && (
            <button
              type="button"
              onClick={() => setShowAllAlerts(true)}
              className="w-full min-h-[44px] flex items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/5 py-2 px-3 text-xs font-semibold text-indigo-300 hover:bg-white/10 hover:text-white transition active:scale-98"
            >
              <span>View all alerts ({allAlerts.length})</span>
              <ChevronDown className="h-3.5 w-3.5" />
            </button>
          )}

          {showAllAlerts && allAlerts.length > 2 && (
            <button
              type="button"
              onClick={() => setShowAllAlerts(false)}
              className="w-full min-h-[44px] flex items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/5 py-2 px-3 text-xs font-semibold text-slate-300 hover:bg-white/10 hover:text-white transition active:scale-98"
            >
              <span>Show fewer alerts</span>
              <ChevronUp className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      )}

      {/* Informative Footnote */}
      <div className="mt-3 pt-2.5 border-t border-white/10 flex items-center justify-between text-[11px] text-slate-400">
        <span>Based on recorded transactions, not bank balances.</span>
      </div>
    </div>
  );
};

export const SpendingAlertsSection = AIInsightsSection;
