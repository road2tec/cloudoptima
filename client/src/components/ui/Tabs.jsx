import { useId } from 'react';
import clsx from 'clsx';
import { motion } from 'framer-motion';

// Underline tabs. tabs: [{ value, label, icon?, count? }]
export default function Tabs({ tabs, value, onChange, className }) {
  const id = useId();
  return (
    <div className={clsx('flex gap-1 overflow-x-auto border-b border-line', className)} role="tablist">
      {tabs.map((t) => {
        const active = t.value === value;
        return (
          <button
            key={t.value}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(t.value)}
            className={clsx('relative flex h-10 items-center gap-2 whitespace-nowrap px-3 text-[13px] font-medium transition', active ? 'text-fg' : 'text-muted hover:text-secondary')}
          >
            {t.icon && <t.icon className="h-4 w-4" />}
            {t.label}
            {t.count != null && <span className="num rounded-md bg-fg/[0.06] px-1.5 text-[11px] text-secondary">{t.count}</span>}
            {active && <motion.span layoutId={`tab-${id}`} className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-brand" />}
          </button>
        );
      })}
    </div>
  );
}

// Pill switcher for small option sets (date presets, group-by, view mode).
export function Segmented({ options, value, onChange, size = 'sm', className }) {
  const id = useId();
  return (
    <div className={clsx('inline-flex rounded-btn border border-line bg-elevated p-0.5', className)}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            onClick={() => onChange(o.value)}
            title={o.title}
            className={clsx(
              'relative flex items-center gap-1.5 rounded-[8px] font-medium transition',
              size === 'sm' ? 'h-7 px-2.5 text-xs' : 'h-8 px-3 text-[13px]',
              active ? 'text-fg' : 'text-muted hover:text-secondary'
            )}
          >
            {active && <motion.span layoutId={`seg-${id}`} className="absolute inset-0 rounded-[8px] border border-line-strong bg-surface shadow-glow" transition={{ type: 'spring', stiffness: 420, damping: 34 }} />}
            <span className="relative flex items-center gap-1.5">
              {o.icon && <o.icon className="h-3.5 w-3.5" />}
              {o.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
