import React, { useState } from 'react';
import {
  X,
  Plus,
  Edit2,
  Trash2,
  Check,
  Tag,
  Palette,
  Sparkles,
  ArrowDownLeft,
  ArrowUpRight,
  HelpCircle,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { CategoryItem, TransactionType } from '../types';
import { ICON_MAP, COLOR_PALETTES, getCategoryMeta } from '../data/categories';

interface CategoryManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  categories: CategoryItem[];
  onAddCategory: (category: Omit<CategoryItem, 'id'>) => void;
  onUpdateCategory: (id: string, updated: Partial<CategoryItem>) => void;
  onDeleteCategory: (id: string) => void;
  onResetCategories: () => void;
  isDark?: boolean;
}

export const CategoryManagerModal: React.FC<CategoryManagerModalProps> = ({
  isOpen,
  onClose,
  categories,
  onAddCategory,
  onUpdateCategory,
  onDeleteCategory,
  onResetCategories,
  isDark = true,
}) => {
  const [filterType, setFilterType] = useState<'all' | 'expense' | 'income'>('all');
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [type, setType] = useState<'expense' | 'income' | 'both'>('expense');
  const [iconName, setIconName] = useState('Tag');
  const [selectedPaletteIndex, setSelectedPaletteIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleStartAdd = () => {
    setIsEditing(true);
    setEditingId(null);
    setName('');
    setType(filterType === 'income' ? 'income' : 'expense');
    setIconName('Coffee');
    setSelectedPaletteIndex(0);
    setError(null);
  };

  const handleStartEdit = (cat: CategoryItem) => {
    setIsEditing(true);
    setEditingId(cat.id);
    setName(cat.name);
    setType(cat.type);
    setIconName(cat.iconName || 'HelpCircle');
    const palIdx = COLOR_PALETTES.findIndex((p) => p.color === cat.color);
    setSelectedPaletteIndex(palIdx >= 0 ? palIdx : 0);
    setError(null);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Please enter a category name');
      return;
    }

    const palette = COLOR_PALETTES[selectedPaletteIndex] || COLOR_PALETTES[0];

    if (editingId) {
      onUpdateCategory(editingId, {
        name: name.trim(),
        type,
        iconName,
        color: palette.color,
        bgColor: palette.bgColor,
        borderColor: palette.borderColor,
        badgeColor: palette.badgeColor,
      });
    } else {
      onAddCategory({
        name: name.trim(),
        type,
        iconName,
        color: palette.color,
        bgColor: palette.bgColor,
        borderColor: palette.borderColor,
        badgeColor: palette.badgeColor,
        isCustom: true,
      });
    }

    setIsEditing(false);
    setEditingId(null);
    setName('');
  };

  const filteredCategories = categories.filter((c) => {
    if (filterType === 'all') return true;
    return c.type === filterType || c.type === 'both';
  });

  const availableIcons = Object.keys(ICON_MAP);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-2xl overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className={`relative w-full max-w-lg my-auto rounded-3xl border shadow-2xl overflow-hidden transition-colors ${
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
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
              <Tag className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-base font-bold">Manage Categories</h2>
              <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                Add and customize income & expense categories
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className={`rounded-xl p-1.5 transition ${
              isDark ? 'text-slate-400 hover:bg-white/10 hover:text-white' : 'text-slate-400 hover:bg-slate-100 hover:text-slate-800'
            }`}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-5 space-y-4 max-h-[78vh] overflow-y-auto">
          <AnimatePresence mode="wait">
            {isEditing ? (
              /* Add / Edit Category Form */
              <motion.form
                key="edit-form"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                onSubmit={handleSave}
                className="space-y-4"
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-indigo-400">
                    {editingId ? 'Edit Category' : 'Create New Category'}
                  </h3>
                  <button
                    type="button"
                    onClick={() => setIsEditing(false)}
                    className="text-xs text-slate-400 hover:text-white underline"
                  >
                    Back to List
                  </button>
                </div>

                {error && (
                  <div className="rounded-xl border border-rose-500/30 bg-rose-950/40 p-2.5 text-xs text-rose-300">
                    {error}
                  </div>
                )}

                {/* Name */}
                <div>
                  <label className="text-xs font-medium block mb-1">Category Name</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Gym & Fitness, Freelance, Pets"
                    className={`w-full rounded-xl border px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40 ${
                      isDark
                        ? 'border-white/10 bg-white/5 text-white'
                        : 'border-slate-200 bg-slate-50 text-slate-900'
                    }`}
                  />
                </div>

                {/* Type Selection */}
                <div>
                  <label className="text-xs font-medium block mb-1">Category Type</label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setType('expense')}
                      className={`flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-semibold border transition ${
                        type === 'expense'
                          ? 'border-rose-500/50 bg-rose-500/20 text-rose-300'
                          : isDark
                          ? 'border-white/5 bg-white/5 text-slate-400 hover:text-white'
                          : 'border-slate-200 bg-slate-50 text-slate-600'
                      }`}
                    >
                      <ArrowUpRight className="h-3.5 w-3.5" />
                      Expense
                    </button>
                    <button
                      type="button"
                      onClick={() => setType('income')}
                      className={`flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-semibold border transition ${
                        type === 'income'
                          ? 'border-emerald-500/50 bg-emerald-500/20 text-emerald-300'
                          : isDark
                          ? 'border-white/5 bg-white/5 text-slate-400 hover:text-white'
                          : 'border-slate-200 bg-slate-50 text-slate-600'
                      }`}
                    >
                      <ArrowDownLeft className="h-3.5 w-3.5" />
                      Income
                    </button>
                    <button
                      type="button"
                      onClick={() => setType('both')}
                      className={`flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-semibold border transition ${
                        type === 'both'
                          ? 'border-indigo-500/50 bg-indigo-500/20 text-indigo-300'
                          : isDark
                          ? 'border-white/5 bg-white/5 text-slate-400 hover:text-white'
                          : 'border-slate-200 bg-slate-50 text-slate-600'
                      }`}
                    >
                      <Tag className="h-3.5 w-3.5" />
                      Both
                    </button>
                  </div>
                </div>

                {/* Color Palette Picker */}
                <div>
                  <label className="text-xs font-medium block mb-1.5">Color Theme</label>
                  <div className="flex flex-wrap gap-2">
                    {COLOR_PALETTES.map((pal, idx) => {
                      const isSelected = selectedPaletteIndex === idx;
                      return (
                        <button
                          key={pal.name}
                          type="button"
                          onClick={() => setSelectedPaletteIndex(idx)}
                          className={`h-7 w-7 rounded-full border-2 flex items-center justify-center transition active:scale-95 ${
                            isSelected ? 'border-white scale-110 shadow-md' : 'border-transparent opacity-80 hover:opacity-100'
                          } ${pal.bgColor}`}
                          title={pal.name}
                        >
                          <span className={`h-3 w-3 rounded-full ${pal.color.replace('text-', 'bg-')}`} />
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Icon Selection */}
                <div>
                  <label className="text-xs font-medium block mb-1.5">Choose Icon</label>
                  <div className="grid grid-cols-6 sm:grid-cols-8 gap-2 max-h-36 overflow-y-auto p-1 border rounded-2xl border-white/10 bg-white/5">
                    {availableIcons.map((icName) => {
                      const Ic = ICON_MAP[icName] || HelpCircle;
                      const isSelected = iconName === icName;
                      return (
                        <button
                          key={icName}
                          type="button"
                          onClick={() => setIconName(icName)}
                          className={`flex flex-col items-center justify-center p-2 rounded-xl border transition ${
                            isSelected
                              ? 'border-indigo-400 bg-indigo-500/30 text-white'
                              : isDark
                              ? 'border-transparent text-slate-400 hover:text-white hover:bg-white/5'
                              : 'border-transparent text-slate-600 hover:bg-slate-100'
                          }`}
                          title={icName}
                        >
                          <Ic className="h-5 w-5" />
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Preview */}
                <div
                  className={`p-3 rounded-2xl border flex items-center gap-3 ${
                    isDark ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-200'
                  }`}
                >
                  <span className="text-xs text-slate-400">Live Preview:</span>
                  <div className="flex items-center gap-2">
                    {(() => {
                      const pal = COLOR_PALETTES[selectedPaletteIndex] || COLOR_PALETTES[0];
                      const Ic = ICON_MAP[iconName] || Tag;
                      return (
                        <div
                          className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border ${pal.bgColor} ${pal.borderColor} ${pal.color} text-xs font-medium`}
                        >
                          <Ic className="h-4 w-4" />
                          <span>{name || 'Category Name'}</span>
                          <span className="text-[10px] uppercase opacity-75">({type})</span>
                        </div>
                      );
                    })()}
                  </div>
                </div>

                {/* Actions */}
                <div className="pt-2 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsEditing(false)}
                    className="rounded-xl px-4 py-2 text-xs font-medium text-slate-400 hover:text-white transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex items-center gap-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2 text-xs font-semibold shadow-lg shadow-indigo-600/30 transition active:scale-95"
                  >
                    <Check className="h-4 w-4" />
                    {editingId ? 'Update Category' : 'Save Category'}
                  </button>
                </div>
              </motion.form>
            ) : (
              /* Category List View */
              <motion.div
                key="list-view"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-4"
              >
                {/* Actions Bar */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  {/* Filters */}
                  <div className="flex rounded-xl border border-white/10 bg-white/5 p-1 gap-1">
                    <button
                      type="button"
                      onClick={() => setFilterType('all')}
                      className={`px-3 py-1 rounded-lg text-xs font-medium transition ${
                        filterType === 'all'
                          ? 'bg-indigo-600 text-white shadow'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      All ({categories.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setFilterType('expense')}
                      className={`px-3 py-1 rounded-lg text-xs font-medium transition ${
                        filterType === 'expense'
                          ? 'bg-rose-600 text-white shadow'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      Expenses
                    </button>
                    <button
                      type="button"
                      onClick={() => setFilterType('income')}
                      className={`px-3 py-1 rounded-lg text-xs font-medium transition ${
                        filterType === 'income'
                          ? 'bg-emerald-600 text-white shadow'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      Income
                    </button>
                  </div>

                  {/* Add New Button */}
                  <button
                    type="button"
                    onClick={handleStartAdd}
                    className="flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow transition hover:from-indigo-500 hover:to-purple-500 active:scale-95"
                  >
                    <Plus className="h-4 w-4" />
                    <span>Add Category</span>
                  </button>
                </div>

                {/* List */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[46vh] overflow-y-auto pr-1">
                  {filteredCategories.map((cat) => {
                    const Ic = ICON_MAP[cat.iconName] || Tag;
                    return (
                      <div
                        key={cat.id}
                        className={`flex items-center justify-between p-2.5 rounded-2xl border transition group ${
                          isDark
                            ? 'border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/10'
                            : 'border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-800'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div
                            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${cat.bgColor} ${cat.color} border ${cat.borderColor}`}
                          >
                            <Ic className="h-4 w-4" />
                          </div>
                          <div className="min-w-0">
                            <span className="text-xs font-semibold block truncate">
                              {cat.name}
                            </span>
                            <span className="text-[10px] opacity-60 uppercase font-medium">
                              {cat.type} {cat.isCustom ? '• Custom' : ''}
                            </span>
                          </div>
                        </div>

                        {/* Edit / Remove controls */}
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleStartEdit(cat)}
                            className={`p-1.5 rounded-lg transition ${
                              isDark
                                ? 'text-slate-400 hover:text-indigo-300 hover:bg-white/10'
                                : 'text-slate-500 hover:text-indigo-600 hover:bg-slate-200'
                            }`}
                            title="Edit Category"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>
                          {cat.isCustom && (
                            <button
                              type="button"
                              onClick={() => onDeleteCategory(cat.id)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition"
                              title="Delete Category"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Reset to Defaults Option */}
                <div className="pt-2 border-t border-white/10 flex items-center justify-between text-xs">
                  <span className={isDark ? 'text-slate-500' : 'text-slate-400'}>
                    Custom categories saved locally
                  </span>
                  <button
                    type="button"
                    onClick={onResetCategories}
                    className="text-xs text-slate-400 hover:text-rose-400 transition"
                  >
                    Reset Defaults
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
};
