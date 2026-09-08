import React, { useRef, useState } from 'react';
import {
  X,
  DollarSign,
  Download,
  Upload,
  Trash2,
  Smartphone,
  Check,
  Volume2,
  FileSpreadsheet,
  AlertCircle,
  Moon,
  Sun,
  Tag,
  Palette,
  Repeat,
  HelpCircle,
} from 'lucide-react';
import { motion } from 'motion/react';
import { UserSettings } from '../types';
import { SUPPORTED_CURRENCIES } from '../data/categories';
import { PWAInstallButton } from './PWAInstallButton';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: UserSettings;
  onUpdateSettings: (newSettings: Partial<UserSettings>) => void;
  onToggleTheme: () => void;
  onOpenCategoryManager?: () => void;
  onOpenRecurringManager?: () => void;
  recurringCount?: number;
  onOpenWalkthrough?: () => void;
  onExportCSV: () => void;
  onExportJSON: () => void;
  onImportJSON: (jsonStr: string) => boolean;
  onClearAll: () => void;
  expensesCount: number;
  isDark?: boolean;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
  onToggleTheme,
  onOpenCategoryManager,
  onOpenRecurringManager,
  recurringCount,
  onOpenWalkthrough,
  onExportCSV,
  onExportJSON,
  onImportJSON,
  onClearAll,
  expensesCount,
  isDark = true,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  if (!isOpen) return null;

  const handleCurrencyChange = (code: string) => {
    const found = SUPPORTED_CURRENCIES.find((c) => c.code === code);
    if (found) {
      onUpdateSettings({ currency: found.code, currencySymbol: found.symbol });
    }
  };

  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        const ok = onImportJSON(content);
        if (ok) {
          setFeedbackMessage({ type: 'success', text: 'Data restored successfully!' });
        } else {
          setFeedbackMessage({ type: 'error', text: 'Invalid backup file format.' });
        }
        setTimeout(() => setFeedbackMessage(null), 4000);
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-2xl overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className={`relative w-full max-w-md my-auto rounded-3xl border shadow-2xl overflow-hidden flex flex-col max-h-[92vh] transition-colors ${
          isDark
            ? 'border-white/15 bg-[#0b132b]/95 text-slate-100'
            : 'border-slate-200 bg-white text-slate-800'
        }`}
      >
        {/* Header */}
        <div
          className={`flex items-center justify-between border-b px-5 py-4 ${
            isDark ? 'border-white/10 bg-white/5' : 'border-slate-100 bg-slate-50'
          }`}
        >
          <h2 className="text-base font-semibold">App & Data Settings</h2>
          <button
            onClick={onClose}
            className={`rounded-xl p-1.5 transition ${
              isDark
                ? 'text-slate-400 hover:bg-white/10 hover:text-white'
                : 'text-slate-400 hover:bg-slate-100 hover:text-slate-800'
            }`}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {feedbackMessage && (
            <div
              className={`rounded-2xl p-3 text-xs flex items-center gap-2 border backdrop-blur-xl ${
                feedbackMessage.type === 'success'
                  ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-200'
                  : 'bg-rose-950/40 border-rose-500/30 text-rose-200'
              }`}
            >
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{feedbackMessage.text}</span>
            </div>
          )}

          {/* Android PWA Install */}
          <PWAInstallButton variant="settings" />

          {/* Feature 4: Toggle switch on Dark Mode (Default is dark mode) */}
          <div
            className={`flex items-center justify-between rounded-2xl border p-3.5 ${
              isDark ? 'border-white/10 bg-white/5' : 'border-slate-200 bg-slate-50'
            }`}
          >
            <div className="flex items-center gap-3">
              <div
                className={`flex h-9 w-9 items-center justify-center rounded-xl border ${
                  isDark
                    ? 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30'
                    : 'bg-amber-500/20 text-amber-500 border-amber-500/30'
                }`}
              >
                {isDark ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
              </div>
              <div>
                <p className="text-xs font-semibold">Dark Mode</p>
                <p className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  {isDark ? 'Dark theme active (default)' : 'Light theme active'}
                </p>
              </div>
            </div>

            {/* Switch button */}
            <button
              type="button"
              onClick={onToggleTheme}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                isDark ? 'bg-indigo-600' : 'bg-slate-300'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-md transition-transform ${
                  isDark ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {/* Feature 5: Manage Custom Categories Button */}
          {onOpenCategoryManager && (
            <div
              className={`flex items-center justify-between rounded-2xl border p-3.5 ${
                isDark ? 'border-white/10 bg-white/5' : 'border-slate-200 bg-slate-50'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-500/20 text-purple-400 border border-purple-500/30">
                  <Tag className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs font-semibold">Custom Categories</p>
                  <p className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    Add, edit, or delete categories
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenCategoryManager();
                }}
                className="rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 text-xs font-semibold shadow transition active:scale-95"
              >
                Manage
              </button>
            </div>
          )}

          {/* Recurring Expenses & Subscriptions */}
          {onOpenRecurringManager && (
            <div
              className={`flex items-center justify-between rounded-2xl border p-3.5 ${
                isDark ? 'border-white/10 bg-white/5' : 'border-slate-200 bg-slate-50'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-500/20 text-purple-400">
                  <Repeat className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-xs font-semibold">Recurring Subscriptions & Bills</p>
                  <p className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    {recurringCount !== undefined ? `${recurringCount} configured rules` : 'Manage subscriptions & rent'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenRecurringManager();
                }}
                className="rounded-xl bg-purple-600 hover:bg-purple-500 text-white px-3 py-1.5 text-xs font-semibold shadow transition active:scale-95"
              >
                Manage
              </button>
            </div>
          )}

          {/* User Guide & Walkthrough */}
          {onOpenWalkthrough && (
            <div
              className={`flex items-center justify-between rounded-2xl border p-3.5 ${
                isDark ? 'border-white/10 bg-white/5' : 'border-slate-200 bg-slate-50'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-500/20 text-indigo-400">
                  <HelpCircle className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-xs font-semibold">Beginner Walkthrough & Guide</p>
                  <p className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    5-step visual tour on how to use scanner, expenses & budget
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenWalkthrough();
                }}
                className="rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 text-xs font-semibold shadow transition active:scale-95"
              >
                View Guide
              </button>
            </div>
          )}

          {/* Feature 3: Primary Currency (Default MYR) */}
          <div>
            <label className={`text-xs font-semibold block mb-1.5 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
              Primary Currency (Default: MYR)
            </label>
            <select
              value={settings.currency}
              onChange={(e) => handleCurrencyChange(e.target.value)}
              className={`w-full rounded-xl border px-3 py-2 text-sm focus:outline-none ${
                isDark
                  ? 'border-white/10 bg-[#0f172a] text-white'
                  : 'border-slate-200 bg-white text-slate-900'
              }`}
            >
              {SUPPORTED_CURRENCIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Monthly Budget */}
          <div>
            <label className={`text-xs font-semibold block mb-1.5 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
              Monthly Budget Target ({settings.currencySymbol})
            </label>
            <input
              type="number"
              min="0"
              step="any"
              value={settings.monthlyBudget === 0 ? '' : settings.monthlyBudget}
              onChange={(e) =>
                onUpdateSettings({ monthlyBudget: e.target.value === '' ? 0 : parseFloat(e.target.value) || 0 })
              }
              className={`w-full rounded-xl border px-3 py-2 text-sm focus:outline-none ${
                isDark
                  ? 'border-white/10 bg-white/5 text-white'
                  : 'border-slate-200 bg-slate-50 text-slate-900'
              }`}
              placeholder="e.g. 3500"
            />
            <p className={`text-[11px] mt-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              Set to 0 to disable budget progress tracking.
            </p>
          </div>

          {/* Haptic Feedback Toggle */}
          <div
            className={`flex items-center justify-between rounded-2xl border p-3.5 ${
              isDark ? 'border-white/10 bg-white/5' : 'border-slate-200 bg-slate-50'
            }`}
          >
            <div>
              <p className="text-xs font-medium">Haptic Vibration</p>
              <p className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                Vibrate on touch and actions on Android devices
              </p>
            </div>
            <button
              type="button"
              onClick={() => onUpdateSettings({ hapticFeedback: !settings.hapticFeedback })}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                settings.hapticFeedback ? 'bg-indigo-600' : 'bg-slate-300'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                  settings.hapticFeedback ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {/* Data Backup & Export Section */}
          <div
            className={`rounded-2xl border p-4 space-y-3 ${
              isDark ? 'border-white/10 bg-white/5' : 'border-slate-200 bg-slate-50'
            }`}
          >
            <h3 className={`text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              Personal Data & Backup ({expensesCount} entries)
            </h3>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={onExportCSV}
                className={`flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2.5 text-xs font-medium transition ${
                  isDark
                    ? 'border-white/10 bg-white/5 text-slate-200 hover:bg-white/10'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100'
                }`}
              >
                <FileSpreadsheet className="h-4 w-4 text-emerald-400" />
                Export CSV
              </button>
              <button
                type="button"
                onClick={onExportJSON}
                className={`flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2.5 text-xs font-medium transition ${
                  isDark
                    ? 'border-white/10 bg-white/5 text-slate-200 hover:bg-white/10'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100'
                }`}
              >
                <Download className="h-4 w-4 text-indigo-400" />
                Backup JSON
              </button>
            </div>

            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                className="hidden"
                onChange={handleFileImport}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className={`w-full flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-medium transition ${
                  isDark
                    ? 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100'
                }`}
              >
                <Upload className="h-3.5 w-3.5 text-slate-400" />
                Restore from Backup JSON
              </button>
            </div>
          </div>

          {/* Clear Data */}
          <div className="pt-2">
            {!showClearConfirm ? (
              <button
                type="button"
                onClick={() => setShowClearConfirm(true)}
                className="w-full flex items-center justify-center gap-2 rounded-xl border border-rose-500/20 bg-rose-950/20 py-2.5 text-xs font-medium text-rose-400 hover:bg-rose-950/40 hover:border-rose-500/30 transition active:scale-98"
              >
                <Trash2 className="h-4 w-4" />
                Clear All Transaction Records
              </button>
            ) : (
              <div className="rounded-2xl border border-rose-500/40 bg-rose-950/60 p-4 space-y-3 backdrop-blur-2xl shadow-xl">
                <div className="flex items-start gap-2.5">
                  <Trash2 className="h-5 w-5 text-rose-400 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-xs font-semibold text-white">
                      Clear all {expensesCount} records?
                    </h4>
                    <p className="text-[11px] text-rose-200/80 mt-0.5 leading-relaxed">
                      This will erase your transaction records and restart with a clean slate.
                    </p>
                  </div>
                </div>
                <div className="flex items-center justify-end gap-2 pt-1 border-t border-rose-500/20">
                  <button
                    type="button"
                    onClick={() => setShowClearConfirm(false)}
                    className="px-3 py-1.5 rounded-xl border border-white/10 bg-white/10 hover:bg-white/15 text-xs font-medium text-slate-200 transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onClearAll();
                      setShowClearConfirm(false);
                      onClose();
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-xs font-semibold text-white shadow-md shadow-rose-950/50 transition active:scale-95"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Yes, Clear All
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
};
