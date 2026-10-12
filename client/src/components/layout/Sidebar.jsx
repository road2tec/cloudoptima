import { NavLink } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import clsx from 'clsx';
import { ChevronsLeft, LogOut } from 'lucide-react';
import { NAV } from './nav';
import Logo from './Logo';
import { Avatar } from '../ui/misc';
import Tooltip from '../ui/Tooltip';
import { useAuth } from '../../context/AuthContext';
import { titleCase } from '../../lib/format';

function NavItem({ item, collapsed, onNavigate }) {
  const link = (
    <NavLink
      to={item.to}
      end={item.end}
      onClick={onNavigate}
      className={({ isActive }) =>
        clsx(
          'relative flex h-9 items-center gap-3 rounded-btn px-3 text-[13px] font-medium transition-colors',
          collapsed && 'justify-center px-0',
          isActive ? 'bg-fg/[0.06] text-fg' : 'text-secondary hover:bg-fg/[0.035] hover:text-fg'
        )
      }
    >
      {({ isActive }) => (
        <>
          {isActive && (
            <motion.span layoutId="nav-indicator" className="absolute -left-3 top-1.5 h-6 w-[3px] rounded-r-full bg-brand" transition={{ type: 'spring', stiffness: 420, damping: 34 }} />
          )}
          <item.icon className={clsx('h-[17px] w-[17px] shrink-0', isActive && 'text-brand-violet')} />
          {!collapsed && <span className="truncate">{item.label}</span>}
        </>
      )}
    </NavLink>
  );
  return collapsed ? (
    <Tooltip content={item.label} className="w-full [&>a]:w-full">
      {link}
    </Tooltip>
  ) : (
    link
  );
}

export default function Sidebar({ collapsed, onToggle, onNavigate, mobile = false }) {
  const { user, logout } = useAuth();
  return (
    <aside className={clsx('flex h-full flex-col border-r border-line bg-surface transition-[width] duration-300', collapsed ? 'w-[76px]' : 'w-[248px]')}>
      <div className={clsx('flex h-16 items-center border-b border-line', collapsed ? 'justify-center' : 'justify-between px-5')}>
        <Logo withText={!collapsed} />
        {!collapsed && !mobile && (
          <button onClick={onToggle} className="rounded-lg p-1.5 text-muted transition hover:bg-fg/5 hover:text-fg" aria-label="Collapse sidebar">
            <ChevronsLeft className="h-4 w-4" />
          </button>
        )}
      </div>

      <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-5">
        {NAV.map((g) => (
          <div key={g.group}>
            <AnimatePresence initial={false}>
              {!collapsed && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="label mb-2 px-3">{g.group}</motion.div>}
            </AnimatePresence>
            {collapsed && <div className="mx-auto mb-2 h-px w-6 bg-line-strong" />}
            <div className="space-y-0.5">
              {g.items.map((item) => (
                <NavItem key={item.to} item={item} collapsed={collapsed} onNavigate={onNavigate} />
              ))}
            </div>
          </div>
        ))}
      </nav>

      {collapsed && !mobile && (
        <button onClick={onToggle} className="mx-auto mb-3 rounded-lg p-2 text-muted transition hover:bg-fg/5 hover:text-fg" aria-label="Expand sidebar">
          <ChevronsLeft className="h-4 w-4 rotate-180" />
        </button>
      )}

      {user && (
        <div className="border-t border-line p-3">
          <div className={clsx('flex items-center gap-3 rounded-xl p-2', !collapsed && 'bg-fg/[0.03]')}>
            <Avatar name={user.name} color={user.avatarColor} size={34} />
            {!collapsed && (
              <>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-medium">{user.name}</div>
                  <div className="truncate text-[11px] text-muted">{titleCase(user.role)} · {user.email}</div>
                </div>
                <Tooltip content="Sign out">
                  <button onClick={logout} className="rounded-lg p-1.5 text-muted transition hover:bg-fg/5 hover:text-danger" aria-label="Sign out">
                    <LogOut className="h-4 w-4" />
                  </button>
                </Tooltip>
              </>
            )}
          </div>
        </div>
      )}
    </aside>
  );
}
