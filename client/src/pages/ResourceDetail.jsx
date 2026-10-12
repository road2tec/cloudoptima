import { memo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Activity, ArrowLeft, BrainCircuit, Coins, Cpu, Lightbulb, MemoryStick, ServerOff, Tags } from 'lucide-react';
import Card, { stagger } from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import Tabs, { Segmented } from '../components/ui/Tabs';
import EmptyState from '../components/ui/EmptyState';
import Skeleton, { SkeletonCard } from '../components/ui/Skeleton';
import ProviderLogo, { ProviderChip } from '../components/ui/ProviderLogo';
import { KeyValue } from '../components/ui/misc';
import ForecastChart from '../components/charts/ForecastChart';
import StackedBar from '../components/charts/StackedBar';
import ChartTooltip from '../components/charts/ChartTooltip';
import { useMetrics, useResource, useResourceForecast } from '../hooks/useApi';
import { useMoney } from '../hooks/useMoney';
import { useTheme } from '../context/ThemeContext';
import { CATEGORIES, RESOURCE_TYPES, RISK_TONES, STATE_TONES, STATUS_TONES } from '../lib/constants';
import { dateTime, hourLabel, shortDate, shortId, timeAgo } from '../lib/format';

const UtilizationChart = memo(function UtilizationChart({ points, stats }) {
  const { chart } = useTheme();
  const data = points.map((p) => ({ ...p, ts: new Date(p.ts).getTime() }));
  return (
    <ResponsiveContainer width="100%" height={320}>
      <ComposedChart data={data} margin={{ top: 10, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid vertical={false} stroke={chart.grid} />
        <XAxis dataKey="ts" type="number" scale="time" domain={['dataMin', 'dataMax']} tickFormatter={shortDate} tickLine={false} axisLine={false} minTickGap={40} tick={{ fill: chart.axis }} />
        <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} tickLine={false} axisLine={false} width={44} tick={{ fill: chart.axis }} />
        <Tooltip content={<ChartTooltip labelFormat={hourLabel} valueFormat={(v) => `${v.toFixed(1)}%`} hideZero={false} />} />
        <Line dataKey="mem" name="Memory" stroke="#8B5CF6" strokeWidth={1.3} dot={false} isAnimationActive={false} />
        <Line dataKey="cpu" name="CPU" stroke="#22D3EE" strokeWidth={1.5} dot={false} isAnimationActive={false} />
        <ReferenceLine y={stats.cpuP95} stroke="#22D3EE" strokeDasharray="5 4" label={{ value: `CPU p95 ${stats.cpuP95}%`, position: 'insideTopRight', fill: '#22D3EE', fontSize: 11 }} />
        <ReferenceLine y={stats.memP95} stroke="#8B5CF6" strokeDasharray="5 4" label={{ value: `Mem p95 ${stats.memP95}%`, position: 'insideBottomRight', fill: '#A78BFA', fontSize: 11 }} />
      </ComposedChart>
    </ResponsiveContainer>
  );
});

function Stat({ icon: Icon, label, value, accent }) {
  return (
    <div className="rounded-xl border border-line bg-fg/[0.02] p-3">
      <div className="flex items-center gap-1.5 text-[11px] text-muted"><Icon className="h-3.5 w-3.5" style={{ color: accent }} />{label}</div>
      <div className="num mt-1 text-lg font-semibold">{value}</div>
    </div>
  );
}

function UtilizationTab({ id }) {
  const { data, isLoading } = useMetrics(id, { interval: 'hour' });
  if (isLoading) return <Skeleton className="h-80 w-full" />;
  if (!data.points.length) return <EmptyState icon={Activity} title="No utilization data" message="This resource has not reported metrics in the last 30 days." />;
  const s = data.stats;
  return (
    <div>
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-5">
        <Stat icon={Cpu} label="CPU p95 (30d)" value={`${s.cpuP95}%`} accent="#22D3EE" />
        <Stat icon={Cpu} label="CPU average" value={`${s.cpuAvg}%`} accent="#22D3EE" />
        <Stat icon={Cpu} label="CPU peak" value={`${s.cpuMax}%`} accent="#F43F5E" />
        <Stat icon={MemoryStick} label="Memory p95" value={`${s.memP95}%`} accent="#8B5CF6" />
        <Stat icon={MemoryStick} label="Memory average" value={`${s.memAvg}%`} accent="#8B5CF6" />
      </div>
      <UtilizationChart points={data.points} stats={s} />
    </div>
  );
}

function ForecastTab({ id }) {
  const [metric, setMetric] = useState('cpu');
  const { data, isLoading } = useResourceForecast(id);
  if (isLoading) return <Skeleton className="h-80 w-full" />;
  const f = data[metric];
  if (!f) return <EmptyState icon={BrainCircuit} title="No forecast yet" message="Forecasts are produced for running VMs with at least 3 days of history." />;
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Segmented options={[{ value: 'cpu', label: 'CPU' }, { value: 'mem', label: 'Memory' }]} value={metric} onChange={setMetric} />
        <Badge tone="brand">{f.model === 'holt-winters' ? `Holt-Winters · ${f.params?.season === 168 ? 'weekly' : 'daily'} season` : 'Linear trend'}</Badge>
        <Badge tone={f.mape < 10 ? 'success' : f.mape < 25 ? 'warning' : 'danger'}>MAPE <span className="num">{f.mape}%</span></Badge>
        <Badge tone="info">RMSE <span className="num">{f.rmse}</span></Badge>
        <Badge tone="neutral">14-day peak <span className="num">{f.predictedPeak}%</span></Badge>
        <span className="ml-auto text-[11px] text-muted">Trained {timeAgo(f.createdAt)} on {f.trainedOn} hourly points · tested on last 7 days</span>
      </div>
      <ForecastChart
        history={data.history.map((h) => ({ ts: h.ts, value: h[metric] }))}
        backtest={f.backtest}
        forecast={f.points}
        threshold={70}
      />
    </div>
  );
}

function CostTab({ data }) {
  const money = useMoney();
  if (!data.costHistory.length) return <EmptyState icon={Coins} title="No cost records" message="This resource has no billed usage in the last 90 days." />;
  return (
    <div>
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-3">
        <Stat icon={Coins} label="Last 30 days" value={money(data.last30dCost)} accent="#10B981" />
        <Stat icon={Coins} label="Run-rate / month" value={money(data.resource.monthlyCost)} accent="#8B5CF6" />
        <Stat icon={Coins} label="Hourly price" value={money(data.resource.hourlyPrice, { decimals: 4 })} accent="#22D3EE" />
      </div>
      <StackedBar data={data.costHistory} keys={data.costServices} valueFormat={(v) => money(v)} axisFormat={(v) => money(v, { compact: true })} colors={['#8B5CF6', '#22D3EE', '#F59E0B', '#10B981', '#F43F5E']} />
    </div>
  );
}

function RecsTab({ recs }) {
  const money = useMoney();
  if (!recs.length) return <EmptyState icon={Lightbulb} title="No recommendations" message="The engines found nothing to optimize on this resource." />;
  return (
    <div className="space-y-3">
      {recs.map((r) => {
        const cat = CATEGORIES[r.category];
        return (
          <div key={r._id} className="flex flex-wrap items-start gap-4 rounded-xl border border-line bg-fg/[0.02] p-4">
            <span className="grid h-10 w-10 place-items-center rounded-xl" style={{ background: `${cat.color}1A`, color: cat.color }}><cat.icon className="h-5 w-5" /></span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{r.title}</span>
                <Badge tone={STATUS_TONES[r.status]}>{r.status}</Badge>
                <Badge tone={RISK_TONES[r.risk]}>{r.risk} risk</Badge>
              </div>
              <p className="mt-1 text-[13px] text-secondary">{r.reason}</p>
              {r.decidedBy && <p className="mt-1 text-[11px] text-muted">{r.status} by {r.decidedBy.name} · {dateTime(r.decidedAt)}{r.note ? ` — “${r.note}”` : ''}</p>}
            </div>
            <div className="text-right">
              <div className="num text-lg font-semibold text-success">{money(r.monthlySaving)}</div>
              <div className="text-[11px] text-muted">/ month</div>
            </div>
          </div>
        );
      })}
      <Link to="/recommendations" className="inline-block text-xs text-brand-violet hover:underline">Manage in Recommendations →</Link>
    </div>
  );
}

function TagsTab({ data }) {
  const r = data.resource;
  const tags = Object.entries(r.tags || {});
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <div>
        <div className="label mb-3">Tags / labels</div>
        {tags.length ? (
          <div className="grid gap-2">
            {tags.map(([k, v]) => (
              <div key={k} className="flex items-center justify-between rounded-lg border border-line bg-fg/[0.02] px-3 py-2 text-[13px]">
                <span className="num text-muted">{k}</span>
                <span className="num">{v}</span>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState compact icon={Tags} title="Untagged" message="Untagged resources cannot be attributed to a team." />
        )}
      </div>
      <div>
        <div className="label mb-3">Metadata</div>
        <div className="divide-y divide-line">
          <KeyValue label="Unified ID" mono>{shortId(r.resourceId)}</KeyValue>
          <KeyValue label="Native ID" mono>{shortId(r.nativeId)}</KeyValue>
          <KeyValue label="Account">{r.account?.name}</KeyValue>
          {r.zone && <KeyValue label="Zone" mono>{r.zone}</KeyValue>}
          {Object.entries(r.meta || {}).filter(([, v]) => v).map(([k, v]) => <KeyValue key={k} label={k} mono>{shortId(String(v))}</KeyValue>)}
          {data.parent && <KeyValue label="Attached to"><Link to={`/inventory/${data.parent._id}`} className="text-brand-violet hover:underline">{data.parent.name}</Link></KeyValue>}
          {data.attached.map((a) => <KeyValue key={a._id} label={`Attached ${a.type}`}>{a.name}</KeyValue>)}
          <KeyValue label="Created">{r.createdAt ? dateTime(r.createdAt) : '—'}</KeyValue>
          <KeyValue label="Last seen">{timeAgo(r.lastSeenAt)}</KeyValue>
        </div>
      </div>
    </div>
  );
}

export default function ResourceDetail() {
  const { id } = useParams();
  const money = useMoney();
  const { data, isLoading, error } = useResource(id);
  const isVm = data?.resource.type === 'vm';
  const [tab, setTab] = useState(null);
  const active = tab || (isVm ? 'util' : 'cost');

  if (error) return <EmptyState icon={ServerOff} title="Resource not found" message={error.message} action={<Link to="/inventory"><Button icon={ArrowLeft}>Back to inventory</Button></Link>} />;
  if (isLoading) {
    return (
      <div className="space-y-4">
        <SkeletonCard lines={3} />
        <SkeletonCard chart />
      </div>
    );
  }
  const r = data.resource;
  const TypeIcon = RESOURCE_TYPES[r.type]?.icon;
  const tabs = [
    ...(isVm ? [{ value: 'util', label: 'Utilization', icon: Activity }, { value: 'forecast', label: 'Forecast', icon: BrainCircuit }] : []),
    { value: 'cost', label: 'Cost', icon: Coins },
    { value: 'recs', label: 'Recommendations', icon: Lightbulb, count: data.recommendations.length },
    { value: 'tags', label: 'Tags', icon: Tags },
  ];

  return (
    <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-4">
      <Link to="/inventory" className="inline-flex items-center gap-1.5 text-[13px] text-secondary hover:text-fg"><ArrowLeft className="h-4 w-4" /> Inventory</Link>
      <Card padded={false}>
        <div className="relative overflow-hidden p-6">
          <div className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-brand opacity-10 blur-3xl" />
          <div className="relative flex flex-wrap items-start gap-5">
            <ProviderLogo provider={r.provider} size={52} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="truncate text-[22px] font-semibold tracking-tight">{r.name}</h1>
                <Badge tone={STATE_TONES[r.state]} dot>{r.state}</Badge>
                {r.tags?.env && <Badge tone={r.tags.env === 'prod' ? 'danger' : 'neutral'}>{r.tags.env}</Badge>}
              </div>
              <div className="num mt-1 truncate text-xs text-muted">{r.resourceId}</div>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-[13px] text-secondary">
                <ProviderChip provider={r.provider} showName />
                <span className="inline-flex items-center gap-1.5 rounded-full border border-line px-2.5 py-0.5">{TypeIcon && <TypeIcon className="h-3.5 w-3.5" />}{RESOURCE_TYPES[r.type]?.label}</span>
                <span className="num rounded-full border border-line px-2.5 py-0.5">{r.region}</span>
                {r.instanceType && <span className="num rounded-full border border-line px-2.5 py-0.5">{r.instanceType} · {r.vcpu} vCPU · {r.memoryGb} GB</span>}
                {r.sizeGb && <span className="num rounded-full border border-line px-2.5 py-0.5">{r.sizeGb} GB</span>}
              </div>
            </div>
            <div className="text-right">
              <div className="label">Monthly cost</div>
              <div className="num mt-1 text-[28px] font-semibold tracking-tight">{money(r.monthlyCost)}</div>
              <div className="text-xs text-muted">{r.account?.name}</div>
            </div>
          </div>
        </div>
        <Tabs tabs={tabs} value={active} onChange={setTab} className="px-4" />
        <div className="p-5">
          {active === 'util' && <UtilizationTab id={id} />}
          {active === 'forecast' && <ForecastTab id={id} />}
          {active === 'cost' && <CostTab data={data} />}
          {active === 'recs' && <RecsTab recs={data.recommendations} />}
          {active === 'tags' && <TagsTab data={data} />}
        </div>
      </Card>
    </motion.div>
  );
}
