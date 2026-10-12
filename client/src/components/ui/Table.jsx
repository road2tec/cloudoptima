import clsx from 'clsx';
import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react';

export function Table({ children, className, maxHeight }) {
  return (
    <div className={clsx('overflow-auto', className)} style={maxHeight ? { maxHeight } : undefined}>
      <table className="w-full border-separate border-spacing-0 text-left text-[13px]">{children}</table>
    </div>
  );
}

export function THead({ children }) {
  return <thead className="sticky top-0 z-10">{children}</thead>;
}

// Sortable header cell. sort is like "-monthlyCost"; field is "monthlyCost".
export function TH({ children, field, sort, onSort, align = 'left', className }) {
  const active = field && sort?.replace(/^-/, '') === field;
  const desc = sort?.startsWith('-');
  const Icon = active ? (desc ? ArrowDown : ArrowUp) : ChevronsUpDown;
  return (
    <th
      className={clsx(
        'glass whitespace-nowrap border-b border-line px-4 py-3 text-[11px] font-medium uppercase tracking-[0.07em] text-muted',
        align === 'right' && 'text-right',
        className
      )}
    >
      {field ? (
        <button
          onClick={() => onSort(active && desc ? field : `-${field}`)}
          className={clsx('inline-flex items-center gap-1 transition hover:text-fg', active && 'text-fg', align === 'right' && 'flex-row-reverse')}
        >
          {children}
          <Icon className={clsx('h-3 w-3', !active && 'opacity-40')} />
        </button>
      ) : (
        children
      )}
    </th>
  );
}

export function TR({ children, onClick, selected, className }) {
  return (
    <tr
      onClick={onClick}
      className={clsx(
        'group transition-colors [&>td]:border-t [&>td]:border-line',
        onClick && 'cursor-pointer hover:bg-fg/[0.025]',
        selected && 'bg-brand-violet/[0.06]',
        className
      )}
    >
      {children}
    </tr>
  );
}

export function TD({ children, align = 'left', className, mono }) {
  return <td className={clsx('whitespace-nowrap px-4 py-3', align === 'right' && 'text-right', mono && 'num', className)}>{children}</td>;
}
