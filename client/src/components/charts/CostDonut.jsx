import { memo, useState } from 'react';
import { Cell, Pie, PieChart, ResponsiveContainer, Sector } from 'recharts';
import { seriesColor, PROVIDERS } from '../../lib/constants';
import { useTheme } from '../../context/ThemeContext';

// data: [{ key, value }]
function CostDonut({ data, valueFormat, height = 220, centerLabel = 'Total' }) {
  const { chart } = useTheme();
  const [active, setActive] = useState(null);
  const total = data.reduce((s, d) => s + d.value, 0);
  const shown = active != null ? data[active] : null;

  return (
    <div className="relative" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="key"
            innerRadius="68%"
            outerRadius="92%"
            paddingAngle={2.5}
            stroke={chart.surface}
            strokeWidth={2}
            activeIndex={active ?? undefined}
            activeShape={(p) => <Sector {...p} outerRadius={p.outerRadius + 5} />}
            onMouseEnter={(_, i) => setActive(i)}
            onMouseLeave={() => setActive(null)}
            animationDuration={800}
          >
            {data.map((d, i) => (
              <Cell key={d.key} fill={seriesColor(d.key, i)} />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className="label">{shown ? PROVIDERS[shown.key]?.label || shown.key : centerLabel}</span>
        <span className="num mt-1 text-xl font-semibold">{valueFormat(shown ? shown.value : total)}</span>
        {shown && <span className="num text-xs text-secondary">{((shown.value / total) * 100).toFixed(1)}%</span>}
      </div>
    </div>
  );
}

export default memo(CostDonut);
