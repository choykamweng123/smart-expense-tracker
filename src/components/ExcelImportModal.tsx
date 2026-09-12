import React, { useRef, useState } from 'react';
import {
  FileSpreadsheet,
  Download,
  Upload,
  X,
  Check,
  AlertCircle,
  CheckCircle2,
  Trash2,
  ChevronDown,
  ChevronUp,
  FileText,
  Table,
  HelpCircle,
  Sparkles,
  ArrowUpRight,
  ArrowDownLeft,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Expense, ExpenseCategory, PaymentMethod, TransactionType } from '../types';
import { CATEGORY_LIST } from '../data/categories';
import {
  parseSpreadsheetFile,
  downloadExcelTemplate,
  downloadCsvTemplate,
  SPREADSHEET_TABLE_FORMAT,
} from '../utils/spreadsheetParser';
import { ParsedCsvTransaction } from '../utils/csvParser';

interface ExcelImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportExpenses: (expenses: Array<Omit<Expense, 'id' | 'createdAt'>>) => void;
  defaultCurrency: string;
  isDark?: boolean;
}

interface EditableImportRow extends ParsedCsvTransaction {
  id: string;
  selected: boolean;
}

export const ExcelImportModal: React.FC<ExcelImportModalProps> = ({
  isOpen,
  onClose,
  onImportExpenses,
  defaultCurrency,
  isDark = true,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [showFormatGuide, setShowFormatGuide] = useState(false);

  // Staged transactions for review
  const [importedRows, setImportRows] = useState<EditableImportRow[]>([]);
  const [fileName, setFileName] = useState<string>('');

  if (!isOpen) return null;

  const handleReset = () => {
    setImportRows([]);
    setFileName('');
    setErrorMessage(null);
    setSuccessMessage(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const processFile = async (file: File) => {
    const validExtensions = ['.xlsx', '.xls', '.csv', '.tsv'];
    const hasValidExt = validExtensions.some((ext) => file.name.toLowerCase().endsWith(ext));

    if (!hasValidExt) {
      setErrorMessage('Please upload a valid Excel (.xlsx, .xls) or CSV (.csv) file.');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const result = await parseSpreadsheetFile(file, defaultCurrency);
      if (result.transactions.length === 0) {
        setErrorMessage('No valid transactions found in the file. Please check that amounts are present.');
        setIsLoading(false);
        return;
      }

      const rows: EditableImportRow[] = result.transactions.map((t, idx) => ({
        ...t,
        id: `row-${Date.now()}-${idx}`,
        selected: true,
      }));

      setFileName(file.name);
      setImportRows(rows);
      setSuccessMessage(`Successfully parsed ${rows.length} transactions from "${file.name}"!`);
    } catch (err: any) {
      console.error('Spreadsheet parse error:', err);
      setErrorMessage(err?.message || 'Failed to read spreadsheet. Please check the table format.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const updateRow = (id: string, updates: Partial<EditableImportRow>) => {
    setImportRows((prev) => prev.map((row) => (row.id === id ? { ...row, ...updates } : row)));
  };

  const deleteRow = (id: string) => {
    setImportRows((prev) => prev.filter((row) => row.id !== id));
  };

  const toggleSelectAll = () => {
    const allSelected = importedRows.length > 0 && importedRows.every((r) => r.selected);
    setImportRows((prev) => prev.map((r) => ({ ...r, selected: !allSelected })));
  };

  // Financial calculations
  const selectedRows = importedRows.filter((r) => r.selected);
  const totalExpense = selectedRows
    .filter((r) => r.type === 'expense')
    .reduce((sum, r) => sum + r.amount, 0);
  const totalIncome = selectedRows
    .filter((r) => r.type === 'income')
    .reduce((sum, r) => sum + r.amount, 0);

  const handleConfirmImport = () => {
    if (selectedRows.length === 0) {
      setErrorMessage('Please select at least one transaction to import.');
      return;
    }

    const formattedExpenses: Array<Omit<Expense, 'id' | 'createdAt'>> = selectedRows.map((r) => ({
      type: r.type,
      merchant: r.merchant.trim() || 'Imported Transaction',
      amount: r.amount,
      currency: r.currency || defaultCurrency,
      date: r.date,
      time: r.time || '',
      category: r.category,
      paymentMethod: r.paymentMethod,
      summary: r.summary || (r.type === 'income' ? `Received from ${r.merchant}` : `Paid to ${r.merchant}`),
      tags: r.tags || ['spreadsheet-import'],
      confidence: 'high',
    }));

    onImportExpenses(formattedExpenses);
    handleReset();
    onClose();
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className={`relative w-full max-w-2xl rounded-3xl border shadow-2xl overflow-hidden my-auto ${
            isDark ? 'bg-[#0b132b] border-white/15 text-white' : 'bg-white border-slate-200 text-slate-900'
          }`}
        >
          {/* Header */}
          <div
            className={`flex items-center justify-between px-5 py-4 border-b ${
              isDark ? 'border-white/10 bg-white/5' : 'border-slate-100 bg-slate-50'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                <FileSpreadsheet className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-sm font-bold tracking-tight">Import Excel & CSV File</h2>
                <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  Upload bank statements, custom spreadsheets (.xlsx, .xls, .csv)
                </p>
              </div>
            </div>

            <button
              onClick={() => {
                handleReset();
                onClose();
              }}
              className="rounded-full p-2 text-slate-400 hover:text-white hover:bg-white/10 transition"
              title="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Modal Body */}
          <div className="p-4 sm:p-5 space-y-4 max-h-[75vh] overflow-y-auto">
            {/* Error Message */}
            {errorMessage && (
              <div className="flex items-start gap-2 rounded-2xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <div className="flex-1">{errorMessage}</div>
                <button
                  onClick={() => setErrorMessage(null)}
                  className="text-rose-400 hover:text-white"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}

            {/* Success Message */}
            {successMessage && (
              <div className="flex items-center gap-2 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-300">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span>{successMessage}</span>
              </div>
            )}

            {/* Uploader Section when no rows loaded */}
            {importedRows.length === 0 ? (
              <div className="space-y-3.5">
                {/* Download Sample Banner - right at the upload section */}
                <div
                  className={`rounded-2xl border p-3.5 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                    isDark
                      ? 'border-indigo-500/30 bg-indigo-500/10 text-white'
                      : 'border-indigo-200 bg-indigo-50/80 text-slate-800'
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 shrink-0">
                        <FileSpreadsheet className="h-4 w-4" />
                      </div>
                      <span className="text-xs font-bold">Download Sample Template to Fill In</span>
                      <span className="rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-semibold">
                        Ready-to-fill
                      </span>
                    </div>
                    <p className={`text-[11px] ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                      Download the template, fill in your transactions in Excel, and upload the file below.
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => downloadExcelTemplate(defaultCurrency)}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white px-3.5 py-2 text-xs font-semibold transition shadow-md active:scale-95"
                    >
                      <Download className="h-3.5 w-3.5" />
                      <span>Download .XLSX</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => downloadCsvTemplate(defaultCurrency)}
                      className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition active:scale-95 ${
                        isDark
                          ? 'border-white/15 bg-white/10 hover:bg-white/15 text-slate-200'
                          : 'border-slate-300 bg-white hover:bg-slate-100 text-slate-700'
                      }`}
                    >
                      <Download className="h-3.5 w-3.5" />
                      <span>.CSV</span>
                    </button>
                  </div>
                </div>

                {/* Drag & Drop Upload Zone */}
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`relative flex flex-col items-center justify-center p-7 rounded-3xl border-2 border-dashed transition-all cursor-pointer text-center ${
                    isDragging
                      ? 'border-emerald-400 bg-emerald-500/10 scale-[1.01]'
                      : isDark
                      ? 'border-white/15 bg-white/5 hover:border-emerald-400/60 hover:bg-white/10'
                      : 'border-slate-300 bg-slate-50 hover:border-emerald-500 hover:bg-slate-100'
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx, .xls, .csv, .tsv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel, text/csv"
                    onChange={handleFileChange}
                    className="hidden"
                  />

                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 mb-2.5 shadow-lg">
                    {isLoading ? (
                      <div className="h-6 w-6 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Upload className="h-6 w-6" />
                    )}
                  </div>

                  <h3 className="text-sm font-bold text-white mb-1">
                    {isLoading ? 'Processing Spreadsheet...' : 'Upload Filled Excel or CSV File'}
                  </h3>
                  <p className="text-xs text-slate-400 max-w-sm mb-3">
                    Drag & drop your <span className="font-semibold text-emerald-400">.xlsx</span>, <span className="font-semibold text-emerald-400">.xls</span>, or <span className="font-semibold text-emerald-400">.csv</span> file here, or click to browse.
                  </p>

                  {/* Required Column Format Tags */}
                  <div className="flex flex-wrap items-center justify-center gap-1.5 max-w-md pt-1 border-t border-white/5">
                    <span className="text-[10px] text-slate-400 font-medium mr-1">Expected columns:</span>
                    <span className="rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-1.5 py-0.5 text-[10px] font-semibold">Date *</span>
                    <span className="rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-1.5 py-0.5 text-[10px] font-semibold">Merchant *</span>
                    <span className="rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-1.5 py-0.5 text-[10px] font-semibold">Amount *</span>
                    <span className="rounded-lg bg-white/10 text-slate-300 px-1.5 py-0.5 text-[10px]">Type</span>
                    <span className="rounded-lg bg-white/10 text-slate-300 px-1.5 py-0.5 text-[10px]">Category</span>
                    <span className="rounded-lg bg-white/10 text-slate-300 px-1.5 py-0.5 text-[10px]">Method</span>
                    <span className="rounded-lg bg-white/10 text-slate-300 px-1.5 py-0.5 text-[10px]">Notes</span>
                  </div>
                </div>

                {/* Format Details Explainer */}
                <div
                  className={`rounded-2xl border p-3.5 transition ${
                    isDark ? 'border-white/10 bg-white/5' : 'border-slate-200 bg-slate-50'
                  }`}
                >
                  {/* Format Accordion Toggle */}
                  <button
                    type="button"
                    onClick={() => setShowFormatGuide(!showFormatGuide)}
                    className="w-full flex items-center justify-between text-xs text-indigo-400 hover:text-indigo-300 transition font-medium"
                  >
                    <span className="flex items-center gap-1.5">
                      <HelpCircle className="h-3.5 w-3.5" />
                      View full Excel column specifications & accepted header names
                    </span>
                    {showFormatGuide ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </button>

                  {/* Format Guide Details */}
                  {showFormatGuide && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="mt-3 space-y-2.5 text-xs text-slate-300 border-t border-white/5 pt-3"
                    >
                      <p className="text-[11px] text-slate-400">
                        The Excel table supports the following standard header columns (order does not matter and column names are flexible):
                      </p>

                      <div className="rounded-xl border border-white/10 bg-black/40 overflow-x-auto">
                        <table className="w-full text-left text-[11px]">
                          <thead className="bg-white/5 text-slate-400 border-b border-white/10 font-semibold">
                            <tr>
                              <th className="px-3 py-2">Column Name</th>
                              <th className="px-3 py-2">Status</th>
                              <th className="px-3 py-2">Example</th>
                              <th className="px-3 py-2">Description</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-white/5 text-slate-300">
                            {SPREADSHEET_TABLE_FORMAT.map((col) => (
                              <tr key={col.name} className="hover:bg-white/5">
                                <td className="px-3 py-1.5 font-bold text-white flex items-center gap-1">
                                  <span>{col.name}</span>
                                </td>
                                <td className="px-3 py-1.5">
                                  {col.required ? (
                                    <span className="rounded bg-rose-500/20 text-rose-300 px-1.5 py-0.5 text-[10px] font-semibold">
                                      Required
                                    </span>
                                  ) : (
                                    <span className="rounded bg-slate-500/20 text-slate-400 px-1.5 py-0.5 text-[10px]">
                                      Optional
                                    </span>
                                  )}
                                </td>
                                <td className="px-3 py-1.5 font-mono text-emerald-400">{col.example}</td>
                                <td className="px-3 py-1.5 text-slate-400">{col.description}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      <div className="bg-white/5 rounded-xl p-3 border border-white/5 text-[11px] text-slate-300 space-y-1">
                        <div className="font-semibold text-white flex items-center gap-1.5">
                          <Sparkles className="h-3.5 w-3.5 text-indigo-400" />
                          Flexible Header Recognition:
                        </div>
                        <p className="text-slate-400">
                          The system also automatically recognizes bank statement formats, such as separated <strong>Debit</strong> / <strong>Credit</strong> columns, <strong>Tarikh</strong> (Date), <strong>Jumlah</strong> (Amount), <strong>Kategori</strong> (Category), and <strong>Description</strong>.
                        </p>
                      </div>
                    </motion.div>
                  )}
                </div>
              </div>
            ) : (
              /* Review & Confirmation Table */
              <div className="space-y-4">
                {/* Summary bar */}
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-white/10 bg-white/5 p-3 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white truncate max-w-[200px] sm:max-w-xs">
                      {fileName}
                    </span>
                    <span className="rounded-full bg-indigo-500/20 text-indigo-300 px-2 py-0.5 text-[11px] font-semibold border border-indigo-500/30">
                      {selectedRows.length} of {importedRows.length} selected
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    {totalIncome > 0 && (
                      <span className="flex items-center gap-1 text-emerald-400 font-bold text-xs">
                        <ArrowUpRight className="h-3.5 w-3.5" />
                        +{defaultCurrency} {totalIncome.toFixed(2)}
                      </span>
                    )}
                    <span className="flex items-center gap-1 text-rose-400 font-bold text-xs">
                      <ArrowDownLeft className="h-3.5 w-3.5" />
                      -{defaultCurrency} {totalExpense.toFixed(2)}
                    </span>
                  </div>
                </div>

                {/* Batch Action Toolbar */}
                <div className="flex items-center justify-between text-xs">
                  <button
                    type="button"
                    onClick={toggleSelectAll}
                    className="text-slate-300 hover:text-white font-medium flex items-center gap-1.5"
                  >
                    <CheckCircle2 className="h-4 w-4 text-indigo-400" />
                    <span>
                      {importedRows.every((r) => r.selected) ? 'Deselect All' : 'Select All'}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={handleReset}
                    className="text-slate-400 hover:text-rose-400 transition flex items-center gap-1"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>Clear & Upload Another</span>
                  </button>
                </div>

                {/* Transaction Rows */}
                <div className="space-y-2 max-h-[45vh] overflow-y-auto pr-1">
                  {importedRows.map((row) => {
                    const isIncome = row.type === 'income';
                    return (
                      <div
                        key={row.id}
                        className={`flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 p-3 rounded-2xl border transition ${
                          row.selected
                            ? isDark
                              ? 'border-indigo-500/30 bg-white/5'
                              : 'border-indigo-200 bg-indigo-50/40'
                            : 'border-white/5 bg-black/20 opacity-60'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 flex-1 min-w-0">
                          {/* Selection Checkbox */}
                          <input
                            type="checkbox"
                            checked={row.selected}
                            onChange={() => updateRow(row.id, { selected: !row.selected })}
                            className="h-4 w-4 rounded border-white/20 bg-white/10 text-indigo-500 focus:ring-0 shrink-0"
                          />

                          {/* Quick Type Toggle */}
                          <button
                            type="button"
                            onClick={() =>
                              updateRow(row.id, {
                                type: isIncome ? 'expense' : 'income',
                              })
                            }
                            className={`h-6 w-6 rounded-lg font-bold shrink-0 flex items-center justify-center transition text-xs border ${
                              isIncome
                                ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                                : 'bg-rose-500/20 border-rose-500/40 text-rose-300'
                            }`}
                            title={isIncome ? 'Income (+). Click for Expense' : 'Expense (-). Click for Income'}
                          >
                            {isIncome ? '+' : '-'}
                          </button>

                          {/* Merchant & Date */}
                          <div className="flex-1 min-w-0">
                            <input
                              type="text"
                              value={row.merchant}
                              onChange={(e) => updateRow(row.id, { merchant: e.target.value })}
                              placeholder="Merchant"
                              className="w-full bg-transparent font-semibold text-xs text-white placeholder:text-slate-500 focus:outline-none truncate"
                            />
                            <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5">
                              <span>{row.date}</span>
                              {row.time && <span>• {row.time}</span>}
                              <span className="hidden sm:inline text-slate-500">• {row.paymentMethod}</span>
                            </div>
                          </div>
                        </div>

                        {/* Controls */}
                        <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0 pl-7 sm:pl-0">
                          {/* Category select */}
                          <select
                            value={row.category}
                            onChange={(e) =>
                              updateRow(row.id, { category: e.target.value as ExpenseCategory })
                            }
                            className="rounded-lg border border-white/10 bg-[#0b132b] px-2 py-1 text-xs text-slate-300 focus:border-indigo-400 focus:outline-none max-w-[130px]"
                          >
                            {CATEGORY_LIST.map((cat) => (
                              <option key={cat} value={cat}>
                                {cat}
                              </option>
                            ))}
                          </select>

                          {/* Amount */}
                          <div className="flex items-center gap-1">
                            <span
                              className={`text-xs font-bold ${
                                isIncome ? 'text-emerald-400' : 'text-slate-400'
                              }`}
                            >
                              {row.currency || defaultCurrency}
                            </span>
                            <input
                              type="number"
                              step="0.01"
                              value={row.amount || ''}
                              onChange={(e) =>
                                updateRow(row.id, { amount: parseFloat(e.target.value) || 0 })
                              }
                              className="w-20 rounded-lg border border-white/10 bg-black/40 px-2 py-1 text-right text-xs font-bold text-white focus:border-indigo-400 focus:outline-none"
                            />
                          </div>

                          {/* Delete */}
                          <button
                            type="button"
                            onClick={() => deleteRow(row.id)}
                            className="p-1 rounded-lg text-slate-500 hover:text-rose-400 transition"
                            title="Remove row"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Footer Buttons */}
          <div
            className={`flex items-center justify-end gap-3 px-5 py-3.5 border-t ${
              isDark ? 'border-white/10 bg-white/5' : 'border-slate-100 bg-slate-50'
            }`}
          >
            <button
              type="button"
              onClick={() => {
                handleReset();
                onClose();
              }}
              className="rounded-xl px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-white/10 transition"
            >
              Cancel
            </button>

            {importedRows.length > 0 && (
              <button
                type="button"
                onClick={handleConfirmImport}
                disabled={selectedRows.length === 0}
                className="flex items-center gap-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 px-4 py-2 text-xs font-bold transition shadow-lg shadow-emerald-500/20"
              >
                <Check className="h-4 w-4" />
                <span>Import {selectedRows.length} Transactions</span>
              </button>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
