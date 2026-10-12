import clsx from 'clsx';
import { motion } from 'framer-motion';

export default function EmptyState({ icon: Icon, title, message, action, className, compact = false }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className={clsx('flex flex-col items-center justify-center text-center', compact ? 'py-8' : 'py-16', className)}
    >
      {Icon && (
        <div className="relative mb-4">
          <div className="absolute inset-0 rounded-2xl bg-brand opacity-20 blur-xl" />
          <div className="relative grid h-12 w-12 place-items-center rounded-2xl border border-line-strong bg-elevated">
            <Icon className="h-5 w-5 text-secondary" />
          </div>
        </div>
      )}
      <h4 className="text-sm font-semibold text-fg">{title}</h4>
      {message && <p className="mt-1 max-w-sm text-[13px] text-secondary">{message}</p>}
      {action && <div className="mt-5">{action}</div>}
    </motion.div>
  );
}
