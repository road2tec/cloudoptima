// Shared glass tooltip for every Recharts chart.
export default function ChartTooltip({ active, payload, label, labelFormat, valueFormat, hideZero = true, total = false }) {
  if (!active || !payload?.length) return null;
  const rows = payload.filter((p) => p.value != null && !(hideZero && p.value === 0) && !String(p.dataKey).startsWith('_'));
  const sum = rows.reduce((s, p) => s + (Array.isArray(p.value) ? 0 : p.value), 0);
  return (
    <div className="glass min-w-[180px] rounded-xl border border-line-strong px-3 py-2.5 shadow-lift">
      <div className="mb-1.5 text-[11px] font-medium text-muted">{labelFormat ? labelFormat(label) : label}</div>
      <div className="space-y-1">
        {rows.map((p) => (
          <div key={p.dataKey} className="flex items-center justify-between gap-4 text-xs">
            <span className="flex items-center gap-2 text-secondary">
              <span className="h-2 w-2 rounded-full" style={{ background: p.color || p.payload?.fill }} />
              {p.name}
            </span>
            <span className="num font-medium text-fg">
              {Array.isArray(p.value) ? `${valueFormat(p.value[0])} – ${valueFormat(p.value[1])}` : valueFormat ? valueFormat(p.value) : p.value}
            </span>
          </div>
        ))}
      </div>
      {total && rows.length > 1 && (
        <div className="mt-2 flex justify-between border-t border-line pt-1.5 text-xs">
          <span className="text-muted">Total</span>
          <span className="num font-semibold">{valueFormat ? valueFormat(sum) : sum}</span>
        </div>
      )}
    </div>
  );
}
