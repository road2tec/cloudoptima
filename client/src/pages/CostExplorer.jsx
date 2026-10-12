import { useState } from 'react';
import { motion } from 'framer-motion';
import { BarChart3, CalendarRange, CircleDollarSign, Layers, MapPin, Server, TrendingUp, Users, Wallet } from 'lucide-react';
import Card, { stagger } from '../components/ui/Card';
import StatCard from '../components/ui/StatCard';
import { Segmented } from '../components/ui/Tabs';
import { SkeletonCard, SkeletonRows } from '../components/ui/Skeleton';
import EmptyState from '../components/ui/EmptyState';
import ProviderLogo from '../components/ui/ProviderLogo';
import { Table, TD, TH, THead, TR } from '../components/ui/Table';
import { Bar, DeltaChip, PageHeader } from '../components/ui/misc';
import StackedBar from '../components/charts/StackedBar';
import { useCostBreakdown, useCostSummary, useCostTrend } from '../hooks/useApi';
import { useMoney } from '../hooks/useMoney';
import { PROVIDERS, seriesColor } from '../lib/constants';
import { titleCase } from '../lib/format';

const PRESETS = [
  { value: 7, label: '7d' },
  { value: 30, label: '30d' },
  { value: 90, label: '90d' },
];
const GROUPS = [
  { value: 'provider', label: 'Provider', icon: Layers },
  { value: 'service', label: 'Service', icon: Server },
  { value: 'region', label: 'Region', icon: MapPin },
  { value: 'team', label: 'Team', icon: Users },
];

export default function CostExplorer() {
  const money = useMoney();
  const [days, setDays] = useState(30);
  const [groupBy, setGroupBy] = useState('provider');
  const summary = useCostSummary();
  const trend = useCostTrend({ days, groupBy });
  const breakdown = useCostBreakdown({ by: groupBy === 'team' ? 'tag:team' : groupBy, days });
  const s = summary.data;
  const b = breakdown.data;

  const label = (key) => (groupBy === 'provider' ? PROVIDERS[key]?.name || key : groupBy === 'team' ? titleCase(key) : key);

  return (
    <div>
      <PageHeader
        title="Cost Explorer"
        description="Slice daily spend by provider, service, region or team, and compare against the previous period."
        actions={
          <>
            <Segmented options={PRESETS} value={days} onChange={setDays} size="md" />
          </>
        }
      />

      <motion.div variants={stagger} initial="hidden" animate="show" className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard loading={summary.isLoading} label="This month" icon={Wallet} accent="#8B5CF6" value={s?.thisMonth} format={(v) => money(v)} footer={<span className="flex items-center gap-1.5"><DeltaChip value={s?.momPct} /> MoM (same days)</span>} />
        <StatCard loading={summary.isLoading} label="Last month" icon={CalendarRange} accent="#6366F1" value={s?.lastMonth} format={(v) => money(v)} footer="Full calendar month" />
        <StatCard loading={summary.isLoading} label="Forecast month-end" icon={TrendingUp} accent="#22D3EE" value={s?.forecastMonthEnd} format={(v) => money(v)} footer={<><span className="num text-fg">{money(s?.dailyRunRate)}</span>/day × {s?.daysLeft} days left</>} />
        <StatCard loading={breakdown.isLoading} label={`Last ${days} days`} icon={CircleDollarSign} accent="#10B981" value={b?.total} format={(v) => money(v)} footer={<span className="flex items-center gap-1.5"><DeltaChip value={b?.changePct} /> vs previous {days}d</span>} />
      </motion.div>

      <motion.div variants={stagger} initial="hidden" animate="show" className="mt-4 space-y-4">
        {trend.isLoading ? (
          <SkeletonCard chart />
        ) : (
          <Card
            title={`Daily spend by ${groupBy}`}
            subtitle={`Last ${days} days · stacked`}
            action={<Segmented options={GROUPS} value={groupBy} onChange={setGroupBy} />}
          >
            <StackedBar data={trend.data.points} keys={trend.data.keys} valueFormat={(v) => money(v)} axisFormat={(v) => money(v, { compact: true })} height={320} />
            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
              {trend.data.totals.map((t, i) => (
                <span key={t.key} className="flex items-center gap-2 text-xs text-secondary">
                  <span className="h-2.5 w-2.5 rounded-sm" style={{ background: seriesColor(t.key, i) }} />
                  {label(t.key)} <span className="num text-fg">{money(t.cost, { compact: true })}</span>
                </span>
              ))}
            </div>
          </Card>
        )}

        <Card title="Breakdown" subtitle={`Share of spend · last ${days} days vs previous ${days} days`} padded={false}>
          <Table>
            <THead>
              <tr>
                <TH>{titleCase(groupBy)}</TH>
                <TH align="right">Resources</TH>
                <TH align="right">Cost</TH>
                <TH className="w-[28%]">Share</TH>
                <TH align="right">Previous</TH>
                <TH align="right">Change</TH>
              </tr>
            </THead>
            <tbody>
              {breakdown.isLoading && <SkeletonRows rows={5} cols={6} />}
              {b?.rows.map((r, i) => (
                <TR key={r.key}>
                  <TD>
                    <span className="flex items-center gap-2.5 font-medium">
                      {groupBy === 'provider' ? <ProviderLogo provider={r.key} size={22} /> : <span className="h-2.5 w-2.5 rounded-sm" style={{ background: seriesColor(r.key, i) }} />}
                      {label(r.key)}
                    </span>
                  </TD>
                  <TD align="right" mono className="text-secondary">{r.resourceCount}</TD>
                  <TD align="right" mono className="font-medium">{money(r.cost)}</TD>
                  <TD>
                    <div className="flex items-center gap-3">
                      <Bar value={r.share} color={seriesColor(r.key, i)} className="flex-1" />
                      <span className="num w-12 text-right text-xs text-secondary">{r.share}%</span>
                    </div>
                  </TD>
                  <TD align="right" mono className="text-secondary">{money(r.prevCost)}</TD>
                  <TD align="right"><DeltaChip value={r.changePct} /></TD>
                </TR>
              ))}
            </tbody>
          </Table>
          {b && !b.rows.length && <EmptyState icon={BarChart3} title="No spend recorded" message="Connect an account or widen the date range." />}
        </Card>
      </motion.div>
    </div>
  );
}
