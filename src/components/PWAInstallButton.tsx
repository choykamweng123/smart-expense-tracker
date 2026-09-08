import React, { useState } from 'react';
import { Download, Smartphone, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface PWAInstallButtonProps {
  variant?: 'compact' | 'banner' | 'settings';
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({ variant = 'compact' }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  // If already running in standalone Android/PWA mode, hide
  if (isInstalled || dismissed) {
    return null;
  }

  if (variant === 'banner' && (isInstallable || isIOS)) {
    return (
      <div className="mb-4 flex items-center justify-between gap-3 rounded-2xl border border-indigo-500/30 bg-indigo-600/15 p-4 text-indigo-200 shadow-xl backdrop-blur-2xl">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-indigo-500/40 bg-slate-900 shadow-md">
            <img
              src="/app-icon.jpg"
              alt="Daily Expense Tracker App Icon"
              className="h-full w-full object-cover"
              referrerPolicy="no-referrer"
            />
          </div>
          <div>
            <p className="text-sm font-semibold text-white">Install Android App</p>
            <p className="text-xs text-indigo-200/80">Add to your home screen for 1-tap daily receipt logging</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isInstallable && (
            <button
              onClick={install}
              className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-lg shadow-indigo-500/25 transition hover:from-indigo-500 hover:to-purple-500 active:scale-95"
            >
              <Download className="h-3.5 w-3.5" />
              Install
            </button>
          )}
          {isIOS && (
            <button
              onClick={() => setShowGuide(true)}
              className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 backdrop-blur-xl px-3 py-1.5 text-xs font-semibold text-indigo-300 transition hover:bg-white/10"
            >
              How to Install
            </button>
          )}
          <button
            onClick={() => setDismissed(true)}
            className="p-1 text-slate-400 hover:text-white"
            title="Dismiss"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }

  if (variant === 'settings') {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-2xl p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-indigo-500/40 bg-slate-900 shadow-md">
              <img
                src="/app-icon.jpg"
                alt="Daily Expense Tracker App Icon"
                className="h-full w-full object-cover"
                referrerPolicy="no-referrer"
              />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-200">Android App Installation</p>
              <p className="text-xs text-slate-400">
                {isInstalled ? 'App is installed on your device' : 'Install onto your phone home screen'}
              </p>
            </div>
          </div>
          {isInstalled ? (
            <span className="rounded-full bg-emerald-500/20 px-2.5 py-1 text-xs font-medium text-emerald-400 border border-emerald-500/30">
              Installed ✓
            </span>
          ) : isInstallable ? (
            <button
              onClick={install}
              className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-lg shadow-indigo-500/25 hover:from-indigo-500 hover:to-purple-500 transition"
            >
              <Download className="h-3.5 w-3.5" />
              Install App
            </button>
          ) : (
            <button
              onClick={() => setShowGuide(true)}
              className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-xl px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-white/10 transition"
            >
              Guide
            </button>
          )}
        </div>

        {showGuide && (
          <div className="mt-3 rounded-xl border border-white/10 bg-white/5 backdrop-blur-xl p-3 text-xs text-slate-300">
            <p className="font-semibold text-white mb-1">To Install on Android:</p>
            <p className="text-slate-400">1. Open Chrome menu (⋮) on Android.<br />2. Tap <strong>Install app</strong> or <strong>Add to Home Screen</strong>.</p>
            <button
              onClick={() => setShowGuide(false)}
              className="mt-2 text-xs font-medium text-indigo-400 underline hover:text-indigo-300"
            >
              Got it
            </button>
          </div>
        )}
      </div>
    );
  }

  // Compact navbar button
  if (isInstallable) {
    return (
      <button
        onClick={install}
        className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 backdrop-blur-xl px-2.5 py-1.5 text-xs font-medium text-indigo-300 transition hover:bg-white/10 hover:border-white/20 active:scale-95"
        title="Install Android App"
      >
        <Download className="h-3.5 w-3.5 text-indigo-400" />
        <span className="hidden sm:inline">Install App</span>
      </button>
    );
  }

  return null;
};
