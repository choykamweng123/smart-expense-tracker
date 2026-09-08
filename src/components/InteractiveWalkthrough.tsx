import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  Camera,
  ArrowUpRight,
  Repeat,
  Wallet,
  ChevronRight,
  ChevronLeft,
  X,
  Sparkles,
  MousePointer,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export interface InteractiveStep {
  id: string;
  targetId: string;
  fallbackTargetId?: string;
  title: string;
  shortInstruction: string;
  badge: string;
  icon: React.ElementType;
  iconBg: string;
  iconColor: string;
  actionText?: string;
  onPerformAction?: () => void;
}

interface InteractiveWalkthroughProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenScanner: () => void;
  onOpenAddExpense: () => void;
  onOpenAddIncome: () => void;
  onOpenRecurring: () => void;
  onOpenBudgetWallets: () => void;
  isDark?: boolean;
}

export const InteractiveWalkthrough: React.FC<InteractiveWalkthroughProps> = ({
  isOpen,
  onClose,
  onOpenScanner,
  onOpenAddExpense,
  onOpenAddIncome,
  onOpenRecurring,
  onOpenBudgetWallets,
  isDark = true,
}) => {
  const [stepIndex, setStepIndex] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [mounted, setMounted] = useState(false);
  const animFrameRef = useRef<number | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const steps: InteractiveStep[] = [
    {
      id: 'scan-receipt',
      targetId: 'btn-scan-receipt',
      fallbackTargetId: 'bottom-floating-actions',
      title: 'Click "Scan Receipt"',
      shortInstruction: 'Snap or upload receipts. AI reads store, total, items, and date under 5MB.',
      badge: 'Step 1 of 5',
      icon: Camera,
      iconBg: 'bg-indigo-500/20 border-indigo-500/40',
      iconColor: 'text-indigo-400',
      actionText: 'Try Scan Receipt',
      onPerformAction: () => {
        handleFinish();
        onOpenScanner();
      },
    },
    {
      id: 'quick-record',
      targetId: 'btn-quick-expense',
      fallbackTargetId: 'bottom-floating-actions',
      title: 'Click "+ Add"',
      shortInstruction: 'Log daily cash, credit card, salary, or freelance income in seconds.',
      badge: 'Step 2 of 5',
      icon: ArrowUpRight,
      iconBg: 'bg-rose-500/20 border-rose-500/40',
      iconColor: 'text-rose-400',
      actionText: 'Try + Add',
      onPerformAction: () => {
        handleFinish();
        onOpenAddExpense();
      },
    },
    {
      id: 'recurring-bills',
      targetId: 'btn-recurring-bills',
      title: 'Click "Recurring"',
      shortInstruction: 'Track recurring rent, Netflix, WiFi, or subscriptions with auto-post forecasts.',
      badge: 'Step 3 of 5',
      icon: Repeat,
      iconBg: 'bg-purple-500/20 border-purple-500/40',
      iconColor: 'text-purple-400',
      actionText: 'Open Recurring',
      onPerformAction: () => {
        handleFinish();
        onOpenRecurring();
      },
    },
    {
      id: 'budget-wallets',
      targetId: 'btn-view-budget-details',
      fallbackTargetId: 'budget-wallet-card',
      title: 'Click "Wallets / Details"',
      shortInstruction: 'Set monthly budget limits for Food, Shopping, and bills with live tracking.',
      badge: 'Step 4 of 5',
      icon: Wallet,
      iconBg: 'bg-cyan-500/20 border-cyan-500/40',
      iconColor: 'text-cyan-400',
      actionText: 'Open Wallets',
      onPerformAction: () => {
        handleFinish();
        onOpenBudgetWallets();
      },
    },
    {
      id: 'category-breakdown',
      targetId: 'category-breakdown-section',
      fallbackTargetId: 'daily-stats-summary-card',
      title: 'Financial Breakdown',
      shortInstruction: 'Track your spending categories, monthly summaries, and net savings.',
      badge: 'Step 5 of 5',
      icon: Sparkles,
      iconBg: 'bg-amber-500/20 border-amber-500/40',
      iconColor: 'text-amber-400',
    },
  ];

  const currentStep = steps[stepIndex];

  // Helper to locate target or fallback
  const getTargetElement = useCallback(() => {
    let el = document.getElementById(currentStep.targetId);
    if (!el && currentStep.fallbackTargetId) {
      el = document.getElementById(currentStep.fallbackTargetId);
    }
    return el;
  }, [currentStep.targetId, currentStep.fallbackTargetId]);

  // Update target rect
  const updateTargetRect = useCallback(() => {
    if (!isOpen) return;
    const el = getTargetElement();
    if (el) {
      const rect = el.getBoundingClientRect();
      setTargetRect(rect);
    } else {
      setTargetRect(null);
    }
  }, [isOpen, getTargetElement]);

  // Scroll element into view and track smoothly
  useEffect(() => {
    if (!isOpen) return;

    const el = getTargetElement();
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }

    updateTargetRect();

    // Track position during scroll animation for 500ms
    const startTime = performance.now();
    const trackLoop = (currentTime: number) => {
      updateTargetRect();
      if (currentTime - startTime < 600) {
        animFrameRef.current = requestAnimationFrame(trackLoop);
      }
    };
    animFrameRef.current = requestAnimationFrame(trackLoop);

    const handleScrollOrResize = () => {
      updateTargetRect();
    };

    window.addEventListener('resize', handleScrollOrResize, { passive: true });
    window.addEventListener('scroll', handleScrollOrResize, { capture: true, passive: true });

    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
      window.removeEventListener('resize', handleScrollOrResize);
      window.removeEventListener('scroll', handleScrollOrResize, true);
    };
  }, [isOpen, stepIndex, getTargetElement, updateTargetRect]);

  if (!isOpen || !mounted) return null;

  const isFirst = stepIndex === 0;
  const isLast = stepIndex === steps.length - 1;

  const handleNext = () => {
    if (isLast) {
      handleFinish();
    } else {
      setStepIndex((prev) => prev + 1);
    }
  };

  const handlePrev = () => {
    if (!isFirst) {
      setStepIndex((prev) => prev - 1);
    }
  };

  const handleFinish = () => {
    localStorage.setItem('receipt_tracker_guide_seen', 'true');
    onClose();
  };

  const handleTargetClick = () => {
    if (currentStep.onPerformAction) {
      currentStep.onPerformAction();
    } else {
      const el = getTargetElement();
      if (el) {
        handleFinish();
        el.click();
      } else {
        handleNext();
      }
    }
  };

  const StepIcon = currentStep.icon;

  // Viewport dimensions
  const windowHeight = typeof window !== 'undefined' ? window.innerHeight : 800;
  const windowWidth = typeof window !== 'undefined' ? window.innerWidth : 400;

  // Safe padding coordinates for spotlight cutout
  const isSmallPill = targetRect
    ? (targetRect.height < 55 && targetRect.width < 180) || targetRect.width === targetRect.height
    : false;
  const spotPad = isSmallPill ? 5 : 6;
  const cornerRadius = isSmallPill ? 9999 : 22;

  const spotX = targetRect ? Math.max(0, targetRect.left - spotPad) : 0;
  const spotY = targetRect ? Math.max(0, targetRect.top - spotPad) : 0;
  const spotW = targetRect ? targetRect.width + spotPad * 2 : 0;
  const spotH = targetRect ? targetRect.height + spotPad * 2 : 0;

  // Smart non-blocking popup placement
  let popoverStyle: React.CSSProperties = {
    bottom: 24,
  };

  if (targetRect) {
    const spaceAbove = targetRect.top;
    const spaceBelow = windowHeight - targetRect.bottom;
    const cardHeightEstimate = 140;
    const margin = 16;

    // Decide whether to place ABOVE or BELOW target so it NEVER blocks the DIV
    if (spaceBelow >= cardHeightEstimate + margin + 10) {
      // Comfortable space below target -> Place BELOW
      popoverStyle = {
        top: Math.max(margin, targetRect.bottom + margin),
      };
    } else if (spaceAbove >= cardHeightEstimate + margin + 10) {
      // Comfortable space above target -> Place ABOVE
      popoverStyle = {
        bottom: Math.max(margin, windowHeight - targetRect.top + margin),
      };
    } else {
      // If element is tall, place at screen edge with maximum visible clearance
      if (spaceAbove > spaceBelow) {
        popoverStyle = {
          top: margin,
        };
      } else {
        popoverStyle = {
          bottom: margin,
        };
      }
    }
  }

  const modalContent = (
    <AnimatePresence>
      <div className="fixed inset-0 z-[9999] overflow-hidden pointer-events-none select-none">
        {/* SVG Mask Backdrop with transparent cutout over the target element so it remains 100% crisp & unblurred */}
        <svg
          className="absolute inset-0 h-full w-full pointer-events-auto"
          onClick={handleFinish}
          style={{ width: '100vw', height: '100vh' }}
        >
          <defs>
            <mask id="walkthrough-cutout-mask">
              {/* White fills everything (opaque dimmed backdrop) */}
              <rect x="0" y="0" width="100%" height="100%" fill="white" />
              {/* Black cuts out the spotlight hole so target is 100% clear and unblurred */}
              {targetRect && (
                <rect
                  x={spotX}
                  y={spotY}
                  width={spotW}
                  height={spotH}
                  rx={cornerRadius}
                  fill="black"
                />
              )}
            </mask>
          </defs>
          <rect
            x="0"
            y="0"
            width="100%"
            height="100%"
            fill={isDark ? 'rgba(2, 6, 23, 0.72)' : 'rgba(15, 23, 42, 0.55)'}
            mask="url(#walkthrough-cutout-mask)"
          />
        </svg>

        {/* Luminous, High-Contrast Highlight Ring over Target (No blur, crisp focus) */}
        {targetRect && (
          <div
            onClick={handleTargetClick}
            className={`absolute border-2 border-indigo-400 ring-4 ring-indigo-500/35 shadow-[0_0_25px_rgba(99,102,241,0.7)] cursor-pointer pointer-events-auto transition-all duration-200 z-10 hover:border-indigo-300 ${
              isSmallPill ? 'rounded-full' : 'rounded-3xl'
            }`}
            style={{
              top: spotY,
              left: spotX,
              width: spotW,
              height: spotH,
            }}
            title="Click to interact with this function"
          >
            {/* Pointer Indicator */}
            <div className="absolute -top-2.5 -right-2.5 flex h-6 w-6 items-center justify-center rounded-full bg-indigo-600 text-white shadow-lg border border-white/60 ring-2 ring-indigo-500/40">
              <MousePointer className="h-3 w-3" />
            </div>
          </div>
        )}

        {/* Compact, Clean, Non-Blocking Floating Action Tooltip */}
        <div
          className="absolute inset-x-0 px-3.5 flex justify-center z-20 pointer-events-none"
          style={popoverStyle}
        >
          <motion.div
            key={currentStep.id}
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.18 }}
            className={`pointer-events-auto relative w-full max-w-[340px] rounded-2xl border shadow-2xl p-3.5 ${
              isDark
                ? 'border-indigo-500/30 bg-[#0b132b]/95 backdrop-blur-2xl text-white shadow-[0_15px_40px_rgba(0,0,0,0.8),0_0_0_1px_rgba(255,255,255,0.08)]'
                : 'border-indigo-200 bg-white/95 backdrop-blur-2xl text-slate-900 shadow-xl'
            }`}
          >
            {/* Header: Step pill, Title & Close */}
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <div className="flex items-center gap-2 min-w-0">
                <div
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border ${currentStep.iconBg}`}
                >
                  <StepIcon className={`h-3.5 w-3.5 ${currentStep.iconColor}`} />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="rounded-full bg-indigo-500/20 px-1.5 py-0.2 text-[9px] font-bold uppercase tracking-wider text-indigo-300 border border-indigo-500/30">
                      {stepIndex + 1}/{steps.length}
                    </span>
                    <h3 className="text-xs font-bold truncate">{currentStep.title}</h3>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={handleFinish}
                className="rounded-lg p-1 text-slate-400 hover:text-white hover:bg-white/10 transition shrink-0"
                title="Close walkthrough"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Short Action Instruction */}
            <p
              className={`text-[11px] leading-snug mb-2.5 ${
                isDark ? 'text-slate-300' : 'text-slate-600'
              }`}
            >
              {currentStep.shortInstruction}
            </p>

            {/* Compact Action Footer & Small Next Icon */}
            <div className="flex items-center justify-between pt-2 border-t border-white/10 text-xs">
              {/* Previous button */}
              <button
                type="button"
                onClick={handlePrev}
                disabled={isFirst}
                className={`flex items-center gap-0.5 text-[11px] font-medium px-2 py-1 rounded-lg transition ${
                  isFirst
                    ? 'opacity-20 cursor-not-allowed text-slate-500'
                    : isDark
                    ? 'hover:bg-white/10 text-slate-300'
                    : 'hover:bg-slate-100 text-slate-700'
                }`}
              >
                <ChevronLeft className="h-3 w-3" />
                <span>Prev</span>
              </button>

              {/* Progress Dots */}
              <div className="flex items-center gap-1">
                {steps.map((s, idx) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setStepIndex(idx)}
                    className={`h-1 rounded-full transition-all ${
                      idx === stepIndex
                        ? 'w-4 bg-indigo-400'
                        : idx < stepIndex
                        ? 'w-1.5 bg-indigo-500/50'
                        : 'w-1.5 bg-white/20'
                    }`}
                    title={s.title}
                  />
                ))}
              </div>

              {/* Action and Next Step Icon Buttons */}
              <div className="flex items-center gap-1.5">
                {currentStep.actionText && (
                  <button
                    type="button"
                    onClick={handleTargetClick}
                    className="flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-lg bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 border border-indigo-500/40 transition active:scale-95"
                  >
                    <span>{currentStep.actionText}</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleNext}
                  className="flex items-center gap-1 rounded-lg bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white px-2.5 py-1 text-[11px] font-bold shadow-md transition active:scale-95"
                >
                  <span>{isLast ? 'Done' : 'Next'}</span>
                  <ChevronRight className="h-3.5 w-3.5 stroke-[2.5]" />
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </AnimatePresence>
  );

  return createPortal(modalContent, document.body);
};

