import React, { useState } from 'react';
import {
  Receipt,
  CreditCard,
  Tag as TagIcon,
  ChevronRight,
  Edit2,
  Trash2,
  TrendingUp,
  ArrowDownLeft,
  ArrowUpRight,
  Repeat,
} from 'lucide-react';
import { motion, useMotionValue, useTransform } from 'motion/react';
import { Expense, CategoryItem } from '../types';
import { getCategoryMeta } from '../data/categories';

interface ExpenseCardProps {
  expense: Expense;
  currencySymbol: string;
  onClick: () => void;
  onEdit?: (expense: Expense) => void;
  onDelete?: (id: string) => void;
  customCategories?: CategoryItem[];
  isDark?: boolean;
}

export const ExpenseCard: React.FC<ExpenseCardProps> = ({
  expense,
  currencySymbol,
  onClick,
  onEdit,
  onDelete,
  customCategories = [],
  isDark = true,
}) => {
  const [isSwipedOpen, setIsSwipedOpen] = useState(false);
  const categoryMeta = getCategoryMeta(expense.category, customCategories);
  const Icon = categoryMeta.icon;
  const isIncome = expense.type === 'income';

  const handleDragEnd = (_: any, info: { offset: { x: number }; velocity: { x: number } }) => {
    // If dragged to the left past 40px or fast swipe left
    if (info.offset.x < -45 || info.velocity.x < -200) {
      setIsSwipedOpen(true);
    } else if (info.offset.x > 25 || info.velocity.x > 200) {
      setIsSwipedOpen(false);
    }
  };

  const handleCardClick = (e: React.MouseEvent) => {
    if (isSwipedOpen) {
      // If currently swiped open, clicking closes the swipe
      e.stopPropagation();
      setIsSwipedOpen(false);
    } else {
      onClick();
    }
  };

  return (
    <div className="relative overflow-hidden rounded-2xl select-none group">
      {/* Background action tray revealed on swipe to left */}
      <div className="absolute inset-y-0 right-0 z-0 flex items-stretch justify-end w-36 rounded-2xl overflow-hidden bg-slate-800/80">
        {onEdit && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIsSwipedOpen(false);
              onEdit(expense);
            }}
            className="flex-1 flex flex-col items-center justify-center bg-indigo-600 hover:bg-indigo-500 text-white transition active:scale-95 px-2 font-medium text-[11px]"
            title="Edit Transaction"
          >
            <Edit2 className="h-4 w-4 mb-1" />
            <span>Edit</span>
          </button>
        )}
        {onDelete && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIsSwipedOpen(false);
              onDelete(expense.id);
            }}
            className="flex-1 flex flex-col items-center justify-center bg-rose-600 hover:bg-rose-500 text-white transition active:scale-95 px-2 font-medium text-[11px]"
            title="Remove Transaction"
          >
            <Trash2 className="h-4 w-4 mb-1" />
            <span>Remove</span>
          </button>
        )}
      </div>

      {/* Foreground Swipeable Card */}
      <motion.div
        drag="x"
        dragConstraints={{ left: -140, right: 0 }}
        dragElastic={0.08}
        onDragEnd={handleDragEnd}
        animate={{ x: isSwipedOpen ? -140 : 0 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        onClick={handleCardClick}
        className={`relative z-10 flex items-center justify-between rounded-2xl p-3.5 transition-colors cursor-pointer shadow-sm ${
          isDark
            ? 'border border-white/10 bg-[#0a1128]/95 backdrop-blur-2xl hover:border-white/20 hover:bg-[#0f172a]'
            : 'border border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50 text-slate-800'
        }`}
      >
        <div className="flex items-center gap-3 min-w-0">
          {/* Category Icon */}
          <div
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${categoryMeta.bgColor} ${categoryMeta.color} border ${categoryMeta.borderColor} shadow-sm`}
          >
            <Icon className="h-5 w-5" />
          </div>

          {/* Info */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <h3
                className={`truncate text-sm font-semibold transition ${
                  isDark ? 'text-white group-hover:text-indigo-300' : 'text-slate-900 group-hover:text-indigo-600'
                }`}
              >
                {expense.merchant}
              </h3>

              {isIncome && (
                <span className="inline-flex items-center rounded-md bg-emerald-500/15 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-400 border border-emerald-500/30 shrink-0">
                  <ArrowDownLeft className="mr-0.5 h-2.5 w-2.5" />
                  Income
                </span>
              )}

              {expense.isRecurring && (
                <span
                  className="inline-flex items-center rounded-md bg-purple-500/15 px-1.5 py-0.5 text-[9px] font-semibold text-purple-300 border border-purple-500/30 shrink-0 capitalize"
                  title={`Recurring ${expense.recurringInterval || 'expense'}`}
                >
                  <Repeat className="mr-0.5 h-2.5 w-2.5" />
                  {expense.recurringInterval || 'Recurring'}
                </span>
              )}

              {expense.receiptImage && (
                <span
                  className="inline-flex items-center rounded-md bg-indigo-500/15 px-1.5 py-0.5 text-[10px] font-medium text-indigo-300 border border-indigo-500/20 shrink-0"
                  title="Receipt scan attached"
                >
                  <Receipt className="mr-0.5 h-3 w-3" />
                  Receipt
                </span>
              )}
            </div>

            <div
              className={`flex items-center gap-2 text-xs mt-0.5 truncate ${
                isDark ? 'text-slate-400' : 'text-slate-500'
              }`}
            >
              <span>{expense.category}</span>
              {expense.time && (
                <>
                  <span className={isDark ? 'text-white/20' : 'text-slate-300'}>•</span>
                  <span>{expense.time}</span>
                </>
              )}
              <span className={isDark ? 'text-white/20' : 'text-slate-300'}>•</span>
              <span>{expense.paymentMethod}</span>
            </div>

            {expense.summary && (
              <p
                className={`text-xs truncate mt-0.5 max-w-xs sm:max-w-md ${
                  isDark ? 'text-slate-400' : 'text-slate-500'
                }`}
              >
                {expense.summary}
              </p>
            )}
          </div>
        </div>

        {/* Amount, Chevron & Swipe Trigger */}
        <div className="flex items-center gap-2 pl-3 shrink-0">
          <div className="text-right">
            <span
              className={`text-sm sm:text-base font-bold block ${
                isIncome
                  ? 'text-emerald-400'
                  : isDark
                  ? 'text-white'
                  : 'text-slate-900'
              }`}
            >
              {isIncome ? '+' : '-'}{currencySymbol}{expense.amount.toFixed(2)}
            </span>
            {expense.items && expense.items.length > 0 && (
              <span className={`text-[10px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                {expense.items.length} item{expense.items.length > 1 ? 's' : ''}
              </span>
            )}
          </div>

          {/* Swipe indicator button (clicking also toggles reveal for desktop mouse users) */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIsSwipedOpen(!isSwipedOpen);
            }}
            className={`p-1 rounded-lg transition ${
              isDark
                ? 'text-slate-500 hover:text-slate-300 hover:bg-white/10'
                : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'
            }`}
            title="Swipe left to Edit or Remove"
          >
            <ChevronRight
              className={`h-4 w-4 transition-transform ${isSwipedOpen ? 'rotate-180 text-indigo-400' : ''}`}
            />
          </button>
        </div>
      </motion.div>
    </div>
  );
};
