import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import clsx from 'clsx';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowRight, Check, CheckCheck, CircleCheck, CircleX, LayoutGrid, Loader2, PiggyBank, Play, Rows3, ShieldCheck, Sparkles, X, Zap } from 'lucide-react';
import Card, { stagger } from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import Select from '../components/ui/Select';
import Tabs, { Segmented } from '../components/ui/Tabs';
import EmptyState from '../components/ui/EmptyState';
import AnimatedNumber from '../components/ui/AnimatedNumber';
import { SkeletonCard, SkeletonRows } from '../components/ui/Skeleton';
import ProviderLogo from '../components/ui/ProviderLogo';
import { Table, TD, TH, THead, TR } from '../components/ui/Table';
import { Bar, PageHeader } from '../components/ui/misc';
import { useApprove, useBulkApprove, useExecuteFinished, useRecommendations, useReject } from '../hooks/useApi';
import { useMoney } from '../hooks/useMoney';
import { useAuth } from '../context/AuthContext';
import { recommendationsApi } from '../api/recommendations';
import { resourcesApi } from '../api/resources';
import { forecastsApi } from '../api/forecasts';
import { CATEGORIES, PROVIDERS, RISK_TONES, STATUS_TONES } from '../lib/constants';
import { timeAgo } from '../lib/format';

const NEED_ROLE = 'Approver role required';

// ---------- config diff (current → proposed) ----------
function ConfigDiff({ rec }) {
  const money = useMoney();
  const c = rec.currentConfig || {};
  const p = rec.proposedConfig || {};
  const left = c.instanceType || (c.sizeGb ? `${c.sizeGb} GB` : c.address || c.state || 'current');
  const right = p.instanceType || p.action;
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <span className="num rounded-lg border border-line bg-fg/[0.03] px-2.5 py-1.5">
        {left}
        {c.vcpu && <span className="text-muted"> · {c.vcpu}c/{c.memoryGb}G</span>}
        <span className="ml-2 text-muted">{money(c.monthlyCost)}</span>
      </span>
      <ArrowRight className="h-3.5 w-3.5 text-muted" />
      <span className="num rounded-lg border border-success/25 bg-success/[0.07] px-2.5 py-1.5 text-success">
        {right}
        {p.vcpu && <span className="opacity-70"> · {p.vcpu}c/{p.memoryGb}G</span>}
        <span className="ml-2 opacity-80">{money(p.monthlyCost)}</span>
      </span>
    </div>
  );
}

// ---------- reject modal ----------
function RejectModal({ rec, onClose }) {
  const [note, setNote] = useState('');
  const reject = useReject();
  return (
    <Modal
      open={Boolean(rec)}
      onClose={onClose}
      title="Reject recommendation"
      description={rec?.title}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="danger" icon={X} loading={reject.isPending} disabled={note.trim().length < 3} onClick={() => reject.mutate({ id: rec._id, note }, { onSuccess: onClose })}>
            Reject
          </Button>
        </>
      }
    >
      <label className="block">
        <span className="mb-1.5 block text-xs font-medium text-secondary">Reason (saved to the audit log)</span>
        <textarea autoFocus value={note} onChange={(e) => setNote(e.target.value)} rows={4} placeholder="e.g. Capacity reserved for the Diwali sale traffic peak" className="input h-auto py-2.5" />
      </label>
    </Modal>
  );
}

// ---------- simulate-execute modal with 3 animated steps ----------
const STEPS = [
  { key: 'dry', label: 'Dry run', desc: 'Validate the plan against the live resource' },
  { key: 'apply', label: 'Applying', desc: 'Connector calls the provider API' },
  { key: 'verify', label: 'Verified', desc: 'Re-read resource through the normalizer' },
];

function ExecuteModal({ rec, onClose }) {
  const money = useMoney();
  const finished = useExecuteFinished();
  const [step, setStep] = useState(-1);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const done = step === 3;

  const reset = () => {
    setStep(-1);
    setError(null);
    setResult(null);
    onClose();
  };

  async function start() {
    setError(null);
    try {
      setStep(0);
      const [dry] = await Promise.all([recommendationsApi.execute(rec._id, true), new Promise((r) => setTimeout(r, 700))]);
      setStep(1);
      const [applied] = await Promise.all([recommendationsApi.execute(rec._id), new Promise((r) => setTimeout(r, 900))]);
      setStep(2);
      const [fresh] = await Promise.all([resourcesApi.get(rec.resource._id), new Promise((r) => setTimeout(r, 600))]);
      const res = fresh.resource;
      const ok = rec.action?.type === 'resize' ? res.instanceType === rec.proposedConfig.instanceType : res.state === 'terminated';
      if (!ok) throw new Error('Verification failed — resource state does not match the plan');
      setResult({ plan: dry.plan, applied, resource: res });
      setStep(3);
      finished();
      toast.success('Change applied and verified', { description: `${money(rec.monthlySaving)}/mo moved to realized savings` });
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <Modal open={Boolean(rec)} onClose={reset} dismissable={step === -1 || done || Boolean(error)} title="Simulate execution" description={rec?.title} size="md"
      footer={
        done ? (
          <Button variant="primary" onClick={reset}>Done</Button>
        ) : (
          <>
            <Button variant="ghost" onClick={reset} disabled={step >= 0 && !error}>Cancel</Button>
            <Button variant="primary" icon={Play} loading={step >= 0 && !error} onClick={start}>{error ? 'Retry' : 'Execute change'}</Button>
          </>
        )
      }
    >
      {rec && (
        <div className="space-y-5">
          <div className="flex items-center gap-3 rounded-xl border border-line bg-fg/[0.02] p-3">
            <ProviderLogo provider={rec.resource?.provider} size={32} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13px] font-medium">{rec.resource?.name}</div>
              <div className="text-[11px] text-muted">{PROVIDERS[rec.resource?.provider]?.name} · {rec.resource?.region}</div>
            </div>
            <div className="num text-right text-sm font-semibold text-success">{money(rec.monthlySaving)}<span className="text-[11px] font-normal text-muted">/mo</span></div>
          </div>
          <ConfigDiff rec={rec} />

          <ol className="relative space-y-1">
            {STEPS.map((s, i) => {
              const state = error && step === i ? 'error' : step > i ? 'done' : step === i ? 'active' : 'idle';
              return (
                <li key={s.key} className="relative flex gap-4 py-2">
                  {i < STEPS.length - 1 && <span className="absolute left-[15px] top-10 h-[calc(100%-24px)] w-px bg-line-strong"><motion.span className="block w-full bg-brand" initial={{ height: 0 }} animate={{ height: step > i ? '100%' : 0 }} transition={{ duration: 0.4 }} /></span>}
                  <motion.span
                    animate={{ scale: state === 'active' ? [1, 1.08, 1] : 1 }}
                    transition={{ repeat: state === 'active' ? Infinity : 0, duration: 1.2 }}
                    className={clsx('relative z-10 grid h-8 w-8 shrink-0 place-items-center rounded-full border text-xs font-semibold',
                      state === 'done' && 'border-transparent bg-success text-white',
                      state === 'active' && 'border-brand-violet bg-brand-violet/15 text-brand-violet',
                      state === 'error' && 'border-danger bg-danger/15 text-danger',
                      state === 'idle' && 'border-line-strong text-muted')}
                  >
                    {state === 'done' ? <Check className="h-4 w-4" /> : state === 'active' ? <Loader2 className="h-4 w-4 animate-spin" /> : state === 'error' ? <X className="h-4 w-4" /> : i + 1}
                  </motion.span>
                  <div>
                    <div className={clsx('text-[13px] font-medium', state === 'idle' ? 'text-muted' : 'text-fg')}>{s.label}</div>
                    <div className="text-xs text-muted">{s.desc}</div>
                    {state === 'error' && <div className="mt-1 text-xs text-danger">{error}</div>}
                  </div>
                </li>
              );
            })}
          </ol>

          <AnimatePresence>
            {done && result && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex items-start gap-3 rounded-xl border border-success/25 bg-success/[0.07] p-4 text-[13px]">
                <CircleCheck className="mt-0.5 h-5 w-5 shrink-0 text-success" />
                <div>
                  <div className="font-medium text-success">{result.plan.description} completed</div>
                  <div className="mt-0.5 text-secondary">
                    Resource is now <span className="num text-fg">{result.resource.instanceType || result.resource.state}</span> · new run-rate <span className="num text-fg">{money(result.resource.monthlyCost)}/mo</span>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </Modal>
  );
}

// ---------- recommendation card ----------
function RecCard({ rec, selected, onSelect, onReject, onExecute }) {
  const money = useMoney();
  const { canOperate } = useAuth();
  const approve = useApprove();
  const cat = CATEGORIES[rec.category];
  const selectable = rec.status === 'open';
  return (
    <motion.article layout variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } }} exit={{ opacity: 0, scale: 0.98 }}
      className={clsx('card group relative flex flex-col overflow-hidden p-5 transition hover:shadow-lift', selected && 'ring-1 ring-brand-violet/60')}>
      <div className="absolute inset-y-0 left-0 w-[3px]" style={{ background: cat.color }} />
      <div className="flex items-start gap-3">
        {selectable && canOperate && (
          <input type="checkbox" checked={selected} onChange={() => onSelect(rec._id)} className="mt-3 accent-[#8B5CF6]" aria-label="Select recommendation" />
        )}
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl" style={{ background: `${cat.color}1A`, color: cat.color }}><cat.icon className="h-5 w-5" /></span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-medium uppercase tracking-wider" style={{ color: cat.color }}>{cat.label}</span>
            <Badge tone={RISK_TONES[rec.risk]} className="!h-5 !text-[10.5px]">{rec.risk} risk</Badge>
            {rec.status !== 'open' && <Badge tone={STATUS_TONES[rec.status]} className="!h-5 !text-[10.5px]">{rec.status}</Badge>}
          </div>
          <h3 className="mt-1 text-[14px] font-semibold leading-snug">{rec.title}</h3>
          {rec.resource && (
            <Link to={`/inventory/${rec.resource._id}`} className="mt-1 inline-flex items-center gap-1.5 text-xs text-secondary hover:text-brand-violet">
              <ProviderLogo provider={rec.resource.provider} size={14} /> {rec.resource.name} · {rec.resource.region}
              {rec.resource.tags?.env && <span className="text-muted">· {rec.resource.tags.env}</span>}
            </Link>
          )}
        </div>
        <div className="text-right">
          <div className="num text-[22px] font-semibold leading-none tracking-tight text-success">{money(rec.monthlySaving)}</div>
          <div className="mt-1 text-[11px] text-muted">saved / month</div>
        </div>
      </div>

      <p className="mt-4 text-[13px] leading-relaxed text-secondary">{rec.reason}</p>
      <div className="mt-4"><ConfigDiff rec={rec} /></div>

      <div className="mt-4 flex items-center gap-3">
        <span className="text-[11px] text-muted">Confidence</span>
        <Bar value={rec.confidence * 100} className="flex-1" height={5} />
        <span className="num text-xs">{Math.round(rec.confidence * 100)}%</span>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-4">
        {rec.status === 'open' && (
          <>
            <Button size="sm" variant="success" icon={Check} loading={approve.isPending} disabledReason={canOperate ? null : NEED_ROLE} onClick={() => approve.mutate({ id: rec._id })}>Approve</Button>
            <Button size="sm" variant="ghost" icon={X} disabledReason={canOperate ? null : NEED_ROLE} onClick={() => onReject(rec)}>Reject</Button>
          </>
        )}
        {rec.status === 'approved' && (
          <>
            <Button size="sm" variant="primary" icon={Zap} disabledReason={canOperate ? null : NEED_ROLE} onClick={() => onExecute(rec)}>Simulate execute</Button>
            <Button size="sm" variant="ghost" icon={X} disabledReason={canOperate ? null : NEED_ROLE} onClick={() => onReject(rec)}>Reject</Button>
          </>
        )}
        <span className="ml-auto text-[11px] text-muted">
          {rec.status === 'executed' ? `Executed by ${rec.executedBy?.name || '—'} · ${timeAgo(rec.executedAt)}` : rec.decidedBy ? `${rec.status} by ${rec.decidedBy.name} · ${timeAgo(rec.decidedAt)}` : `Found ${timeAgo(rec.createdAt)}`}
        </span>
      </div>
      {rec.note && <div className="mt-2 rounded-lg bg-fg/[0.03] px-3 py-2 text-xs italic text-secondary">“{rec.note}”</div>}
    </motion.article>
  );
}

// ---------- page ----------
const STATUS_TABS = [
  { value: 'open', label: 'Open' },
  { value: 'approved', label: 'Approved' },
  { value: 'executed', label: 'Executed' },
  { value: 'rejected', label: 'Rejected' },
  { value: '', label: 'All' },
];

export default function Recommendations() {
  const money = useMoney();
  const qc = useQueryClient();
  const { canOperate } = useAuth();
  const [status, setStatus] = useState('open');
  const [category, setCategory] = useState('');
  const [provider, setProvider] = useState('');
  const [risk, setRisk] = useState('');
  const [sort, setSort] = useState('saving');
  const [view, setView] = useState('cards');
  const [selected, setSelected] = useState(new Set());
  const [rejecting, setRejecting] = useState(null);
  const [executing, setExecuting] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const bulk = useBulkApprove();

  const params = useMemo(() => ({ status, category, provider, risk, sort }), [status, category, provider, risk, sort]);
  const { data, isLoading, isFetching } = useRecommendations(params);
  const items = data?.items || [];
  const summary = data?.summary;

  const toggle = (id) => setSelected((s) => {
    const n = new Set(s);
    n.has(id) ? n.delete(id) : n.add(id);
    return n;
  });
  const lowRiskOpen = items.filter((r) => r.status === 'open' && r.risk === 'low');
  const selectedLow = [...selected].filter((id) => lowRiskOpen.some((r) => r._id === id));
  const selectedSaving = items.filter((r) => selected.has(r._id)).reduce((s, r) => s + r.monthlySaving, 0);

  const runAnalysis = () => {
    setAnalyzing(true);
    toast.promise(forecastsApi.runAnalysis(), {
      loading: 'Forecasting demand and running idle / right-size engines…',
      success: (r) => {
        qc.invalidateQueries();
        return `Analysis complete — ${r.generated} open recommendations`;
      },
      error: (e) => e.message,
      finally: () => setAnalyzing(false),
    });
  };

  return (
    <div>
      <PageHeader
        title="Recommendations"
        description="Every finding explains itself with real numbers. Approve, reject, then simulate execution against the cloud."
        actions={<Button icon={Sparkles} loading={analyzing} onClick={runAnalysis} disabledReason={canOperate ? null : NEED_ROLE}>Re-run analysis</Button>}
      />

      {/* summary strip */}
      <Card className="mb-4" padded={false}>
        <div className="relative grid gap-6 overflow-hidden p-5 lg:grid-cols-[auto_1fr]">
          <div className="pointer-events-none absolute -left-16 -top-20 h-56 w-56 rounded-full bg-success opacity-10 blur-3xl" />
          <div className="relative flex gap-8">
            <div>
              <div className="label">Potential / month</div>
              {summary ? <AnimatedNumber value={summary.potential} format={(v) => money(v)} className="num mt-1 block text-[32px] font-semibold tracking-tight text-success" /> : <div className="mt-2 h-8 w-36 animate-pulse rounded bg-fg/5" />}
              <div className="text-xs text-muted">{summary ? `${summary.counts.open} open · ${summary.counts.approved} approved` : ' '}</div>
            </div>
            <div>
              <div className="label">Realized / month</div>
              {summary ? <AnimatedNumber value={summary.realized} format={(v) => money(v)} className="num mt-1 block text-[32px] font-semibold tracking-tight" /> : <div className="mt-2 h-8 w-28 animate-pulse rounded bg-fg/5" />}
              <div className="text-xs text-muted">{summary ? `${summary.counts.executed} executed` : ' '}</div>
            </div>
          </div>
          <div className="relative flex flex-wrap content-center gap-2 lg:justify-end">
            {(summary?.byCategory || []).map((c) => {
              const meta = CATEGORIES[c.key];
              const active = category === c.key;
              return (
                <button key={c.key} onClick={() => setCategory(active ? '' : c.key)}
                  className={clsx('flex items-center gap-2 rounded-xl border px-3 py-2 text-left transition', active ? 'border-transparent ring-1' : 'border-line hover:border-line-strong')}
                  style={active ? { background: `${meta.color}14`, '--tw-ring-color': meta.color } : undefined}>
                  <meta.icon className="h-4 w-4" style={{ color: meta.color }} />
                  <span>
                    <span className="block text-[11px] text-muted">{meta.label} · {c.count}</span>
                    <span className="num block text-[13px] font-semibold">{money(c.saving)}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </Card>

      {/* filters */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Tabs tabs={STATUS_TABS.map((t) => ({ ...t, count: t.value && summary ? summary.counts[t.value] : undefined }))} value={status} onChange={(v) => { setStatus(v); setSelected(new Set()); }} className="mr-auto border-0" />
        <Select className="w-36" label="Cloud" value={provider} onChange={setProvider} options={Object.entries(PROVIDERS).map(([k, p]) => ({ value: k, label: p.label, icon: <ProviderLogo provider={k} size={14} /> }))} />
        <Select className="w-32" label="Risk" value={risk} onChange={setRisk} options={['low', 'medium', 'high'].map((r) => ({ value: r, label: r }))} />
        <Select className="w-44" label="Sort" value={sort} onChange={setSort} allowClear={false} options={[{ value: 'saving', label: 'Highest saving' }, { value: 'confidence', label: 'Confidence' }, { value: 'risk', label: 'Risk' }, { value: 'newest', label: 'Newest' }]} />
        <Segmented options={[{ value: 'cards', label: 'Cards', icon: LayoutGrid }, { value: 'table', label: 'Table', icon: Rows3 }]} value={view} onChange={setView} size="md" />
      </div>

      {/* bulk bar */}
      {canOperate && status === 'open' && lowRiskOpen.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-line bg-surface px-4 py-3 text-[13px]">
          <ShieldCheck className="h-4 w-4 text-success" />
          <span className="text-secondary">
            {selected.size ? <><span className="num text-fg">{selected.size}</span> selected · <span className="num text-success">{money(selectedSaving)}</span>/mo</> : <><span className="num text-fg">{lowRiskOpen.length}</span> low-risk items can be bulk approved</>}
          </span>
          <div className="ml-auto flex gap-2">
            <Button size="sm" variant="ghost" onClick={() => setSelected(selected.size ? new Set() : new Set(lowRiskOpen.map((r) => r._id)))}>{selected.size ? 'Clear' : 'Select all low-risk'}</Button>
            <Button size="sm" variant="success" icon={CheckCheck} loading={bulk.isPending} disabled={!selectedLow.length} onClick={() => bulk.mutate(selectedLow, { onSuccess: () => setSelected(new Set()) })}>
              Approve {selectedLow.length || ''} low-risk
            </Button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="grid gap-4 xl:grid-cols-2">{Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} lines={5} />)}</div>
      ) : !items.length ? (
        <Card><EmptyState icon={status === 'open' ? PiggyBank : CircleX} title={status === 'open' ? 'No open recommendations' : `Nothing ${status || 'here'} yet`} message={status === 'open' ? 'Great work — or re-run the analysis to look again.' : 'Recommendations move here as they are decided.'} /></Card>
      ) : view === 'cards' ? (
        <motion.div variants={stagger} initial="hidden" animate="show" className={clsx('grid gap-4 transition-opacity xl:grid-cols-2', isFetching && 'opacity-70')}>
          <AnimatePresence initial={false}>
            {items.map((r) => (
              <RecCard key={r._id} rec={r} selected={selected.has(r._id)} onSelect={toggle} onReject={setRejecting} onExecute={setExecuting} />
            ))}
          </AnimatePresence>
        </motion.div>
      ) : (
        <Card padded={false}>
          <Table maxHeight="calc(100vh - 360px)">
            <THead>
              <tr>
                <TH>Recommendation</TH>
                <TH>Resource</TH>
                <TH>Risk</TH>
                <TH>Confidence</TH>
                <TH>Status</TH>
                <TH align="right">Saving / mo</TH>
                <TH align="right">Actions</TH>
              </tr>
            </THead>
            <tbody>
              {isFetching && !items.length && <SkeletonRows cols={7} />}
              {items.map((r) => <RecRow key={r._id} rec={r} onReject={setRejecting} onExecute={setExecuting} />)}
            </tbody>
          </Table>
        </Card>
      )}

      <RejectModal rec={rejecting} onClose={() => setRejecting(null)} />
      <ExecuteModal rec={executing} onClose={() => setExecuting(null)} />
    </div>
  );
}

function RecRow({ rec, onReject, onExecute }) {
  const money = useMoney();
  const { canOperate } = useAuth();
  const approve = useApprove();
  const cat = CATEGORIES[rec.category];
  return (
    <TR>
      <TD>
        <div className="flex items-center gap-2.5">
          <span className="grid h-7 w-7 place-items-center rounded-lg" style={{ background: `${cat.color}1A`, color: cat.color }}><cat.icon className="h-3.5 w-3.5" /></span>
          <span className="max-w-[320px] truncate font-medium" title={rec.reason}>{rec.title}</span>
        </div>
      </TD>
      <TD>{rec.resource && <Link to={`/inventory/${rec.resource._id}`} className="flex items-center gap-1.5 text-secondary hover:text-brand-violet"><ProviderLogo provider={rec.resource.provider} size={16} />{rec.resource.name}</Link>}</TD>
      <TD><Badge tone={RISK_TONES[rec.risk]}>{rec.risk}</Badge></TD>
      <TD><div className="flex w-28 items-center gap-2"><Bar value={rec.confidence * 100} height={4} /><span className="num text-xs">{Math.round(rec.confidence * 100)}%</span></div></TD>
      <TD><Badge tone={STATUS_TONES[rec.status]}>{rec.status}</Badge></TD>
      <TD align="right" mono className="font-semibold text-success">{money(rec.monthlySaving)}</TD>
      <TD align="right">
        <div className="flex justify-end gap-1.5">
          {rec.status === 'open' && <Button size="xs" variant="success" icon={Check} loading={approve.isPending} disabledReason={canOperate ? null : NEED_ROLE} onClick={() => approve.mutate({ id: rec._id })}>Approve</Button>}
          {rec.status === 'approved' && <Button size="xs" variant="primary" icon={Zap} disabledReason={canOperate ? null : NEED_ROLE} onClick={() => onExecute(rec)}>Execute</Button>}
          {['open', 'approved'].includes(rec.status) && <Button size="xs" variant="ghost" icon={X} disabledReason={canOperate ? null : NEED_ROLE} onClick={() => onReject(rec)} aria-label="Reject" />}
        </div>
      </TD>
    </TR>
  );
}
