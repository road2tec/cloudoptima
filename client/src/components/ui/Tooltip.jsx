import clsx from 'clsx';

// CSS-only tooltip; cheap enough to use everywhere.
export default function Tooltip({ content, children, side = 'top', className }) {
  if (!content) return children;
  return (
    <span className={clsx('group/tt relative inline-flex', className)}>
      {children}
      <span
        role="tooltip"
        className={clsx(
          'pointer-events-none absolute left-1/2 z-50 -translate-x-1/2 whitespace-nowrap rounded-lg border border-line-strong bg-elevated px-2.5 py-1.5 text-xs font-medium text-fg opacity-0 shadow-lift transition duration-150 group-hover/tt:opacity-100',
          side === 'top' ? 'bottom-full mb-2 translate-y-1 group-hover/tt:translate-y-0' : 'top-full mt-2 -translate-y-1 group-hover/tt:translate-y-0'
        )}
      >
        {content}
      </span>
    </span>
  );
}
