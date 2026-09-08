import React, { useState } from 'react';
import {
  Camera,
  Repeat,
  ShieldCheck,
  ChevronRight,
  ChevronLeft,
  X,
  Sparkles,
  CheckCircle2,
  Wallet,
  ArrowUpRight,
  ArrowDownLeft,
  HandMetal,
  HelpCircle,
  PiggyBank,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface AppWalkthroughModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenScanner?: () => void;
  onOpenAddExpense?: () => void;
  isDark?: boolean;
}

interface StepInfo {
  step: number;
  title: string;
  subtitle: string;
  icon: React.ElementType;
  iconBg: string;
  iconColor: string;
  badge: string;
  description: string;
  bulletPoints: { title: string; desc: string }[];
  highlightTip?: string;
  previewIllustration: 'scanner' | 'manual' | 'recurring' | 'swipe' | 'budget';
}

const STEPS: StepInfo[] = [
  {
    step: 1,
    title: 'Scan Paper Receipts with AI',
    subtitle: 'No more manual typing',
    icon: Camera,
    iconBg: 'bg-indigo-500/20 border-indigo-500/30',
    iconColor: 'text-indigo-400',
    badge: 'Step 1 of 5 • Smart Scanner',
    description:
      'Snap a photo with your phone camera or upload a receipt image. The Gemini AI reads everything for you automatically.',
    bulletPoints: [
      {
        title: 'Auto-detects Total & Date',
        desc: 'Detects the final price, date, and tax from restaurants, grocery stores, or fuel stations.',
      },
      {
        title: 'Automatic Categorization',
        desc: 'Sorts into Food, Groceries, Transport, Shopping, or your own custom categories.',
      },
      {
        title: 'Line Item Breakdown',
        desc: 'Extracts itemized purchases so you can see exactly what you bought.',
      },
    ],
    highlightTip: 'Tip: Hold receipt flat under good lighting for 100% accuracy.',
    previewIllustration: 'scanner',
  },
  {
    step: 2,
    title: 'Quick Cash & Income Logging',
    subtitle: 'Track money in & money out',
    icon: Wallet,
    iconBg: 'bg-emerald-500/20 border-emerald-500/30',
    iconColor: 'text-emerald-400',
    badge: 'Step 2 of 5 • Fast Logging',
    description:
      'For daily purchases without paper receipts (like hawker food or coffee), or when receiving your salary and freelance pay.',
    bulletPoints: [
      {
        title: '+ Expense Button',
        desc: 'Tap "+ Expense" to record cash, debit card, or e-wallet payments in seconds.',
      },
      {
        title: '+ Income Button',
        desc: 'Tap "+ Income" to record salary, side gigs, bonus, or investment returns.',
      },
      {
        title: 'Instant Net Balance',
        desc: 'The app shows your Net Savings (Income minus Expenses) right at the top.',
      },
    ],
    highlightTip: 'Tip: Tap any category icon to auto-fill the transaction type.',
    previewIllustration: 'manual',
  },
  {
    step: 3,
    title: 'Recurring Bills & Subscriptions',
    subtitle: 'Counted & auto-logged on due dates',
    icon: Repeat,
    iconBg: 'bg-purple-500/20 border-purple-500/30',
    iconColor: 'text-purple-400',
    badge: 'Step 3 of 5 • Subscriptions',
    description:
      'Have recurring expenses like Netflix, Spotify, gym memberships, house rent, or TNB electricity? Set them once and relax.',
    bulletPoints: [
      {
        title: 'Auto-posted when Due',
        desc: 'On due dates, the app automatically writes the bill into your expense ledger.',
      },
      {
        title: 'Included in Budget Forecast',
        desc: 'See both what you already spent and upcoming bills due this month.',
      },
      {
        title: 'Quick Malaysian Presets',
        desc: 'One-tap setup for Netflix, Spotify, Unifi, TNB, and Rent with standard cycles.',
      },
    ],
    highlightTip: 'Tip: Look for the purple "Recurring" tag in your transaction feed.',
    previewIllustration: 'recurring',
  },
  {
    step: 4,
    title: 'Easy Gestures: Tap & Swipe',
    subtitle: 'Manage your transactions intuitively',
    icon: HandMetal,
    iconBg: 'bg-amber-500/20 border-amber-500/30',
    iconColor: 'text-amber-400',
    badge: 'Step 4 of 5 • Gestures',
    description:
      'Designed specifically for mobile screens so you can inspect, edit, or delete transactions with simple finger motions.',
    bulletPoints: [
      {
        title: 'Tap to View Details',
        desc: 'Tap any transaction card to see receipt pictures, notes, and full item breakdowns.',
      },
      {
        title: 'Swipe Left to Delete or Edit',
        desc: 'Swipe any row to the left to reveal quick "Edit" and "Delete" action buttons.',
      },
      {
        title: 'Instant Search & Filters',
        desc: 'Search by shop name (e.g., "Lotus", "Mamak") or filter by Expense, Income, or Recurring.',
      },
    ],
    highlightTip: 'Tip: You can also tap the search bar to find purchases by tags or notes.',
    previewIllustration: 'swipe',
  },
  {
    step: 5,
    title: 'Monthly Budget & 100% Privacy',
    subtitle: 'Stay on budget with peace of mind',
    icon: ShieldCheck,
    iconBg: 'bg-cyan-500/20 border-cyan-500/30',
    iconColor: 'text-cyan-400',
    badge: 'Step 5 of 5 • Budget & Privacy',
    description:
      'Set your spending limits and keep full ownership of your data without complicated cloud logins.',
    bulletPoints: [
      {
        title: 'Monthly Budget Warning',
        desc: 'Visual progress bar turns amber and red if your spending nears or exceeds your limit.',
      },
      {
        title: 'Custom Categories',
        desc: 'Create your own categories with custom colors and icons in the Settings menu.',
      },
      {
        title: 'Private & Offline-First',
        desc: 'All your data stays directly on your device. Export to Excel/CSV or backup anytime.',
      },
    ],
    highlightTip: 'Tip: You can install this app as a mobile PWA icon right onto your phone homescreen!',
    previewIllustration: 'budget',
  },
];

export const AppWalkthroughModal: React.FC<AppWalkthroughModalProps> = ({
  isOpen,
  onClose,
  onOpenScanner,
  onOpenAddExpense,
  isDark = true,
}) => {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  if (!isOpen) return null;

  const currentStep = STEPS[currentStepIndex];
  const isFirstStep = currentStepIndex === 0;
  const isLastStep = currentStepIndex === STEPS.length - 1;

  const handleNext = () => {
    if (isLastStep) {
      handleFinish();
    } else {
      setCurrentStepIndex((prev) => prev + 1);
    }
  };

  const handlePrev = () => {
    if (!isFirstStep) {
      setCurrentStepIndex((prev) => prev - 1);
    }
  };

  const handleFinish = () => {
    localStorage.setItem('receipt_tracker_guide_seen', 'true');
    onClose();
  };

  const StepIcon = currentStep.icon;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
      style={{ animation: 'fadeIn 0.2s ease-out' }}
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/80 backdrop-blur-md transition-opacity"
        onClick={handleFinish}
      />

      {/* Modal Dialog */}
      <div
        className={`relative z-10 w-full max-w-md rounded-3xl border shadow-2xl overflow-hidden transition-all my-auto ${
          isDark
            ? 'border-white/15 bg-gradient-to-b from-slate-900 via-slate-900 to-[#080d1a] text-white'
            : 'border-slate-200 bg-white text-slate-900'
        }`}
      >
        {/* Top Header Bar */}
        <div
          className={`flex items-center justify-between px-5 py-3.5 border-b ${
            isDark ? 'border-white/10 bg-white/5' : 'border-slate-100 bg-slate-50'
          }`}
        >
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-indigo-500/20 text-indigo-400">
              <Sparkles className="h-3.5 w-3.5" />
            </span>
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-400">
              Beginner Guide & Walkthrough
            </span>
          </div>

          <button
            type="button"
            onClick={handleFinish}
            className={`rounded-full p-1.5 transition ${
              isDark ? 'text-slate-400 hover:bg-white/10 hover:text-white' : 'text-slate-500 hover:bg-slate-200'
            }`}
            title="Close Guide"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Progress Step Bar */}
        <div className="px-5 pt-3 pb-1">
          <div className="flex items-center justify-between text-[11px] font-medium mb-1.5">
            <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>
              Step {currentStep.step} of {STEPS.length}
            </span>
            <span className="font-semibold text-indigo-400">
              {Math.round(((currentStepIndex + 1) / STEPS.length) * 100)}% Completed
            </span>
          </div>
          <div className="grid grid-cols-5 gap-1.5">
            {STEPS.map((s, idx) => (
              <button
                key={s.step}
                type="button"
                onClick={() => setCurrentStepIndex(idx)}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  idx === currentStepIndex
                    ? 'bg-gradient-to-r from-indigo-500 to-purple-500 shadow-sm'
                    : idx < currentStepIndex
                    ? 'bg-indigo-400/50'
                    : isDark
                    ? 'bg-white/10'
                    : 'bg-slate-200'
                }`}
                title={`Go to step ${s.step}: ${s.title}`}
              />
            ))}
          </div>
        </div>

        {/* Content Body with Transition */}
        <div className="p-5 space-y-4 max-h-[68vh] overflow-y-auto scrollbar-thin">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep.step}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
              className="space-y-4"
            >
              {/* Step Header Block */}
              <div className="flex items-start gap-3.5">
                <div
                  className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border ${currentStep.iconBg} ${currentStep.iconColor} shadow-md`}
                >
                  <StepIcon className="h-6 w-6" />
                </div>
                <div className="min-w-0 flex-1">
                  <span
                    className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider mb-1 ${
                      isDark ? 'bg-white/10 text-indigo-300' : 'bg-indigo-50 text-indigo-700'
                    }`}
                  >
                    {currentStep.badge}
                  </span>
                  <h3 className="text-base sm:text-lg font-bold leading-tight">
                    {currentStep.title}
                  </h3>
                  <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'} mt-0.5`}>
                    {currentStep.subtitle}
                  </p>
                </div>
              </div>

              {/* Main Explanatory Text */}
              <p
                className={`text-xs sm:text-sm leading-relaxed ${
                  isDark ? 'text-slate-300' : 'text-slate-700'
                }`}
              >
                {currentStep.description}
              </p>

              {/* Visual Interactive Mockup Card */}
              <div
                className={`rounded-2xl border p-3 text-xs ${
                  isDark ? 'border-white/10 bg-white/5' : 'border-slate-200 bg-slate-50'
                }`}
              >
                {currentStep.previewIllustration === 'scanner' && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-indigo-400 flex items-center gap-1">
                        <Camera className="h-3.5 w-3.5" /> Paper Receipt Example
                      </span>
                      <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded font-mono">
                        99% Confident
                      </span>
                    </div>
                    <div
                      className={`p-2.5 rounded-xl border font-mono text-[11px] space-y-1 ${
                        isDark ? 'bg-black/30 border-white/10 text-slate-300' : 'bg-white border-slate-200 text-slate-700'
                      }`}
                    >
                      <div className="flex justify-between font-bold">
                        <span>LOTUS STORE BUKIT JALIL</span>
                        <span className="text-emerald-400">MYR 68.50</span>
                      </div>
                      <div className="flex justify-between text-[10px] text-slate-400">
                        <span>Fresh Milk x 2</span>
                        <span>MYR 15.60</span>
                      </div>
                      <div className="flex justify-between text-[10px] text-slate-400">
                        <span>Brown Rice 5kg</span>
                        <span>MYR 32.90</span>
                      </div>
                      <div className="flex justify-between text-[10px] text-slate-400">
                        <span>Cooking Oil 1L</span>
                        <span>MYR 20.00</span>
                      </div>
                    </div>
                  </div>
                )}

                {currentStep.previewIllustration === 'manual' && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-[11px] font-semibold">
                      <span className="text-slate-400">Two quick buttons on dashboard:</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-2.5 text-center">
                        <ArrowUpRight className="h-4 w-4 text-rose-400 mx-auto mb-1" />
                        <span className="block text-xs font-bold text-rose-400">+ Expense</span>
                        <span className="text-[10px] text-slate-400">For lunch, transport, shopping</span>
                      </div>
                      <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-2.5 text-center">
                        <ArrowDownLeft className="h-4 w-4 text-emerald-400 mx-auto mb-1" />
                        <span className="block text-xs font-bold text-emerald-400">+ Income</span>
                        <span className="text-[10px] text-slate-400">For salary, freelance, refunds</span>
                      </div>
                    </div>
                  </div>
                )}

                {currentStep.previewIllustration === 'recurring' && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-purple-400 flex items-center gap-1">
                        <Repeat className="h-3.5 w-3.5" /> Recurring Bills Example
                      </span>
                      <span className="text-[10px] bg-purple-500/20 text-purple-300 px-1.5 py-0.5 rounded font-bold">
                        Auto-Logs
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5">
                      <div
                        className={`p-2 rounded-xl border text-[11px] ${
                          isDark ? 'bg-black/30 border-white/10' : 'bg-white border-slate-200'
                        }`}
                      >
                        <p className="font-bold text-white flex items-center gap-1">
                          <span className="h-1.5 w-1.5 rounded-full bg-purple-400" />
                          Netflix Standard
                        </p>
                        <p className="text-slate-400 text-[10px]">MYR 45.00 • Monthly</p>
                      </div>
                      <div
                        className={`p-2 rounded-xl border text-[11px] ${
                          isDark ? 'bg-black/30 border-white/10' : 'bg-white border-slate-200'
                        }`}
                      >
                        <p className="font-bold text-white flex items-center gap-1">
                          <span className="h-1.5 w-1.5 rounded-full bg-purple-400" />
                          Spotify Premium
                        </p>
                        <p className="text-slate-400 text-[10px]">MYR 15.90 • Monthly</p>
                      </div>
                    </div>
                  </div>
                )}

                {currentStep.previewIllustration === 'swipe' && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-[11px] font-semibold text-amber-400">
                      <span>Swipe row left to reveal actions:</span>
                    </div>
                    <div
                      className={`relative overflow-hidden rounded-xl border p-2.5 flex items-center justify-between ${
                        isDark ? 'bg-black/40 border-white/10' : 'bg-white border-slate-200'
                      }`}
                    >
                      <div>
                        <p className="font-bold text-xs">Mamak Nasi Kandar</p>
                        <p className="text-[10px] text-slate-400">Food & Dining • Cash</p>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-rose-400 mr-2">-MYR 14.50</span>
                        <span className="rounded bg-indigo-600 text-white text-[10px] font-bold px-2 py-0.5 shadow">
                          Edit
                        </span>
                        <span className="rounded bg-rose-600 text-white text-[10px] font-bold px-2 py-0.5 shadow">
                          Del
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {currentStep.previewIllustration === 'budget' && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-semibold text-cyan-400 flex items-center gap-1">
                        <PiggyBank className="h-3.5 w-3.5" /> Monthly Budget Tracker
                      </span>
                      <span className="text-emerald-400 font-bold text-[10px]">On Track (48%)</span>
                    </div>
                    <div
                      className={`h-2.5 w-full rounded-full overflow-hidden ${
                        isDark ? 'bg-white/10' : 'bg-slate-200'
                      }`}
                    >
                      <div
                        className="h-full bg-gradient-to-r from-cyan-500 to-indigo-500 rounded-full"
                        style={{ width: '48%' }}
                      />
                    </div>
                    <div className="flex justify-between text-[10px] text-slate-400">
                      <span>Spent: MYR 1,200</span>
                      <span>Budget: MYR 2,500</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Bullet Points with Checkmarks */}
              <div className="space-y-2.5">
                {currentStep.bulletPoints.map((bp, i) => (
                  <div key={i} className="flex items-start gap-2.5 text-xs">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-semibold text-slate-200 block">
                        {bp.title}
                      </span>
                      <span className={isDark ? 'text-slate-400' : 'text-slate-600'}>
                        {bp.desc}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Highlight Tip Banner */}
              {currentStep.highlightTip && (
                <div
                  className={`rounded-xl border p-2.5 text-[11px] flex items-center gap-2 ${
                    isDark
                      ? 'border-indigo-500/30 bg-indigo-500/10 text-indigo-200'
                      : 'border-indigo-200 bg-indigo-50 text-indigo-800'
                  }`}
                >
                  <Sparkles className="h-3.5 w-3.5 text-indigo-400 shrink-0" />
                  <span>{currentStep.highlightTip}</span>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Footer Navigation Buttons */}
        <div
          className={`p-4 border-t flex items-center justify-between gap-2 ${
            isDark ? 'border-white/10 bg-white/5' : 'border-slate-100 bg-slate-50'
          }`}
        >
          {/* Back Button */}
          <button
            type="button"
            onClick={handlePrev}
            disabled={isFirstStep}
            className={`flex items-center gap-1 rounded-xl px-3 py-2 text-xs font-semibold transition ${
              isFirstStep
                ? 'opacity-30 cursor-not-allowed text-slate-500'
                : isDark
                ? 'bg-white/5 hover:bg-white/10 text-slate-300'
                : 'bg-slate-200 hover:bg-slate-300 text-slate-700'
            }`}
          >
            <ChevronLeft className="h-4 w-4" />
            Back
          </button>

          {/* Center skip button */}
          {!isLastStep && (
            <button
              type="button"
              onClick={handleFinish}
              className={`text-xs underline-offset-2 hover:underline transition ${
                isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Skip guide
            </button>
          )}

          {/* Next / Finish Button */}
          <div className="flex items-center gap-2">
            {isLastStep && onOpenScanner && (
              <button
                type="button"
                onClick={() => {
                  handleFinish();
                  onOpenScanner();
                }}
                className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white px-3 py-2 text-xs font-bold shadow-md transition active:scale-95"
              >
                <Camera className="h-3.5 w-3.5" />
                Try Scanning
              </button>
            )}

            <button
              type="button"
              onClick={handleNext}
              className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white px-4 py-2 text-xs font-bold shadow-lg transition active:scale-95"
            >
              <span>{isLastStep ? 'Got It, Let’s Go!' : 'Next'}</span>
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
