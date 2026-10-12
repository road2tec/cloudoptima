import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import clsx from 'clsx';
import { ArrowUpRight, ChevronLeft, ChevronRight, Columns3, Filter, Search, SearchX, X } from 'lucide-react';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import Select from '../components/ui/Select';
import EmptyState from '../components/ui/EmptyState';
import { Drawer } from '../components/ui/Modal';
import ProviderLogo, { ProviderChip } from '../components/ui/ProviderLogo';
import { SkeletonRows } from '../components/ui/Skeleton';
import { Table, TD, TH, THead, TR } from '../components/ui/Table';
import { KeyValue, PageHeader } from '../components/ui/misc';
import { useResourceFacets, useResources } from '../hooks/useApi';
import { useDebounce } from '../hooks/useDebounce';
import { useMoney } from '../hooks/useMoney';
import { PROVIDERS, RESOURCE_TYPES, STATE_TONES } from '../lib/constants';
import { shortId, timeAgo } from '../lib/format';

const COLUMNS = [
  { key: 'name', label: 'Resource', field: 'name', always: true },
  { key: 'provider', label: 'Provider', field: 'provider' },
  { key: 'type', label: 'Type', field: 'type' },
  { key: 'region', label: 'Region', field: 'region' },
  { key: 'size', label: 'Size', field: 'instanceType' },
  { key: 'state', label: 'State', field: 'state' },
  { key: 'env', label: 'Env' },
  { key: 'team', label: 'Team' },
  { key: 'created', label: 'Created', field: 'createdAt' },
  { key: 'cost', label: 'Monthly cost', field: 'monthlyCost', align: 'right', always: true },
];
const COL_KEY = 'co-inventory-cols';
const DEFAULT_COLS = COLUMNS.filter((c) => c.key !== 'created').map((c) => c.key);
const FILTER_KEYS = ['provider', 'region', 'type', 'state', 'env', 'search'];

function ColumnToggle({ visible, setVisible }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => !ref.current?.contains(e.target) && setOpen(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);
  return (
    <div ref={ref} className="relative">
      <Button size="sm" icon={Columns3} onClick={() => setOpen((o) => !o)}>Columns</Button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} className="absolute right-0 z-40 mt-1.5 w-48 rounded-xl border border-line-strong bg-elevated p-1.5 shadow-lift">
            {COLUMNS.filter((c) => !c.always).map((c) => (
              <label key={c.key} className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] text-secondary hover:bg-fg/5">
                <input type="checkbox" className="accent-[#8B5CF6]" checked={visible.includes(c.key)} onChange={(e) => setVisible((v) => (e.target.checked ? [...v, c.key] : v.filter((x) => x !== c.key)))} />
                {c.label}
              </label>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ResourceDrawer({ resource, onClose }) {
  const money = useMoney();
  const navigate = useNavigate();
  const r = resource;
  const Icon = r ? RESOURCE_TYPES[r.type]?.icon : null;
  return (
    <Drawer
      open={Boolean(r)}
      onClose={onClose}
      title={
        r && (
          <div className="flex items-center gap-3">
            <ProviderLogo provider={r.provider} size={36} />
            <div className="min-w-0">
              <div className="truncate text-[15px] font-semibold">{r.name}</div>
              <div className="num truncate text-[11px] text-muted">{shortId(r.resourceId)}</div>
            </div>
          </div>
        )
      }
      footer={
        r && (
          <Button variant="primary" className="w-full justify-center" iconRight={ArrowUpRight} onClick={() => navigate(`/inventory/${r._id}`)}>
            Open full details
          </Button>
        )
      }
    >
      {r && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-line bg-fg/[0.02] p-3">
              <div className="label">Monthly cost</div>
              <div className="num mt-1 text-xl font-semibold">{money(r.monthlyCost)}</div>
            </div>
            <div className="rounded-xl border border-line bg-fg/[0.02] p-3">
              <div className="label">State</div>
              <div className="mt-1.5"><Badge tone={STATE_TONES[r.state]} dot>{r.state}</Badge></div>
            </div>
          </div>
          <div className="divide-y divide-line">
            <KeyValue label="Type"><span className="inline-flex items-center gap-1.5">{Icon && <Icon className="h-3.5 w-3.5 text-muted" />}{RESOURCE_TYPES[r.type]?.label}</span></KeyValue>
            <KeyValue label="Account">{r.account?.name}</KeyValue>
            <KeyValue label="Region" mono>{r.region}{r.zone && r.zone !== r.region ? ` · ${r.zone}` : ''}</KeyValue>
            {r.instanceType && <KeyValue label="Instance type" mono>{r.instanceType}</KeyValue>}
            {r.vcpu && <KeyValue label="vCPU / memory" mono>{r.vcpu} vCPU · {r.memoryGb} GB</KeyValue>}
            {r.sizeGb && <KeyValue label="Size" mono>{r.sizeGb} GB</KeyValue>}
            {r.meta?.address && <KeyValue label="Address" mono>{r.meta.address}</KeyValue>}
            <KeyValue label="Hourly price" mono>{money(r.hourlyPrice, { decimals: 4 })}</KeyValue>
            {r.attachedTo && <KeyValue label="Attached to" mono>{shortId(r.attachedTo)}</KeyValue>}
            <KeyValue label="Created">{r.createdAt ? timeAgo(r.createdAt) : '—'}</KeyValue>
            <KeyValue label="Native ID" mono>{shortId(r.nativeId)}</KeyValue>
          </div>
          <div>
            <div className="label mb-2">Tags</div>
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(r.tags || {}).map(([k, v]) => (
                <span key={k} className="num rounded-md border border-line bg-fg/[0.03] px-2 py-1 text-[11px]"><span className="text-muted">{k}=</span>{v}</span>
              ))}
            </div>
          </div>
        </div>
      )}
    </Drawer>
  );
}

export default function Inventory() {
  const money = useMoney();
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState(params.get('search') || '');
  const debounced = useDebounce(search, 300);
  const [selected, setSelected] = useState(null);
  const [visible, setVisible] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(COL_KEY)) || DEFAULT_COLS;
    } catch {
      return DEFAULT_COLS;
    }
  });
  useEffect(() => localStorage.setItem(COL_KEY, JSON.stringify(visible)), [visible]);

  const f = Object.fromEntries(FILTER_KEYS.map((k) => [k, params.get(k) || '']));
  const sort = params.get('sort') || '-monthlyCost';
  const page = Number(params.get('page')) || 1;
  const limit = 25;

  const update = (patch) => {
    const next = new URLSearchParams(params);
    Object.entries(patch).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)));
    if (!('page' in patch)) next.delete('page');
    setParams(next, { replace: true });
  };
  useEffect(() => {
    if (debounced !== f.search) update({ search: debounced });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced]);

  const query = useMemo(
    () => ({ provider: f.provider, region: f.region, type: f.type, state: f.state, tag: f.env ? `env:${f.env}` : '', search: f.search, sort, page, limit }),
    [f.provider, f.region, f.type, f.state, f.env, f.search, sort, page]
  );
  const { data, isLoading, isFetching } = useResources(query);
  const { data: facets } = useResourceFacets();

  const regionOpts = (facets?.regions || []).filter((r) => !f.provider || r.provider === f.provider).map((r) => ({ value: r.value, label: r.value, hint: r.count, icon: <ProviderLogo provider={r.provider} size={14} /> }));
  const activeFilters = FILTER_KEYS.filter((k) => f[k]).length;
  const cols = COLUMNS.filter((c) => c.always || visible.includes(c.key));
  const total = data?.total || 0;
  const pages = Math.max(1, Math.ceil(total / limit));

  return (
    <div>
      <PageHeader title="Inventory" description="Every VM, disk, IP and snapshot across AWS, Azure and Google Cloud — normalized into one schema." />

      <Card padded={false} className="overflow-visible">
        <div className="flex flex-wrap items-center gap-2 border-b border-line p-3">
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, ID, type or region…" className="input h-9 pl-9" />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted hover:text-fg" aria-label="Clear search">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <Select className="w-36" label="Cloud" value={f.provider} onChange={(v) => update({ provider: v, region: '' })} options={Object.entries(PROVIDERS).map(([k, p]) => ({ value: k, label: p.label, icon: <ProviderLogo provider={k} size={14} /> }))} />
          <Select className="w-44" label="Region" value={f.region} onChange={(v) => update({ region: v })} options={regionOpts} />
          <Select className="w-36" label="Type" value={f.type} onChange={(v) => update({ type: v })} options={Object.entries(RESOURCE_TYPES).map(([k, t]) => ({ value: k, label: t.short, hint: facets?.types.find((x) => x.value === k)?.count }))} />
          <Select className="w-36" label="State" value={f.state} onChange={(v) => update({ state: v })} options={['running', 'stopped', 'in-use', 'available', 'terminated'].map((s) => ({ value: s, label: s }))} />
          <Select className="w-32" label="Env" value={f.env} onChange={(v) => update({ env: v })} options={(facets?.envs || []).map((e) => ({ value: e.value, label: e.value, hint: e.count }))} />
          {activeFilters > 0 && (
            <Button size="sm" variant="ghost" icon={X} onClick={() => { setSearch(''); setParams({}, { replace: true }); }}>
              Clear {activeFilters}
            </Button>
          )}
          <div className="ml-auto"><ColumnToggle visible={visible} setVisible={setVisible} /></div>
        </div>

        <Table maxHeight="calc(100vh - 290px)">
          <THead>
            <tr>
              {cols.map((c) => (
                <TH key={c.key} field={c.field} sort={sort} onSort={(s) => update({ sort: s })} align={c.align}>{c.label}</TH>
              ))}
            </tr>
          </THead>
          <tbody className={clsx('transition-opacity', isFetching && !isLoading && 'opacity-60')}>
            {isLoading && <SkeletonRows rows={10} cols={cols.length} />}
            {!isLoading &&
              data.items.map((r) => {
                const Icon = RESOURCE_TYPES[r.type]?.icon;
                return (
                  <TR key={r._id} onClick={() => setSelected(r)} selected={selected?._id === r._id}>
                    {cols.map((c) => {
                      switch (c.key) {
                        case 'name':
                          return (
                            <TD key={c.key}>
                              <div className="flex items-center gap-3">
                                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-line bg-fg/[0.03]">{Icon && <Icon className="h-4 w-4 text-secondary" />}</span>
                                <div className="min-w-0">
                                  <Link to={`/inventory/${r._id}`} onClick={(e) => e.stopPropagation()} className="block max-w-[260px] truncate font-medium text-fg hover:text-brand-violet">{r.name}</Link>
                                  <div className="num max-w-[260px] truncate text-[11px] text-muted">{shortId(r.nativeId)}</div>
                                </div>
                              </div>
                            </TD>
                          );
                        case 'provider':
                          return <TD key={c.key}><ProviderChip provider={r.provider} /></TD>;
                        case 'type':
                          return <TD key={c.key} className="text-secondary">{RESOURCE_TYPES[r.type]?.short}</TD>;
                        case 'region':
                          return <TD key={c.key} mono className="text-secondary">{r.region}</TD>;
                        case 'size':
                          return <TD key={c.key} mono className="text-secondary">{r.instanceType || (r.sizeGb ? `${r.sizeGb} GB` : r.meta?.address || '—')}</TD>;
                        case 'state':
                          return <TD key={c.key}><Badge tone={STATE_TONES[r.state]} dot>{r.state}</Badge></TD>;
                        case 'env':
                          return <TD key={c.key}>{r.tags?.env ? <span className={clsx('rounded-md px-1.5 py-0.5 text-[11px] font-medium', r.tags.env === 'prod' ? 'bg-danger/10 text-danger' : 'bg-fg/[0.05] text-secondary')}>{r.tags.env}</span> : '—'}</TD>;
                        case 'team':
                          return <TD key={c.key} className="text-secondary">{r.tags?.team || '—'}</TD>;
                        case 'created':
                          return <TD key={c.key} className="text-secondary">{r.createdAt ? timeAgo(r.createdAt) : '—'}</TD>;
                        case 'cost':
                          return <TD key={c.key} align="right" mono className="font-medium">{money(r.monthlyCost)}</TD>;
                        default:
                          return null;
                      }
                    })}
                  </TR>
                );
              })}
          </tbody>
        </Table>

        {!isLoading && !data.items.length && (
          <EmptyState
            icon={activeFilters ? SearchX : Filter}
            title="No resources match"
            message="Try removing a filter or searching for a different name."
            action={<Button size="sm" onClick={() => { setSearch(''); setParams({}, { replace: true }); }}>Reset filters</Button>}
          />
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-3 text-[13px] text-secondary">
          <span>
            {total ? (
              <>
                Showing <span className="num text-fg">{(page - 1) * limit + 1}–{Math.min(page * limit, total)}</span> of <span className="num text-fg">{total}</span> resources
              </>
            ) : (
              'No results'
            )}
          </span>
          <div className="flex items-center gap-1">
            <Button size="sm" variant="ghost" icon={ChevronLeft} disabled={page <= 1} onClick={() => update({ page: String(page - 1) })}>Prev</Button>
            {Array.from({ length: pages }, (_, i) => i + 1)
              .filter((p) => p === 1 || p === pages || Math.abs(p - page) <= 1)
              .map((p, i, arr) => (
                <span key={p} className="flex items-center">
                  {i > 0 && p - arr[i - 1] > 1 && <span className="px-1 text-muted">…</span>}
                  <button onClick={() => update({ page: String(p) })} className={clsx('num h-8 min-w-8 rounded-lg px-2 text-xs transition', p === page ? 'bg-brand text-white' : 'hover:bg-fg/5')}>{p}</button>
                </span>
              ))}
            <Button size="sm" variant="ghost" iconRight={ChevronRight} disabled={page >= pages} onClick={() => update({ page: String(page + 1) })}>Next</Button>
          </div>
        </div>
      </Card>

      <ResourceDrawer resource={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
