import React, { useState, useEffect } from 'react';
import {
  X,
  Trash2,
  Edit2,
  Check,
  Receipt,
  Calendar,
  Clock,
  CreditCard,
  Tag,
  ExternalLink,
  ArrowDownLeft,
  ArrowUpRight,
  Repeat,
} from 'lucide-react';
import { motion } from 'motion/react';
import { Expense, ExpenseCategory, PaymentMethod, CategoryItem, TransactionType } from '../types';
import { getCategoryMeta } from '../data/categories';

interface ExpenseDetailModalProps {
  expense: Expense | null;
  onClose: () => void;
  onUpdate: (id: string, updated: Partial<Expense>) => void;
  onDelete: (id: string) => void;
  currencySymbol: string;
  customCategories?: CategoryItem[];
  isDark?: boolean;
}

export const ExpenseDetailModal: React.FC<ExpenseDetailModalProps> = ({
  expense,
  onClose,
  onUpdate,
  onDelete,
  currencySymbol,
  customCategories = [],
  isDark = true,
}) => {
  if (!expense) return null;

  const [isEditing, setIsEditing] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [editedType, setEditedType] = useState<TransactionType>(expense.type || 'expense');
  const [editedMerchant, setEditedMerchant] = useState(expense.merchant);
  const [editedAmount, setEditedAmount] = useState(expense.amount);
  const [editedCategory, setEditedCategory] = useState<ExpenseCategory>(expense.category);
  const [editedPaymentMethod, setEditedPaymentMethod] = useState<PaymentMethod>(expense.paymentMethod);
  const [editedDate, setEditedDate] = useState(expense.date);
  const [editedTime, setEditedTime] = useState(expense.time || '');
  const [editedSummary, setEditedSummary] = useState(expense.summary || '');
  const [showImageFull, setShowImageFull] = useState(false);

  useEffect(() => {
    if (expense) {
      setEditedType(expense.type || 'expense');
      setEditedMerchant(expense.merchant);
      setEditedAmount(expense.amount);
      setEditedCategory(expense.category);
      setEditedPaymentMethod(expense.paymentMethod);
      setEditedDate(expense.date);
      setEditedTime(expense.time || '');
      setEditedSummary(expense.summary || '');
      setIsEditing(false);
      setShowDeleteConfirm(false);
    }
  }, [expense]);

  const activeCategory = isEditing ? editedCategory : expense.category;
  const categoryMeta = getCategoryMeta(activeCategory, customCategories);
  const Icon = categoryMeta.icon;
  const isIncome = (isEditing ? editedType : expense.type) === 'income';

  const handleSave = () => {
    onUpdate(expense.id, {
      type: editedType,
      merchant: editedMerchant,
      amount: Number(editedAmount) || 0,
      category: editedCategory,
      paymentMethod: editedPaymentMethod,
      date: editedDate,
      time: editedTime,
      summary: editedSummary,
    });
    setIsEditing(false);
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
          <div className="flex items-center gap-2.5">
            <div
              className={`flex h-9 w-9 items-center justify-center rounded-xl ${categoryMeta.bgColor} ${categoryMeta.color} border ${categoryMeta.borderColor}`}
            >
              <Icon className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h2 className="text-base font-semibold truncate max-w-[170px]">
                  {isEditing ? (isIncome ? 'Edit Income' : 'Edit Expense') : expense.merchant}
                </h2>
                <span
                  className={`inline-flex items-center text-[9px] font-bold px-1.5 py-0.5 rounded border ${
                    isIncome
                      ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                      : 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30'
                  }`}
                >
                  {isIncome ? 'Income' : 'Expense'}
                </span>
                {expense.isRecurring && (
                  <span className="rounded-full bg-purple-500/20 border border-purple-500/30 px-2 py-0.5 text-[10px] font-semibold text-purple-300 flex items-center gap-1 capitalize">
                    <Repeat className="h-3 w-3" />
                    {expense.recurringInterval || 'Recurring'}
                  </span>
                )}
              </div>
              <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                {expense.category}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {!isEditing ? (
              <>
                <button
                  type="button"
                  onClick={() => setIsEditing(true)}
                  className={`rounded-xl p-2 transition ${
                    isDark
                      ? 'text-slate-400 hover:bg-white/10 hover:text-white'
                      : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'
                  }`}
                  title="Edit transaction"
                >
                  <Edit2 className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm((prev) => !prev)}
                  className={`rounded-xl p-2 transition ${
                    showDeleteConfirm
                      ? 'bg-rose-500/30 text-rose-300'
                      : 'text-rose-400 hover:bg-rose-500/15 hover:text-rose-300'
                  }`}
                  title="Delete transaction"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={handleSave}
                className="flex items-center gap-1 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 px-3 py-1.5 text-xs font-semibold text-white shadow-lg transition active:scale-95"
              >
                <Check className="h-3.5 w-3.5" />
                Save
              </button>
            )}
            <button
              onClick={onClose}
              className={`rounded-xl p-2 transition ${
                isDark
                  ? 'text-slate-400 hover:bg-white/10 hover:text-white'
                  : 'text-slate-400 hover:bg-slate-100 hover:text-slate-800'
              }`}
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Delete Confirmation Banner */}
          {showDeleteConfirm && (
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: -6 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              className="rounded-2xl border border-rose-500/40 bg-rose-950/60 p-4 space-y-3 backdrop-blur-2xl shadow-2xl"
            >
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-500/25 text-rose-300 border border-rose-500/40">
                  <Trash2 className="h-5 w-5" />
                </div>
                <div className="space-y-1">
                  <h4 className="text-sm font-semibold text-white">Delete this record?</h4>
                  <p className="text-xs text-rose-200">
                    This will permanently remove "{expense.merchant}" (
                    {currencySymbol}
                    {expense.amount.toFixed(2)}) from your transaction history.
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-end gap-2 pt-1 border-t border-rose-500/20">
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(false)}
                  className="rounded-xl px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-white transition"
                >
                  Keep Record
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onDelete(expense.id);
                    onClose();
                  }}
                  className="flex items-center gap-1 rounded-xl bg-rose-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-lg shadow-rose-600/30 transition hover:bg-rose-500 active:scale-95"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Confirm Delete
                </button>
              </div>
            </motion.div>
          )}

          {/* Amount Hero */}
          <div
            className={`rounded-2xl border p-4 text-center ${
              isIncome
                ? 'border-emerald-500/20 bg-emerald-500/5'
                : isDark
                ? 'border-white/10 bg-white/5'
                : 'border-slate-200 bg-slate-50'
            }`}
          >
            <span
              className={`text-xs uppercase tracking-wider block mb-1 font-semibold ${
                isIncome ? 'text-emerald-400' : isDark ? 'text-slate-400' : 'text-slate-500'
              }`}
            >
              {isIncome ? 'Total Income Received' : 'Total Spent Amount'}
            </span>

            {isEditing ? (
              <div className="space-y-3">
                {/* Type toggle in edit mode */}
                <div className="grid grid-cols-2 gap-2 p-1 rounded-xl border border-white/10 bg-white/5">
                  <button
                    type="button"
                    onClick={() => setEditedType('expense')}
                    className={`py-1 text-xs font-bold rounded-lg transition ${
                      editedType === 'expense' ? 'bg-rose-600 text-white' : 'text-slate-400'
                    }`}
                  >
                    Expense (-)
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditedType('income')}
                    className={`py-1 text-xs font-bold rounded-lg transition ${
                      editedType === 'income' ? 'bg-emerald-600 text-white' : 'text-slate-400'
                    }`}
                  >
                    Income (+)
                  </button>
                </div>
                <div className="flex items-center justify-center gap-1">
                  <span className="text-2xl font-bold text-indigo-400">{currencySymbol}</span>
                  <input
                    type="number"
                    step="0.01"
                    value={editedAmount}
                    onChange={(e) => setEditedAmount(Number(e.target.value))}
                    className="w-44 bg-transparent text-center text-3xl font-black focus:outline-none"
                  />
                </div>
              </div>
            ) : (
              <div
                className={`text-3xl sm:text-4xl font-black ${
                  isIncome ? 'text-emerald-400' : isDark ? 'text-white' : 'text-slate-900'
                }`}
              >
                {isIncome ? '+' : '-'}{currencySymbol}{expense.amount.toFixed(2)}
              </div>
            )}
          </div>

          {/* Details grid */}
          <div className="space-y-3">
            {/* Merchant / Source */}
            <div>
              <label className="text-xs font-medium text-slate-400 block mb-1">
                {isIncome ? 'Income Source / Payer' : 'Merchant / Store'}
              </label>
              {isEditing ? (
                <input
                  type="text"
                  value={editedMerchant}
                  onChange={(e) => setEditedMerchant(e.target.value)}
                  className={`w-full rounded-xl border px-3.5 py-2 text-sm focus:outline-none ${
                    isDark
                      ? 'border-white/10 bg-white/5 text-white'
                      : 'border-slate-200 bg-slate-50 text-slate-900'
                  }`}
                />
              ) : (
                <p className="text-sm font-semibold">{expense.merchant}</p>
              )}
            </div>

            {/* Category */}
            <div>
              <label className="text-xs font-medium text-slate-400 block mb-1">Category</label>
              {isEditing ? (
                <select
                  value={editedCategory}
                  onChange={(e) => setEditedCategory(e.target.value as ExpenseCategory)}
                  className={`w-full rounded-xl border px-3 py-2 text-xs focus:outline-none ${
                    isDark
                      ? 'border-white/10 bg-[#0f172a] text-white'
                      : 'border-slate-200 bg-white text-slate-900'
                  }`}
                >
                  {customCategories.map((c) => (
                    <option key={c.id || c.name} value={c.name}>
                      {c.name} ({c.type})
                    </option>
                  ))}
                </select>
              ) : (
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium ${categoryMeta.bgColor} ${categoryMeta.color}`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {expense.category}
                  </span>
                </div>
              )}
            </div>

            {/* Date & Time */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-slate-400 block mb-1">Date</label>
                {isEditing ? (
                  <input
                    type="date"
                    value={editedDate}
                    onChange={(e) => setEditedDate(e.target.value)}
                    className={`w-full rounded-xl border px-2.5 py-1.5 text-xs focus:outline-none ${
                      isDark
                        ? 'border-white/10 bg-white/5 text-white'
                        : 'border-slate-200 bg-slate-50 text-slate-900'
                    }`}
                  />
                ) : (
                  <div className="flex items-center gap-1.5 text-xs font-medium">
                    <Calendar className="h-3.5 w-3.5 text-slate-400" />
                    <span>{expense.date}</span>
                  </div>
                )}
              </div>

              <div>
                <label className="text-xs font-medium text-slate-400 block mb-1">Time</label>
                {isEditing ? (
                  <input
                    type="time"
                    value={editedTime}
                    onChange={(e) => setEditedTime(e.target.value)}
                    className={`w-full rounded-xl border px-2.5 py-1.5 text-xs focus:outline-none ${
                      isDark
                        ? 'border-white/10 bg-white/5 text-white'
                        : 'border-slate-200 bg-slate-50 text-slate-900'
                    }`}
                  />
                ) : (
                  <div className="flex items-center gap-1.5 text-xs font-medium">
                    <Clock className="h-3.5 w-3.5 text-slate-400" />
                    <span>{expense.time || 'Not specified'}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Payment Method */}
            <div>
              <label className="text-xs font-medium text-slate-400 block mb-1">
                {isIncome ? 'Deposit Method' : 'Payment Method'}
              </label>
              {isEditing ? (
                <select
                  value={editedPaymentMethod}
                  onChange={(e) => setEditedPaymentMethod(e.target.value as PaymentMethod)}
                  className={`w-full rounded-xl border px-3 py-2 text-xs focus:outline-none ${
                    isDark
                      ? 'border-white/10 bg-[#0f172a] text-white'
                      : 'border-slate-200 bg-white text-slate-900'
                  }`}
                >
                  <option value="Credit Card">Credit Card</option>
                  <option value="Debit Card">Debit Card</option>
                  <option value="Cash">Cash</option>
                  <option value="E-Wallet">E-Wallet</option>
                  <option value="Bank Transfer">Bank Transfer</option>
                  <option value="Other">Other</option>
                </select>
              ) : (
                <div className="flex items-center gap-1.5 text-xs font-medium">
                  <CreditCard className="h-3.5 w-3.5 text-slate-400" />
                  <span>{expense.paymentMethod}</span>
                </div>
              )}
            </div>

            {/* Notes */}
            <div>
              <label className="text-xs font-medium text-slate-400 block mb-1">Summary / Note</label>
              {isEditing ? (
                <textarea
                  rows={2}
                  value={editedSummary}
                  onChange={(e) => setEditedSummary(e.target.value)}
                  className={`w-full rounded-xl border px-3 py-2 text-xs focus:outline-none ${
                    isDark
                      ? 'border-white/10 bg-white/5 text-white'
                      : 'border-slate-200 bg-slate-50 text-slate-900'
                  }`}
                />
              ) : (
                <p className="text-xs text-slate-300 leading-relaxed">
                  {expense.summary || 'No description provided.'}
                </p>
              )}
            </div>

            {/* Line items if any */}
            {expense.items && expense.items.length > 0 && (
              <div>
                <label className="text-xs font-medium text-slate-400 block mb-1.5">
                  Itemized Breakdown ({expense.items.length} items)
                </label>
                <div
                  className={`rounded-2xl border p-2 space-y-1.5 ${
                    isDark ? 'border-white/10 bg-white/5' : 'border-slate-200 bg-slate-50'
                  }`}
                >
                  {expense.items.map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between text-xs py-1 border-b border-white/5 last:border-0">
                      <div className="flex items-center gap-2">
                        {item.quantity && (
                          <span className="text-slate-400 font-medium">x{item.quantity}</span>
                        )}
                        <span>{item.name}</span>
                      </div>
                      {item.price !== undefined && (
                        <span className="font-semibold tabular-nums">
                          {currencySymbol}{item.price.toFixed(2)}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
};
