import { memo } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import ChartTooltip from './ChartTooltip';
import { seriesColor, PROVIDERS } from '../../lib/constants';
import { shortDate } from '../../lib/format';
import { useTheme } from '../../context/ThemeContext';

function StackedBar({ data, keys, height = 300, valueFormat, axisFormat, xKey = 'date', xFormat = shortDate, colors }) {
  const { chart } = useTheme();
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barCategoryGap="22%">
        <CartesianGrid vertical={false} stroke={chart.grid} />
        <XAxis dataKey={xKey} tickFormatter={xFormat} tickLine={false} axisLine={false} minTickGap={24} tick={{ fill: chart.axis }} />
        <YAxis tickFormatter={axisFormat || valueFormat} tickLine={false} axisLine={false} width={56} tick={{ fill: chart.axis }} />
        <Tooltip content={<ChartTooltip labelFormat={xFormat} valueFormat={valueFormat} total />} cursor={{ fill: chart.empty }} />
        {keys.map((k, i) => (
          <Bar
            key={k}
            dataKey={k}
            name={PROVIDERS[k]?.label || k}
            stackId="s"
            fill={colors?.[i] || seriesColor(k, i)}
            radius={i === keys.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
            animationDuration={600}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

export default memo(StackedBar);
