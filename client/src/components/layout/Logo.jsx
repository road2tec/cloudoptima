export default function Logo({ size = 32, withText = true }) {
  return (
    <div className="flex items-center gap-2.5">
      <svg width={size} height={size} viewBox="0 0 32 32" className="shrink-0 drop-shadow-[0_6px_16px_rgba(139,92,246,.45)]">
        <defs>
          <linearGradient id="logo-g" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#8B5CF6" />
            <stop offset="1" stopColor="#22D3EE" />
          </linearGradient>
        </defs>
        <rect width="32" height="32" rx="9" fill="url(#logo-g)" />
        <path d="M9 19.5a4.5 4.5 0 0 1 1.6-8.7A6 6 0 0 1 22 12a4 4 0 0 1 .5 7.9" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" />
        <path d="M12 22l3-3 2 2 4-4" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {withText && (
        <div className="leading-tight">
          <div className="text-[15px] font-semibold tracking-tight">CloudOptima</div>
          <div className="text-[10.5px] font-medium uppercase tracking-[0.14em] text-muted">FinOps Command</div>
        </div>
      )}
    </div>
  );
}
