import React, { useState, useEffect } from 'react';
import { Search, Command, X, ArrowRight } from 'lucide-react';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (path: string) => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({ isOpen, onClose, onNavigate }) => {
  const [query, setQuery] = useState('');

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (isOpen) onClose();
        else {
          // Open handled by parent state
        }
      }
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const actions = [
    { title: 'Create New Lead', category: 'Leads', path: '/app/leads/new' },
    { title: 'View All Deals Kanban', category: 'Deals', path: '/app/deals' },
    { title: 'Create Sales Quote', category: 'Quotes', path: '/app/quotes/new' },
    { title: 'GST Tax Invoices', category: 'Finance', path: '/app/invoices' },
    { title: 'Products & Price Book', category: 'Catalog', path: '/app/products' },
    { title: 'Audit Trail & Logs', category: 'Security', path: '/app/audit' },
    { title: 'Organization Integrations', category: 'Settings', path: '/app/org/integrations' },
  ].filter(a => a.title.toLowerCase().includes(query.toLowerCase()) || a.category.toLowerCase().includes(query.toLowerCase()));

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 bg-slate-900/60 backdrop-blur-sm">
      <div className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="flex items-center px-4 py-3 border-b border-slate-200 dark:border-slate-800">
          <Search className="w-5 h-5 text-indigo-500 mr-3" />
          <input
            type="text"
            className="flex-1 bg-transparent text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none text-base"
            placeholder="Type a command or search (e.g. Lead, Quote, Invoice)..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
          />
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="max-h-96 overflow-y-auto p-2">
          {actions.length === 0 ? (
            <div className="py-8 text-center text-slate-500 text-sm">No commands matching "{query}"</div>
          ) : (
            actions.map((act, i) => (
              <button
                key={i}
                onClick={() => {
                  onNavigate(act.path);
                  onClose();
                }}
                className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-indigo-50 dark:hover:bg-slate-800 text-left transition"
              >
                <div>
                  <span className="text-sm font-medium text-slate-900 dark:text-slate-100">{act.title}</span>
                  <span className="ml-2 text-xs px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 border border-slate-200 dark:border-slate-700">{act.category}</span>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-400" />
              </button>
            ))
          )}
        </div>

        <div className="px-4 py-2 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-800 text-xs text-slate-400 flex justify-between items-center">
          <span>Press <kbd className="px-1.5 py-0.5 bg-white dark:bg-slate-700 border rounded shadow-xs">ESC</kbd> to close</span>
          <span className="flex items-center gap-1"><Command className="w-3 h-3" /> Navigation</span>
        </div>
      </div>
    </div>
  );
};
