import { useState } from 'react';
import { motion } from 'framer-motion';
import clsx from 'clsx';
import { CloudOff, Plus, RefreshCw, Trash2, TriangleAlert } from 'lucide-react';
import Card, { stagger } from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import Select from '../components/ui/Select';
import EmptyState from '../components/ui/EmptyState';
import { SkeletonCard } from '../components/ui/Skeleton';
import ProviderLogo from '../components/ui/ProviderLogo';
import { PageHeader } from '../components/ui/misc';
import { useAccounts, useConnectAccount, useDeleteAccount, useProviderCatalog, useSyncAccount } from '../hooks/useApi';
import { useMoney } from '../hooks/useMoney';
import { useAuth } from '../context/AuthContext';
import { PROVIDERS, RESOURCE_TYPES } from '../lib/constants';
import { timeAgo } from '../lib/format';

function ConnectModal({ open, onClose }) {
  const { data: catalog } = useProviderCatalog();
  const connect = useConnectAccount();
  const [provider, setProvider] = useState('aws');
  const [name, setName] = useState('');
  const [region, setRegion] = useState('');
  const regions = catalog?.[provider]?.regions || [];
  const submit = () =>
    connect.mutate({ provider, name, region: region || regions[0]?.code }, {
      onSuccess: () => {
        setName('');
        setRegion('');
        onClose();
      },
    });
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Connect cloud account"
      description="A simulated estate is provisioned and pulled through the same connector → normalizer pipeline."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" icon={Plus} loading={connect.isPending} disabled={name.trim().length < 3} onClick={submit}>Connect</Button>
        </>
      }
    >
      <div className="space-y-5">
        <div>
          <div className="mb-2 text-xs font-medium text-secondary">Provider</div>
          <div className="grid grid-cols-3 gap-2">
            {Object.entries(PROVIDERS).map(([k, p]) => (
              <button key={k} onClick={() => { setProvider(k); setRegion(''); }}
                className={clsx('flex flex-col items-center gap-2 rounded-xl border p-4 transition', provider === k ? 'border-transparent ring-2' : 'border-line hover:border-line-strong')}
                style={provider === k ? { '--tw-ring-color': p.color, background: `${p.color}10` } : undefined}>
                <ProviderLogo provider={k} size={36} />
                <span className="text-xs font-medium">{p.label}</span>
              </button>
            ))}
          </div>
        </div>
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-secondary">Account name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder={`e.g. Staging ${PROVIDERS[provider].label}`} className="input" />
        </label>
        <div>
          <span className="mb-1.5 block text-xs font-medium text-secondary">Default region</span>
          <Select value={region || regions[0]?.code || ''} onChange={setRegion} allowClear={false} options={regions.map((r) => ({ value: r.code, label: `${r.code} — ${r.name}` }))} />
        </div>
      </div>
    </Modal>
  );
}

function AccountCard({ a, onDelete }) {
  const money = useMoney();
  const { canOperate, isAdmin } = useAuth();
  const sync = useSyncAccount();
  const p = PROVIDERS[a.provider];
  const syncing = a.status === 'syncing';
  return (
    <motion.div variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } }} whileHover={{ y: -3 }} className="card relative overflow-hidden hover:shadow-lift">
      <div className="pointer-events-none absolute -right-14 -top-14 h-40 w-40 rounded-full opacity-20 blur-3xl" style={{ background: p.color }} />
      {syncing && (
        <div className="absolute inset-x-0 top-0 h-0.5 overflow-hidden">
          <motion.div className="h-full w-1/3 bg-brand" animate={{ x: ['-100%', '300%'] }} transition={{ repeat: Infinity, duration: 1.2, ease: 'easeInOut' }} />
        </div>
      )}
      <div className="relative p-5">
        <div className="flex items-start gap-3">
          <ProviderLogo provider={a.provider} size={44} />
          <div className="min-w-0 flex-1">
            <div className="truncate text-[15px] font-semibold">{a.name}</div>
            <div className="num truncate text-[11px] text-muted">{p.name} · {a.externalId}</div>
          </div>
          <Badge tone={a.status === 'connected' ? 'success' : syncing ? 'info' : 'danger'} dot pulse={syncing}>{a.status}</Badge>
        </div>

        <div className="mt-5 grid grid-cols-3 gap-2">
          {[
            ['Monthly', money(a.monthlyCost, { compact: true })],
            ['Last 30d', money(a.last30dSpend, { compact: true })],
            ['Savings', money(a.potentialSaving, { compact: true })],
          ].map(([l, v], i) => (
            <div key={l} className="rounded-xl border border-line bg-fg/[0.02] px-3 py-2.5">
              <div className="text-[10.5px] text-muted">{l}</div>
              <div className={clsx('num mt-0.5 text-[15px] font-semibold', i === 2 && 'text-success')}>{v}</div>
            </div>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap gap-1.5">
          {Object.entries(RESOURCE_TYPES).map(([k, t]) => (
            <span key={k} className="inline-flex items-center gap-1.5 rounded-lg border border-line px-2 py-1 text-[11px] text-secondary">
              <t.icon className="h-3 w-3" /> <span className="num text-fg">{a.byType?.[k] || 0}</span> {t.short}
            </span>
          ))}
        </div>

        {a.status === 'error' && a.lastError && (
          <div className="mt-3 flex items-start gap-2 rounded-lg bg-danger/10 px-3 py-2 text-xs text-danger"><TriangleAlert className="mt-0.5 h-3.5 w-3.5" />{a.lastError}</div>
        )}

        <div className="mt-5 flex items-center gap-2 border-t border-line pt-4">
          <div className="text-[11px] text-muted">
            <div>Region <span className="num text-secondary">{a.defaultRegion}</span></div>
            <div>{syncing ? 'Syncing now…' : `Synced ${timeAgo(a.lastSyncedAt)}${a.lastSyncDurationMs ? ` · ${(a.lastSyncDurationMs / 1000).toFixed(1)}s` : ''}`}</div>
          </div>
          <div className="ml-auto flex gap-1.5">
            <Button size="sm" icon={RefreshCw} className={clsx(syncing && '[&>svg]:animate-spin')} disabled={syncing} disabledReason={canOperate ? null : 'Approver role required'} onClick={() => sync.mutate(a._id)}>
              {syncing ? 'Syncing' : 'Sync now'}
            </Button>
            <Button size="sm" variant="ghost" icon={Trash2} disabledReason={isAdmin ? null : 'Admin role required'} onClick={() => onDelete(a)} aria-label="Disconnect" />
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export default function Accounts() {
  const { data, isLoading } = useAccounts();
  const { canOperate } = useAuth();
  const remove = useDeleteAccount();
  const [connectOpen, setConnectOpen] = useState(false);
  const [deleting, setDeleting] = useState(null);

  return (
    <div>
      <PageHeader
        title="Cloud accounts"
        description="Connected AWS accounts, Azure subscriptions and GCP projects. Every sync runs connector → normalizer → database."
        actions={<Button variant="primary" icon={Plus} onClick={() => setConnectOpen(true)} disabledReason={canOperate ? null : 'Approver role required'}>Connect account</Button>}
      />
      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} lines={6} />)}</div>
      ) : !data.length ? (
        <Card><EmptyState icon={CloudOff} title="No accounts connected" message="Connect an AWS, Azure or GCP account to start tracking spend." action={<Button variant="primary" icon={Plus} onClick={() => setConnectOpen(true)}>Connect account</Button>} /></Card>
      ) : (
        <motion.div variants={stagger} initial="hidden" animate="show" className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {data.map((a) => <AccountCard key={a._id} a={a} onDelete={setDeleting} />)}
        </motion.div>
      )}

      <ConnectModal open={connectOpen} onClose={() => setConnectOpen(false)} />
      <Modal
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        size="sm"
        title="Disconnect account?"
        description={deleting?.name}
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeleting(null)}>Cancel</Button>
            <Button variant="danger" icon={Trash2} loading={remove.isPending} onClick={() => remove.mutate(deleting._id, { onSuccess: () => setDeleting(null) })}>Disconnect</Button>
          </>
        }
      >
        <p className="text-[13px] text-secondary">All inventory, metrics, cost history, forecasts and recommendations for this account will be removed. This cannot be undone.</p>
      </Modal>
    </div>
  );
}
