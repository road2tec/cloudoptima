import { useState } from 'react';
import { motion } from 'framer-motion';
import { Check, ChevronLeft, ChevronRight, Cloud, Database, KeyRound, LogIn, Play, RefreshCw, ScrollText, Settings2, Sparkles, Trash2, UserPlus, X, Zap } from 'lucide-react';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Select from '../components/ui/Select';
import EmptyState from '../components/ui/EmptyState';
import Skeleton from '../components/ui/Skeleton';
import { Avatar, PageHeader } from '../components/ui/misc';
import { useAudit, useAuditFacets } from '../hooks/useApi';
import { useMoney } from '../hooks/useMoney';
import { dateTime, timeAgo, titleCase } from '../lib/format';

const ACTION_META = {
  'auth.login': { icon: LogIn, color: '#64748B', verb: 'signed in' },
  'auth.register': { icon: UserPlus, color: '#22D3EE', verb: 'created an account' },
  'recommendation.approve': { icon: Check, color: '#10B981', verb: 'approved' },
  'recommendation.bulk-approve': { icon: Check, color: '#10B981', verb: 'bulk-approved' },
  'recommendation.reject': { icon: X, color: '#F43F5E', verb: 'rejected' },
  'recommendation.dry-run': { icon: Play, color: '#F59E0B', verb: 'dry-ran' },
  'recommendation.execute': { icon: Zap, color: '#8B5CF6', verb: 'executed' },
  'account.connect': { icon: Cloud, color: '#22D3EE', verb: 'connected account' },
  'account.sync': { icon: RefreshCw, color: '#6366F1', verb: 'synced account' },
  'account.delete': { icon: Trash2, color: '#F43F5E', verb: 'disconnected account' },
  'analysis.run': { icon: Sparkles, color: '#8B5CF6', verb: 'ran optimization analysis' },
  'forecast.run': { icon: Sparkles, color: '#22D3EE', verb: 'ran forecasts' },
  'user.settings.update': { icon: Settings2, color: '#64748B', verb: 'updated settings' },
  'system.seed': { icon: Database, color: '#64748B', verb: 'seeded the platform' },
};

function describe(e, money) {
  const d = e.details || {};
  if (d.title) return `${d.title}${d.monthlySaving ? ` · ${money(d.monthlySaving)}/mo` : ''}${d.note ? ` — “${d.note}”` : ''}`;
  if (e.action === 'recommendation.bulk-approve') return `${d.count} recommendations · ${money(d.monthlySaving)}/mo`;
  if (e.action === 'analysis.run') return `${d.generated} recommendations · ${money(d.potential)}/mo potential · ${(d.durationMs / 1000).toFixed(1)}s`;
  if (e.action === 'forecast.run') return `${d.resources} resources · avg MAPE ${d.avgMape}%`;
  if (d.name) return `${d.name}${d.provider ? ` (${d.provider.toUpperCase()})` : ''}${d.region ? ` · ${d.region}` : ''}`;
  if (e.action === 'user.settings.update' && d.settings) return Object.entries(d.settings).map(([k, v]) => `${titleCase(k)}: ${v}`).join(' · ');
  return e.entityType ? titleCase(e.entityType) : '';
}

const dayLabel = (d) => {
  const date = new Date(d);
  const today = new Date();
  const y = new Date(Date.now() - 86400000);
  if (date.toDateString() === today.toDateString()) return 'Today';
  if (date.toDateString() === y.toDateString()) return 'Yesterday';
  return date.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' });
};

export default function AuditLog() {
  const money = useMoney();
  const [user, setUser] = useState('');
  const [action, setAction] = useState('');
  const [page, setPage] = useState(1);
  const limit = 30;
  const { data, isLoading } = useAudit({ user, action, page, limit });
  const { data: facets } = useAuditFacets();
  const items = data?.items || [];
  const pages = Math.max(1, Math.ceil((data?.total || 0) / limit));

  // Group entries by calendar day for the timeline.
  const groups = [];
  items.forEach((e) => {
    const label = dayLabel(e.createdAt);
    if (groups.at(-1)?.label !== label) groups.push({ label, items: [] });
    groups.at(-1).items.push(e);
  });

  return (
    <div>
      <PageHeader
        title="Audit log"
        description="Every decision and change, who made it and when."
        actions={
          <>
            <Select className="w-48" label="User" value={user} onChange={(v) => { setUser(v); setPage(1); }} options={(facets?.users || []).map((u) => ({ value: u.id, label: u.name, hint: u.count }))} />
            <Select className="w-56" label="Action" value={action} onChange={(v) => { setAction(v); setPage(1); }} align="right" options={(facets?.actions || []).map((a) => ({ value: a.value, label: a.value, hint: a.count }))} />
          </>
        }
      />
      <Card>
        {isLoading ? (
          <div className="space-y-5">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="flex gap-4"><Skeleton className="h-9 w-9 rounded-full" /><div className="flex-1 space-y-2"><Skeleton className="h-3 w-1/2" /><Skeleton className="h-3 w-1/3" /></div></div>)}</div>
        ) : !items.length ? (
          <EmptyState icon={ScrollText} title="No audit entries" message="Nothing matches these filters yet." />
        ) : (
          <div className="space-y-8">
            {groups.map((g) => (
              <section key={g.label}>
                <div className="label mb-4">{g.label}</div>
                <ol className="relative space-y-1 border-l border-line-strong pl-7">
                  {g.items.map((e, i) => {
                    const meta = ACTION_META[e.action] || { icon: KeyRound, color: '#64748B', verb: e.action };
                    return (
                      <motion.li key={e._id} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: Math.min(i * 0.025, 0.4) }} className="relative rounded-xl px-3 py-3 transition hover:bg-fg/[0.025]">
                        <span className="absolute -left-[44px] top-3.5 grid h-8 w-8 place-items-center rounded-full border-4 border-surface" style={{ background: meta.color }}>
                          <meta.icon className="h-3.5 w-3.5 text-white" />
                        </span>
                        <div className="flex flex-wrap items-start gap-3">
                          <Avatar name={e.userName || 'System'} color={e.user?.avatarColor} size={28} />
                          <div className="min-w-0 flex-1 text-[13px]">
                            <div>
                              <span className="font-medium">{e.userName || 'System'}</span>{' '}
                              <span className="text-secondary">{meta.verb}</span>
                              {e.user?.role && <span className="ml-2 rounded bg-fg/[0.05] px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-muted">{e.user.role}</span>}
                            </div>
                            <div className="mt-0.5 truncate text-xs text-muted">{describe(e, money)}</div>
                          </div>
                          <div className="text-right text-[11px] text-muted" title={dateTime(e.createdAt)}>
                            <div>{timeAgo(e.createdAt)}</div>
                            <div className="num">{e.ip?.replace('::ffff:', '')}</div>
                          </div>
                        </div>
                      </motion.li>
                    );
                  })}
                </ol>
              </section>
            ))}
          </div>
        )}
        {pages > 1 && (
          <div className="mt-6 flex items-center justify-between border-t border-line pt-4 text-[13px] text-secondary">
            <span>Page <span className="num text-fg">{page}</span> of <span className="num text-fg">{pages}</span> · {data.total} entries</span>
            <div className="flex gap-1">
              <Button size="sm" variant="ghost" icon={ChevronLeft} disabled={page <= 1} onClick={() => setPage(page - 1)}>Prev</Button>
              <Button size="sm" variant="ghost" iconRight={ChevronRight} disabled={page >= pages} onClick={() => setPage(page + 1)}>Next</Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
