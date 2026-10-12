import clsx from 'clsx';
import { motion } from 'framer-motion';
import { TrendingDown, TrendingUp } from 'lucide-react';
import { initials, signed } from '../../lib/format';

export function Avatar({ name, color = '#8B5CF6', size = 32, className }) {
  return (
    <span
      className={clsx('grid shrink-0 place-items-center rounded-full font-semibold text-white ring-2 ring-surface', className)}
      style={{ width: size, height: size, fontSize: size * 0.38, background: `linear-gradient(135deg, ${color}, ${color}AA)` }}
    >
      {initials(name)}
    </span>
  );
}

// Thin animated bar used for shares and confidence.
export function Bar({ value, max = 100, color, className, height = 6 }) {
  const pct = Math.max(0, Math.min(100, (value / (max || 1)) * 100));
  return (
    <div className={clsx('w-full overflow-hidden rounded-full bg-fg/[0.06]', className)} style={{ height }}>
      <motion.div
        className={clsx('h-full rounded-full', !color && 'bg-brand')}
        style={color ? { background: color } : undefined}
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
      />
    </div>
  );
}

// Month-over-month style change chip. `inverse` = an increase is good.
export function DeltaChip({ value, inverse = false, className, suffix = '' }) {
  if (value == null) return <span className="text-xs text-muted">—</span>;
  const up = value > 0;
  const good = inverse ? up : !up;
  const Icon = up ? TrendingUp : TrendingDown;
  return (
    <span className={clsx('num inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11.5px] font-medium', good ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger', className)}>
      <Icon className="h-3 w-3" />
      {signed(value)}
      {suffix}
    </span>
  );
}

export function PageHeader({ title, description, actions }) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-[22px] font-semibold tracking-tight">{title}</h1>
        {description && <p className="mt-1 text-[13px] text-secondary">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function KeyValue({ label, children, mono }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5 text-[13px]">
      <span className="text-muted">{label}</span>
      <span className={clsx('min-w-0 break-all text-right text-fg', mono && 'num')}>{children}</span>
    </div>
  );
}
