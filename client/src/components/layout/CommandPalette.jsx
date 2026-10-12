import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Command } from 'cmdk';
import { toast } from 'sonner';
import { CornerDownLeft, LogOut, Moon, Play, Search, Server, Sun } from 'lucide-react';
import { FLAT_NAV } from './nav';
import ProviderLogo from '../ui/ProviderLogo';
import { useResources } from '../../hooks/useApi';
import { useDebounce } from '../../hooks/useDebounce';
import { useMoney } from '../../hooks/useMoney';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { forecastsApi } from '../../api/forecasts';
import { useQueryClient } from '@tanstack/react-query';

const Item = ({ children, onSelect, value }) => (
  <Command.Item value={value} onSelect={onSelect} className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] text-secondary">
    {children}
  </Command.Item>
);

export default function CommandPalette({ open, onClose }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const money = useMoney();
  const { theme, toggle } = useTheme();
  const { logout, canOperate } = useAuth();
  const [query, setQuery] = useState('');
  const search = useDebounce(query.trim(), 200);
  const { data, isFetching } = useResources(search.length >= 2 ? { search, limit: 8, sort: '-monthlyCost' } : null);

  useEffect(() => {
    if (!open) setQuery('');
  }, [open]);

  const go = (to) => {
    onClose();
    navigate(to);
  };
  const q = query.toLowerCase();
  const pages = FLAT_NAV.filter((n) => !q || n.label.toLowerCase().includes(q) || n.group.toLowerCase().includes(q));
  const resources = search.length >= 2 ? data?.items || [] : [];

  const runAnalysis = () => {
    onClose();
    toast.promise(forecastsApi.runAnalysis(), {
      loading: 'Running forecasts and optimization engines…',
      success: (r) => {
        qc.invalidateQueries();
        return `Analysis complete — ${r.generated} recommendations`;
      },
      error: (e) => e.message,
    });
  };

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[90] flex items-start justify-center px-4 pt-[12vh]">
          <motion.div className="absolute inset-0 bg-black/55 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: -8 }}
            transition={{ duration: 0.15 }}
            className="card-elevated gradient-border relative w-full max-w-xl overflow-hidden shadow-lift"
          >
            <Command shouldFilter={false} loop onKeyDown={(e) => e.key === 'Escape' && onClose()}>
              <div className="flex items-center gap-3 border-b border-line px-4">
                <Search className="h-4 w-4 text-muted" />
                <Command.Input autoFocus value={query} onValueChange={setQuery} placeholder="Jump to a page or search resources by name…" className="h-14 flex-1 bg-transparent text-sm text-fg outline-none placeholder:text-muted" />
                {isFetching && <span className="h-3 w-3 animate-spin rounded-full border-2 border-brand-violet border-t-transparent" />}
                <kbd className="num rounded-md border border-line-strong px-1.5 py-0.5 text-[10.5px] text-muted">Esc</kbd>
              </div>
              <Command.List className="max-h-[52vh] overflow-y-auto p-2">
                <Command.Empty className="py-10 text-center text-[13px] text-muted">{search.length >= 2 && isFetching ? 'Searching…' : 'No results'}</Command.Empty>
                {resources.length > 0 && (
                  <Command.Group heading="Resources">
                    {resources.map((r) => (
                      <Item key={r._id} value={`res-${r._id}`} onSelect={() => go(`/inventory/${r._id}`)}>
                        <ProviderLogo provider={r.provider} size={22} />
                        <div className="min-w-0 flex-1">
                          <div className="truncate font-medium text-fg">{r.name}</div>
                          <div className="truncate text-[11px] text-muted">{r.type.toUpperCase()} · {r.instanceType || `${r.sizeGb || ''} GB`} · {r.region}</div>
                        </div>
                        <span className="num text-xs">{money(r.monthlyCost)}/mo</span>
                      </Item>
                    ))}
                  </Command.Group>
                )}
                {pages.length > 0 && (
                  <Command.Group heading="Pages">
                    {pages.map((p) => (
                      <Item key={p.to} value={`page-${p.to}`} onSelect={() => go(p.to)}>
                        <p.icon className="h-4 w-4" />
                        <span className="flex-1 text-fg">{p.label}</span>
                        <span className="text-[11px] text-muted">{p.group}</span>
                      </Item>
                    ))}
                  </Command.Group>
                )}
                {!q && (
                  <Command.Group heading="Actions">
                    <Item value="act-theme" onSelect={() => { toggle(); onClose(); }}>
                      {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                      <span className="flex-1 text-fg">Switch to {theme === 'dark' ? 'light' : 'dark'} theme</span>
                    </Item>
                    {canOperate && (
                      <Item value="act-analysis" onSelect={runAnalysis}>
                        <Play className="h-4 w-4" />
                        <span className="flex-1 text-fg">Run optimization analysis</span>
                      </Item>
                    )}
                    <Item value="act-inventory" onSelect={() => go('/inventory?type=vm&state=running')}>
                      <Server className="h-4 w-4" />
                      <span className="flex-1 text-fg">Show running VMs</span>
                    </Item>
                    <Item value="act-logout" onSelect={() => { onClose(); logout(); }}>
                      <LogOut className="h-4 w-4" />
                      <span className="flex-1 text-fg">Sign out</span>
                    </Item>
                  </Command.Group>
                )}
              </Command.List>
              <div className="flex items-center gap-4 border-t border-line px-4 py-2.5 text-[11px] text-muted">
                <span className="flex items-center gap-1"><CornerDownLeft className="h-3 w-3" /> open</span>
                <span>↑↓ navigate</span>
                <span className="ml-auto">Type 2+ letters to search resources</span>
              </div>
            </Command>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
}
