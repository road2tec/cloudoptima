import { memo, useMemo } from 'react';
import { Area, CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import ChartTooltip from './ChartTooltip';
import { hourLabel, shortDate } from '../../lib/format';
import { useTheme } from '../../context/ThemeContext';

/**
 * Actual history + forecast with a confidence band.
 * history:  [{ ts, value }]
 * forecast: [{ ts, value, lower, upper }]
 * backtest: [{ ts, predicted }] (optional) — hold-out predictions drawn over the history
 */
function ForecastChart({ history = [], forecast = [], backtest = [], height = 320, unit = '%', threshold }) {
  const { chart } = useTheme();
  const data = useMemo(() => {
    const map = new Map();
    const at = (ts) => {
      const k = new Date(ts).getTime();
      if (!map.has(k)) map.set(k, { ts: k });
      return map.get(k);
    };
    history.forEach((h) => (at(h.ts).actual = h.value));
    backtest.forEach((b) => (at(b.ts).backtest = b.predicted));
    forecast.forEach((f) => Object.assign(at(f.ts), { forecast: f.value, band: [f.lower, f.upper] }));
    // Join the forecast line to the last actual point so there is no visual gap.
    const last = history.at(-1);
    if (last && forecast.length) Object.assign(at(last.ts), { forecast: last.value, band: [last.value, last.value] });
    return [...map.values()].sort((a, b) => a.ts - b.ts);
  }, [history, forecast, backtest]);

  const now = history.at(-1) ? new Date(history.at(-1).ts).getTime() : null;
  const fmt = (v) => `${Number(v).toFixed(1)}${unit}`;

  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} margin={{ top: 10, right: 8, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id="fc-band" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#8B5CF6" stopOpacity={0.28} />
            <stop offset="1" stopColor="#22D3EE" stopOpacity={0.1} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke={chart.grid} />
        <XAxis dataKey="ts" type="number" scale="time" domain={['dataMin', 'dataMax']} tickFormatter={shortDate} tickLine={false} axisLine={false} minTickGap={40} tick={{ fill: chart.axis }} />
        <YAxis tickFormatter={(v) => `${v}${unit}`} tickLine={false} axisLine={false} width={46} domain={[0, (max) => Math.min(100, Math.ceil((max + 5) / 10) * 10)]} tick={{ fill: chart.axis }} />
        <Tooltip content={<ChartTooltip labelFormat={hourLabel} valueFormat={fmt} hideZero={false} />} />
        <Area dataKey="band" name="Confidence band" stroke="none" fill="url(#fc-band)" isAnimationActive={false} />
        <Line dataKey="actual" name="Actual" stroke="#22D3EE" strokeWidth={1.6} dot={false} isAnimationActive={false} />
        {backtest.length > 0 && <Line dataKey="backtest" name="Hold-out prediction" stroke="#F59E0B" strokeWidth={1.4} strokeDasharray="3 3" dot={false} isAnimationActive={false} />}
        <Line dataKey="forecast" name="Forecast" stroke="#A78BFA" strokeWidth={2} strokeDasharray="6 4" dot={false} isAnimationActive={false} />
        {now && <ReferenceLine x={now} stroke={chart.axis} strokeDasharray="2 4" label={{ value: 'now', position: 'insideTopRight', fill: chart.text, fontSize: 11 }} />}
        {threshold && <ReferenceLine y={threshold} stroke="#F43F5E" strokeOpacity={0.6} strokeDasharray="4 4" label={{ value: `${threshold}% ceiling`, position: 'insideTopLeft', fill: '#F43F5E', fontSize: 11 }} />}
      </ComposedChart>
    </ResponsiveContainer>
  );
}

export default memo(ForecastChart);
