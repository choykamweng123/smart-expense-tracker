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
  CheckSquare,
  Square,
  ArrowDownLeft,
  ArrowUpRight,
  Eye,
  FileSpreadsheet,
  Wallet,
  Download,
  Cpu,
  Zap,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Expense,
  ExpenseCategory,
  ParsedReceiptData,
  PaymentMethod,
  TransactionType,
} from '../types';
import { CATEGORIES, CATEGORY_LIST } from '../data/categories';
import {
  validateAndOptimizeReceiptImage,
  MAX_RECEIPT_FILE_SIZE_BYTES,
} from '../utils/imageOptimizer';
import {
  performLocalOCR,
  parseOcrTextToTransactions,
  LOCAL_OCR_CONFIDENCE_THRESHOLD,
} from '../utils/localOcr';
import { analyzeImageFile, ImageQualityReport } from '../utils/imageQuality';
import { parseBankCsv } from '../utils/csvParser';
import {
  parseSpreadsheetFile,
  downloadExcelTemplate,
  downloadCsvTemplate,
} from '../utils/spreadsheetParser';
import { CameraScannerView } from './CameraScannerView';

interface ReceiptScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveExpense: (expense: Omit<Expense, 'id' | 'createdAt'>) => void;
  onSaveMultipleExpenses?: (expenses: Array<Omit<Expense, 'id' | 'createdAt'>>) => void;
  defaultCurrency: string;
  onOpenManual?: () => void;
}

type TabType = 'upload' | 'camera' | 'text';
type ReviewMode = 'batch' | 'single';

interface ScannedItem {
  id: string;
  fileName: string;
  previewImage: string;
  fileSizeMB: number;
  status: 'pending' | 'analyzing' | 'done' | 'error';
  errorMessage?: string;
  parsedData?: ParsedReceiptData;
  type: TransactionType;
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
  selected?: boolean;
  statementSource?: string;
  imageQualityScore?: number;
  ocrConfidenceScore?: number;
  executionEngine?: 'local_ocr' | 'cloud_ai';
  confidenceReason?: string;
}

function parseFilenameMetadata(fileName: string, fallbackDate: string, fallbackTime: string): {
  date: string;
  time: string;
  merchant: string;
  paymentMethod: PaymentMethod;
  source?: string;
} {
  let date = fallbackDate;
  let time = fallbackTime;
  let merchant = fileName.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ').trim();
  let paymentMethod: PaymentMethod = 'E-Wallet';
  let source: string | undefined;

  // Extract YYYYMMDD (e.g. Screenshot_20260908_233330)
  const dateMatch = fileName.match(/(\d{4})(\d{2})(\d{2})/);
  if (dateMatch) {
    const [_, y, m, d] = dateMatch;
    const year = Number(y);
    const month = Number(m);
    const day = Number(d);
    if (year >= 2020 && year <= 2035 && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      date = `${y}-${m}-${d}`;
    }
  }

  // Extract HHMMSS or HHMM
  const timeMatch = fileName.match(/_(\d{2})(\d{2})(\d{2})/) || fileName.match(/_(\d{2})(\d{2})/);
  if (timeMatch) {
    const hh = Number(timeMatch[1]);
    const mm = Number(timeMatch[2]);
    if (hh >= 0 && hh <= 23 && mm >= 0 && mm <= 59) {
      time = `${timeMatch[1]}:${timeMatch[2]}`;
    }
  }

  const lower = fileName.toLowerCase();
  if (lower.includes('tng') || lower.includes('touch') || lower.includes('wallet')) {
    merchant = 'TNG eWallet';
    paymentMethod = 'E-Wallet';
    source = "Touch 'n Go eWallet";
  } else if (lower.includes('grab')) {
    merchant = 'GrabPay';
    paymentMethod = 'E-Wallet';
    source = 'Grab';
  } else if (lower.includes('boost')) {
    merchant = 'Boost eWallet';
    paymentMethod = 'E-Wallet';
    source = 'Boost';
  } else if (lower.includes('maybank') || lower.includes('mae')) {
    merchant = 'Maybank';
    paymentMethod = 'Bank Transfer';
    source = 'Maybank';
  } else if (lower.includes('cimb')) {
    merchant = 'CIMB Bank';
    paymentMethod = 'Bank Transfer';
    source = 'CIMB';
  } else if (lower.includes('receipt')) {
    merchant = 'Receipt / Store';
    paymentMethod = 'Cash';
  }

  return { date, time, merchant, paymentMethod, source };
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
  const [reviewMode, setReviewMode] = useState<ReviewMode>('batch');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [statusDetail, setStatusDetail] = useState<string>('');
  const [generalError, setGeneralError] = useState<string | null>(null);

  // Queue of scanned items for multi-upload and statement batch support
  const [scannedItems, setScannedItems] = useState<ScannedItem[]>([]);
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const [isReceiptExpanded, setIsReceiptExpanded] = useState<boolean>(false);
  const [previewModalImage, setPreviewModalImage] = useState<string | null>(null);
  const [detectedSource, setDetectedSource] = useState<string | null>(null);
  const [processingProgress, setProcessingProgress] = useState<{
    current: number;
    total: number;
  } | null>(null);

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
    setPreviewModalImage(null);
    setDetectedSource(null);
    setTransactionText('');
    setGeneralError(null);
    setIsAnalyzing(false);
    setStatusDetail('');
    setProcessingProgress(null);
    setTagInput('');
    setReviewMode('batch');
  };

  /**
   * Process a single base64/text receipt payload via server endpoint
   */
  const callAnalyzeApi = async (
    imageBase64?: string,
    text?: string
  ): Promise<{
    statementSource?: string;
    isMultipleTransactions?: boolean;
    transactions: ParsedReceiptData[];
    merchant?: string;
    amount?: number;
    type?: TransactionType;
    currency?: string;
    date?: string;
    time?: string;
    category?: ExpenseCategory;
    paymentMethod?: PaymentMethod;
    summary?: string;
    tags?: string[];
  }> => {
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
    return json.data;
  };

  /**
   * Handle single or multiple file selections (e.g. Touch 'n Go screenshot, receipts, or CSV statements)
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
    let detectedSourceFound: string | null = null;

    // Check for direct CSV / Excel (.xlsx, .xls) spreadsheet files
    const spreadsheetFiles = files.filter((f) => {
      const lower = f.name.toLowerCase();
      return (
        lower.endsWith('.csv') ||
        lower.endsWith('.xlsx') ||
        lower.endsWith('.xls') ||
        lower.endsWith('.tsv') ||
        f.type === 'text/csv' ||
        f.type.includes('spreadsheet') ||
        f.type.includes('excel')
      );
    });
    const imageFiles = files.filter((f) => !spreadsheetFiles.includes(f));

    if (spreadsheetFiles.length > 0) {
      for (const sheetFile of spreadsheetFiles) {
        try {
          const parseRes = await parseSpreadsheetFile(sheetFile, defaultCurrency);
          if (parseRes.transactions.length > 0) {
            detectedSourceFound = `${sheetFile.name} (Spreadsheet Import)`;
            parseRes.transactions.forEach((tx, idx) => {
              newItems.push({
                id: `sheet-${Date.now()}-${idx}`,
                fileName: `${sheetFile.name} (#${idx + 1})`,
                previewImage: '',
                fileSizeMB: 0,
                status: 'done',
                type: tx.type,
                merchant: tx.merchant,
                amount: tx.amount,
                currency: tx.currency || defaultCurrency,
                date: tx.date || today,
                time: tx.time || nowTime,
                category: tx.category,
                paymentMethod: tx.paymentMethod,
                summary: tx.summary,
                items: [],
                tags: tx.tags,
                selected: true,
                statementSource: sheetFile.name,
                executionEngine: 'local_ocr',
                ocrConfidenceScore: 100,
                imageQualityScore: 100,
              });
            });
          }
        } catch (e: any) {
          console.error('Failed to parse spreadsheet file:', e);
        }
      }
    }

    if (imageFiles.length === 0 && newItems.length > 0) {
      setDetectedSource(detectedSourceFound);
      setScannedItems((prev) => (prev.length > 0 ? [...prev, ...newItems] : newItems));
      setReviewMode(newItems.length > 1 ? 'batch' : 'single');
      setIsAnalyzing(false);
      setProcessingProgress(null);
      return;
    }

    // Step 1: Validate and optimize all image files client-side (<5MB safeguard)
    const validOptimizedItems: Array<{ file: File; base64: string; finalSizeMB: number }> = [];

    for (let i = 0; i < imageFiles.length; i++) {
      const file = imageFiles[i];
      setProcessingProgress({ current: i + 1, total: imageFiles.length });
      setStatusDetail(`Optimizing image ${i + 1} of ${imageFiles.length}...`);

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

    if (validOptimizedItems.length === 0 && newItems.length === 0) {
      setIsAnalyzing(false);
      setProcessingProgress(null);
      return;
    }

    // Step 2: Multi-stage OCR Pipeline prioritizing Local Execution
    for (let i = 0; i < validOptimizedItems.length; i++) {
      const item = validOptimizedItems[i];
      setProcessingProgress({ current: i + 1, total: validOptimizedItems.length });

      // Stage 1: Image Quality Score Assessment
      setStatusDetail(`Assessing image quality for ${item.file.name}...`);
      let qualityScore = 80;
      let qualityReport: ImageQualityReport | null = null;
      try {
        qualityReport = await analyzeImageFile(item.file);
        qualityScore = qualityReport.score;
      } catch (qErr) {
        console.warn('Image quality analysis skipped:', qErr);
      }

      // Stage 2: Prioritize Local On-Device OCR
      setStatusDetail(`Running local OCR on ${item.file.name}...`);
      let ocrResult: any = null;

      try {
        ocrResult = await performLocalOCR(
          item.base64,
          (_, status) => setStatusDetail(`${item.file.name}: ${status}`),
          defaultCurrency
        );
      } catch (err: any) {
        console.warn('Local OCR execution encountered error:', err);
      }

      // Check if Local OCR Confidence Score meets or exceeds the threshold
      const localConfidence = ocrResult?.ocrConfidenceScore ?? 0;
      const hasValidAmount = ocrResult?.hasValidAmount && ocrResult?.transactions?.some((t: any) => t.amount > 0);
      const isLocalAcceptable = ocrResult && localConfidence >= LOCAL_OCR_CONFIDENCE_THRESHOLD && hasValidAmount;

      if (isLocalAcceptable) {
        // --- ⚡ STAGE 3A: ACCEPT LOCAL ON-DEVICE OCR (Zero Cloud Quota Used) ---
        if (ocrResult.statementSource) {
          detectedSourceFound = ocrResult.statementSource;
        }

        ocrResult.transactions.forEach((tx: any, txIdx: number) => {
          const itemType: TransactionType = tx.type === 'income' ? 'income' : 'expense';
          newItems.push({
            id: `ocr-local-${Date.now()}-${i}-${txIdx}`,
            fileName: ocrResult.transactions.length > 1 ? `${item.file.name} (#${txIdx + 1})` : item.file.name,
            previewImage: item.base64,
            fileSizeMB: item.finalSizeMB,
            status: 'done' as const,
            parsedData: tx,
            type: itemType,
            merchant: tx.merchant || item.file.name.replace(/\.[^/.]+$/, ''),
            amount: Math.abs(Number(tx.amount)) || 0,
            currency: tx.currency || defaultCurrency,
            date: tx.date || today,
            time: tx.time || nowTime,
            category: (tx.category as ExpenseCategory) || 'Other',
            paymentMethod: (tx.paymentMethod as PaymentMethod) || 'E-Wallet',
            summary: tx.summary || `${tx.merchant} (Local OCR)`,
            items: tx.items || [],
            tags: tx.tags || ['local-ocr'],
            selected: true,
            statementSource: ocrResult.statementSource || 'Local OCR (On-Device)',
            imageQualityScore: qualityScore,
            ocrConfidenceScore: localConfidence,
            executionEngine: 'local_ocr',
            confidenceReason: `Local OCR Confidence ${localConfidence}% meets threshold (Quality: ${qualityScore}%)`,
          });
        });
      } else {
        // --- ☁️ STAGE 3B: LOCAL CONFIDENCE BELOW THRESHOLD (< 70%) -> CONDITIONAL CLOUD ANALYSIS ---
        setStatusDetail(`Local OCR score (${localConfidence}%) is below ${LOCAL_OCR_CONFIDENCE_THRESHOLD}% threshold. Enhancing with Cloud AI...`);
        try {
          const parsed = await callAnalyzeApi(item.base64, undefined);
          if (parsed.statementSource) {
            detectedSourceFound = parsed.statementSource;
          }

          const rawList =
            Array.isArray(parsed.transactions) && parsed.transactions.length > 0
              ? parsed.transactions
              : [
                  {
                    merchant: parsed.merchant || item.file.name.replace(/\.[^/.]+$/, ''),
                    amount: Number(parsed.amount) || 0,
                    type: (parsed.type === 'income' ? 'income' : 'expense') as TransactionType,
                    currency: parsed.currency || defaultCurrency,
                    date: parsed.date || today,
                    time: parsed.time || nowTime,
                    category: (parsed.category as ExpenseCategory) || 'Other',
                    paymentMethod: (parsed.paymentMethod as PaymentMethod) || 'E-Wallet',
                    summary: parsed.summary || `Receipt from ${parsed.merchant || 'Store'}`,
                    items: [],
                    tags: parsed.tags || ['receipt'],
                    confidence: 'high' as const,
                  },
                ];

          rawList.forEach((tx: any, txIdx: number) => {
            const itemType: TransactionType = tx.type === 'income' ? 'income' : 'expense';
            newItems.push({
              id: `receipt-cloud-${Date.now()}-${i}-${txIdx}`,
              fileName: rawList.length > 1 ? `${item.file.name} (#${txIdx + 1})` : item.file.name,
              previewImage: item.base64,
              fileSizeMB: item.finalSizeMB,
              status: 'done' as const,
              parsedData: tx,
              type: itemType,
              merchant: tx.merchant || item.file.name.replace(/\.[^/.]+$/, ''),
              amount: Math.abs(Number(tx.amount)) || 0,
              currency: tx.currency || defaultCurrency,
              date: tx.date || today,
              time: tx.time || nowTime,
              category: (tx.category as ExpenseCategory) || 'Other',
              paymentMethod: (tx.paymentMethod as PaymentMethod) || 'E-Wallet',
              summary: tx.summary || (itemType === 'income' ? `Received from ${tx.merchant}` : `Paid to ${tx.merchant}`),
              items: tx.items || [],
              tags: tx.tags && tx.tags.length > 0 ? tx.tags : ['cloud-ai'],
              selected: true,
              statementSource: parsed.statementSource || 'Cloud AI Vision',
              imageQualityScore: qualityScore,
              ocrConfidenceScore: 95,
              executionEngine: 'cloud_ai',
              confidenceReason: `Enhanced with Cloud AI (Local OCR score was ${localConfidence}%)`,
            });
          });
        } catch (cloudErr: any) {
          console.warn(`Cloud AI fallback also failed for ${item.file.name}. Keeping local OCR data.`, cloudErr);

          if (ocrResult && ocrResult.transactions && ocrResult.transactions.length > 0) {
            ocrResult.transactions.forEach((tx: any, txIdx: number) => {
              const itemType: TransactionType = tx.type === 'income' ? 'income' : 'expense';
              newItems.push({
                id: `ocr-partial-${Date.now()}-${i}-${txIdx}`,
                fileName: ocrResult.transactions.length > 1 ? `${item.file.name} (#${txIdx + 1})` : item.file.name,
                previewImage: item.base64,
                fileSizeMB: item.finalSizeMB,
                status: 'done' as const,
                parsedData: tx,
                type: itemType,
                merchant: tx.merchant || item.file.name.replace(/\.[^/.]+$/, ''),
                amount: Math.abs(Number(tx.amount)) || 0,
                currency: tx.currency || defaultCurrency,
                date: tx.date || today,
                time: tx.time || nowTime,
                category: (tx.category as ExpenseCategory) || 'Other',
                paymentMethod: (tx.paymentMethod as PaymentMethod) || 'E-Wallet',
                summary: tx.summary || `${tx.merchant} (Local OCR)`,
                items: tx.items || [],
                tags: ['local-ocr', 'verify-required'],
                selected: true,
                statementSource: ocrResult.statementSource || 'Local OCR (Review Required)',
                imageQualityScore: qualityScore,
                ocrConfidenceScore: localConfidence,
                executionEngine: 'local_ocr',
                confidenceReason: `Local OCR confidence is ${localConfidence}%. Please verify details.`,
              });
            });
          } else {
            const meta = parseFilenameMetadata(item.file.name, today, nowTime);
            newItems.push({
              id: `ocr-err-${Date.now()}-${i}-0`,
              fileName: item.file.name,
              previewImage: item.base64,
              fileSizeMB: item.finalSizeMB,
              status: 'error' as const,
              errorMessage: 'Could not extract text with high confidence. Please verify or adjust manually.',
              type: 'expense',
              merchant: meta.merchant || item.file.name.replace(/\.[^/.]+$/, ''),
              amount: 0,
              currency: defaultCurrency,
              date: meta.date,
              time: meta.time,
              category: meta.merchant.toLowerCase().includes('toll') ? 'Transportation' : 'Other',
              paymentMethod: meta.paymentMethod,
              summary: `${meta.merchant} (Manual check)`,
              items: [],
              tags: ['manual-check'],
              selected: true,
              statementSource: meta.source,
              imageQualityScore: qualityScore,
              ocrConfidenceScore: localConfidence,
            });
          }
        }
      }
    }

    if (detectedSourceFound) {
      setDetectedSource(detectedSourceFound);
    }
    setScannedItems((prev) => (prev.length > 0 ? [...prev, ...newItems] : newItems));
    setReviewMode(newItems.length > 1 ? 'batch' : 'single');
    setIsAnalyzing(false);
    setStatusDetail('');
    setProcessingProgress(null);
  };

  /**
   * Handle text/SMS analysis (e.g. pasted e-wallet history or statement text)
   */
  const handleAnalyzeText = async () => {
    if (!transactionText.trim()) return;

    setIsAnalyzing(true);
    setStatusDetail('Categorizing transaction text...');
    setGeneralError(null);
    const today = new Date().toISOString().slice(0, 10);
    const nowTime = new Date().toTimeString().slice(0, 5);

    try {
      const parsed = await callAnalyzeApi(undefined, transactionText);
      if (parsed.statementSource) {
        setDetectedSource(parsed.statementSource);
      }

      const rawList =
        Array.isArray(parsed.transactions) && parsed.transactions.length > 0
          ? parsed.transactions
          : [
              {
                merchant: parsed.merchant || 'Unknown Merchant',
                amount: Number(parsed.amount) || 0,
                type: (parsed.type === 'income' ? 'income' : 'expense') as TransactionType,
                currency: parsed.currency || defaultCurrency,
                date: parsed.date || today,
                time: parsed.time || nowTime,
                category: (parsed.category as ExpenseCategory) || 'Other',
                paymentMethod: (parsed.paymentMethod as PaymentMethod) || 'E-Wallet',
                summary: parsed.summary || transactionText.slice(0, 60),
                tags: parsed.tags || ['text-import'],
                confidence: 'high' as const,
              },
            ];

      const items: ScannedItem[] = rawList.map((tx: any, txIdx: number) => {
        const itemType: TransactionType = tx.type === 'income' ? 'income' : 'expense';
        return {
          id: `text-${Date.now()}-${txIdx}`,
          fileName: rawList.length > 1 ? `Statement item #${txIdx + 1}` : 'Text / SMS Transaction',
          previewImage: '',
          fileSizeMB: 0,
          status: 'done' as const,
          parsedData: tx,
          type: itemType,
          merchant: tx.merchant || 'Unknown Merchant',
          amount: Math.abs(Number(tx.amount)) || 0,
          currency: tx.currency || defaultCurrency,
          date: tx.date || today,
          time: tx.time || nowTime,
          category: (tx.category as ExpenseCategory) || 'Other',
          paymentMethod: (tx.paymentMethod as PaymentMethod) || 'E-Wallet',
          summary: tx.summary || (itemType === 'income' ? `Received from ${tx.merchant}` : `Paid to ${tx.merchant}`),
          items: tx.items || [],
          tags: tx.tags && tx.tags.length > 0 ? tx.tags : ['text-import'],
          selected: true,
          statementSource: parsed.statementSource,
        };
      });

      setScannedItems(items);
      setSelectedIndex(0);
      setReviewMode(items.length > 1 ? 'batch' : 'single');
    } catch (err: any) {
      // Gracefully parse with local offline text parser
      const localResult = parseOcrTextToTransactions(transactionText, defaultCurrency);
      const items: ScannedItem[] = localResult.transactions.map((tx: any, txIdx: number) => {
        const itemType: TransactionType = tx.type === 'income' ? 'income' : 'expense';
        return {
          id: `text-local-${Date.now()}-${txIdx}`,
          fileName: localResult.transactions.length > 1 ? `Statement item #${txIdx + 1}` : 'Text Transaction',
          previewImage: '',
          fileSizeMB: 0,
          status: 'done' as const,
          parsedData: tx,
          type: itemType,
          merchant: tx.merchant || 'Unknown Merchant',
          amount: Math.abs(Number(tx.amount)) || 0,
          currency: tx.currency || defaultCurrency,
          date: tx.date || today,
          time: tx.time || nowTime,
          category: tx.category || 'Other',
          paymentMethod: tx.paymentMethod || 'E-Wallet',
          summary: tx.summary || transactionText.slice(0, 60),
          items: [],
          tags: ['local-text'],
          selected: true,
          statementSource: 'Offline Text Parser',
        };
      });

      setScannedItems(items);
      setSelectedIndex(0);
      setReviewMode(items.length > 1 ? 'batch' : 'single');
      setGeneralError('AI quota reached. Extracted details locally using on-device text parser.');
    } finally {
      setIsAnalyzing(false);
      setStatusDetail('');
    }
  };

  /**
   * Update item fields at a specific index
   */
  const updateItemAtIndex = (index: number, updates: Partial<ScannedItem>) => {
    setScannedItems((prev) =>
      prev.map((item, idx) => (idx === index ? { ...item, ...updates } : item))
    );
  };

  /**
   * Update fields for currently selected receipt
   */
  const updateCurrentItem = (updates: Partial<ScannedItem>) => {
    updateItemAtIndex(selectedIndex, updates);
  };

  const currentItem = scannedItems[selectedIndex];

  // Selection helpers
  const selectedCount = scannedItems.filter((it) => it.selected !== false).length;
  const isAllSelected = scannedItems.length > 0 && selectedCount === scannedItems.length;

  const toggleSelectAll = () => {
    const nextState = !isAllSelected;
    setScannedItems((prev) => prev.map((it) => ({ ...it, selected: nextState })));
  };

  const toggleSelectItem = (index: number) => {
    setScannedItems((prev) =>
      prev.map((it, idx) =>
        idx === index ? { ...it, selected: it.selected === false ? true : false } : it
      )
    );
  };

  // Financial totals breakdown
  const totalExpenseAmount = scannedItems
    .filter((it) => it.selected !== false && it.type === 'expense')
    .reduce((sum, it) => sum + (Number(it.amount) || 0), 0);

  const totalIncomeAmount = scannedItems
    .filter((it) => it.selected !== false && it.type === 'income')
    .reduce((sum, it) => sum + (Number(it.amount) || 0), 0);

  const totalExpenseCount = scannedItems.filter(
    (it) => it.selected !== false && it.type === 'expense'
  ).length;
  const totalIncomeCount = scannedItems.filter(
    (it) => it.selected !== false && it.type === 'income'
  ).length;

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
      type: currentItem.type || 'expense',
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
   * Save all checked transactions in one bulk action
   */
  const handleSaveAll = () => {
    const itemsToSave = scannedItems.filter((it) => it.selected !== false);
    if (itemsToSave.length === 0) {
      setGeneralError('Please select at least one transaction to import.');
      return;
    }

    const formattedExpenses = itemsToSave.map((item) => ({
      type: item.type || 'expense',
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

  /**
   * Retry AI analysis for a specific failed item using its existing preview image
   */
  const handleRetryItem = async (index: number) => {
    const item = scannedItems[index];
    if (!item || !item.previewImage) return;

    const today = new Date().toISOString().slice(0, 10);
    const nowTime = new Date().toTimeString().slice(0, 5);

    updateItemAtIndex(index, {
      status: 'analyzing',
      errorMessage: undefined,
    });

    try {
      const parsed = await callAnalyzeApi(item.previewImage, undefined);
      const rawList: ParsedReceiptData[] =
        Array.isArray(parsed.transactions) && parsed.transactions.length > 0
          ? parsed.transactions
          : [
              {
                merchant: parsed.merchant || item.merchant,
                amount: Math.abs(Number(parsed.amount)) || item.amount,
                type: (parsed.type === 'income' ? 'income' : 'expense') as TransactionType,
                currency: parsed.currency || defaultCurrency,
                date: parsed.date || today,
                time: parsed.time || nowTime,
                category: (parsed.category as ExpenseCategory) || item.category,
                paymentMethod: (parsed.paymentMethod as PaymentMethod) || item.paymentMethod,
                summary: parsed.summary || item.summary,
                items: [],
                tags: parsed.tags && parsed.tags.length > 0 ? parsed.tags : item.tags,
                confidence: 'high' as const,
              },
            ];

      if (rawList.length > 1) {
        const replacements: ScannedItem[] = rawList.map((tx, txIdx) => {
          const itemType: TransactionType = tx.type === 'income' ? 'income' : 'expense';
          return {
            id: `receipt-retry-${Date.now()}-${txIdx}`,
            fileName: `${item.fileName} (#${txIdx + 1})`,
            previewImage: item.previewImage,
            fileSizeMB: item.fileSizeMB,
            status: 'done' as const,
            parsedData: tx,
            type: itemType,
            merchant: tx.merchant || item.fileName,
            amount: Math.abs(Number(tx.amount)) || 0,
            currency: tx.currency || defaultCurrency,
            date: tx.date || today,
            time: tx.time || nowTime,
            category: (tx.category as ExpenseCategory) || 'Other',
            paymentMethod: (tx.paymentMethod as PaymentMethod) || 'E-Wallet',
            summary: tx.summary || (itemType === 'income' ? `Received from ${tx.merchant}` : `Paid to ${tx.merchant}`),
            items: tx.items || [],
            tags: tx.tags && tx.tags.length > 0 ? tx.tags : ['statement-import'],
            selected: true,
            statementSource: parsed.statementSource,
          };
        });

        setScannedItems((prev) => {
          const next = [...prev];
          next.splice(index, 1, ...replacements);
          return next;
        });
      } else {
        const first = rawList[0];
        const itemType: TransactionType = first.type === 'income' ? 'income' : 'expense';
        updateItemAtIndex(index, {
          status: 'done',
          parsedData: first,
          type: itemType,
          merchant: first.merchant || item.merchant,
          amount: Math.abs(Number(first.amount)) || item.amount,
          currency: first.currency || item.currency || defaultCurrency,
          date: first.date || item.date,
          time: first.time || item.time,
          category: (first.category as ExpenseCategory) || item.category,
          paymentMethod: (first.paymentMethod as PaymentMethod) || item.paymentMethod,
          summary: first.summary || item.summary,
          items: first.items || item.items,
          tags: first.tags && first.tags.length > 0 ? first.tags : item.tags,
          statementSource: parsed.statementSource || item.statementSource,
          errorMessage: undefined,
        });
      }
    } catch (err: any) {
      updateItemAtIndex(index, {
        status: 'error',
        errorMessage: err?.message || 'AI service is experiencing high demand. Please retry or enter details manually.',
      });
    }
  };

  /**
   * Run local on-device OCR on a specific item (0 API quota used)
   */
  const handleLocalOcrItem = async (index: number) => {
    const item = scannedItems[index];
    if (!item || !item.previewImage) return;

    const today = new Date().toISOString().slice(0, 10);
    const nowTime = new Date().toTimeString().slice(0, 5);

    updateItemAtIndex(index, {
      status: 'analyzing',
      errorMessage: undefined,
    });

    try {
      const ocrResult = await performLocalOCR(item.previewImage, undefined, defaultCurrency);
      if (ocrResult.transactions.length > 1) {
        const replacements: ScannedItem[] = ocrResult.transactions.map((tx: any, txIdx: number) => {
          const itemType: TransactionType = tx.type === 'income' ? 'income' : 'expense';
          return {
            id: `ocr-retry-${Date.now()}-${txIdx}`,
            fileName: `${item.fileName} (#${txIdx + 1})`,
            previewImage: item.previewImage,
            fileSizeMB: item.fileSizeMB,
            status: 'done' as const,
            parsedData: tx,
            type: itemType,
            merchant: tx.merchant || item.fileName,
            amount: Math.abs(Number(tx.amount)) || 0,
            currency: tx.currency || defaultCurrency,
            date: tx.date || today,
            time: tx.time || nowTime,
            category: (tx.category as ExpenseCategory) || 'Other',
            paymentMethod: (tx.paymentMethod as PaymentMethod) || 'E-Wallet',
            summary: tx.summary || `${tx.merchant} (Offline OCR)`,
            items: [],
            tags: ['local-ocr'],
            selected: true,
            statementSource: ocrResult.statementSource || 'On-Device OCR',
          };
        });

        setScannedItems((prev) => {
          const next = [...prev];
          next.splice(index, 1, ...replacements);
          return next;
        });
      } else {
        const first = ocrResult.transactions[0];
        const itemType: TransactionType = first?.type === 'income' ? 'income' : 'expense';
        updateItemAtIndex(index, {
          status: 'done',
          parsedData: first,
          type: itemType,
          merchant: first?.merchant || item.merchant,
          amount: Math.abs(Number(first?.amount)) || item.amount,
          currency: first?.currency || defaultCurrency,
          date: first?.date || item.date,
          time: first?.time || item.time,
          category: (first?.category as ExpenseCategory) || item.category,
          paymentMethod: (first?.paymentMethod as PaymentMethod) || item.paymentMethod,
          summary: first?.summary || item.summary,
          tags: ['local-ocr'],
          statementSource: ocrResult.statementSource || item.statementSource,
          errorMessage: undefined,
        });
      }
    } catch (err: any) {
      updateItemAtIndex(index, {
        status: 'error',
        errorMessage: 'Local OCR could not read clear text. Please edit details manually.',
      });
    }
  };

  /**
   * Retry all failed items in sequence with Cloud AI
   */
  const handleRetryAllFailed = async () => {
    for (let i = 0; i < scannedItems.length; i++) {
      if (scannedItems[i].status === 'error' && scannedItems[i].previewImage) {
        await handleRetryItem(i);
      }
    }
  };

  /**
   * Run local OCR on all failed items in sequence
   */
  const handleLocalOcrAllFailed = async () => {
    for (let i = 0; i < scannedItems.length; i++) {
      if (scannedItems[i].status === 'error' && scannedItems[i].previewImage) {
        await handleLocalOcrItem(i);
      }
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

  /**
   * Convert scanned transactions into a clean CSV file and download to device
   */
  const handleExportCSV = () => {
    if (scannedItems.length === 0) return;
    const itemsToExport = scannedItems.filter((it) => it.selected !== false);
    const rows = itemsToExport.length > 0 ? itemsToExport : scannedItems;

    const headers = ['Date', 'Time', 'Type', 'Merchant', 'Amount', 'Currency', 'Category', 'Payment Method', 'Notes'];
    const csvLines = [
      headers.join(','),
      ...rows.map((it) => [
        `"${it.date || ''}"`,
        `"${it.time || ''}"`,
        `"${it.type || 'expense'}"`,
        `"${(it.merchant || '').replace(/"/g, '""')}"`,
        (it.amount || 0).toFixed(2),
        `"${it.currency || defaultCurrency}"`,
        `"${it.category || 'Other'}"`,
        `"${it.paymentMethod || 'E-Wallet'}"`,
        `"${(it.summary || '').replace(/"/g, '""')}"`,
      ].join(',')),
    ];

    const blob = new Blob([csvLines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transactions_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Sample receipt/statement loader for testing
  const handleLoadSample = (type: 'tng' | 'grocery' | 'coffee' | 'transport' | 'tech') => {
    const today = new Date().toISOString().slice(0, 10);

    if (type === 'tng') {
      // Direct high-fidelity replica of Touch 'n Go (TNG) eWallet statement screenshot
      const tngItems: ScannedItem[] = [
        {
          id: `sample-tng-1`,
          fileName: 'TNG: TAOBAO',
          previewImage: '',
          fileSizeMB: 0,
          status: 'done',
          type: 'expense',
          merchant: 'TAOBAO',
          amount: 16.69,
          currency: 'MYR',
          date: '2026-09-08',
          time: '21:31',
          category: 'Shopping',
          paymentMethod: 'E-Wallet',
          summary: 'TAOBAO Online Payment (+16 points)',
          items: [],
          tags: ['tng', 'taobao', 'online-shopping'],
          selected: true,
          statementSource: "Touch 'n Go eWallet",
        },
        {
          id: `sample-tng-2`,
          fileName: 'TNG: Exit Toll PANTAI',
          previewImage: '',
          fileSizeMB: 0,
          status: 'done',
          type: 'expense',
          merchant: 'Exit Toll: PANTAI',
          amount: 2.50,
          currency: 'MYR',
          date: '2026-09-08',
          time: '20:16',
          category: 'Transportation',
          paymentMethod: 'E-Wallet',
          summary: 'PayDirect Payment at Pantai toll interchange',
          items: [],
          tags: ['tng', 'toll', 'paydirect'],
          selected: true,
          statementSource: "Touch 'n Go eWallet",
        },
        {
          id: `sample-tng-3`,
          fileName: 'TNG: Receive from HON CHENG YIN',
          previewImage: '',
          fileSizeMB: 0,
          status: 'done',
          type: 'income',
          merchant: 'HON CHENG YIN',
          amount: 2.50,
          currency: 'MYR',
          date: '2026-09-08',
          time: '20:09',
          category: 'Other',
          paymentMethod: 'E-Wallet',
          summary: 'Receive from Wallet (HON CHENG YIN)',
          items: [],
          tags: ['tng', 'transfer-in', 'income'],
          selected: true,
          statementSource: "Touch 'n Go eWallet",
        },
        {
          id: `sample-tng-4`,
          fileName: 'TNG: Transfer to GAN YONG SENG',
          previewImage: '',
          fileSizeMB: 0,
          status: 'done',
          type: 'expense',
          merchant: 'Transfer to GAN YONG SENG',
          amount: 4.20,
          currency: 'MYR',
          date: '2026-09-08',
          time: '09:44',
          category: 'Other',
          paymentMethod: 'E-Wallet',
          summary: 'Transfer to Wallet (GAN YONG SENG)',
          items: [],
          tags: ['tng', 'transfer-out'],
          selected: true,
          statementSource: "Touch 'n Go eWallet",
        },
        {
          id: `sample-tng-5`,
          fileName: 'TNG: Exit Toll DAMANSARA',
          previewImage: '',
          fileSizeMB: 0,
          status: 'done',
          type: 'expense',
          merchant: 'Exit Toll: DAMANSARA',
          amount: 2.00,
          currency: 'MYR',
          date: '2026-09-08',
          time: '07:47',
          category: 'Transportation',
          paymentMethod: 'E-Wallet',
          summary: 'PayDirect Payment at Damansara toll interchange',
          items: [],
          tags: ['tng', 'toll', 'paydirect'],
          selected: true,
          statementSource: "Touch 'n Go eWallet",
        },
        {
          id: `sample-tng-6`,
          fileName: 'TNG: Receive from GAN YONG SENG',
          previewImage: '',
          fileSizeMB: 0,
          status: 'done',
          type: 'income',
          merchant: 'GAN YONG SENG',
          amount: 7.50,
          currency: 'MYR',
          date: '2026-09-07',
          time: '21:32',
          category: 'Other',
          paymentMethod: 'E-Wallet',
          summary: 'Receive from Wallet (GAN YONG SENG)',
          items: [],
          tags: ['tng', 'transfer-in', 'income'],
          selected: true,
          statementSource: "Touch 'n Go eWallet",
        },
      ];

      setDetectedSource("Touch 'n Go eWallet");
      setScannedItems(tngItems);
      setSelectedIndex(0);
      setReviewMode('batch');
      return;
    }

    const samples: Record<
      string,
      {
        text: string;
        category: ExpenseCategory;
        merchant: string;
        amount: number;
        summary: string;
      }
    > = {
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
        amount: 10.0,
        summary: 'Breakfast oat flat white and almond croissant',
      },
      transport: {
        text: `Grab Ride Receipt #GRB-89312\nDate: ${today} 08:30 AM\nFare: $14.20\nToll: $2.50\nPayment: GrabPay Wallet\nTOTAL: $16.70`,
        category: 'Transportation',
        merchant: 'Grab Ride',
        amount: 16.7,
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-[#020617]/85 backdrop-blur-2xl overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="relative w-full max-w-2xl my-auto rounded-3xl border border-white/15 bg-[#0b132b]/95 backdrop-blur-3xl text-slate-100 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.8),0_0_0_1px_rgba(255,255,255,0.1)] overflow-hidden flex flex-col max-h-[92vh]"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-3.5 bg-white/5 backdrop-blur-xl">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
              {scannedItems.length > 1 ? (
                <FileSpreadsheet className="h-4 w-4" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-white truncate">
                {scannedItems.length > 1
                  ? `${scannedItems.length} Scanned Transactions`
                  : scannedItems.length === 1
                  ? 'Review Transaction'
                  : 'Receipt & Statement Scanner'}
              </h2>
              <p className="text-[11px] text-slate-400 truncate">
                {scannedItems.length > 1
                  ? `${totalExpenseCount} expenses · ${totalIncomeCount} income`
                  : 'Scan receipts or statement screenshots automatically'}
              </p>
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
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
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
                <Zap className="h-14 w-14 text-indigo-400/80" />

                {/* Laser scan line animation */}
                <motion.div
                  className="absolute inset-x-0 h-1 bg-gradient-to-r from-transparent via-indigo-400 shadow-[0_0_12px_#818cf8] to-transparent"
                  animate={{ top: ['0%', '100%', '0%'] }}
                  transition={{ repeat: Infinity, duration: 1.8, ease: 'easeInOut' }}
                />
              </div>

              <div className="flex items-center gap-2 text-indigo-300 font-medium text-sm mb-1.5">
                <Loader2 className="h-4 w-4 animate-spin text-indigo-400" />
                {statusDetail || (
                  processingProgress && processingProgress.total > 1
                    ? `Analyzing Document ${processingProgress.current} of ${processingProgress.total}...`
                    : 'Running OCR analysis pipeline...'
                )}
              </div>
              <p className="text-xs text-slate-400 max-w-sm">
                Prioritizing on-device local OCR with smart confidence assessment and automated cloud fallback.
              </p>
            </div>
          ) : scannedItems.length > 0 && currentItem ? (
            /* Scanned Items Review Screen */
            <div className="space-y-3.5">
              {/* Top Banner: Select All, Financial Totals, Export CSV & View Switcher */}
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-white/10 bg-white/5 p-2.5 backdrop-blur-xl text-xs">
                {/* Left: Select all & financial summary */}
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={toggleSelectAll}
                    className="flex items-center gap-1.5 font-medium text-slate-200 hover:text-white transition"
                  >
                    {isAllSelected ? (
                      <CheckSquare className="h-4 w-4 text-indigo-400" />
                    ) : (
                      <Square className="h-4 w-4 text-slate-400" />
                    )}
                    <span>
                      {isAllSelected ? 'Deselect All' : `Select All (${scannedItems.length})`}
                    </span>
                  </button>

                  <span className="text-slate-600 hidden sm:inline">•</span>

                  <span className="text-rose-300 font-semibold">
                    -{defaultCurrency} {totalExpenseAmount.toFixed(2)}
                  </span>

                  {totalIncomeAmount > 0 && (
                    <>
                      <span className="text-slate-600">•</span>
                      <span className="text-emerald-300 font-semibold">
                        +{defaultCurrency} {totalIncomeAmount.toFixed(2)}
                      </span>
                    </>
                  )}
                </div>

                {/* Right: Export CSV & View Toggle */}
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={handleExportCSV}
                    className="inline-flex items-center gap-1 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-slate-200 hover:text-white px-2.5 py-1 text-xs font-medium transition"
                    title="Export detected transactions to CSV file"
                  >
                    <Download className="h-3.5 w-3.5 text-indigo-400" />
                    <span>Export CSV</span>
                  </button>

                  {scannedItems.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setReviewMode(reviewMode === 'batch' ? 'single' : 'batch')}
                      className="rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white px-2.5 py-1 text-xs font-medium transition"
                    >
                      {reviewMode === 'batch' ? 'Single View' : 'Batch List'}
                    </button>
                  )}
                </div>
              </div>

              {/* BATCH LIST VIEW */}
              {reviewMode === 'batch' && scannedItems.length > 1 ? (
                <div className="space-y-2">
                  {/* Failed items notice with bulk retry */}
                  {scannedItems.some((it) => it.status === 'error') && (
                    <div className="flex items-center justify-between gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <AlertCircle className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                        <span className="truncate">Some items failed AI detection due to demand.</span>
                      </div>
                      <button
                        type="button"
                        onClick={handleRetryAllFailed}
                        className="inline-flex items-center gap-1 rounded-lg bg-amber-400/25 hover:bg-amber-400/35 text-amber-100 px-2.5 py-0.5 text-[11px] font-semibold transition shrink-0"
                      >
                        <RotateCcw className="h-3 w-3" />
                        <span>Retry Failed</span>
                      </button>
                    </div>
                  )}

                  {/* Clean streamlined list of transactions */}
                  <div className="space-y-1.5 max-h-[52vh] overflow-y-auto pr-1">
                    {scannedItems.map((item, idx) => {
                      const isSelected = item.selected !== false;
                      const isIncome = item.type === 'income';

                      return (
                        <div
                          key={item.id || idx}
                          className={`group rounded-xl border px-3 py-2 transition backdrop-blur-xl ${
                            isSelected
                              ? 'border-white/10 bg-white/5 hover:border-indigo-500/30 hover:bg-white/8'
                              : 'border-white/5 bg-black/20 opacity-50'
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            {/* Checkbox */}
                            <button
                              type="button"
                              onClick={() => toggleSelectItem(idx)}
                              className="text-slate-400 hover:text-indigo-400 transition shrink-0"
                            >
                              {isSelected ? (
                                <CheckSquare className="h-4 w-4 text-indigo-400" />
                              ) : (
                                <Square className="h-4 w-4 text-slate-500" />
                              )}
                            </button>

                            {/* Quick Type Toggle (- / +) */}
                            <button
                              type="button"
                              onClick={() =>
                                updateItemAtIndex(idx, {
                                  type: isIncome ? 'expense' : 'income',
                                })
                              }
                              className={`h-6 w-6 rounded-lg font-bold shrink-0 flex items-center justify-center transition text-xs border ${
                                isIncome
                                  ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/30'
                                  : 'bg-rose-500/20 border-rose-500/30 text-rose-300 hover:bg-rose-500/30'
                              }`}
                              title={
                                isIncome
                                  ? 'Income (+). Click to toggle to Expense (-)'
                                  : 'Expense (-). Click to toggle to Income (+)'
                              }
                            >
                              {isIncome ? '+' : '-'}
                            </button>

                            {/* Merchant & Date */}
                            <div className="flex-1 min-w-0">
                              <input
                                type="text"
                                value={item.merchant}
                                onChange={(e) =>
                                  updateItemAtIndex(idx, { merchant: e.target.value })
                                }
                                placeholder="Merchant / Recipient"
                                className="w-full bg-transparent font-semibold text-xs text-white placeholder:text-slate-500 focus:outline-none truncate"
                              />
                              <div className="text-[11px] text-slate-400 flex flex-wrap items-center gap-1.5 mt-0.5">
                                <span>{item.date}</span>
                                {item.time && <span>• {item.time}</span>}
                                {item.imageQualityScore !== undefined && (
                                  <span
                                    className={`inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-medium ${
                                      item.imageQualityScore >= 70
                                        ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/20'
                                        : 'bg-amber-500/15 text-amber-300 border border-amber-500/20'
                                    }`}
                                    title={`Image Quality: ${item.imageQualityScore}%`}
                                  >
                                    Quality {item.imageQualityScore}%
                                  </span>
                                )}
                                {item.ocrConfidenceScore !== undefined && (
                                  <span
                                    className={`inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-medium ${
                                      item.executionEngine === 'local_ocr'
                                        ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                                        : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                                    }`}
                                    title={item.confidenceReason || (item.executionEngine === 'local_ocr' ? 'Processed with Local OCR' : 'Enhanced with Cloud AI Vision')}
                                  >
                                    {item.executionEngine === 'local_ocr' ? '⚡ Local OCR' : '☁️ Cloud AI'} ({item.ocrConfidenceScore}%)
                                  </span>
                                )}
                                {item.statementSource && (
                                  <span className="hidden sm:inline text-slate-500">
                                    • {item.statementSource}
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Category Selector */}
                            <select
                              value={item.category}
                              onChange={(e) =>
                                updateItemAtIndex(idx, {
                                  category: e.target.value as ExpenseCategory,
                                })
                              }
                              className="hidden sm:block rounded-lg border border-white/10 bg-[#0b132b] px-2 py-1 text-xs text-slate-300 focus:border-indigo-400 focus:outline-none max-w-[125px]"
                            >
                              {CATEGORY_LIST.map((cat) => (
                                <option key={cat} value={cat}>
                                  {cat}
                                </option>
                              ))}
                            </select>

                            {/* Amount Input */}
                            <div className="flex items-center gap-1 shrink-0">
                              <span
                                className={`text-xs font-bold ${
                                  isIncome ? 'text-emerald-400' : 'text-slate-400'
                                }`}
                              >
                                {item.currency || defaultCurrency}
                              </span>
                              <input
                                type="number"
                                step="0.01"
                                value={item.amount || ''}
                                onChange={(e) =>
                                  updateItemAtIndex(idx, {
                                    amount: parseFloat(e.target.value) || 0,
                                  })
                                }
                                className="w-16 sm:w-20 rounded-lg border border-white/10 bg-black/40 px-2 py-1 text-right text-xs font-bold text-white focus:border-indigo-400 focus:outline-none"
                              />
                            </div>

                            {/* Preview image button (if any) */}
                            {item.previewImage && (
                              <button
                                type="button"
                                onClick={() => setPreviewModalImage(item.previewImage)}
                                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition shrink-0"
                                title="View screenshot"
                              >
                                <Eye className="h-3.5 w-3.5" />
                              </button>
                            )}

                            {/* Delete */}
                            <button
                              type="button"
                              onClick={() => handleRemoveItem(idx)}
                              className="p-1 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition shrink-0"
                              title="Remove item"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>

                          {/* Status indicators if error or analyzing */}
                          {item.status === 'error' && (
                            <div className="flex flex-wrap items-center justify-between gap-2 mt-1.5 pt-1.5 border-t border-white/5 text-[11px] text-amber-200">
                              <span className="truncate max-w-[200px]">
                                {item.errorMessage || 'AI service high demand/timeout.'}
                              </span>
                              {item.previewImage && (
                                <div className="flex items-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => handleLocalOcrItem(idx)}
                                    className="inline-flex items-center gap-1 rounded bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-200 px-2 py-0.5 font-medium transition shrink-0"
                                    title="Scan using on-device OCR without API quota"
                                  >
                                    <Zap className="h-3 w-3" />
                                    <span>Offline OCR</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleRetryItem(idx)}
                                    className="inline-flex items-center gap-1 rounded bg-amber-400/20 hover:bg-amber-400/30 text-amber-100 px-2 py-0.5 font-medium transition shrink-0"
                                  >
                                    <RotateCcw className="h-3 w-3" />
                                    <span>Retry AI</span>
                                  </button>
                                </div>
                              )}
                            </div>
                          )}

                          {item.status === 'analyzing' && (
                            <div className="flex items-center gap-2 mt-1.5 pt-1.5 border-t border-white/5 text-[11px] text-indigo-200">
                              <Loader2 className="h-3 w-3 text-indigo-400 animate-spin shrink-0" />
                              <span>{statusDetail || 'Scanning with OCR/AI...'}</span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                /* SINGLE TRANSACTION DETAILED VIEW */
                <div className="space-y-3.5">
                  {/* Navigator when multiple items exist in single view */}
                  {scannedItems.length > 1 && (
                    <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-3.5 py-2 backdrop-blur-xl">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-slate-200">
                          Transaction {selectedIndex + 1} of {scannedItems.length}
                        </span>
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
                              title={`Go to item ${idx + 1}`}
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
                          title="Remove this item"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Error notice with Retry in single view */}
                  {currentItem.status === 'error' && (
                    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-3.5 py-2.5 text-xs text-amber-200">
                      <div className="flex items-center gap-2 min-w-0 max-w-[280px]">
                        <AlertCircle className="h-4 w-4 text-amber-400 shrink-0" />
                        <span className="truncate">{currentItem.errorMessage || 'AI analysis encountered high demand or timed out.'}</span>
                      </div>
                      {currentItem.previewImage && (
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleLocalOcrItem(selectedIndex)}
                            className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-200 px-2.5 py-1 text-xs font-semibold transition shrink-0"
                            title="Extract text offline without API quota"
                          >
                            <Zap className="h-3.5 w-3.5" />
                            <span>Scan with Offline OCR</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRetryItem(selectedIndex)}
                            className="inline-flex items-center gap-1.5 rounded-xl bg-amber-400/25 hover:bg-amber-400/35 text-amber-100 px-2.5 py-1 text-xs font-semibold transition shrink-0"
                          >
                            <RotateCcw className="h-3.5 w-3.5" />
                            <span>Retry AI</span>
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {currentItem.status === 'analyzing' && (
                    <div className="flex items-center gap-2 rounded-2xl border border-indigo-500/30 bg-indigo-500/10 px-3.5 py-2.5 text-xs text-indigo-200">
                      <Loader2 className="h-4 w-4 text-indigo-400 animate-spin shrink-0" />
                      <span>{statusDetail || 'Scanning transaction with OCR/AI...'}</span>
                    </div>
                  )}

                  {/* Engine & Quality Confidence Status Banner */}
                  {(currentItem.imageQualityScore !== undefined || currentItem.ocrConfidenceScore !== undefined) && (
                    <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs">
                      <div className="flex items-center gap-2">
                        {currentItem.executionEngine === 'local_ocr' ? (
                          <span className="inline-flex items-center gap-1 font-semibold text-indigo-300">
                            <Zap className="h-3.5 w-3.5 text-indigo-400" />
                            Local On-Device OCR
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 font-semibold text-cyan-300">
                            <Cpu className="h-3.5 w-3.5 text-cyan-400" />
                            Cloud AI Vision (Fallback)
                          </span>
                        )}
                        {currentItem.ocrConfidenceScore !== undefined && (
                          <span className="text-slate-400 text-[11px]">
                            • Confidence: <strong className="text-white">{currentItem.ocrConfidenceScore}%</strong>
                          </span>
                        )}
                      </div>
                      {currentItem.imageQualityScore !== undefined && (
                        <span
                          className={`text-[11px] font-medium px-2 py-0.5 rounded-full border ${
                            currentItem.imageQualityScore >= 70
                              ? 'bg-emerald-500/15 border-emerald-500/25 text-emerald-300'
                              : 'bg-amber-500/15 border-amber-500/25 text-amber-300'
                          }`}
                        >
                          Quality: {currentItem.imageQualityScore}%
                        </span>
                      )}
                    </div>
                  )}

                  {/* Transaction Type: Expense vs Income */}
                  <div>
                    <label className="text-xs font-medium text-slate-300 block mb-1">
                      Transaction Type
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => updateCurrentItem({ type: 'expense' })}
                        className={`flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-semibold border transition ${
                          currentItem.type === 'expense'
                            ? 'bg-rose-500/20 border-rose-500/40 text-rose-300 shadow-sm'
                            : 'border-white/10 text-slate-400 hover:text-white hover:bg-white/5'
                        }`}
                      >
                        <ArrowDownLeft className="h-3.5 w-3.5" />
                        Expense (Payment / Toll / Transfer Out)
                      </button>
                      <button
                        type="button"
                        onClick={() => updateCurrentItem({ type: 'income' })}
                        className={`flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-semibold border transition ${
                          currentItem.type === 'income'
                            ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300 shadow-sm'
                            : 'border-white/10 text-slate-400 hover:text-white hover:bg-white/5'
                        }`}
                      >
                        <ArrowUpRight className="h-3.5 w-3.5" />
                        Income (Received / Top Up / Refund)
                      </button>
                    </div>
                  </div>

                  {/* Form fields for review */}
                  <div className="space-y-3">
                    {/* Merchant / Vendor */}
                    <div>
                      <label className="text-xs font-medium text-slate-300 block mb-1">
                        Merchant / Sender / Recipient
                      </label>
                      <input
                        type="text"
                        value={currentItem.merchant}
                        onChange={(e) => updateCurrentItem({ merchant: e.target.value })}
                        placeholder="e.g. TAOBAO, Exit Toll: PANTAI, Starbucks"
                        className="w-full rounded-xl border border-white/10 bg-white/5 backdrop-blur-xl px-3 py-2 text-xs text-white placeholder:text-slate-500 focus:border-indigo-400 focus:outline-none"
                      />
                    </div>

                    {/* Amount */}
                    <div>
                      <label className="text-xs font-medium text-slate-300 block mb-1">Amount</label>
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
                        <label className="text-xs font-medium text-slate-300 block mb-1">
                          Category
                        </label>
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
                        <label className="text-xs font-medium text-slate-300 block mb-1">
                          Payment Method
                        </label>
                        <select
                          value={currentItem.paymentMethod}
                          onChange={(e) =>
                            updateCurrentItem({ paymentMethod: e.target.value as PaymentMethod })
                          }
                          className="w-full rounded-xl border border-white/10 bg-[#0b132b] px-3 py-2 text-xs text-white focus:border-indigo-400 focus:outline-none"
                        >
                          <option value="E-Wallet">E-Wallet (TNG, GrabPay, Boost)</option>
                          <option value="Credit Card">Credit Card</option>
                          <option value="Debit Card">Debit Card</option>
                          <option value="Bank Transfer">Bank Transfer</option>
                          <option value="Cash">Cash</option>
                          <option value="Other">Other</option>
                        </select>
                      </div>
                    </div>

                    {/* View receipt / screenshot — expandable */}
                    {currentItem.previewImage && (
                      <div>
                        <button
                          type="button"
                          onClick={() => setIsReceiptExpanded(!isReceiptExpanded)}
                          className="w-full flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-300 hover:bg-white/10 hover:text-white transition"
                        >
                          <span className="flex items-center gap-2">
                            <Receipt className="h-4 w-4 text-indigo-400" />
                            <span className="font-medium">View original screenshot / image</span>
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
                                alt="Scanned document preview"
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
                        Note / Description
                      </label>
                      <input
                        type="text"
                        value={currentItem.summary}
                        onChange={(e) => updateCurrentItem({ summary: e.target.value })}
                        placeholder="e.g. TAOBAO Online purchase or Pantai toll payment"
                        className="w-full rounded-xl border border-white/10 bg-white/5 backdrop-blur-xl px-3 py-2 text-xs text-white placeholder:text-slate-500 focus:border-indigo-400 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              )}
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
                  Upload Photo / CSV
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('camera')}
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
                accept="image/*,.pdf,.csv,.xlsx,.xls,.tsv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"
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
                <div className="space-y-3">
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                        handleFilesSelected(e.dataTransfer.files);
                      }
                    }}
                    className="group flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-white/15 bg-white/5 backdrop-blur-xl p-8 text-center cursor-pointer transition hover:border-indigo-400/50 hover:bg-white/8"
                  >
                    <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-500/20 text-indigo-400 transition group-hover:scale-105 border border-indigo-500/30">
                      <Upload className="h-6 w-6" />
                    </div>
                    <p className="text-sm font-semibold text-white mb-1">
                      Upload Receipts, Screenshots, Excel or CSV
                    </p>
                    <p className="text-xs text-slate-400 max-w-sm mb-4">
                      Drag & drop receipt photos, e-wallet screenshots, bank CSV statements, or Excel (.xlsx / .xls) spreadsheets.
                    </p>

                    <span className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 px-4 py-2 text-xs font-semibold text-white shadow-md transition">
                      Browse Files
                    </span>
                  </div>

                  {/* Sample Excel / CSV template download & format prompt */}
                  <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-white">
                        <FileSpreadsheet className="h-4 w-4 text-emerald-400" />
                        <span>Need a sample Excel template?</span>
                      </div>
                      <p className="text-[11px] text-slate-400">
                        Download pre-formatted sample with columns: Date, Merchant, Amount, Category, Method.
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          downloadExcelTemplate(defaultCurrency);
                        }}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 px-3 py-1.5 text-xs font-semibold transition shadow-sm active:scale-95"
                      >
                        <Download className="h-3.5 w-3.5" />
                        <span>Sample .XLSX</span>
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          downloadCsvTemplate(defaultCurrency);
                        }}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-slate-300 border border-white/15 px-2.5 py-1.5 text-xs font-semibold transition active:scale-95"
                      >
                        <Download className="h-3.5 w-3.5" />
                        <span>.CSV</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Camera view with Live Image Quality Feedback HUD */}
              {activeTab === 'camera' && (
                <div className="space-y-2">
                  <CameraScannerView
                    onCapture={(file) => handleFilesSelected([file])}
                    onCancel={() => setActiveTab('upload')}
                  />
                  <p className="text-[11px] text-center text-slate-400">
                    💡 Hold steady in good lighting for maximum local OCR accuracy.
                  </p>
                </div>
              )}

              {/* Text / SMS paste view */}
              {activeTab === 'text' && (
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-medium text-slate-300 block mb-1">
                      Paste Bank Transaction SMS, e-Wallet Notification, or Statement Text:
                    </label>
                    <textarea
                      rows={5}
                      value={transactionText}
                      onChange={(e) => setTransactionText(e.target.value)}
                      placeholder={`Example:\n"08 Sep, 21:31 | TAOBAO | -RM16.69\n08 Sep, 20:16 | Exit Toll: PANTAI | -RM2.50\n08 Sep, 20:09 | Receive from HON CHENG YIN | +RM2.50"`}
                      className="w-full rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-3 text-xs text-white placeholder:text-slate-500 focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400/40"
                    />
                  </div>
                  <button
                    type="button"
                    disabled={!transactionText.trim()}
                    onClick={handleAnalyzeText}
                    className="w-full flex items-center justify-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 py-2.5 text-xs font-semibold text-white shadow-md transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Sparkles className="h-4 w-4" />
                    Auto-Extract All Transactions
                  </button>
                </div>
              )}

              {/* Subtle sample testing link */}
              <div className="flex items-center justify-center gap-1.5 pt-1 text-xs text-slate-400">
                <span>Testing without an image?</span>
                <button
                  type="button"
                  onClick={() => handleLoadSample('tng')}
                  className="text-indigo-400 hover:text-indigo-300 font-medium underline underline-offset-2 transition"
                >
                  Load sample TNG statement
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        {scannedItems.length > 0 && !isAnalyzing && (
          <div className="border-t border-white/10 px-4 sm:px-5 py-3.5 bg-white/5 backdrop-blur-xl flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 text-xs font-medium text-indigo-400 hover:text-indigo-300 transition py-2 px-1 shrink-0"
            >
              <Plus className="h-4 w-4" />
              Add more
            </button>

            {scannedItems.length > 1 ? (
              <button
                type="button"
                onClick={handleSaveAll}
                disabled={selectedCount === 0}
                className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-5 py-2.5 text-xs font-semibold text-white shadow-lg shadow-emerald-500/25 transition hover:from-emerald-500 hover:to-teal-500 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Check className="h-4 w-4" />
                Import {selectedCount === scannedItems.length ? `All (${scannedItems.length})` : `${selectedCount}`} Transactions
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSaveCurrent}
                className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 px-5 py-2.5 text-xs font-semibold text-white shadow-lg shadow-indigo-500/25 transition hover:from-indigo-500 hover:to-purple-500 active:scale-95"
              >
                <Check className="h-4 w-4" />
                Save transaction
              </button>
            )}
          </div>
        )}
      </motion.div>

      {/* Fullscreen image inspection modal */}
      <AnimatePresence>
        {previewModalImage && (
          <div
            onClick={() => setPreviewModalImage(null)}
            className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="relative max-w-xl max-h-[85vh] overflow-hidden rounded-2xl border border-white/20 bg-slate-950 p-2 shadow-2xl"
            >
              <button
                type="button"
                onClick={() => setPreviewModalImage(null)}
                className="absolute top-4 right-4 z-10 p-1.5 rounded-full bg-black/60 text-white hover:bg-black/90 transition"
              >
                <X className="h-5 w-5" />
              </button>
              <img
                src={previewModalImage}
                alt="Full receipt or screenshot"
                className="max-h-[80vh] w-auto mx-auto object-contain rounded-xl"
              />
            </div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
