import clsx from 'clsx';
import { motion } from 'framer-motion';
import AnimatedNumber from './AnimatedNumber';
import Skeleton from './Skeleton';
import Sparkline from '../charts/Sparkline';
import { fadeUp } from './Card';

export default function StatCard({ label, value, format, icon: Icon, accent = '#8B5CF6', spark, footer, loading, live = false }) {
  if (loading) {
    return (
      <div className="card space-y-3 p-4">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-7 w-32" />
        <Skeleton className="h-8 w-full" />
      </div>
    );
  }
  return (
    <motion.div variants={fadeUp} whileHover={{ y: -3 }} transition={{ type: 'spring', stiffness: 300, damping: 22 }} className="card group relative overflow-hidden p-4 hover:shadow-lift">
      {/* soft accent glow */}
      <div className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full opacity-[0.14] blur-2xl transition group-hover:opacity-25" style={{ background: accent }} />
      <div className="relative flex items-center justify-between">
        <span className="label">{label}</span>
        {Icon && (
          <span className="grid h-7 w-7 place-items-center rounded-lg" style={{ background: `${accent}1A`, color: accent }}>
            <Icon className="h-3.5 w-3.5" />
          </span>
        )}
      </div>
      <div className="relative mt-2 flex items-baseline gap-2">
        <AnimatedNumber value={value} format={format} className="num text-[24px] font-semibold tracking-tight" />
        {live && <span className="h-1.5 w-1.5 animate-pulse-dot rounded-full bg-success" />}
      </div>
      <div className={clsx('relative mt-2 flex min-h-[32px] items-end justify-between gap-3')}>
        <div className="text-xs text-secondary">{footer}</div>
        {spark?.length > 1 && (
          <div className="h-8 w-24 shrink-0">
            <Sparkline data={spark} color={accent} />
          </div>
        )}
      </div>
    </motion.div>
  );
}
