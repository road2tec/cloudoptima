import clsx from 'clsx';
import { PROVIDERS } from '../../lib/constants';

// Simple hand-drawn provider marks on a coloured rounded square (no external images).
const GLYPHS = {
  aws: (
    <>
      <text x="16" y="17" textAnchor="middle" fontSize="10.5" fontWeight="700" fontFamily="Inter, sans-serif" fill="#fff" letterSpacing="-0.3">aws</text>
      <path d="M8.5 20.5c4.6 2.6 10.4 2.6 15 0" stroke="#fff" strokeWidth="1.8" fill="none" strokeLinecap="round" />
      <path d="M21.6 19.2l2.2 1.2-1.1 2.2" stroke="#fff" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  azure: (
    <>
      <path d="M14.2 7.5h4.4L12 24.5H7.8z" fill="#fff" />
      <path d="M19.2 11.6l5.2 12.9H13.6l6.3-1.9-3-5.1z" fill="#fff" opacity=".82" />
    </>
  ),
  gcp: (
    <>
      <path d="M11.2 21.5a4.6 4.6 0 0 1-.6-9.1 6 6 0 0 1 11.3 1.4 3.9 3.9 0 0 1-.6 7.7z" fill="none" stroke="#fff" strokeWidth="2" strokeLinejoin="round" />
      <circle cx="16" cy="17.2" r="2" fill="#fff" />
    </>
  ),
};

export default function ProviderLogo({ provider, size = 28, className }) {
  const meta = PROVIDERS[provider];
  if (!meta) return null;
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" className={clsx('shrink-0', className)} role="img" aria-label={meta.name}>
      <defs>
        <linearGradient id={`pl-${provider}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={meta.color} />
          <stop offset="1" stopColor={meta.color} stopOpacity=".78" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="8" fill={`url(#pl-${provider})`} />
      <rect x=".5" y=".5" width="31" height="31" rx="7.5" fill="none" stroke="#fff" strokeOpacity=".18" />
      {GLYPHS[provider]}
    </svg>
  );
}

export function ProviderChip({ provider, className, showName = false }) {
  const meta = PROVIDERS[provider];
  if (!meta) return null;
  return (
    <span className={clsx('inline-flex h-6 items-center gap-1.5 rounded-full py-0.5 pl-0.5 pr-2.5 text-[11.5px] font-medium ring-1 ring-inset', className)} style={{ background: `${meta.color}14`, color: meta.color, '--tw-ring-color': `${meta.color}33` }}>
      <ProviderLogo provider={provider} size={20} />
      {showName ? meta.name : meta.label}
    </span>
  );
}
