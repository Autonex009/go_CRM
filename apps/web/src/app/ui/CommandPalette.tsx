import React, { useState, useEffect, useMemo } from 'react';
import { Search, Command, X, ArrowRight } from 'lucide-react';
import { useAuthStore } from '../auth/store';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (path: string) => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({ isOpen, onClose, onNavigate }) => {
  const [query, setQuery] = useState('');
  const user = useAuthStore((s) => s.user);
  const role = user?.role || 'sales';
  const isEngineer = role === 'engineer';
  const isManager = role === 'manager';
  const isAdmin = role === 'owner' || role === 'admin';
  // Sales and account managers see every ask on the board, so they get the
  // engineer workload view too (mirrors ENGINEER_TASKS_ROLES).
  const canSeeEngineerTasks =
    isAdmin || role === 'sales' || role === 'account_manager';

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (isOpen) onClose();
      }
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const rawActions = useMemo(() => {
    if (isEngineer) {
      return [
        { title: 'Engineer Dashboard', category: 'Overview', path: '/' },
        { title: 'My Tasks Kanban', category: 'Engineering', path: '/implementation' },
      ];
    }
    if (isManager) {
      return [
        { title: 'Dashboard Overview', category: 'Overview', path: '/' },
        { title: 'Implementation Board', category: 'Engineering', path: '/implementation' },
        { title: 'Engineer Tasks Matrix', category: 'Management', path: '/implementation/team-tasks' },
        { title: 'Team & Settings', category: 'Settings', path: '/team' },
      ];
    }
    return [
      { title: 'Dashboard Overview', category: 'Overview', path: '/' },
      { title: 'View All Deals Kanban', category: 'Pipeline', path: '/deals' },
      { title: 'View Leads Pipeline', category: 'Leads', path: '/leads' },
      { title: 'Companies & Accounts', category: 'CRM', path: '/accounts' },
      { title: 'Implementation Board', category: 'Engineering', path: '/implementation' },
      ...(canSeeEngineerTasks ? [{ title: 'Engineer Tasks Matrix', category: 'Management', path: '/implementation/team-tasks' }] : []),
      { title: 'Quotes Workbench', category: 'Sales', path: '/quotes' },
      { title: 'GST Tax Invoices', category: 'Finance', path: '/invoices' },
      { title: 'Sales Analytics', category: 'Metrics', path: '/metrics' },
      { title: 'Team & Settings', category: 'Settings', path: '/team' },
    ];
  }, [isEngineer, isManager, canSeeEngineerTasks]);

  if (!isOpen) return null;

  const actions = rawActions.filter(
    (a) =>
      a.title.toLowerCase().includes(query.toLowerCase()) ||
      a.category.toLowerCase().includes(query.toLowerCase()),
  );

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
