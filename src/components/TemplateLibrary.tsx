import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { BookOpen, Search, Plus, Trash2, X, Check, Tag, ChevronDown } from 'lucide-react';
import { useSettings } from '@/context/SettingsContext';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'motion/react';

// ── Types ─────────────────────────────────────────────────────────────────────

export type TemplateCategory = 'Developer' | 'Creative' | 'Analysis' | 'Architecture' | 'Custom';

export interface Template {
  id: string;
  name: string;
  description: string;
  category: TemplateCategory;
  systemPrompt: string;
  builtIn?: boolean;
}

// ── Built-in templates ─────────────────────────────────────────────────────────

const BUILT_IN_TEMPLATES: Template[] = [
  {
    id: 'builtin_code',
    name: 'Code Expert',
    description: 'Senior software engineer specializing in clean, production-ready code.',
    category: 'Developer',
    systemPrompt: `You are an expert software engineer with 15+ years of experience across multiple languages and paradigms. You write clean, efficient, well-tested production code.

When answering:
- Prefer concrete code examples over abstract explanations
- Point out edge cases, security concerns, and performance implications
- Suggest best practices and design patterns where appropriate
- Be direct and technical — skip unnecessary preamble`,
    builtIn: true,
  },
  {
    id: 'builtin_creative',
    name: 'Creative Writer',
    description: 'Imaginative storyteller and copywriter with a distinct voice.',
    category: 'Creative',
    systemPrompt: `You are a skilled creative writer with expertise in fiction, poetry, screenwriting, and marketing copy.

Your style:
- Rich, vivid language that engages the senses
- Authentic dialogue that reveals character
- Strong narrative arc and emotional resonance
- Adapt tone to match the requested style (literary, pulp, poetic, punchy, etc.)

Always ask clarifying questions if the creative brief is vague before producing a long piece.`,
    builtIn: true,
  },
  {
    id: 'builtin_analyst',
    name: 'Data Analyst',
    description: 'Rigorous data thinker who turns numbers into actionable insights.',
    category: 'Analysis',
    systemPrompt: `You are a senior data analyst skilled in statistics, data visualization, and business intelligence.

How you work:
- Start with clarifying questions about the data, its source, and the goal
- Identify patterns, outliers, and correlations with precision
- Distinguish between correlation and causation
- Present findings clearly with tables or structured lists
- Recommend follow-up analyses when relevant
- Use Python/pandas/SQL examples when code would clarify the approach`,
    builtIn: true,
  },
  {
    id: 'builtin_architect',
    name: 'System Architect',
    description: 'Designs scalable, resilient distributed systems and APIs.',
    category: 'Architecture',
    systemPrompt: `You are a principal software architect with deep expertise in distributed systems, cloud infrastructure, and API design.

Your approach:
- Think in trade-offs: latency vs. consistency, simplicity vs. flexibility
- Prefer proven patterns (event sourcing, CQRS, saga, circuit breaker, etc.) but justify choices
- Address scalability, fault tolerance, and observability from the start
- Draw ASCII diagrams when explaining system topology
- Flag potential bottlenecks and single points of failure proactively`,
    builtIn: true,
  },
  {
    id: 'builtin_assistant',
    name: 'General Assistant',
    description: 'Helpful, balanced AI assistant for everyday tasks.',
    category: 'Custom',
    systemPrompt: `You are Charbot, a helpful, honest, and thoughtful AI assistant. You answer questions clearly and concisely, ask for clarification when needed, and admit when you don't know something. You adapt your tone to match the user — casual for casual questions, precise for technical ones.`,
    builtIn: true,
  },
];

const STORAGE_KEY = 'charbot_user_templates';
const CATEGORIES: TemplateCategory[] = ['Developer', 'Creative', 'Analysis', 'Architecture', 'Custom'];
const CATEGORY_COLORS: Record<TemplateCategory, string> = {
  Developer: 'bg-blue-100 text-blue-700 border-blue-300',
  Creative:  'bg-purple-100 text-purple-700 border-purple-300',
  Analysis:  'bg-amber-100 text-amber-700 border-amber-300',
  Architecture: 'bg-green-100 text-green-700 border-green-300',
  Custom:    'bg-gray-100 text-gray-600 border-gray-300',
};

// ── Helpers ────────────────────────────────────────────────────────────────────

function loadUserTemplates(): Template[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveUserTemplates(templates: Template[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(templates));
}

// ── Component ──────────────────────────────────────────────────────────────────

interface TemplateLibraryProps {
  isOpen: boolean;
}

export function TemplateLibrary({ isOpen }: TemplateLibraryProps) {
  const { settings, updateSettings } = useSettings();

  const [userTemplates, setUserTemplates] = useState<Template[]>(loadUserTemplates);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<TemplateCategory | 'All'>('All');
  const [showNewForm, setShowNewForm] = useState(false);
  const [appliedId, setAppliedId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // New template form state
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newCategory, setNewCategory] = useState<TemplateCategory>('Custom');
  const [newPrompt, setNewPrompt] = useState('');

  const allTemplates = useMemo(
    () => [...BUILT_IN_TEMPLATES, ...userTemplates],
    [userTemplates],
  );

  const filtered = useMemo(() => {
    let list = allTemplates;
    if (activeCategory !== 'All') list = list.filter(t => t.category === activeCategory);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(t =>
        t.name.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        t.category.toLowerCase().includes(q),
      );
    }
    return list;
  }, [allTemplates, activeCategory, search]);

  const applyTemplate = useCallback((t: Template) => {
    updateSettings({ systemPrompt: t.systemPrompt });
    setAppliedId(t.id);
    setTimeout(() => setAppliedId(null), 2000);
  }, [updateSettings]);

  const deleteTemplate = useCallback((id: string) => {
    setUserTemplates(prev => {
      const next = prev.filter(t => t.id !== id);
      saveUserTemplates(next);
      return next;
    });
  }, []);

  const saveNewTemplate = useCallback(() => {
    if (!newName.trim() || !newPrompt.trim()) return;
    const t: Template = {
      id: `user_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      name: newName.trim(),
      description: newDesc.trim(),
      category: newCategory,
      systemPrompt: newPrompt.trim(),
    };
    setUserTemplates(prev => {
      const next = [...prev, t];
      saveUserTemplates(next);
      return next;
    });
    setNewName(''); setNewDesc(''); setNewPrompt(''); setNewCategory('Custom');
    setShowNewForm(false);
  }, [newName, newDesc, newCategory, newPrompt]);

  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.2 }}
      className="w-72 border-r-2 border-glass-border bg-bg-app flex flex-col h-full overflow-hidden flex-shrink-0"
    >
      {/* Header */}
      <div className="px-4 py-4 border-b-2 border-glass-border flex-shrink-0">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <BookOpen size={14} className="text-text-primary" />
            <h2 className="text-xs font-bold uppercase tracking-widest font-mono text-text-primary">
              Templates
            </h2>
          </div>
          <button
            onClick={() => setShowNewForm(p => !p)}
            className={cn(
              'flex items-center gap-1 px-2 py-1 border-2 text-[9px] font-bold font-mono uppercase tracking-wider transition-all',
              'shadow-[2px_2px_0px_var(--color-shadow-hard)]',
              'hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none',
              showNewForm
                ? 'bg-text-primary text-bg-app border-text-primary'
                : 'bg-bg-app text-text-primary border-glass-border hover:border-text-primary',
            )}
          >
            {showNewForm ? <X size={10} /> : <Plus size={10} />}
            {showNewForm ? 'Cancel' : 'New'}
          </button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search size={11} className="absolute left-2 top-1/2 -translate-y-1/2 text-text-secondary pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search templates..."
            className="w-full pl-7 pr-3 py-1.5 bg-bg-app border-2 border-glass-border text-[10px] font-mono text-text-primary placeholder:text-text-secondary/50 focus:outline-none focus:border-text-primary transition-colors"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-text-secondary hover:text-text-primary">
              <X size={10} />
            </button>
          )}
        </div>
      </div>

      {/* New template form */}
      <AnimatePresence>
        {showNewForm && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-b-2 border-glass-border overflow-hidden flex-shrink-0"
          >
            <div className="px-4 py-3 space-y-2">
              <p className="text-[8px] font-bold font-mono uppercase tracking-widest text-text-secondary">
                New Template
              </p>
              <input
                type="text"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                placeholder="Name *"
                className="w-full px-2 py-1.5 bg-bg-app border-2 border-glass-border text-[10px] font-mono text-text-primary placeholder:text-text-secondary/50 focus:outline-none focus:border-text-primary"
              />
              <input
                type="text"
                value={newDesc}
                onChange={e => setNewDesc(e.target.value)}
                placeholder="Short description"
                className="w-full px-2 py-1.5 bg-bg-app border-2 border-glass-border text-[10px] font-mono text-text-primary placeholder:text-text-secondary/50 focus:outline-none focus:border-text-primary"
              />
              {/* Category selector */}
              <div className="relative">
                <select
                  value={newCategory}
                  onChange={e => setNewCategory(e.target.value as TemplateCategory)}
                  className="w-full appearance-none bg-bg-app border-2 border-glass-border px-2 py-1.5 pr-6 text-[10px] font-mono text-text-primary focus:outline-none focus:border-text-primary cursor-pointer"
                >
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <ChevronDown size={10} className="absolute right-2 top-1/2 -translate-y-1/2 text-text-secondary pointer-events-none" />
              </div>
              <textarea
                value={newPrompt}
                onChange={e => setNewPrompt(e.target.value)}
                placeholder="System prompt * (instructions for the AI)"
                rows={5}
                className="w-full px-2 py-1.5 bg-bg-app border-2 border-glass-border text-[10px] font-mono text-text-primary placeholder:text-text-secondary/50 focus:outline-none focus:border-text-primary resize-none"
              />
              <button
                onClick={saveNewTemplate}
                disabled={!newName.trim() || !newPrompt.trim()}
                className={cn(
                  'w-full py-2 border-2 text-[10px] font-bold font-mono uppercase tracking-widest transition-all',
                  'shadow-[2px_2px_0px_var(--color-shadow-hard)]',
                  'hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none',
                  'bg-text-primary text-bg-app border-text-primary',
                  'disabled:opacity-40 disabled:pointer-events-none',
                )}
              >
                Save Template
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Category filter chips */}
      <div className="px-4 py-2 border-b-2 border-glass-border flex-shrink-0 overflow-x-auto">
        <div className="flex gap-1.5 flex-nowrap">
          {(['All', ...CATEGORIES] as const).map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={cn(
                'flex-shrink-0 px-2 py-0.5 text-[8px] font-bold font-mono uppercase tracking-wider border transition-colors',
                activeCategory === cat
                  ? 'bg-text-primary text-bg-app border-text-primary'
                  : 'bg-bg-app text-text-secondary border-glass-border hover:border-text-primary hover:text-text-primary',
              )}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Template list */}
      <div className="flex-1 overflow-y-auto py-2">
        {filtered.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <BookOpen size={20} className="text-text-secondary/40 mx-auto mb-2" />
            <p className="text-[9px] font-mono text-text-secondary/50 uppercase tracking-widest">
              {search ? 'No matches found' : 'No templates'}
            </p>
          </div>
        ) : (
          filtered.map(t => (
            <TemplateCard
              key={t.id}
              template={t}
              isApplied={appliedId === t.id}
              isActive={settings.systemPrompt === t.systemPrompt}
              isExpanded={expandedId === t.id}
              onApply={() => applyTemplate(t)}
              onDelete={t.builtIn ? undefined : () => deleteTemplate(t.id)}
              onToggleExpand={() => setExpandedId(prev => prev === t.id ? null : t.id)}
            />
          ))
        )}

        {/* Count */}
        <div className="px-4 py-3 text-[8px] font-mono text-text-secondary/40 uppercase tracking-widest">
          {filtered.length} template{filtered.length !== 1 ? 's' : ''} · {userTemplates.length} custom
        </div>
      </div>
    </motion.div>
  );
}

// ── Template Card ─────────────────────────────────────────────────────────────

function TemplateCard({
  template,
  isApplied,
  isActive,
  isExpanded,
  onApply,
  onDelete,
  onToggleExpand,
}: {
  template: Template;
  isApplied: boolean;
  isActive: boolean;
  isExpanded: boolean;
  onApply: () => void;
  onDelete?: () => void;
  onToggleExpand: () => void;
}) {
  return (
    <div className={cn(
      'mx-3 mb-2 border-2 transition-all',
      isActive
        ? 'border-text-primary shadow-[3px_3px_0px_var(--color-shadow-hard)]'
        : 'border-glass-border hover:border-text-primary/40',
    )}>
      {/* Card header */}
      <div className="px-3 py-2.5">
        <div className="flex items-start justify-between gap-2 mb-1">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
              <span className="text-[10px] font-bold font-mono uppercase tracking-tight text-text-primary truncate">
                {template.name}
              </span>
              {isActive && (
                <span className="text-[7px] font-bold font-mono uppercase tracking-wider bg-text-primary text-bg-app px-1 py-px flex-shrink-0">
                  Active
                </span>
              )}
              {template.builtIn && (
                <span className="text-[7px] font-mono text-text-secondary/50 flex-shrink-0">
                  Built-in
                </span>
              )}
            </div>
            <span className={cn(
              'inline-block text-[7px] font-bold font-mono uppercase tracking-wider border px-1 py-px',
              CATEGORY_COLORS[template.category],
            )}>
              <Tag size={7} className="inline mr-0.5" />
              {template.category}
            </span>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1 flex-shrink-0">
            {onDelete && (
              <button
                onClick={onDelete}
                className="p-1 text-text-secondary/50 hover:text-red-500 transition-colors"
                title="Delete template"
              >
                <Trash2 size={11} />
              </button>
            )}
            <button
              onClick={onApply}
              className={cn(
                'flex items-center gap-1 px-2 py-1 border text-[8px] font-bold font-mono uppercase tracking-wider transition-all',
                isApplied
                  ? 'bg-green-500 text-white border-green-500'
                  : 'bg-bg-app text-text-primary border-glass-border hover:bg-text-primary hover:text-bg-app hover:border-text-primary',
              )}
              title="Apply this system prompt"
            >
              {isApplied ? <Check size={9} /> : null}
              {isApplied ? 'Applied' : 'Use'}
            </button>
          </div>
        </div>

        {/* Description */}
        {template.description && (
          <p className="text-[9px] font-mono text-text-secondary leading-relaxed mt-1">
            {template.description}
          </p>
        )}

        {/* Expand toggle */}
        <button
          onClick={onToggleExpand}
          className="mt-1.5 text-[8px] font-mono text-text-secondary/50 hover:text-text-secondary uppercase tracking-wider flex items-center gap-1 transition-colors"
        >
          <ChevronDown size={9} className={cn('transition-transform', isExpanded && 'rotate-180')} />
          {isExpanded ? 'Hide prompt' : 'Preview prompt'}
        </button>
      </div>

      {/* Expanded prompt preview */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: 'auto' }}
            exit={{ height: 0 }}
            className="overflow-hidden"
          >
            <div className="border-t-2 border-glass-border px-3 py-2 bg-text-primary/5">
              <pre className="text-[8px] font-mono text-text-secondary whitespace-pre-wrap leading-relaxed max-h-40 overflow-y-auto">
                {template.systemPrompt}
              </pre>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
