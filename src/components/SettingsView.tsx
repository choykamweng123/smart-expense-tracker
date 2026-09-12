import React, { useRef, useState } from 'react';
import {
  DollarSign,
  Download,
  Upload,
  Trash2,
  Check,
  Volume2,
  FileSpreadsheet,
  AlertCircle,
  Moon,
  Sun,
  Tag,
  HelpCircle,
  ShieldCheck,
  CheckCircle2,
  RefreshCw,
  RotateCcw,
  FileDown,
  Sparkles,
  Layers,
  Smartphone,
  ChevronDown,
  ChevronUp,
  Info,
} from 'lucide-react';
import { UserSettings } from '../types';
import { SUPPORTED_CURRENCIES } from '../data/categories';
import { PWAInstallButton } from './PWAInstallButton';
import { downloadExcelTemplate } from '../utils/spreadsheetParser';
import { APP_INFO } from '../config/version';

interface SettingsViewProps {
  settings: UserSettings;
  onUpdateSettings: (newSettings: Partial<UserSettings>) => void;
  onToggleTheme: () => void;
  onOpenCategoryManager: () => void;
  onOpenWalkthrough: () => void;
  onExportCSV: () => void;
  onExportExcel?: () => void;
  onOpenExcelImport?: () => void;
  onExportJSON: () => void;
  onImportJSON: (jsonStr: string) => boolean;
  onClearAll: () => void;
  expensesCount: number;
  isDark?: boolean;
  onCheckForUpdate?: () => Promise<any>;
  isCheckingUpdate?: boolean;
  updateCheckStatus?: string | null;
  onForceClearCache?: () => void;
  lastChecked?: Date | null;
  needRefresh?: boolean;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  onUpdateSettings,
  onToggleTheme,
  onOpenCategoryManager,
  onOpenWalkthrough,
  onExportCSV,
  onExportExcel,
  onOpenExcelImport,
  onExportJSON,
  onImportJSON,
  onClearAll,
  expensesCount,
  isDark = true,
  onCheckForUpdate,
  isCheckingUpdate = false,
  updateCheckStatus = null,
  onForceClearCache,
  lastChecked = null,
  needRefresh = false,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importStatus, setImportStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [confirmClear, setConfirmClear] = useState(false);
  const [showUpdateHelp, setShowUpdateHelp] = useState(false);

  const handleCurrencyChange = (currencyCode: string) => {
    const selected = SUPPORTED_CURRENCIES.find((c) => c.code === currencyCode);
    if (selected) {
      onUpdateSettings({
        currency: selected.code,
        currencySymbol: selected.symbol,
      });
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        const success = onImportJSON(content);
        setImportStatus(success ? 'success' : 'error');
        setTimeout(() => setImportStatus('idle'), 3000);
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="space-y-4">
      {/* View Title */}
      <div className="flex items-center justify-between px-1">
        <div>
          <h2 className={`text-base font-bold tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
            Settings & Preferences
          </h2>
          <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            Customize categories, currency, themes, and backup data
          </p>
        </div>
      </div>

      {/* 1. Currency Preference */}
      <div
        className={`rounded-3xl border p-4 sm:p-5 transition-all shadow-sm ${
          isDark ? 'border-white/10 bg-white/5 text-slate-100' : 'border-slate-200 bg-white text-slate-800'
        }`}
      >
        <div className="flex items-center gap-2 mb-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
            <DollarSign className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Primary Currency
            </h3>
            <p className={`text-xs ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
              Selected: <span className="font-bold text-indigo-400">{settings.currency} ({settings.currencySymbol})</span>
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {SUPPORTED_CURRENCIES.map((curr) => {
            const isSelected = settings.currency === curr.code;
            return (
              <button
                key={curr.code}
                type="button"
                onClick={() => handleCurrencyChange(curr.code)}
                className={`min-h-[44px] flex items-center justify-between px-3 py-2 rounded-2xl border text-xs font-semibold transition active:scale-95 ${
                  isSelected
                    ? 'border-indigo-500 bg-indigo-600 text-white shadow-md'
                    : isDark
                    ? 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'
                    : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                }`}
              >
                <div className="flex items-center gap-1.5 truncate">
                  <span className="font-mono font-bold">{curr.symbol}</span>
                  <span className="truncate">{curr.name}</span>
                </div>
                {isSelected && <Check className="h-3.5 w-3.5 shrink-0" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. Theme & Appearance */}
      <div
        className={`rounded-3xl border p-4 sm:p-5 transition-all shadow-sm ${
          isDark ? 'border-white/10 bg-white/5 text-slate-100' : 'border-slate-200 bg-white text-slate-800'
        }`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-purple-500/20 text-purple-400 border border-purple-500/30">
              {isDark ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
            </div>
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Visual Theme
              </h3>
              <p className={`text-xs ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                Currently using <span className="font-bold">{isDark ? 'Dark Mode' : 'Light Mode'}</span>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onToggleTheme}
            className={`min-h-[44px] flex items-center gap-1.5 px-4 py-2 rounded-2xl border text-xs font-semibold transition active:scale-95 ${
              isDark
                ? 'border-white/15 bg-white/10 text-amber-300 hover:bg-white/15'
                : 'border-slate-200 bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            {isDark ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
            <span>{isDark ? 'Switch to Light' : 'Switch to Dark'}</span>
          </button>
        </div>
      </div>

      {/* 3. Categories & Tags Management */}
      <div
        className={`rounded-3xl border p-4 sm:p-5 transition-all shadow-sm ${
          isDark ? 'border-white/10 bg-white/5 text-slate-100' : 'border-slate-200 bg-white text-slate-800'
        }`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
              <Tag className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Categories & Tags
              </h3>
              <p className={`text-xs ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                Add custom categories, colors, icons, and tags
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onOpenCategoryManager}
            className="min-h-[44px] px-4 py-2 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow transition active:scale-95"
          >
            Manage
          </button>
        </div>
      </div>

      {/* 4. Backup & Restore */}
      <div
        className={`rounded-3xl border p-4 sm:p-5 transition-all shadow-sm ${
          isDark ? 'border-white/10 bg-white/5 text-slate-100' : 'border-slate-200 bg-white text-slate-800'
        }`}
      >
        <div className="flex items-center gap-2 mb-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-500/20 text-blue-400 border border-blue-500/30">
            <Download className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Data Backup & Restore
            </h3>
            <p className={`text-xs ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
              Export data for spreadsheets or transfer to another device
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {/* Import Excel / CSV */}
          {onOpenExcelImport && (
            <button
              type="button"
              onClick={onOpenExcelImport}
              className={`min-h-[44px] flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-2xl border text-xs font-semibold transition active:scale-95 ${
                isDark
                  ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20'
                  : 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
              }`}
            >
              <FileSpreadsheet className="h-4 w-4 text-emerald-400" />
              <span>Import Excel / CSV Statement</span>
            </button>
          )}

          {/* Download Sample Excel Template */}
          <button
            type="button"
            onClick={() => downloadExcelTemplate(settings.currency)}
            className={`min-h-[44px] flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-2xl border text-xs font-semibold transition active:scale-95 ${
              isDark
                ? 'border-indigo-500/30 bg-indigo-500/10 text-indigo-300 hover:bg-indigo-500/20'
                : 'border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
            }`}
            title="Download formatted Excel template (.xlsx) with sample transactions and category reference"
          >
            <FileDown className="h-4 w-4 text-indigo-400" />
            <span>Download Sample Excel Template</span>
          </button>

          {/* Export Excel (.xlsx) */}
          {onExportExcel && (
            <button
              type="button"
              onClick={onExportExcel}
              className={`min-h-[44px] flex items-center justify-center gap-2 px-3 py-2.5 rounded-2xl border text-xs font-semibold transition active:scale-95 ${
                isDark
                  ? 'border-white/10 bg-white/5 text-slate-200 hover:bg-white/10'
                  : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
              }`}
            >
              <FileSpreadsheet className="h-4 w-4 text-emerald-400" />
              <span>Export to Excel (.xlsx)</span>
            </button>
          )}

          {/* Export CSV */}
          <button
            type="button"
            onClick={onExportCSV}
            className={`min-h-[44px] flex items-center justify-center gap-2 px-3 py-2.5 rounded-2xl border text-xs font-semibold transition active:scale-95 ${
              isDark
                ? 'border-white/10 bg-white/5 text-slate-200 hover:bg-white/10'
                : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
            }`}
          >
            <Download className="h-4 w-4 text-teal-400" />
            <span>Export to CSV</span>
          </button>

          {/* Export JSON */}
          <button
            type="button"
            onClick={onExportJSON}
            className={`min-h-[44px] flex items-center justify-center gap-2 px-3 py-2.5 rounded-2xl border text-xs font-semibold transition active:scale-95 ${
              isDark
                ? 'border-white/10 bg-white/5 text-slate-200 hover:bg-white/10'
                : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
            }`}
          >
            <Download className="h-4 w-4 text-blue-400" />
            <span>Export Backup (JSON)</span>
          </button>

          {/* Import JSON */}
          <label
            className={`min-h-[44px] flex items-center justify-center gap-2 px-3 py-2.5 rounded-2xl border text-xs font-semibold cursor-pointer transition active:scale-95 ${
              isDark
                ? 'border-white/10 bg-white/5 text-slate-200 hover:bg-white/10'
                : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
            }`}
          >
            <Upload className="h-4 w-4 text-purple-400" />
            <span>Restore Backup (JSON)</span>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleFileChange}
              className="hidden"
            />
          </label>
        </div>

        {importStatus === 'success' && (
          <div className="mt-3 flex items-center gap-2 rounded-xl bg-emerald-500/20 border border-emerald-500/30 p-2.5 text-xs text-emerald-300">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>Backup imported successfully! Your transactions have been restored.</span>
          </div>
        )}
        {importStatus === 'error' && (
          <div className="mt-3 flex items-center gap-2 rounded-xl bg-rose-500/20 border border-rose-500/30 p-2.5 text-xs text-rose-300">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>Failed to import backup. Please ensure the file is a valid JSON backup.</span>
          </div>
        )}
      </div>

      {/* 5. Help & Walkthrough */}
      <div
        className={`rounded-3xl border p-4 sm:p-5 transition-all shadow-sm ${
          isDark ? 'border-white/10 bg-white/5 text-slate-100' : 'border-slate-200 bg-white text-slate-800'
        }`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
              <HelpCircle className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Help & Beginner Guide
              </h3>
              <p className={`text-xs ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                Step-by-step walkthrough of features and gestures
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onOpenWalkthrough}
            className={`min-h-[44px] px-4 py-2 rounded-2xl border text-xs font-semibold transition active:scale-95 ${
              isDark
                ? 'border-indigo-500/30 bg-indigo-500/10 text-indigo-300 hover:bg-indigo-500/20'
                : 'border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
            }`}
          >
            Open Guide
          </button>
        </div>
      </div>

      {/* 6. Haptic Feedback Toggle */}
      <div
        className={`rounded-3xl border p-4 sm:p-5 transition-all shadow-sm ${
          isDark ? 'border-white/10 bg-white/5 text-slate-100' : 'border-slate-200 bg-white text-slate-800'
        }`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
              <Volume2 className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Haptic Feedback
              </h3>
              <p className={`text-xs ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                Vibrate on button clicks and swipes
              </p>
            </div>
          </div>

          <label className="relative inline-flex items-center cursor-pointer min-h-[44px]">
            <input
              type="checkbox"
              checked={settings.hapticFeedback}
              onChange={(e) => onUpdateSettings({ hapticFeedback: e.target.checked })}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[12px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
          </label>
        </div>
      </div>

      {/* 6. Version & System Status */}
      <div
        className={`rounded-3xl border p-4 sm:p-5 transition-all shadow-sm ${
          isDark ? 'border-white/10 bg-white/5 text-slate-100' : 'border-slate-200 bg-white text-slate-800'
        }`}
      >
        <div className="flex items-start justify-between gap-3 mb-3.5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 shrink-0">
              <Sparkles className="h-4.5 w-4.5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  {APP_INFO.name}
                </h3>
                <span className="rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-2 py-0.5 text-[10px] font-bold">
                  v{APP_INFO.version}
                </span>
              </div>
              <p className={`text-xs mt-0.5 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                Build {APP_INFO.buildNumber} • {APP_INFO.releaseDate}
              </p>
            </div>
          </div>

          {/* Up to Date Real-time Status Badge */}
          <div className="flex items-center gap-1.5 shrink-0">
            {needRefresh ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2.5 py-1 text-xs font-semibold animate-pulse">
                <RefreshCw className="h-3 w-3 animate-spin" />
                <span>Update Ready</span>
              </span>
            ) : isCheckingUpdate ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 px-2.5 py-1 text-xs font-semibold">
                <RefreshCw className="h-3 w-3 animate-spin" />
                <span>Checking...</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2.5 py-1 text-xs font-semibold">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                <span>Up to date</span>
              </span>
            )}
          </div>
        </div>

        {/* New Version Ready Alert Banner */}
        {needRefresh && (
          <div className="p-3 mb-3.5 rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white flex items-center justify-between gap-3 shadow-lg shadow-indigo-500/20">
            <div className="min-w-0">
              <p className="text-xs font-bold flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5" />
                <span>New Update v{APP_INFO.version} Ready!</span>
              </p>
              <p className="text-[11px] text-indigo-100 opacity-90">
                Tap the button to reload and activate the new version immediately.
              </p>
            </div>
            {onForceClearCache && (
              <button
                type="button"
                onClick={onForceClearCache}
                className="px-3 py-1.5 rounded-xl bg-white text-indigo-700 text-xs font-bold shadow hover:bg-indigo-50 active:scale-95 shrink-0"
              >
                Update Now
              </button>
            )}
          </div>
        )}

        {/* System & Release Info Grid */}
        <div
          className={`p-3 rounded-2xl mb-3.5 text-xs space-y-2 border ${
            isDark ? 'bg-white/5 border-white/5 text-slate-300' : 'bg-slate-50 border-slate-100 text-slate-600'
          }`}
        >
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-slate-400">Current Release:</span>
            <span className="font-semibold text-emerald-400 flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400"></span>
              v{APP_INFO.version} (Stable)
            </span>
          </div>

          <div className="flex items-center justify-between text-[11px]">
            <span className="text-slate-400">Storage Architecture:</span>
            <span className="font-medium text-slate-300">100% Local Device Storage (Offline PWA)</span>
          </div>

          {lastChecked && (
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-400">Last Checked:</span>
              <span className="font-medium text-slate-300">
                {lastChecked.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
            </div>
          )}

          {updateCheckStatus && (
            <div className="pt-1 text-[11px] font-medium text-indigo-400 border-t border-white/5">
              {updateCheckStatus}
            </div>
          )}
        </div>

        {/* Action Controls */}
        <div className="flex flex-col sm:flex-row gap-2 mb-3">
          {onCheckForUpdate && (
            <button
              type="button"
              onClick={onCheckForUpdate}
              disabled={isCheckingUpdate}
              className={`min-h-[44px] flex-1 flex items-center justify-center gap-2 px-3.5 py-2 rounded-2xl border text-xs font-semibold transition active:scale-95 ${
                isDark
                  ? 'border-indigo-500/30 bg-indigo-500/15 text-indigo-300 hover:bg-indigo-500/25'
                  : 'border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
              }`}
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isCheckingUpdate ? 'animate-spin' : ''}`} />
              <span>{isCheckingUpdate ? 'Checking for updates...' : 'Check for Updates'}</span>
            </button>
          )}

          {onForceClearCache && (
            <button
              type="button"
              onClick={onForceClearCache}
              className="min-h-[44px] flex-1 flex items-center justify-center gap-2 px-3.5 py-2 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition shadow-sm active:scale-95"
              title="Purges cached PWA assets and forces hard reload without losing expense data"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Force Update & Reload</span>
            </button>
          )}
        </div>

        {/* Expandable Mobile PWA Update Guide */}
        <div className="border-t border-white/5 pt-2.5">
          <button
            type="button"
            onClick={() => setShowUpdateHelp(!showUpdateHelp)}
            className="flex items-center justify-between w-full py-1 text-left text-xs font-medium text-indigo-400 hover:text-indigo-300 transition"
          >
            <span className="flex items-center gap-1.5">
              <Smartphone className="h-3.5 w-3.5" />
              <span>Installed on phone & not updating? Tap for help</span>
            </span>
            {showUpdateHelp ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>

          {showUpdateHelp && (
            <div
              className={`mt-2 p-3 rounded-2xl text-[11px] space-y-2.5 border leading-relaxed ${
                isDark ? 'bg-slate-900/60 border-white/5 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-600'
              }`}
            >
              <div className="flex items-start gap-2">
                <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-indigo-500/20 text-indigo-400 text-[10px] font-bold">1</span>
                <div>
                  <strong className="text-slate-200">Tap "Force Update & Reload" above:</strong>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    This clears the offline Service Worker cache and re-downloads fresh files. Your saved transactions and budgets in local storage will <span className="text-emerald-400 font-semibold">NOT</span> be deleted.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-2">
                <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-indigo-500/20 text-indigo-400 text-[10px] font-bold">2</span>
                <div>
                  <strong className="text-slate-200">Swipe the app away from Recent Apps:</strong>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    On Android and iOS, pulling down to refresh does not bypass an active PWA process. Swipe the app away from your phone's multitasking/app switcher, then tap the icon to open fresh.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-2">
                <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-indigo-500/20 text-indigo-400 text-[10px] font-bold">3</span>
                <div>
                  <strong className="text-slate-200">Check Your Installed Link (Dev vs Shared):</strong>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    If you installed using the <em>Shared Link</em>, you must click <strong>Deploy / Share</strong> in AI Studio to push the update to that URL. If you want instant real-time updates as code changes, open and install the <em>Development Link</em>.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 7. Reset Data */}
      <div
        className={`rounded-3xl border p-4 sm:p-5 transition-all shadow-sm ${
          isDark ? 'border-rose-500/20 bg-rose-950/10' : 'border-rose-200 bg-rose-50/50'
        }`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-rose-500/20 text-rose-400 border border-rose-500/30">
              <Trash2 className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-rose-400">
                Clear All Data
              </h3>
              <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                {expensesCount} recorded transactions
              </p>
            </div>
          </div>

          {!confirmClear ? (
            <button
              type="button"
              onClick={() => setConfirmClear(true)}
              className="min-h-[44px] px-3.5 py-1.5 rounded-2xl border border-rose-500/40 text-rose-400 hover:bg-rose-500/10 text-xs font-semibold transition active:scale-95"
            >
              Reset Data
            </button>
          ) : (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => {
                  onClearAll();
                  setConfirmClear(false);
                }}
                className="min-h-[44px] px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition"
              >
                Confirm Delete
              </button>
              <button
                type="button"
                onClick={() => setConfirmClear(false)}
                className="min-h-[44px] px-3 py-1.5 rounded-xl border border-white/10 text-slate-300 text-xs font-medium"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Disclaimer / Privacy Footnote with Version Badge */}
      <div className="pt-3 pb-5 text-center space-y-2">
        <div className="flex items-center justify-center gap-2 text-xs text-slate-400">
          <span className="font-semibold text-slate-300">{APP_INFO.name}</span>
          <span>•</span>
          <span className="font-mono text-indigo-400 font-bold">v{APP_INFO.version}</span>
          <span>•</span>
          <span className="inline-flex items-center gap-1 text-emerald-400 font-medium">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400"></span>
            Up to date
          </span>
        </div>

        <div className="flex items-center justify-center gap-1.5 text-xs text-slate-500">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
          <span>Local Device Privacy</span>
        </div>
        <p className="text-[11px] text-slate-500 max-w-xs mx-auto leading-relaxed">
          Recorded balances and transaction data are stored locally on your device in your browser storage and are not connected to external bank accounts.
        </p>
      </div>
    </div>
  );
};
