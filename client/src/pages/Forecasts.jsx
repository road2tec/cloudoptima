import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { BrainCircuit, Gauge, LineChart, Play, Sigma, Target, TriangleAlert } from 'lucide-react';
import Card, { stagger } from '../components/ui/Card';
import StatCard from '../components/ui/StatCard';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import { Segmented } from '../components/ui/Tabs';
import { SkeletonCard, SkeletonRows } from '../components/ui/Skeleton';
import EmptyState from '../components/ui/EmptyState';
import ProviderLogo from '../components/ui/ProviderLogo';
import { Table, TD, TH, THead, TR } from '../components/ui/Table';
import { Bar, PageHeader } from '../components/ui/misc';
import ForecastChart from '../components/charts/ForecastChart';
import { useFleetForecast } from '../hooks/useApi';
import { forecastsApi } from '../api/forecasts';
import { useAuth } from '../context/AuthContext';
import { timeAgo } from '../lib/format';

const mapeTone = (m) => (m < 10 ? 'success' : m < 25 ? 'warning' : 'danger');

export default function Forecasts() {
  const qc = useQueryClient();
  const { canOperate } = useAuth();
  const { data, isLoading } = useFleetForecast();
  const [running, setRunning] = useState(false);
  const [view, setView] = useState('forecast');
  const [sort, setSort] = useState('-predictedPeak');

  const rows = useMemo(() => {
    if (!data) return [];
    const key = sort.replace(/^-/, '');
    const dir = sort.startsWith('-') ? -1 : 1;
    const val = (r) => (key === 'name' ? r.resource.name : r[key]);
    return [...data.accuracy].sort((a, b) => (val(a) > val(b) ? dir : -dir));
  }, [data, sort]);

  const run = () => {
    setRunning(true);
    toast.promise(forecastsApi.run(), {
      loading: 'Training Holt-Winters models on 30 days of hourly data…',
      success: (r) => {
        qc.invalidateQueries({ queryKey: ['forecasts'] });
        return `Forecasted ${r.resources} VMs · avg CPU MAPE ${r.avgMape}%`;
      },
      error: (e) => e.message,
      finally: () => setRunning(false),
    });
  };

  const s = data?.summary;
  const highRisk = rows.filter((r) => r.predictedPeak >= 80).length;

  return (
    <div>
      <PageHeader
        title="Forecasts"
        description="14-day demand forecasts per VM. Models are back-tested on a 7-day hold-out before they are trusted."
        actions={
          <Button variant="primary" icon={Play} loading={running} onClick={run} disabledReason={canOperate ? null : 'Approver role required'}>
            Run forecast
          </Button>
        }
      />

      <motion.div variants={stagger} initial="hidden" animate="show" className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard loading={isLoading} label="Models trained" icon={BrainCircuit} accent="#8B5CF6" value={s?.count} footer={s ? <>HW <span className="num text-fg">{s.models['holt-winters'] || 0}</span> · linear <span className="num text-fg">{s.models['linear-trend'] || 0}</span> · {timeAgo(s.lastRun)}</> : null} />
        <StatCard loading={isLoading} label="Avg CPU MAPE" icon={Target} accent="#10B981" value={s?.avgMape} format={(v) => `${v.toFixed(2)}%`} footer="Mean absolute % error on hold-out" />
        <StatCard loading={isLoading} label="Avg CPU RMSE" icon={Sigma} accent="#22D3EE" value={s?.avgRmse} format={(v) => v.toFixed(2)} footer="Root mean squared error (pts)" />
        <StatCard loading={isLoading} label="Predicted fleet peak" icon={Gauge} accent="#F59E0B" value={s?.peak} format={(v) => `${v.toFixed(1)}%`} footer={<><span className="num text-fg">{highRisk}</span> VMs forecast ≥ 80% CPU</>} />
      </motion.div>

      <div className="mt-4">
        {isLoading ? (
          <SkeletonCard chart />
        ) : !data.fleet.length ? (
          <Card><EmptyState icon={LineChart} title="No forecasts yet" message="Run the forecaster to train models on the last 30 days of metrics." /></Card>
        ) : (
          <Card
            title={view === 'forecast' ? 'Fleet CPU demand — next 14 days' : 'Back-test — hold-out week'}
            subtitle={view === 'forecast' ? 'Average across all running VMs · shaded band = 95% confidence' : 'Models trained on days 1–23 predicting days 24–30, compared with what actually happened'}
            action={<Segmented options={[{ value: 'forecast', label: 'Forecast' }, { value: 'backtest', label: 'Back-test' }]} value={view} onChange={setView} />}
          >
            {view === 'forecast' ? (
              <ForecastChart history={data.history} forecast={data.fleet} height={340} />
            ) : (
              <ForecastChart history={data.backtest.map((b) => ({ ts: b.ts, value: b.actual }))} backtest={data.backtest} height={340} />
            )}
          </Card>
        )}
      </div>

      <Card className="mt-4" padded={false} title="Model accuracy" subtitle="Per-VM CPU model · sorted by your choice">
        <Table maxHeight="560px">
          <THead>
            <tr>
              <TH field="name" sort={sort} onSort={setSort}>Resource</TH>
              <TH>Model</TH>
              <TH field="mape" sort={sort} onSort={setSort} align="right">MAPE</TH>
              <TH field="rmse" sort={sort} onSort={setSort} align="right">RMSE</TH>
              <TH field="predictedPeak" sort={sort} onSort={setSort} className="w-[22%]">Predicted CPU peak</TH>
              <TH field="memPeak" sort={sort} onSort={setSort} align="right">Mem peak</TH>
            </tr>
          </THead>
          <tbody>
            {isLoading && <SkeletonRows rows={8} cols={6} />}
            {rows.map((r) => (
              <TR key={r._id}>
                <TD>
                  <Link to={`/inventory/${r.resource._id}`} className="flex items-center gap-2.5 hover:text-brand-violet">
                    <ProviderLogo provider={r.resource.provider} size={22} />
                    <span className="font-medium">{r.resource.name}</span>
                    <span className="num text-[11px] text-muted">{r.resource.instanceType}</span>
                  </Link>
                </TD>
                <TD><Badge tone="brand">{r.model === 'holt-winters' ? `HW · ${r.params?.season === 168 ? '168h' : '24h'}` : 'Linear'}</Badge></TD>
                <TD align="right"><Badge tone={mapeTone(r.mape)} className="num">{r.mape}%</Badge></TD>
                <TD align="right" mono className="text-secondary">{r.rmse}</TD>
                <TD>
                  <div className="flex items-center gap-3">
                    <Bar value={r.predictedPeak} color={r.predictedPeak >= 80 ? '#F43F5E' : r.predictedPeak >= 60 ? '#F59E0B' : '#22D3EE'} className="flex-1" />
                    <span className="num flex w-14 items-center justify-end gap-1 text-xs">{r.predictedPeak >= 80 && <TriangleAlert className="h-3 w-3 text-danger" />}{r.predictedPeak}%</span>
                  </div>
                </TD>
                <TD align="right" mono className="text-secondary">{r.memPeak != null ? `${r.memPeak}%` : '—'}</TD>
              </TR>
            ))}
          </tbody>
        </Table>
      </Card>
    </div>
  );
}
