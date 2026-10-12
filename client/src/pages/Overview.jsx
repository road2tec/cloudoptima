import { memo, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Activity, ArrowRight, Check, CircleDollarSign, Cpu, Flame, Gauge, PiggyBank, RefreshCw, Server, TrendingUp } from 'lucide-react';
import clsx from 'clsx';
import Card, { stagger } from '../components/ui/Card';
import StatCard from '../components/ui/StatCard';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import EmptyState from '../components/ui/EmptyState';
import { SkeletonCard } from '../components/ui/Skeleton';
import ProviderLogo from '../components/ui/ProviderLogo';
import { DeltaChip, PageHeader } from '../components/ui/misc';
import AreaTrend from '../components/charts/AreaTrend';
import CostDonut from '../components/charts/CostDonut';
import Heatmap from '../components/charts/Heatmap';
import ChartTooltip from '../components/charts/ChartTooltip';
import { useApprove, useCostTrend, useOverview } from '../hooks/useApi';
import { useMoney } from '../hooks/useMoney';
import { useLive } from '../context/SocketContext';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { CATEGORIES, PROVIDERS, RISK_TONES } from '../lib/constants';
import { formatPct, hourLabel, timeAgo } from '../lib/format';

const LiveCpuChart = memo(function LiveCpuChart({ history, ticks }) {
  const { chart } = useTheme();
  const data = useMemo(() => {
    const pts = history.map((h) => ({ ts: new Date(h.ts).getTime(), cpu: h.cpu, mem: h.mem }));
    const lastHist = pts.at(-1)?.ts || 0;
    ticks.forEach((t) => {
      const ts = new Date(t.ts).getTime();
      if (ts > lastHist) pts.push({ ts, cpu: t.avgCpu, mem: t.avgMem });
    });
    return pts.slice(-150);
  }, [history, ticks]);
  return (
    <ResponsiveContainer width="100%" height={230}>
      <AreaChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id="live-cpu" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#22D3EE" stopOpacity={0.35} />
            <stop offset="1" stopColor="#22D3EE" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="live-mem" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#8B5CF6" stopOpacity={0.25} />
            <stop offset="1" stopColor="#8B5CF6" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke={chart.grid} />
        <XAxis dataKey="ts" type="number" scale="time" domain={['dataMin', 'dataMax']} tickFormatter={(v) => new Date(v).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })} tickLine={false} axisLine={false} minTickGap={40} tick={{ fill: chart.axis }} />
        <YAxis tickFormatter={(v) => `${v}%`} tickLine={false} axisLine={false} width={40} domain={[0, 'auto']} tick={{ fill: chart.axis }} />
        <Tooltip content={<ChartTooltip labelFormat={hourLabel} valueFormat={(v) => `${v.toFixed(1)}%`} />} />
        <Area type="monotone" dataKey="mem" name="Avg memory" stroke="#8B5CF6" strokeWidth={1.4} fill="url(#live-mem)" isAnimationActive={false} />
        <Area type="monotone" dataKey="cpu" name="Avg CPU" stroke="#22D3EE" strokeWidth={1.8} fill="url(#live-cpu)" isAnimationActive={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
});

function TopSavings({ items }) {
  const money = useMoney();
  const { canOperate } = useAuth();
  const approve = useApprove();
  if (!items.length) return <EmptyState compact icon={PiggyBank} title="Nothing to optimize" message="All open recommendations have been handled." />;
  return (
    <ul className="divide-y divide-line">
      {items.map((r, i) => {
        const cat = CATEGORIES[r.category];
        return (
          <motion.li key={r._id} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl" style={{ background: `${cat.color}1A`, color: cat.color }}>
              <cat.icon className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="truncate text-[13px] font-medium">{r.title}</span>
              </div>
              <div className="mt-0.5 flex items-center gap-2 text-[11px] text-muted">
                {r.resource && <ProviderLogo provider={r.resource.provider} size={14} />}
                <span>{cat.label}</span>
                <Badge tone={RISK_TONES[r.risk]} className="!h-5 !px-1.5 !text-[10px]">{r.risk}</Badge>
              </div>
            </div>
            <div className="text-right">
              <div className="num text-[15px] font-semibold text-success">{money(r.monthlySaving)}</div>
              <div className="text-[10.5px] text-muted">per month</div>
            </div>
            <Button
              size="xs"
              variant="success"
              icon={Check}
              loading={approve.isPending && approve.variables?.id === r._id}
              disabledReason={canOperate ? null : 'Approver role required'}
              onClick={() => approve.mutate({ id: r._id })}
            >
              Approve
            </Button>
          </motion.li>
        );
      })}
    </ul>
  );
}

function AccountsHealth({ accounts }) {
  const money = useMoney();
  return (
    <ul className="space-y-2.5">
      {accounts.map((a) => (
        <li key={a._id} className="flex items-center gap-3 rounded-xl border border-line bg-fg/[0.02] p-3">
          <ProviderLogo provider={a.provider} size={30} />
          <div className="min-w-0 flex-1">
            <div className="truncate text-[13px] font-medium">{a.name}</div>
            <div className="text-[11px] text-muted">{a.resourceCount} resources · synced {timeAgo(a.lastSyncedAt)}</div>
          </div>
          <div className="text-right">
            <div className="num text-[13px] font-medium">{money(a.monthlyCost, { compact: true })}</div>
            <Badge tone={a.status === 'connected' ? 'success' : a.status === 'syncing' ? 'info' : 'danger'} dot pulse={a.status === 'syncing'} className="!h-5 !text-[10px]">
              {a.status}
            </Badge>
          </div>
        </li>
      ))}
    </ul>
  );
}

export default function Overview() {
  const money = useMoney();
  const { data, isLoading } = useOverview();
  const trend = useCostTrend({ days: 90, groupBy: 'provider' });
  const { ticks, lastTick } = useLive();
  const k = data?.kpis;
  const liveCpu = lastTick?.avgCpu ?? k?.avgCpu;
  const fmtMoney = (v) => money(v, { compact: v >= 100000 });

  return (
    <div>
      <PageHeader
        title="Overview"
        description="Spend, waste and utilization across every connected cloud."
        actions={
          <Link to="/recommendations">
            <Button variant="primary" icon={PiggyBank} iconRight={ArrowRight}>
              Review savings
            </Button>
          </Link>
        }
      />

      <motion.div variants={stagger} initial="hidden" animate="show" className="grid grid-cols-2 gap-4 md:grid-cols-3 2xl:grid-cols-6">
        <StatCard loading={isLoading} label="Month-to-date" icon={CircleDollarSign} accent="#8B5CF6" value={k?.mtdSpend} format={fmtMoney} spark={data?.sparklines.spend} footer={<span className="flex items-center gap-1.5"><DeltaChip value={k?.momPct} /> MoM</span>} />
        <StatCard loading={isLoading} label="Forecast month-end" icon={TrendingUp} accent="#22D3EE" value={k?.forecastMonthEnd} format={fmtMoney} footer={<>Last month <span className="num text-fg">{money(k?.lastMonth, { compact: true })}</span></>} />
        <StatCard loading={isLoading} label="Potential savings" icon={PiggyBank} accent="#10B981" value={k?.potentialSavings} format={(v) => `${money(v)}`} footer={<><span className="num text-fg">{k?.openRecommendations}</span> open · <span className="num text-success">{money(k?.realizedSavings, { compact: true })}</span> realized</>} />
        <StatCard loading={isLoading} label="Waste" icon={Flame} accent="#F43F5E" value={k?.wastePct} format={(v) => `${v.toFixed(1)}%`} footer={<>of <span className="num text-fg">{money(k?.monthlyRunRate, { compact: true })}</span>/mo run-rate</>} />
        <StatCard loading={isLoading} label="Active resources" icon={Server} accent="#F59E0B" value={k?.activeResources} footer={<><span className="num text-fg">{k?.runningVms}</span> of {k?.totalVms} VMs running</>} />
        <StatCard loading={isLoading} live label="Avg fleet CPU" icon={Cpu} accent="#22D3EE" value={liveCpu} format={(v) => `${v.toFixed(1)}%`} spark={data?.sparklines.cpu} footer={<>Memory <span className="num text-fg">{formatPct(lastTick?.avgMem ?? k?.avgMem)}</span></>} />
      </motion.div>

      <motion.div variants={stagger} initial="hidden" animate="show" className="mt-4 grid gap-4 xl:grid-cols-3">
        {trend.isLoading ? (
          <SkeletonCard chart className="xl:col-span-2" />
        ) : (
          <Card className="xl:col-span-2" title="Daily spend by provider" subtitle="Last 90 days · stacked" action={<Link to="/costs" className="text-xs text-brand-violet hover:underline">Cost Explorer →</Link>}>
            <AreaTrend data={trend.data.points} keys={trend.data.keys} valueFormat={(v) => money(v)} axisFormat={(v) => money(v, { compact: true })} />
          </Card>
        )}
        {isLoading ? (
          <SkeletonCard chart />
        ) : (
          <Card title="Spend by provider" subtitle="Month to date">
            <CostDonut data={data.byProvider.map((p) => ({ key: p.provider, value: p.cost }))} valueFormat={(v) => money(v, { compact: true })} centerLabel="MTD" />
            <ul className="mt-4 space-y-2">
              {data.byProvider.map((p) => (
                <li key={p.provider} className="flex items-center gap-2.5 text-[13px]">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: PROVIDERS[p.provider].color }} />
                  <span className="flex-1 text-secondary">{PROVIDERS[p.provider].name}</span>
                  <span className="num font-medium">{money(p.cost)}</span>
                  <span className="num w-12 text-right text-xs text-muted">{((p.cost / k.mtdSpend) * 100).toFixed(0)}%</span>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </motion.div>

      <motion.div variants={stagger} initial="hidden" animate="show" className="mt-4 grid gap-4 xl:grid-cols-3">
        {isLoading ? (
          <SkeletonCard lines={8} className="xl:col-span-2" />
        ) : (
          <Card className="xl:col-span-2" title="Top 5 savings opportunities" subtitle="Ranked by monthly saving" action={<Link to="/recommendations" className="text-xs text-brand-violet hover:underline">View all →</Link>}>
            <TopSavings items={data.topRecommendations} />
          </Card>
        )}
        {isLoading ? (
          <SkeletonCard lines={6} />
        ) : (
          <Card title="Accounts health" subtitle={`${data.accounts.length} connected accounts`} action={<Link to="/accounts" className="text-xs text-brand-violet hover:underline">Manage →</Link>}>
            <AccountsHealth accounts={data.accounts} />
          </Card>
        )}
      </motion.div>

      <motion.div variants={stagger} initial="hidden" animate="show" className="mt-4 grid gap-4 xl:grid-cols-3">
        {isLoading ? (
          <SkeletonCard chart className="xl:col-span-2" />
        ) : (
          <Card className="xl:col-span-2" title="Utilization heatmap" subtitle="Top VMs by cost · average CPU by hour of day · last 7 days">
            <Heatmap rows={data.heatmap} />
          </Card>
        )}
        {isLoading ? (
          <SkeletonCard chart />
        ) : (
          <Card
            title="Live fleet utilization"
            subtitle={lastTick ? `${lastTick.running} VMs · burn ${money(lastTick.burnRate)}/h` : 'Last 24 hours · waiting for next tick'}
            action={
              <span className={clsx('flex items-center gap-1.5 text-[11px] font-medium', lastTick ? 'text-success' : 'text-muted')}>
                {lastTick ? <Activity className="h-3.5 w-3.5" /> : <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
                {lastTick ? 'streaming' : 'connecting'}
              </span>
            }
          >
            <LiveCpuChart history={data.fleetCpu} ticks={ticks} />
            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
              {[
                ['CPU', formatPct(liveCpu), Gauge],
                ['Memory', formatPct(lastTick?.avgMem ?? k.avgMem), Activity],
                ['Burn / h', money(lastTick?.burnRate ?? k.hourlyBurn), Flame],
              ].map(([label, val, Icon]) => (
                <div key={label} className="rounded-xl border border-line bg-fg/[0.02] px-2 py-2.5">
                  <div className="flex items-center justify-center gap-1 text-[10.5px] text-muted"><Icon className="h-3 w-3" />{label}</div>
                  <div className="num mt-0.5 text-sm font-semibold">{val}</div>
                </div>
              ))}
            </div>
          </Card>
        )}
      </motion.div>
    </div>
  );
}
