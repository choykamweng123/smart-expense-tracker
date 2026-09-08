import React, { useState, useEffect } from 'react';
import { Smartphone, Monitor, Wifi, BatteryCharging, Signal } from 'lucide-react';

interface AndroidFrameProps {
  children: React.ReactNode;
  isDark?: boolean;
}

export const AndroidFrame: React.FC<AndroidFrameProps> = ({ children, isDark = true }) => {
  // Check if screen is already mobile size (< 768px)
  const [isLargeScreen, setIsLargeScreen] = useState(false);
  const [useDeviceFrame, setUseDeviceFrame] = useState(true);
  const [currentTime, setCurrentTime] = useState('');

  useEffect(() => {
    const updateSize = () => {
      setIsLargeScreen(window.innerWidth >= 768);
    };
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 10000);
    return () => clearInterval(interval);
  }, []);

  // If on actual mobile device or user toggles off frame on desktop
  if (!isLargeScreen || !useDeviceFrame) {
    return (
      <div
        className={`relative min-h-screen flex flex-col overflow-hidden transition-colors ${
          isDark ? 'bg-[#060b18] text-slate-100' : 'bg-slate-50 text-slate-800'
        }`}
      >
        {/* Ambient Frosted Glass Blur Orbs */}
        <div
          className={`fixed top-[-20%] left-[-10%] w-[60%] h-[60%] rounded-full blur-[120px] pointer-events-none -z-0 ${
            isDark ? 'bg-indigo-600/20' : 'bg-indigo-300/20'
          }`}
        />
        <div
          className={`fixed bottom-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full blur-[120px] pointer-events-none -z-0 ${
            isDark ? 'bg-emerald-500/10' : 'bg-emerald-300/20'
          }`}
        />

        {/* Desktop top bar with frame toggle if on large screen */}
        {isLargeScreen && (
          <header
            className={`relative z-10 border-b px-4 py-2.5 flex items-center justify-between text-xs transition-colors ${
              isDark
                ? 'border-white/10 bg-white/5 backdrop-blur-xl text-slate-400'
                : 'border-slate-200 bg-white/80 backdrop-blur-xl text-slate-600'
            }`}
          >
            <span className="font-semibold">Daily Expense Tracker (PWA)</span>
            <button
              onClick={() => setUseDeviceFrame(true)}
              className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs transition ${
                isDark
                  ? 'border-white/10 bg-white/5 text-slate-200 hover:bg-white/10'
                  : 'border-slate-200 bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <Smartphone className="h-3.5 w-3.5 text-indigo-500" />
              Switch to Android Phone View
            </button>
          </header>
        )}
        <div className="relative z-10 flex-1 w-full max-w-3xl mx-auto">{children}</div>
      </div>
    );
  }

  // Realistic Android Phone frame on Desktop preview
  return (
    <div
      className={`relative min-h-screen flex flex-col items-center justify-start p-4 sm:p-6 overflow-hidden transition-colors ${
        isDark ? 'bg-[#020617]' : 'bg-slate-200/80'
      }`}
    >
      {/* Ambient Frosted Glass Blur Orbs */}
      <div
        className={`fixed top-[-20%] left-[-10%] w-[60%] h-[60%] rounded-full blur-[120px] pointer-events-none ${
          isDark ? 'bg-indigo-600/20' : 'bg-indigo-300/25'
        }`}
      />
      <div
        className={`fixed bottom-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full blur-[120px] pointer-events-none ${
          isDark ? 'bg-emerald-500/10' : 'bg-emerald-300/20'
        }`}
      />

      {/* Top switch banner */}
      <div
        className={`relative z-10 mb-3 flex items-center justify-between w-full max-w-[420px] px-2 text-xs ${
          isDark ? 'text-slate-400' : 'text-slate-600'
        }`}
      >
        <div className="flex items-center gap-1.5 font-medium">
          <Smartphone className="h-4 w-4 text-indigo-500" />
          <span>Android Phone View</span>
        </div>
        <button
          onClick={() => setUseDeviceFrame(false)}
          className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1 transition ${
            isDark
              ? 'border-white/10 bg-white/5 backdrop-blur-xl text-slate-300 hover:bg-white/10'
              : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100 shadow-sm'
          }`}
          title="Switch to full screen layout"
        >
          <Monitor className="h-3.5 w-3.5 text-purple-500" />
          <span>Expand View</span>
        </button>
      </div>

      {/* Android Device Mockup Shell */}
      <div
        className={`relative z-10 w-full max-w-[420px] rounded-[44px] border-[8px] backdrop-blur-2xl shadow-[0_25px_60px_-15px_rgba(0,0,0,0.6)] overflow-hidden flex flex-col min-h-[840px] max-h-[92vh] transition-colors ${
          isDark
            ? 'border-slate-800 bg-[#060b18]/95 text-slate-100'
            : 'border-slate-300 bg-slate-50 text-slate-800'
        }`}
      >
        {/* Android Status Bar with Camera Punch Hole */}
        <div
          className={`relative z-30 flex items-center justify-between px-6 pt-3 pb-2 border-b text-xs font-medium select-none transition-colors ${
            isDark
              ? 'bg-white/5 border-white/5 text-slate-300'
              : 'bg-slate-100 border-slate-200 text-slate-600'
          }`}
        >
          {/* Clock */}
          <span className="font-semibold tracking-tight">{currentTime || '09:41'}</span>

          {/* Camera Notch / Punch Hole */}
          <div className="absolute left-1/2 -translate-x-1/2 top-2 h-4 w-4 rounded-full bg-black border border-white/10 shadow-inner flex items-center justify-center">
            <div className="h-1.5 w-1.5 rounded-full bg-slate-900" />
          </div>

          {/* Status Icons */}
          <div className="flex items-center gap-1.5">
            <Signal className="h-3.5 w-3.5" />
            <Wifi className="h-3.5 w-3.5" />
            <div className="flex items-center gap-0.5">
              <span className="text-[10px]">98%</span>
              <BatteryCharging className="h-3.5 w-3.5 text-emerald-500" />
            </div>
          </div>
        </div>

        {/* Scrollable App Screen Content */}
        <div className="flex-1 overflow-y-auto bg-transparent flex flex-col">{children}</div>

        {/* Android Gesture Navigation Bar Pill */}
        <div
          className={`py-2.5 flex justify-center items-center select-none shrink-0 border-t ${
            isDark ? 'bg-white/5 border-white/5' : 'bg-slate-100 border-slate-200'
          }`}
        >
          <div
            className={`h-1.5 w-32 rounded-full ${isDark ? 'bg-white/20' : 'bg-slate-400'}`}
          />
        </div>
      </div>
    </div>
  );
};
