import { memo } from 'react';
import { Link } from 'react-router-dom';
import ProviderLogo from '../ui/ProviderLogo';
import { useTheme } from '../../context/ThemeContext';

// Colour scale: low = cool cyan, mid = violet, high = rose.
function heatColor(v) {
  if (v == null) return null;
  const t = Math.min(1, v / 75);
  const stops = [
    [34, 211, 238],
    [139, 92, 246],
    [244, 63, 94],
  ];
  const [a, b, k] = t < 0.5 ? [stops[0], stops[1], t * 2] : [stops[1], stops[2], (t - 0.5) * 2];
  const c = a.map((x, i) => Math.round(x + (b[i] - x) * k));
  return `rgba(${c.join(',')},${0.32 + t * 0.68})`;
}

// rows: [{ id, name, provider, hours: [24 values] }]
function Heatmap({ rows }) {
  const { chart } = useTheme();
  return (
    <div className="overflow-x-auto">
      <div className="min-w-[620px]">
        {rows.map((r) => (
          <div key={r.id} className="flex items-center gap-3 py-[3px]">
            <Link to={`/inventory/${r.id}`} className="flex w-44 shrink-0 items-center gap-2 truncate text-xs text-secondary transition hover:text-fg">
              <ProviderLogo provider={r.provider} size={16} />
              <span className="truncate">{r.name}</span>
            </Link>
            <div className="grid flex-1 gap-[3px]" style={{ gridTemplateColumns: 'repeat(24, minmax(0, 1fr))' }}>
              {r.hours.map((v, h) => (
                <div
                  key={h}
                  title={`${r.name} · ${String(h).padStart(2, '0')}:00 IST · ${v == null ? 'no data' : `${v}% CPU`}`}
                  className="h-[18px] rounded-[4px] transition hover:scale-110 hover:ring-1 hover:ring-fg/40"
                  style={{ background: heatColor(v) || chart.empty }}
                />
              ))}
            </div>
          </div>
        ))}
        <div className="mt-2 flex items-center gap-3 pl-[188px] text-[10px] text-muted">
          <div className="grid flex-1" style={{ gridTemplateColumns: 'repeat(24, minmax(0, 1fr))' }}>
            {Array.from({ length: 24 }).map((_, h) => (
              <span key={h} className="num text-center">{h % 3 === 0 ? String(h).padStart(2, '0') : ''}</span>
            ))}
          </div>
        </div>
        <div className="mt-3 flex items-center justify-end gap-2 text-[11px] text-muted">
          <span>Low</span>
          <div className="h-2 w-28 rounded-full" style={{ background: `linear-gradient(90deg, ${heatColor(5)}, ${heatColor(45)}, ${heatColor(90)})` }} />
          <span>High CPU · hour of day (IST)</span>
        </div>
      </div>
    </div>
  );
}

export default memo(Heatmap);
