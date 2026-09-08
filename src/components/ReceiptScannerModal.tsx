import React, { useState, useRef } from 'react';
import {
  Camera,
  Upload,
  FileText,
  Sparkles,
  X,
  Check,
  AlertCircle,
  Clock,
  Calendar,
  CreditCard,
  Tag,
  Loader2,
  Receipt,
  RotateCcw,
  Plus,
  Trash2,
  Layers,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ShieldAlert,
  FileCheck,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Expense, ExpenseCategory, ParsedReceiptData, PaymentMethod } from '../types';
import { CATEGORIES, CATEGORY_LIST } from '../data/categories';
import { validateAndOptimizeReceiptImage, MAX_RECEIPT_FILE_SIZE_BYTES } from '../utils/imageOptimizer';

interface ReceiptScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveExpense: (expense: Omit<Expense, 'id' | 'createdAt'>) => void;
  onSaveMultipleExpenses?: (expenses: Array<Omit<Expense, 'id' | 'createdAt'>>) => void;
  defaultCurrency: string;
  onOpenManual?: () => void;
}

type TabType = 'upload' | 'camera' | 'text';

interface ScannedItem {
  id: string;
  fileName: string;
  previewImage: string;
  fileSizeMB: number;
  status: 'pending' | 'analyzing' | 'done' | 'error';
  errorMessage?: string;
  parsedData?: ParsedReceiptData;
  merchant: string;
  amount: number;
  currency: string;
  date: string;
  time: string;
  category: ExpenseCategory;
  paymentMethod: PaymentMethod;
  summary: string;
  items: Array<{ name: string; quantity?: number; price?: number }>;
  tags: string[];
}

export const ReceiptScannerModal: React.FC<ReceiptScannerModalProps> = ({
  isOpen,
  onClose,
  onSaveExpense,
  onSaveMultipleExpenses,
  defaultCurrency,
  onOpenManual,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('upload');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [generalError, setGeneralError] = useState<string | null>(null);

  // Queue of scanned items for multi-upload support
  const [scannedItems, setScannedItems] = useState<ScannedItem[]>([]);
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const [isReceiptExpanded, setIsReceiptExpanded] = useState<boolean>(false);
  const [processingProgress, setProcessingProgress] = useState<{ current: number; total: number } | null>(null);

  // Text/SMS input state
  const [transactionText, setTransactionText] = useState('');
  const [tagInput, setTagInput] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleReset = () => {
    setScannedItems([]);
    setSelectedIndex(0);
    setIsReceiptExpanded(false);
    setTransactionText('');
    setGeneralError(null);
    setIsAnalyzing(false);
    setProcessingProgress(null);
    setTagInput('');
  };

  /**
   * Process a single base64/text receipt payload via server endpoint
   */
  const callAnalyzeApi = async (
    imageBase64?: string,
    text?: string
  ): Promise<ParsedReceiptData> => {
    const response = await fetch('/api/analyze-receipt', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        imageBase64: imageBase64 || undefined,
        text: text || undefined,
        preferredCurrency: defaultCurrency,
      }),
    });

    const json = await response.json();
    if (!response.ok || !json.success) {
      throw new Error(json.error || 'Receipt analysis failed');
    }
    return json.data as ParsedReceiptData;
  };

  /**
   * Handle single or multiple file selections with strict 5MB validation and auto-compression
   */
  const handleFilesSelected = async (fileList: FileList | File[]) => {
    const files = Array.from(fileList);
    if (files.length === 0) return;

    setGeneralError(null);
    setIsAnalyzing(true);
    setProcessingProgress({ current: 0, total: files.length });

    const newItems: ScannedItem[] = [];
    const today = new Date().toISOString().slice(0, 10);
    const nowTime = new Date().toTimeString().slice(0, 5);

    // Step 1: Validate and optimize all files client-side (<5MB safeguard)
    const validOptimizedItems: Array<{ file: File; base64: string; finalSizeMB: number }> = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setProcessingProgress({ current: i + 1, total: files.length });

      const optResult = await validateAndOptimizeReceiptImage(file, MAX_RECEIPT_FILE_SIZE_BYTES);

      if (optResult.error || !optResult.base64) {
        setGeneralError(optResult.error || `File "${file.name}" exceeds the 5MB limit.`);
        continue;
      }

      validOptimizedItems.push({
        file: optResult.file,
        base64: optResult.base64,
        finalSizeMB: optResult.finalSizeMB,
      });
    }

    if (validOptimizedItems.length === 0) {
      setIsAnalyzing(false);
      setProcessingProgress(null);
      return;
    }

    // Step 2: Queue and process sequentially to prevent server jam and protect API quotas
    for (let i = 0; i < validOptimizedItems.length; i++) {
      const item = validOptimizedItems[i];
      setProcessingProgress({ current: i + 1, total: validOptimizedItems.length });

      try {
        const parsed = await callAnalyzeApi(item.base64, undefined);
        newItems.push({
          id: `receipt-${Date.now()}-${i}`,
          fileName: item.file.name,
          previewImage: item.base64,
          fileSizeMB: item.finalSizeMB,
          status: 'done',
          parsedData: parsed,
          merchant: parsed.merchant || item.file.name.replace(/\.[^/.]+$/, ''),
          amount: Number(parsed.amount) || 0,
          currency: parsed.currency || defaultCurrency,
          date: parsed.date || today,
          time: parsed.time || nowTime,
          category: (parsed.category as ExpenseCategory) || 'Other',
          paymentMethod: (parsed.paymentMethod as PaymentMethod) || 'Credit Card',
          summary: parsed.summary || `Receipt from ${parsed.merchant || 'Store'}`,
          items: parsed.items || [],
          tags: parsed.tags || ['receipt'],
        });
      } catch (err: any) {
        console.error(`Failed to analyze ${item.file.name}:`, err);
        // Add as editable manual entry rather than losing the user's uploaded receipt
        newItems.push({
          id: `receipt-${Date.now()}-${i}`,
          fileName: item.file.name,
          previewImage: item.base64,
          fileSizeMB: item.finalSizeMB,
          status: 'error',
          errorMessage: err?.message || 'Could not auto-detect text. Please enter details manually.',
          merchant: item.file.name.replace(/\.[^/.]+$/, ''),
          amount: 0,
          currency: defaultCurrency,
          date: today,
          time: nowTime,
          category: 'Other',
          paymentMethod: 'Credit Card',
          summary: 'Scanned receipt image',
          items: [],
          tags: ['receipt'],
        });
      }
    }

    setScannedItems((prev) => (prev.length > 0 ? [...prev, ...newItems] : newItems));
    setIsAnalyzing(false);
    setProcessingProgress(null);
  };

  /**
   * Handle text/SMS analysis
   */
  const handleAnalyzeText = async () => {
    if (!transactionText.trim()) return;

    setIsAnalyzing(true);
    setGeneralError(null);
    const today = new Date().toISOString().slice(0, 10);
    const nowTime = new Date().toTimeString().slice(0, 5);

    try {
      const parsed = await callAnalyzeApi(undefined, transactionText);
      const item: ScannedItem = {
        id: `text-${Date.now()}`,
        fileName: 'Text / SMS Transaction',
        previewImage: '',
        fileSizeMB: 0,
        status: 'done',
        parsedData: parsed,
        merchant: parsed.merchant || 'Unknown Merchant',
        amount: Number(parsed.amount) || 0,
        currency: parsed.currency || defaultCurrency,
        date: parsed.date || today,
        time: parsed.time || nowTime,
        category: (parsed.category as ExpenseCategory) || 'Other',
        paymentMethod: (parsed.paymentMethod as PaymentMethod) || 'Credit Card',
        summary: parsed.summary || transactionText.slice(0, 50),
        items: parsed.items || [],
        tags: parsed.tags || ['sms-import'],
      };

      setScannedItems([item]);
      setSelectedIndex(0);
    } catch (err: any) {
      setGeneralError(err?.message || 'Failed to auto-categorize transaction text.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  /**
   * Update fields for currently selected receipt
   */
  const updateCurrentItem = (updates: Partial<ScannedItem>) => {
    setScannedItems((prev) =>
      prev.map((item, idx) => (idx === selectedIndex ? { ...item, ...updates } : item))
    );
  };

  const currentItem = scannedItems[selectedIndex];

  // Calculate total amount across all scanned items
  const totalScannedAmount = scannedItems.reduce(
    (sum, item) => sum + (Number(item.amount) || 0),
    0
  );

  /**
   * Save currently selected receipt
   */
  const handleSaveCurrent = () => {
    if (!currentItem) return;
    if (!currentItem.merchant.trim()) {
      setGeneralError('Please enter a merchant name.');
      return;
    }

    onSaveExpense({
      type: 'expense',
      merchant: currentItem.merchant.trim(),
      amount: Number(currentItem.amount) || 0,
      currency: currentItem.currency || defaultCurrency,
      date: currentItem.date,
      time: currentItem.time,
      category: currentItem.category,
      paymentMethod: currentItem.paymentMethod,
      summary: currentItem.summary.trim(),
      tags: currentItem.tags,
      items: currentItem.items.length > 0 ? currentItem.items : undefined,
      receiptImage: currentItem.previewImage || undefined,
      confidence: currentItem.parsedData?.confidence || 'high',
    });

    // Remove saved item from queue
    const remaining = scannedItems.filter((_, idx) => idx !== selectedIndex);
    if (remaining.length === 0) {
      handleReset();
      onClose();
    } else {
      setScannedItems(remaining);
      setSelectedIndex(Math.max(0, Math.min(selectedIndex, remaining.length - 1)));
    }
  };

  /**
   * Save all scanned receipts in one click
   */
  const handleSaveAll = () => {
    if (scannedItems.length === 0) return;

    const formattedExpenses = scannedItems.map((item) => ({
      type: 'expense' as const,
      merchant: (item.merchant || 'Unknown Store').trim(),
      amount: Number(item.amount) || 0,
      currency: item.currency || defaultCurrency,
      date: item.date,
      time: item.time,
      category: item.category,
      paymentMethod: item.paymentMethod,
      summary: item.summary.trim(),
      tags: item.tags,
      items: item.items.length > 0 ? item.items : undefined,
      receiptImage: item.previewImage || undefined,
      confidence: item.parsedData?.confidence || 'high',
    }));

    if (onSaveMultipleExpenses) {
      onSaveMultipleExpenses(formattedExpenses);
    } else {
      formattedExpenses.forEach((exp) => onSaveExpense(exp));
    }

    handleReset();
    onClose();
  };

  const handleRemoveItem = (indexToRemove: number) => {
    const remaining = scannedItems.filter((_, idx) => idx !== indexToRemove);
    if (remaining.length === 0) {
      handleReset();
    } else {
      setScannedItems(remaining);
      setSelectedIndex(Math.max(0, Math.min(selectedIndex, remaining.length - 1)));
    }
  };

  const handleAddTag = () => {
    if (!currentItem) return;
    const clean = tagInput.trim().toLowerCase();
    if (clean && !currentItem.tags.includes(clean)) {
      updateCurrentItem({ tags: [...currentItem.tags, clean] });
      setTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    if (!currentItem) return;
    updateCurrentItem({
      tags: currentItem.tags.filter((t) => t !== tagToRemove),
    });
  };

  // Sample receipt loader for testing
  const handleLoadSample = (type: 'grocery' | 'coffee' | 'transport' | 'tech') => {
    const today = new Date().toISOString().slice(0, 10);
    const samples: Record<string, { text: string; category: ExpenseCategory; merchant: string; amount: number; summary: string }> = {
      grocery: {
        text: `GREEN GROCER MART #104\nDate: ${today} 14:22\nPayment: VISA ****9012\n-------------------------------\nOrganic Milk 1gal       $4.99\nAvocado Hass 4pk        $5.50\nOrganic Sourdough Bread $4.25\nBananas 2.4lb           $1.85\nGreek Yogurt Honey      $3.99\n-------------------------------\nTOTAL: $21.80`,
        category: 'Groceries',
        merchant: 'Green Grocer Mart',
        amount: 21.80,
        summary: 'Groceries: milk, avocados, sourdough bread & yogurt',
      },
      coffee: {
        text: `ARTISAN COFFEE ROASTERS\nDate: ${today} 09:15\n-------------------------------\n1x Oat Flat White       $5.50\n1x Almond Croissant     $4.50\n-------------------------------\nTOTAL: $10.00\nPaid via Apple Pay`,
        category: 'Food & Dining',
        merchant: 'Artisan Coffee Roasters',
        amount: 10.00,
        summary: 'Breakfast oat flat white and almond croissant',
      },
      transport: {
        text: `Grab Ride Receipt #GRB-89312\nDate: ${today} 08:30 AM\nFare: $14.20\nToll: $2.50\nPayment: GrabPay Wallet\nTOTAL: $16.70`,
        category: 'Transportation',
        merchant: 'Grab Ride',
        amount: 16.70,
        summary: 'Morning commute ride to CBD office',
      },
      tech: {
        text: `BEST ELECTRONICS STORE\nDate: ${today} 16:40\n-------------------------------\nUSB-C Fast GaN Charger 65W   $32.00\nBraided Cable 2M             $12.99\nTax:                         $3.60\nTOTAL:                       $48.59`,
        category: 'Shopping',
        merchant: 'Best Electronics Store',
        amount: 48.59,
        summary: 'Electronics: 65W GaN Charger & 2M Braided Cable',
      },
    };

    const s = samples[type];
    setTransactionText(s.text);
    setActiveTab('text');
    handleAnalyzeText();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-[#020617]/80 backdrop-blur-2xl overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="relative w-full max-w-xl my-auto rounded-3xl border border-white/15 bg-[#0b132b]/90 backdrop-blur-3xl text-slate-100 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.8),0_0_0_1px_rgba(255,255,255,0.1)] overflow-hidden flex flex-col max-h-[92vh]"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4 bg-white/5 backdrop-blur-xl">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
              <Sparkles className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              {scannedItems.length > 0 ? (
                <h2 className="text-sm sm:text-base font-semibold text-white truncate">
                  {scannedItems.length > 1
                    ? `Review ${scannedItems.length} expenses · Total ${defaultCurrency}${totalScannedAmount.toFixed(2)}`
                    : `Review scanned expense · Total ${defaultCurrency}${totalScannedAmount.toFixed(2)}`}
                </h2>
              ) : (
                <>
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm sm:text-base font-semibold text-white truncate">
                      Scan & Auto-Categorize
                    </h2>
                    <span className="rounded-full bg-emerald-500/20 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
                      Max 5MB / file
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">
                    Supports single & multi-receipt upload with auto-compression
                  </p>
                </>
              )}
            </div>
          </div>
          <button
            onClick={() => {
              handleReset();
              onClose();
            }}
            className="rounded-xl p-1.5 text-slate-400 hover:bg-white/10 hover:text-white transition shrink-0 ml-2"
            title="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {generalError && (
            <div className="rounded-2xl border border-amber-500/30 bg-amber-950/40 p-3.5 text-xs text-amber-200 backdrop-blur-xl flex items-start gap-2.5">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-amber-400" />
              <div className="flex-1">
                <p className="font-semibold text-amber-100">Notice</p>
                <p className="text-amber-200/90 leading-relaxed">{generalError}</p>
              </div>
              <button
                type="button"
                onClick={() => setGeneralError(null)}
                className="text-amber-400 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* Analyzing Progress State */}
          {isAnalyzing ? (
            <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
              <div className="relative mb-6 h-36 w-36 rounded-2xl border-2 border-dashed border-indigo-500/40 bg-white/5 backdrop-blur-xl overflow-hidden flex items-center justify-center shadow-inner">
                <Receipt className="h-14 w-14 text-indigo-400/60" />

                {/* Laser scan line animation */}
                <motion.div
                  className="absolute inset-x-0 h-1 bg-gradient-to-r from-transparent via-indigo-400 to-transparent shadow-[0_0_12px_#818cf8]"
                  animate={{ top: ['0%', '100%', '0%'] }}
                  transition={{ repeat: Infinity, duration: 1.8, ease: 'easeInOut' }}
                />
              </div>

              <div className="flex items-center gap-2 text-indigo-300 font-medium text-sm mb-1.5">
                <Loader2 className="h-4 w-4 animate-spin text-indigo-400" />
                {processingProgress && processingProgress.total > 1
                  ? `Analyzing Receipt ${processingProgress.current} of ${processingProgress.total}...`
                  : 'Analyzing with Gemini AI...'}
              </div>
              <p className="text-xs text-slate-400 max-w-xs">
                Extracting merchant, items, amount, and date below 5MB threshold.
              </p>
            </div>
          ) : scannedItems.length > 0 && currentItem ? (
            /* Scanned Items Review Screen */
            <div className="space-y-3.5">
              {/* Receipt Pagination / Navigator for multiple receipts */}
              {scannedItems.length > 1 && (
                <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-3.5 py-2.5 backdrop-blur-xl">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-slate-200">
                      Receipt {selectedIndex + 1} of {scannedItems.length}
                    </span>
                    {/* Progress indicator dots */}
                    <div className="flex items-center gap-1 ml-1">
                      {scannedItems.map((_, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setSelectedIndex(idx)}
                          className={`h-1.5 rounded-full transition-all ${
                            idx === selectedIndex
                              ? 'w-4 bg-indigo-400'
                              : 'w-1.5 bg-white/20 hover:bg-white/40'
                          }`}
                          title={`Go to receipt ${idx + 1}`}
                        />
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      disabled={selectedIndex === 0}
                      onClick={() => setSelectedIndex((prev) => Math.max(0, prev - 1))}
                      className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-medium text-slate-300 hover:bg-white/10 transition disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <ChevronLeft className="h-3.5 w-3.5" />
                      <span>Previous</span>
                    </button>

                    <button
                      type="button"
                      disabled={selectedIndex === scannedItems.length - 1}
                      onClick={() =>
                        setSelectedIndex((prev) => Math.min(scannedItems.length - 1, prev + 1))
                      }
                      className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-medium text-slate-300 hover:bg-white/10 transition disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <span>Next</span>
                      <ChevronRight className="h-3.5 w-3.5" />
                    </button>

                    <button
                      type="button"
                      onClick={() => handleRemoveItem(selectedIndex)}
                      className="ml-1 p-1 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition"
                      title="Remove this receipt"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              )}

              {/* Form fields for review */}
              <div className="space-y-3">
                {/* Merchant */}
                <div>
                  <label className="text-xs font-medium text-slate-300 block mb-1">
                    Merchant
                  </label>
                  <input
                    type="text"
                    value={currentItem.merchant}
                    onChange={(e) => updateCurrentItem({ merchant: e.target.value })}
                    placeholder="e.g. Starbucks, Target, Shell"
                    className="w-full rounded-xl border border-white/10 bg-white/5 backdrop-blur-xl px-3 py-2 text-xs text-white placeholder:text-slate-500 focus:border-indigo-400 focus:outline-none"
                  />
                </div>

                {/* Amount */}
                <div>
                  <label className="text-xs font-medium text-slate-300 block mb-1">
                    Amount
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-indigo-400">
                      {currentItem.currency || defaultCurrency}
                    </span>
                    <input
                      type="number"
                      step="0.01"
                      value={currentItem.amount || ''}
                      onChange={(e) =>
                        updateCurrentItem({ amount: parseFloat(e.target.value) || 0 })
                      }
                      placeholder="0.00"
                      className="w-full rounded-xl border border-white/10 bg-white/5 backdrop-blur-xl pl-12 pr-3 py-2 text-xs font-semibold text-white focus:border-indigo-400 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Date & Time */}
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="text-xs font-medium text-slate-300 block mb-1">Date</label>
                    <input
                      type="date"
                      value={currentItem.date}
                      onChange={(e) => updateCurrentItem({ date: e.target.value })}
                      className="w-full rounded-xl border border-white/10 bg-white/5 backdrop-blur-xl px-3 py-2 text-xs text-white focus:border-indigo-400 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-300 block mb-1">Time</label>
                    <input
                      type="time"
                      value={currentItem.time}
                      onChange={(e) => updateCurrentItem({ time: e.target.value })}
                      className="w-full rounded-xl border border-white/10 bg-white/5 backdrop-blur-xl px-3 py-2 text-xs text-white focus:border-indigo-400 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Category & Payment Method */}
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="text-xs font-medium text-slate-300 block mb-1">Category</label>
                    <select
                      value={currentItem.category}
                      onChange={(e) =>
                        updateCurrentItem({ category: e.target.value as ExpenseCategory })
                      }
                      className="w-full rounded-xl border border-white/10 bg-[#0b132b] px-3 py-2 text-xs text-white focus:border-indigo-400 focus:outline-none"
                    >
                      {CATEGORY_LIST.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-300 block mb-1">Payment Method</label>
                    <select
                      value={currentItem.paymentMethod}
                      onChange={(e) =>
                        updateCurrentItem({ paymentMethod: e.target.value as PaymentMethod })
                      }
                      className="w-full rounded-xl border border-white/10 bg-[#0b132b] px-3 py-2 text-xs text-white focus:border-indigo-400 focus:outline-none"
                    >
                      <option value="Credit Card">Credit Card</option>
                      <option value="Debit Card">Debit Card</option>
                      <option value="Cash">Cash</option>
                      <option value="E-Wallet">E-Wallet</option>
                      <option value="Bank Transfer">Bank Transfer</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                </div>

                {/* View receipt — expandable */}
                {currentItem.previewImage && (
                  <div>
                    <button
                      type="button"
                      onClick={() => setIsReceiptExpanded(!isReceiptExpanded)}
                      className="w-full flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-300 hover:bg-white/10 hover:text-white transition"
                    >
                      <span className="flex items-center gap-2">
                        <Receipt className="h-4 w-4 text-indigo-400" />
                        <span className="font-medium">View receipt</span>
                        {currentItem.fileName && (
                          <span className="text-[11px] text-slate-400 truncate max-w-[160px]">
                            • {currentItem.fileName}
                          </span>
                        )}
                      </span>
                      <ChevronDown
                        className={`h-4 w-4 text-slate-400 transition-transform duration-200 ${
                          isReceiptExpanded ? 'rotate-180 text-white' : ''
                        }`}
                      />
                    </button>
                    <AnimatePresence>
                      {isReceiptExpanded && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="overflow-hidden rounded-2xl border border-white/10 bg-black/40 p-2 mt-2"
                        >
                          <img
                            src={currentItem.previewImage}
                            alt="Scanned receipt preview"
                            className="max-h-60 w-full rounded-xl object-contain mx-auto"
                          />
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}

                {/* Note / Description */}
                <div>
                  <label className="text-xs font-medium text-slate-300 block mb-1">
                    Note (Optional)
                  </label>
                  <input
                    type="text"
                    value={currentItem.summary}
                    onChange={(e) => updateCurrentItem({ summary: e.target.value })}
                    placeholder="e.g. Lunch with team or Weekly groceries"
                    className="w-full rounded-xl border border-white/10 bg-white/5 backdrop-blur-xl px-3 py-2 text-xs text-white placeholder:text-slate-500 focus:border-indigo-400 focus:outline-none"
                  />
                </div>
              </div>
            </div>
          ) : (
            /* Upload / Capture / Text selection */
            <div className="space-y-4">
              {/* Method Tabs */}
              <div className="grid grid-cols-3 gap-1 rounded-2xl bg-white/5 backdrop-blur-xl p-1 border border-white/10">
                <button
                  type="button"
                  onClick={() => setActiveTab('upload')}
                  className={`flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-medium transition ${
                    activeTab === 'upload'
                      ? 'bg-indigo-600 text-white font-semibold shadow-lg shadow-indigo-500/25'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Upload className="h-4 w-4" />
                  Upload Photo(s)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('camera');
                    cameraInputRef.current?.click();
                  }}
                  className={`flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-medium transition ${
                    activeTab === 'camera'
                      ? 'bg-indigo-600 text-white font-semibold shadow-lg shadow-indigo-500/25'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Camera className="h-4 w-4" />
                  Camera Snap
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('text')}
                  className={`flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-medium transition ${
                    activeTab === 'text'
                      ? 'bg-indigo-600 text-white font-semibold shadow-lg shadow-indigo-500/25'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <FileText className="h-4 w-4" />
                  Paste Text / SMS
                </button>
              </div>

              {/* Hidden file inputs */}
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*,.pdf"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files.length > 0) {
                    handleFilesSelected(e.target.files);
                  }
                }}
              />
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files.length > 0) {
                    handleFilesSelected(e.target.files);
                  }
                }}
              />

              {/* Upload view */}
              {activeTab === 'upload' && (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                      handleFilesSelected(e.dataTransfer.files);
                    }
                  }}
                  className="group flex flex-col items-center justify-center rounded-3xl border-2 border-dashed border-white/15 bg-white/5 backdrop-blur-xl p-8 text-center cursor-pointer transition hover:border-indigo-500/50 hover:bg-white/10"
                >
                  <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-500/20 text-indigo-400 transition group-hover:scale-105 border border-indigo-500/30">
                    <Upload className="h-7 w-7" />
                  </div>
                  <p className="text-sm font-semibold text-white mb-1">
                    Select single or multiple receipt images
                  </p>
                  <p className="text-xs text-slate-400 max-w-xs mb-3">
                    Drag & drop files or choose from gallery. Supports JPG, PNG, WEBP.
                  </p>

                  <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 px-3 py-1 text-[11px] font-medium text-emerald-300 mb-3">
                    <FileCheck className="h-3.5 w-3.5" />
                    Strict &lt;5MB per file safeguard with automatic compression
                  </div>

                  <span className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-indigo-500/25">
                    Browse Files
                  </span>
                </div>
              )}

              {/* Camera view */}
              {activeTab === 'camera' && (
                <div
                  onClick={() => cameraInputRef.current?.click()}
                  className="group flex flex-col items-center justify-center rounded-3xl border-2 border-dashed border-indigo-500/40 bg-white/5 backdrop-blur-xl p-8 text-center cursor-pointer transition hover:bg-white/10"
                >
                  <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-500/20 text-indigo-400 transition group-hover:scale-105 border border-indigo-500/30">
                    <Camera className="h-7 w-7" />
                  </div>
                  <p className="text-sm font-semibold text-white mb-1">
                    Snap Receipt with Camera
                  </p>
                  <p className="text-xs text-slate-400 max-w-xs mb-3">
                    High-res camera captures are automatically optimized under 5MB to ensure fast processing.
                  </p>
                  <span className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-indigo-500/25">
                    Take Photo
                  </span>
                </div>
              )}

              {/* Text / SMS paste view */}
              {activeTab === 'text' && (
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-medium text-slate-300 block mb-1">
                      Paste Bank Transaction SMS, e-Wallet Notification, or Receipt Text:
                    </label>
                    <textarea
                      rows={5}
                      value={transactionText}
                      onChange={(e) => setTransactionText(e.target.value)}
                      placeholder={`Example:\n"RM 48.50 spent at Shell Petrol Station on 06/09 via Touch 'n Go eWallet"\nOR\n"Paid $24.80 to Subway Sandwiches on Sep 6"`}
                      className="w-full rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-3 text-xs text-white placeholder:text-slate-500 focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400/40"
                    />
                  </div>
                  <button
                    type="button"
                    disabled={!transactionText.trim()}
                    onClick={handleAnalyzeText}
                    className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 py-2.5 text-xs font-semibold text-white shadow-lg shadow-indigo-500/25 transition hover:from-indigo-500 hover:to-purple-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Sparkles className="h-4 w-4" />
                    Auto-Categorize Transaction
                  </button>
                </div>
              )}

              {/* Quick Sample Presets */}
              <div className="pt-2 border-t border-white/10">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    Or Test with a Sample Receipt:
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <button
                    type="button"
                    onClick={() => handleLoadSample('coffee')}
                    className="flex flex-col items-start rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-2.5 text-left hover:border-white/20 hover:bg-white/10 transition"
                  >
                    <span className="text-xs font-medium text-amber-300">☕ Coffee Shop</span>
                    <span className="text-[10px] text-slate-400">$10.00 • Latte</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleLoadSample('grocery')}
                    className="flex flex-col items-start rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-2.5 text-left hover:border-white/20 hover:bg-white/10 transition"
                  >
                    <span className="text-xs font-medium text-emerald-300">🛒 Groceries</span>
                    <span className="text-[10px] text-slate-400">$21.80 • Milk & Bread</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleLoadSample('transport')}
                    className="flex flex-col items-start rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-2.5 text-left hover:border-white/20 hover:bg-white/10 transition"
                  >
                    <span className="text-xs font-medium text-sky-300">🚗 Ride Commute</span>
                    <span className="text-[10px] text-slate-400">$16.70 • Grab</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleLoadSample('tech')}
                    className="flex flex-col items-start rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-2.5 text-left hover:border-white/20 hover:bg-white/10 transition"
                  >
                    <span className="text-xs font-medium text-pink-300">🛍️ Tech Store</span>
                    <span className="text-[10px] text-slate-400">$48.59 • Charger</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        {scannedItems.length > 0 && !isAnalyzing && (
          <div className="border-t border-white/10 px-5 py-3.5 bg-white/5 backdrop-blur-xl flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 text-xs font-medium text-indigo-400 hover:text-indigo-300 transition py-2 px-1"
            >
              <Plus className="h-4 w-4" />
              Add more receipts
            </button>

            {scannedItems.length > 1 ? (
              <button
                type="button"
                onClick={handleSaveAll}
                className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-5 py-2.5 text-xs font-semibold text-white shadow-lg shadow-emerald-500/25 transition hover:from-emerald-500 hover:to-teal-500 active:scale-95"
              >
                <Check className="h-4 w-4" />
                Save all {scannedItems.length} expenses
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSaveCurrent}
                className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 px-5 py-2.5 text-xs font-semibold text-white shadow-lg shadow-indigo-500/25 transition hover:from-indigo-500 hover:to-purple-500 active:scale-95"
              >
                <Check className="h-4 w-4" />
                Save expense
              </button>
            )}
          </div>
        )}
      </motion.div>
    </div>
  );
};
