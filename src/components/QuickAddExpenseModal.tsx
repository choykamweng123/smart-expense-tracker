import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  Send,
  Sparkles,
  Loader2,
  Check,
  Edit3,
  Calendar,
  Bot,
  User,
  CheckCircle2,
  AlertCircle,
  RotateCcw,
  ArrowRight,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Expense, ExpenseCategory, CategoryItem } from '../types';
import { getCategoryMeta, CATEGORY_LIST } from '../data/categories';
import { parseNaturalExpense, QuickAddExtractedExpense } from '../utils/naturalExpenseParser';

interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text?: string;
  parsedExpense?: QuickAddExtractedExpense;
  isConfirmed?: boolean;
  timestamp: number;
}

interface QuickAddExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveExpense: (expense: Omit<Expense, 'id' | 'createdAt'>) => void;
  onOpenFullEdit?: (draft: Partial<Expense>) => void;
  defaultCurrency: string;
  customCategories?: CategoryItem[];
  isDark?: boolean;
}

const CHAT_SUGGESTIONS = [
  "I had lunch at McDonald's today for RM18.50",
  "Grab ride to Mid Valley RM18",
  "Bought groceries at Village Grocer RM92",
  "Starbucks iced caramel macchiato RM17",
];

export const QuickAddExpenseModal: React.FC<QuickAddExpenseModalProps> = ({
  isOpen,
  onClose,
  onSaveExpense,
  onOpenFullEdit,
  defaultCurrency,
  customCategories = [],
  isDark = true,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      sender: 'assistant',
      text: '👋 Hi! Type your expense naturally (e.g. "I had lunch at McDonald\'s today for RM18.50"). I\'ll extract the details into a confirmation card for you to review and confirm.',
      timestamp: Date.now(),
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);

  // Edit fields for active inline edit
  const [editMerchant, setEditMerchant] = useState('');
  const [editAmount, setEditAmount] = useState('');
  const [editCategory, setEditCategory] = useState<ExpenseCategory>('Food & Dining');
  const [editDate, setEditDate] = useState('');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        inputRef.current?.focus();
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 200);
    }
  }, [isOpen, messages]);

  if (!isOpen) return null;

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend ?? inputText).trim();
    if (!text || isProcessing) return;

    const userMsgId = 'msg_' + Date.now();
    const newMessages: ChatMessage[] = [
      ...messages,
      {
        id: userMsgId,
        sender: 'user',
        text,
        timestamp: Date.now(),
      },
    ];

    setMessages(newMessages);
    setInputText('');
    setIsProcessing(true);

    try {
      const extracted = await parseNaturalExpense(text, defaultCurrency);
      const assistantMsgId = 'asst_' + Date.now();
      setMessages((prev) => [
        ...prev,
        {
          id: assistantMsgId,
          sender: 'assistant',
          parsedExpense: extracted,
          timestamp: Date.now(),
        },
      ]);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: 'err_' + Date.now(),
          sender: 'assistant',
          text: `⚠️ ${err?.message || 'Sorry, I could not parse that expense. Please try phrasing it with merchant and amount.'}`,
          timestamp: Date.now(),
        },
      ]);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConfirmExpense = (msgId: string, expense: QuickAddExtractedExpense) => {
    const amountNum =
      editingMessageId === msgId ? parseFloat(editAmount) || expense.amount : expense.amount;
    const merchantFinal =
      editingMessageId === msgId ? editMerchant.trim() || expense.merchant : expense.merchant;
    const categoryFinal =
      editingMessageId === msgId ? editCategory || expense.category : expense.category;
    const dateFinal =
      editingMessageId === msgId ? editDate || expense.date : expense.date;

    const finalExpense: Omit<Expense, 'id' | 'createdAt'> = {
      merchant: merchantFinal,
      amount: Math.round(amountNum * 100) / 100,
      currency: expense.currency || defaultCurrency,
      category: categoryFinal,
      type: expense.type || 'expense',
      date: dateFinal || new Date().toISOString().slice(0, 10),
      time: expense.time || new Date().toTimeString().slice(0, 5),
      paymentMethod: expense.paymentMethod || 'E-Wallet',
      summary: expense.summary || `${merchantFinal} - ${categoryFinal}`,
      tags: expense.tags || ['quick-add'],
    };

    onSaveExpense(finalExpense);

    // Mark this message as confirmed and append confirmation bot text
    setMessages((prev) =>
      prev.map((msg) => (msg.id === msgId ? { ...msg, isConfirmed: true } : msg)).concat({
        id: 'saved_' + Date.now(),
        sender: 'assistant',
        text: `✅ Saved ${finalExpense.currency} ${finalExpense.amount.toFixed(2)} at ${finalExpense.merchant} (${finalExpense.category}) on ${finalExpense.date}. Budget & dashboard totals updated!`,
        timestamp: Date.now(),
      })
    );

    setEditingMessageId(null);
  };

  const handleStartEdit = (msgId: string, expense: QuickAddExtractedExpense) => {
    setEditingMessageId(msgId);
    setEditMerchant(expense.merchant);
    setEditAmount(expense.amount.toString());
    setEditCategory(expense.category);
    setEditDate(expense.date);
  };

  const formatDateDisplay = (isoDate: string) => {
    const today = new Date().toISOString().slice(0, 10);
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    if (isoDate === today) return 'Today';
    if (isoDate === yesterday) return 'Yesterday';
    return isoDate;
  };

  return (
    <div
      id="quick-add-expense-modal"
      role="dialog"
      aria-modal="true"
      aria-label="Quick Add Expense Chat"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-md"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 16 }}
        className={`w-full max-w-lg h-[86vh] max-h-[720px] rounded-3xl border flex flex-col shadow-2xl overflow-hidden ${
          isDark
            ? 'bg-[#0b132b] border-white/15 text-slate-100 shadow-black/80'
            : 'bg-white border-slate-200 text-slate-900 shadow-slate-400/30'
        }`}
      >
        {/* Modal Top Bar */}
        <div className="px-4 py-3.5 border-b border-white/10 flex items-center justify-between shrink-0 bg-white/5 backdrop-blur-sm">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-600 text-white shadow-md">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-1.5">
                <span>Quick Add Expense</span>
                <span className="rounded-md bg-indigo-500/20 px-1.5 py-0.5 text-[9px] font-semibold text-indigo-300 border border-indigo-500/30">
                  Chat
                </span>
              </h2>
              <p className="text-[10px] text-slate-400">
                Type naturally • Confirmation required before saving
              </p>
            </div>
          </div>

          <button
            type="button"
            id="close-quick-add-modal"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Chat Thread Container */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3.5">
          {messages.map((msg) => {
            const isUser = msg.sender === 'user';

            return (
              <div
                key={msg.id}
                className={`flex gap-2.5 ${isUser ? 'justify-end' : 'justify-start'}`}
              >
                {!isUser && (
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-600/30 text-indigo-400 border border-indigo-500/30 mt-0.5">
                    <Bot className="h-4 w-4" />
                  </div>
                )}

                <div className={`max-w-[85%] space-y-2 ${isUser ? 'items-end' : 'items-start'}`}>
                  {/* Text Message Bubble */}
                  {msg.text && (
                    <div
                      className={`px-3.5 py-2.5 rounded-2xl text-xs sm:text-sm leading-relaxed ${
                        isUser
                          ? 'bg-gradient-to-tr from-indigo-600 to-purple-600 text-white rounded-tr-sm shadow-md'
                          : isDark
                          ? 'bg-slate-900 border border-white/10 text-slate-200 rounded-tl-sm'
                          : 'bg-slate-100 border border-slate-200 text-slate-800 rounded-tl-sm'
                      }`}
                    >
                      {msg.text}
                    </div>
                  )}

                  {/* Review Expense Confirmation Card */}
                  {msg.parsedExpense && (
                    <div
                      className={`rounded-2xl border p-3.5 shadow-xl ${
                        isDark
                          ? 'bg-slate-900/95 border-indigo-500/40 text-white'
                          : 'bg-white border-indigo-200 text-slate-900'
                      }`}
                    >
                      {/* Review Card Header */}
                      <div className="flex items-center justify-between pb-2.5 border-b border-white/10 mb-2.5">
                        <div className="flex items-center gap-1.5">
                          <CheckCircle2 className="h-4 w-4 text-indigo-400" />
                          <span className="text-xs font-bold uppercase tracking-wider text-indigo-400">
                            Review Expense
                          </span>
                        </div>
                        {msg.isConfirmed ? (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                            Confirmed
                          </span>
                        ) : (
                          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                            Pending Review
                          </span>
                        )}
                      </div>

                      {/* Content Preview or Inline Edit */}
                      {editingMessageId !== msg.id ? (
                        <div className="space-y-2 text-xs">
                          <div className="flex justify-between items-baseline">
                            <span className="text-[10px] uppercase font-bold text-slate-400">Merchant</span>
                            <span className="font-bold text-white text-sm">
                              {msg.parsedExpense.merchant}
                            </span>
                          </div>

                          <div className="flex justify-between items-baseline">
                            <span className="text-[10px] uppercase font-bold text-slate-400">Amount</span>
                            <span className="font-extrabold text-rose-400 text-base">
                              {msg.parsedExpense.currency} {msg.parsedExpense.amount.toFixed(2)}
                            </span>
                          </div>

                          <div className="flex justify-between items-center">
                            <span className="text-[10px] uppercase font-bold text-slate-400">Category</span>
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-white/5 border border-white/10 font-semibold text-slate-200">
                              {msg.parsedExpense.category}
                            </span>
                          </div>

                          <div className="flex justify-between items-center">
                            <span className="text-[10px] uppercase font-bold text-slate-400">Date</span>
                            <span className="font-medium text-slate-300">
                              {formatDateDisplay(msg.parsedExpense.date)}
                            </span>
                          </div>
                        </div>
                      ) : (
                        /* Inline Edit Fields */
                        <div className="space-y-2 text-xs">
                          <div>
                            <label className="block text-[10px] font-bold text-slate-400 mb-0.5">Merchant</label>
                            <input
                              type="text"
                              value={editMerchant}
                              onChange={(e) => setEditMerchant(e.target.value)}
                              className="w-full h-8 px-2.5 rounded-xl bg-black/40 border border-white/15 text-white text-xs"
                            />
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-[10px] font-bold text-slate-400 mb-0.5">Amount</label>
                              <input
                                type="number"
                                step="0.01"
                                value={editAmount}
                                onChange={(e) => setEditAmount(e.target.value)}
                                className="w-full h-8 px-2.5 rounded-xl bg-black/40 border border-white/15 text-white text-xs font-bold"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-bold text-slate-400 mb-0.5">Date</label>
                              <input
                                type="date"
                                value={editDate}
                                onChange={(e) => setEditDate(e.target.value)}
                                className="w-full h-8 px-2 rounded-xl bg-black/40 border border-white/15 text-white text-xs"
                              />
                            </div>
                          </div>

                          <div>
                            <label className="block text-[10px] font-bold text-slate-400 mb-0.5">Category</label>
                            <select
                              value={editCategory}
                              onChange={(e) => setEditCategory(e.target.value as ExpenseCategory)}
                              className="w-full h-8 px-2 rounded-xl bg-slate-800 border border-white/15 text-white text-xs"
                            >
                              {CATEGORY_LIST.map((cat) => (
                                <option key={cat} value={cat}>
                                  {cat}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                      )}

                      {/* Card Action Buttons: [Confirm] [Edit] */}
                      {!msg.isConfirmed && (
                        <div className="mt-3 pt-2.5 border-t border-white/10 flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleConfirmExpense(msg.id, msg.parsedExpense!)}
                            className="flex-1 min-h-[40px] flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 text-white text-xs font-bold shadow-md active:scale-95 transition"
                          >
                            <Check className="h-3.5 w-3.5 stroke-[2.5]" />
                            <span>Confirm</span>
                          </button>

                          {editingMessageId !== msg.id ? (
                            <button
                              type="button"
                              onClick={() => handleStartEdit(msg.id, msg.parsedExpense!)}
                              className="min-h-[40px] px-3 rounded-xl border border-white/15 bg-white/5 text-xs font-semibold text-slate-300 hover:text-white transition active:scale-95 flex items-center gap-1"
                            >
                              <Edit3 className="h-3.5 w-3.5" />
                              <span>Edit</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setEditingMessageId(null)}
                              className="min-h-[40px] px-3 rounded-xl border border-white/15 bg-white/5 text-xs font-semibold text-slate-300 hover:text-white"
                            >
                              Done
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {isUser && (
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-purple-600/30 text-purple-300 border border-purple-500/30 mt-0.5">
                    <User className="h-4 w-4" />
                  </div>
                )}
              </div>
            );
          })}

          {isProcessing && (
            <div className="flex gap-2.5 items-center text-xs text-slate-400">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-600/30 text-indigo-400 border border-indigo-500/30">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              </div>
              <span className="italic">AI is parsing your expense details...</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Quick Suggestion Chips */}
        <div className="px-4 py-2 border-t border-white/10 bg-white/5 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          <span className="text-[10px] uppercase font-bold text-slate-500 shrink-0">Try:</span>
          {CHAT_SUGGESTIONS.map((item, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handleSendMessage(item)}
              disabled={isProcessing}
              className="shrink-0 px-2.5 py-1 rounded-xl border border-white/10 bg-white/5 text-[11px] text-slate-300 hover:text-white hover:bg-white/10 transition whitespace-nowrap active:scale-95"
            >
              {item}
            </button>
          ))}
        </div>

        {/* Bottom Input Form */}
        <div className="p-3 border-t border-white/10 bg-[#080e21]/90 backdrop-blur-md shrink-0">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="relative flex items-center"
          >
            <input
              ref={inputRef}
              type="text"
              id="quick-add-chat-input"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="e.g. I had lunch at McDonald's today for RM18.50"
              disabled={isProcessing}
              className={`w-full h-11 pl-3.5 pr-11 rounded-2xl text-xs sm:text-sm border transition focus:outline-none focus:ring-2 focus:ring-indigo-500/40 ${
                isDark
                  ? 'bg-slate-900 border-white/15 text-white placeholder-slate-500'
                  : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400'
              }`}
            />
            <button
              type="submit"
              disabled={isProcessing || !inputText.trim()}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 h-8 w-8 rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-600 text-white flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed transition hover:opacity-90 active:scale-95"
              aria-label="Send expense message"
            >
              <Send className="h-3.5 w-3.5" />
            </button>
          </form>
        </div>
      </motion.div>
    </div>
  );
};
