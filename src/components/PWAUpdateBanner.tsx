import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { RefreshCw, Sparkles, X } from 'lucide-react';

interface PWAUpdateBannerProps {
  needRefresh: boolean;
  onUpdate: () => void;
  onDismiss: () => void;
  isDark?: boolean;
}

export const PWAUpdateBanner: React.FC<PWAUpdateBannerProps> = ({
  needRefresh,
  onUpdate,
  onDismiss,
  isDark = true,
}) => {
  return (
    <AnimatePresence>
      {needRefresh && (
        <motion.div
          initial={{ opacity: 0, y: -20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20, scale: 0.95 }}
          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
          className="fixed top-3 left-3 right-3 sm:left-auto sm:right-6 sm:max-w-md z-50 pointer-events-auto"
        >
          <div
            className={`flex items-center justify-between gap-3 p-3.5 rounded-2xl border shadow-2xl backdrop-blur-2xl ${
              isDark
                ? 'bg-slate-900/95 border-indigo-500/40 text-slate-100 shadow-indigo-950/60'
                : 'bg-white/95 border-indigo-200 text-slate-900 shadow-slate-300/60'
            }`}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-600 text-white shadow-md shadow-indigo-500/30">
                <Sparkles className="h-4 w-4 animate-pulse" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold leading-tight flex items-center gap-1.5">
                  <span>App Update Ready</span>
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping" />
                </p>
                <p className={`text-[11px] truncate ${isDark ? 'text-slate-300' : 'text-slate-500'}`}>
                  New deployment detected. Tap to refresh.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={onUpdate}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-xs font-semibold shadow-md shadow-indigo-500/30 transition active:scale-95"
              >
                <RefreshCw className="h-3 w-3 animate-spin" style={{ animationDuration: '3s' }} />
                <span>Update</span>
              </button>
              <button
                type="button"
                onClick={onDismiss}
                className={`p-1.5 rounded-xl transition ${
                  isDark ? 'text-slate-400 hover:text-white hover:bg-white/10' : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'
                }`}
                title="Dismiss for now"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
