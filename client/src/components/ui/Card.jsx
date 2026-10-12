import clsx from 'clsx';
import { motion } from 'framer-motion';

export const fadeUp = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] } },
};
export const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.05 } } };

export default function Card({ title, subtitle, action, children, className, bodyClassName, hover = false, padded = true, ...rest }) {
  return (
    <motion.section
      variants={fadeUp}
      whileHover={hover ? { y: -3 } : undefined}
      transition={{ type: 'spring', stiffness: 300, damping: 24 }}
      className={clsx('card relative overflow-hidden', hover && 'transition-shadow hover:shadow-lift', className)}
      {...rest}
    >
      {(title || action) && (
        <header className="flex items-start justify-between gap-3 px-5 pt-4">
          <div className="min-w-0">
            {title && <h3 className="truncate text-[13px] font-semibold text-fg">{title}</h3>}
            {subtitle && <p className="mt-0.5 truncate text-xs text-muted">{subtitle}</p>}
          </div>
          {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
        </header>
      )}
      <div className={clsx(padded && 'p-5', title && padded && 'pt-4', bodyClassName)}>{children}</div>
    </motion.section>
  );
}
