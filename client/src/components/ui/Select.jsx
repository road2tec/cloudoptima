import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, ChevronDown } from 'lucide-react';
import clsx from 'clsx';

// Custom dropdown. options: [{ value, label, icon?, hint? }]. value '' = "All".
export default function Select({ value, onChange, options, placeholder = 'All', label, icon: Icon, className, align = 'left', allowClear = true }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => !ref.current?.contains(e.target) && setOpen(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  const selected = options.find((o) => o.value === value);
  const items = allowClear ? [{ value: '', label: placeholder }, ...options] : options;

  return (
    <div ref={ref} className={clsx('relative', className)}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={clsx(
          'flex h-9 w-full items-center gap-2 rounded-btn border bg-elevated px-3 text-[13px] transition',
          open ? 'border-brand-violet/50 ring-2 ring-brand-violet/15' : 'border-line hover:border-line-strong',
          value ? 'text-fg' : 'text-secondary'
        )}
      >
        {Icon && <Icon className="h-3.5 w-3.5 text-muted" />}
        {label && <span className="text-muted">{label}</span>}
        <span className="flex min-w-0 flex-1 items-center gap-1.5 truncate text-left font-medium">
          {selected?.icon}
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown className={clsx('h-3.5 w-3.5 shrink-0 text-muted transition', open && 'rotate-180')} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.ul
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.12 }}
            className={clsx('absolute z-40 mt-1.5 max-h-72 min-w-full overflow-y-auto rounded-xl border border-line-strong bg-elevated p-1 shadow-lift', align === 'right' ? 'right-0' : 'left-0')}
          >
            {items.map((o) => (
              <li key={o.value || '__all'}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(o.value);
                    setOpen(false);
                  }}
                  className={clsx('flex w-full items-center gap-2 whitespace-nowrap rounded-lg px-2.5 py-2 text-left text-[13px] transition hover:bg-fg/[0.06]', o.value === value ? 'text-fg' : 'text-secondary')}
                >
                  {o.icon}
                  <span className="flex-1">{o.label}</span>
                  {o.hint != null && <span className="num text-[11px] text-muted">{o.hint}</span>}
                  {o.value === value && <Check className="h-3.5 w-3.5 text-brand-violet" />}
                </button>
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}
