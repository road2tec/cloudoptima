import { memo, useId } from 'react';
import { Area, AreaChart, ResponsiveContainer } from 'recharts';

function Sparkline({ data, color = '#8B5CF6', dataKey = 'value' }) {
  const id = useId().replace(/:/g, '');
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id={`sp-${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={color} stopOpacity={0.35} />
            <stop offset="1" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area type="monotone" dataKey={dataKey} stroke={color} strokeWidth={1.6} fill={`url(#sp-${id})`} isAnimationActive={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export default memo(Sparkline);
