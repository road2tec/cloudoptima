import clsx from 'clsx';

const TONES = {
  success: 'bg-success/10 text-success ring-success/20',
  warning: 'bg-warning/10 text-warning ring-warning/20',
  danger: 'bg-danger/10 text-danger ring-danger/20',
  info: 'bg-brand-cyan/10 text-brand-cyan ring-brand-cyan/20',
  brand: 'bg-brand-violet/[0.12] text-[#A78BFA] ring-brand-violet/25',
  neutral: 'bg-fg/[0.05] text-secondary ring-line-strong',
};
const DOTS = { success: 'bg-success', warning: 'bg-warning', danger: 'bg-danger', info: 'bg-brand-cyan', brand: 'bg-brand-violet', neutral: 'bg-muted' };

export default function Badge({ tone = 'neutral', dot = false, pulse = false, className, children }) {
  return (
    <span className={clsx('inline-flex h-6 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 text-[11.5px] font-medium ring-1 ring-inset', TONES[tone], className)}>
      {dot && <span className={clsx('h-1.5 w-1.5 rounded-full', DOTS[tone], pulse && 'animate-pulse')} />}
      {children}
    </span>
  );
}
