import { memo, useId } from 'react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import ChartTooltip from './ChartTooltip';
import { seriesColor, PROVIDERS } from '../../lib/constants';
import { shortDate } from '../../lib/format';
import { useTheme } from '../../context/ThemeContext';

// Stacked area chart (e.g. daily spend by provider).
function AreaTrend({ data, keys, height = 280, valueFormat, axisFormat, xKey = 'date', xFormat = shortDate, stacked = true }) {
  const { chart } = useTheme();
  const id = useId().replace(/:/g, '');
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        <defs>
          {keys.map((k, i) => (
            <linearGradient key={k} id={`at-${id}-${i}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor={seriesColor(k, i)} stopOpacity={0.4} />
              <stop offset="1" stopColor={seriesColor(k, i)} stopOpacity={0.02} />
            </linearGradient>
          ))}
        </defs>
        <CartesianGrid vertical={false} stroke={chart.grid} />
        <XAxis dataKey={xKey} tickFormatter={xFormat} tickLine={false} axisLine={false} minTickGap={32} tick={{ fill: chart.axis }} />
        <YAxis tickFormatter={axisFormat || valueFormat} tickLine={false} axisLine={false} width={56} tick={{ fill: chart.axis }} />
        <Tooltip content={<ChartTooltip labelFormat={xFormat} valueFormat={valueFormat} total={stacked} />} cursor={{ stroke: chart.grid, strokeWidth: 1 }} />
        {keys.map((k, i) => (
          <Area
            key={k}
            type="monotone"
            dataKey={k}
            name={PROVIDERS[k]?.label || k}
            stackId={stacked ? 's' : undefined}
            stroke={seriesColor(k, i)}
            strokeWidth={1.6}
            fill={`url(#at-${id}-${i})`}
            animationDuration={700}
          />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  );
}

export default memo(AreaTrend);
