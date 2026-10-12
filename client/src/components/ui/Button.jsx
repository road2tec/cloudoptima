import { forwardRef } from 'react';
import clsx from 'clsx';
import { Loader2 } from 'lucide-react';
import Tooltip from './Tooltip';

const VARIANTS = {
  primary: 'bg-brand text-white shadow-brand hover:brightness-110 active:brightness-95',
  secondary: 'bg-elevated text-fg border border-line-strong hover:bg-fg/[0.06]',
  ghost: 'text-secondary hover:text-fg hover:bg-fg/[0.05]',
  danger: 'bg-danger/10 text-danger border border-danger/25 hover:bg-danger/15',
  success: 'bg-success/10 text-success border border-success/25 hover:bg-success/15',
};
const SIZES = {
  xs: 'h-7 px-2.5 text-xs gap-1.5',
  sm: 'h-8 px-3 text-[13px] gap-1.5',
  md: 'h-10 px-4 text-sm gap-2',
  icon: 'h-9 w-9 justify-center',
};

const Button = forwardRef(function Button(
  { variant = 'secondary', size = 'md', loading = false, icon: Icon, iconRight: IconRight, disabled, disabledReason, className, children, ...rest },
  ref
) {
  const isDisabled = disabled || loading || Boolean(disabledReason);
  const btn = (
    <button
      ref={ref}
      disabled={isDisabled}
      className={clsx(
        'inline-flex select-none items-center whitespace-nowrap rounded-btn font-medium transition-all duration-150',
        'disabled:cursor-not-allowed disabled:opacity-45 disabled:shadow-none disabled:hover:brightness-100',
        VARIANTS[variant],
        SIZES[size],
        className
      )}
      {...rest}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : Icon && <Icon className="h-4 w-4 shrink-0" />}
      {children}
      {IconRight && <IconRight className="h-4 w-4 shrink-0" />}
    </button>
  );
  // Disabled buttons explain why on hover (e.g. "Approver role required").
  return disabledReason ? (
    <Tooltip content={disabledReason}>
      <span className="inline-flex">{btn}</span>
    </Tooltip>
  ) : (
    btn
  );
});

export default Button;
