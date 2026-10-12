import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import clsx from 'clsx';
import { Bell, ChevronRight, LogOut, Menu, Moon, Search, Settings, Sun } from 'lucide-react';
import { routeMeta } from './nav';
import { Avatar } from '../ui/misc';
import Tooltip from '../ui/Tooltip';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useLive } from '../../context/SocketContext';
import { useAudit } from '../../hooks/useApi';
import { timeAgo, titleCase } from '../../lib/format';

function usePopover() {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => !ref.current?.contains(e.target) && setOpen(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);
  return { open, setOpen, ref };
}

const pop = { initial: { opacity: 0, y: -6, scale: 0.98 }, animate: { opacity: 1, y: 0, scale: 1 }, exit: { opacity: 0, y: -6, scale: 0.98 }, transition: { duration: 0.14 } };

function LiveIndicator() {
  const { connected, lastEventAt } = useLive();
  const [, force] = useState(0);
  useEffect(() => {
    const t = setInterval(() => force((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <Tooltip content={connected ? 'Streaming live metrics from the simulator' : 'Realtime connection lost — retrying'} side="bottom">
      <div className="hidden h-8 items-center gap-2 rounded-full border border-line bg-elevated px-3 text-xs md:flex">
        <span className={clsx('h-2 w-2 rounded-full', connected ? 'animate-pulse-dot bg-success' : 'bg-danger')} />
        <span className="font-medium">{connected ? 'Live' : 'Offline'}</span>
        <span className="num text-muted">· updated {timeAgo(lastEventAt)}</span>
      </div>
    </Tooltip>
  );
}

function Notifications() {
  const { open, setOpen, ref } = usePopover();
  const { data } = useAudit({ limit: 8 });
  const [seen, setSeen] = useState(() => localStorage.getItem('co-notif-seen') || '');
  const items = data?.items || [];
  const unread = items.filter((i) => i.createdAt > seen).length;
  const toggle = () => {
    setOpen((o) => !o);
    if (items[0]) {
      localStorage.setItem('co-notif-seen', items[0].createdAt);
      setSeen(items[0].createdAt);
    }
  };
  return (
    <div ref={ref} className="relative">
      <button onClick={toggle} className="relative grid h-9 w-9 place-items-center rounded-btn text-secondary transition hover:bg-fg/5 hover:text-fg" aria-label="Notifications">
        <Bell className="h-[18px] w-[18px]" />
        {unread > 0 && <span className="num absolute right-1 top-1 grid h-4 min-w-4 place-items-center rounded-full bg-danger px-1 text-[9.5px] font-semibold text-white">{unread}</span>}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div {...pop} className="absolute right-0 z-50 mt-2 w-80 overflow-hidden rounded-xl border border-line-strong bg-elevated shadow-lift">
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <span className="text-[13px] font-semibold">Activity</span>
              <Link to="/audit" onClick={() => setOpen(false)} className="text-xs text-brand-violet hover:underline">View all</Link>
            </div>
            <ul className="max-h-80 overflow-y-auto">
              {items.map((i) => (
                <li key={i._id} className="flex gap-3 border-b border-line px-4 py-3 last:border-0">
                  <Avatar name={i.userName || 'System'} color={i.user?.avatarColor} size={26} />
                  <div className="min-w-0 text-xs">
                    <div className="text-fg"><span className="font-medium">{i.userName || 'System'}</span> <span className="text-secondary">{titleCase(i.action.split('.').slice(1).join(' ') || i.action)}</span></div>
                    <div className="mt-0.5 truncate text-muted">{i.details?.title || i.details?.name || i.entityType} · {timeAgo(i.createdAt)}</div>
                  </div>
                </li>
              ))}
              {!items.length && <li className="px-4 py-6 text-center text-xs text-muted">No activity yet</li>}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function UserMenu() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { open, setOpen, ref } = usePopover();
  if (!user) return null;
  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen((o) => !o)} className="rounded-full transition hover:opacity-90" aria-label="Account menu">
        <Avatar name={user.name} color={user.avatarColor} size={32} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div {...pop} className="absolute right-0 z-50 mt-2 w-60 overflow-hidden rounded-xl border border-line-strong bg-elevated p-1 shadow-lift">
            <div className="px-3 py-2.5">
              <div className="text-[13px] font-medium">{user.name}</div>
              <div className="text-xs text-muted">{user.email}</div>
              <div className="mt-2 inline-flex rounded-md bg-brand-violet/10 px-2 py-0.5 text-[11px] font-medium text-[#A78BFA]">{titleCase(user.role)}</div>
            </div>
            <div className="my-1 h-px bg-line" />
            <button onClick={() => { setOpen(false); navigate('/settings'); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-[13px] text-secondary hover:bg-fg/5 hover:text-fg">
              <Settings className="h-4 w-4" /> Settings
            </button>
            <button onClick={logout} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-[13px] text-secondary hover:bg-danger/10 hover:text-danger">
              <LogOut className="h-4 w-4" /> Sign out
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function Topbar({ onMenu, onSearch }) {
  const { pathname } = useLocation();
  const meta = routeMeta(pathname);
  const { theme, toggle } = useTheme();
  return (
    <header className="glass sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-line px-4 sm:px-6">
      <button onClick={onMenu} className="rounded-lg p-2 text-secondary hover:bg-fg/5 lg:hidden" aria-label="Open navigation">
        <Menu className="h-5 w-5" />
      </button>
      <div className="min-w-0">
        <div className="flex items-center gap-1 text-[11px] text-muted">
          <span>{meta.group}</span>
          {meta.parent && (
            <>
              <ChevronRight className="h-3 w-3" />
              <Link to={meta.parent.to} className="hover:text-fg">{meta.parent.label}</Link>
            </>
          )}
        </div>
        <div className="truncate text-[15px] font-semibold leading-tight">{meta.title}</div>
      </div>

      <button
        onClick={onSearch}
        className="ml-auto flex h-9 w-9 items-center gap-2 rounded-btn border border-line bg-elevated px-2.5 text-[13px] text-muted transition hover:border-line-strong hover:text-secondary sm:w-64 md:w-72"
      >
        <Search className="h-4 w-4 shrink-0" />
        <span className="hidden flex-1 text-left sm:inline">Search resources, pages…</span>
        <kbd className="num hidden rounded-md border border-line-strong px-1.5 py-0.5 text-[10.5px] sm:inline">Ctrl K</kbd>
      </button>
      <LiveIndicator />
      <Notifications />
      <Tooltip content={theme === 'dark' ? 'Light theme' : 'Dark theme'} side="bottom">
        <button onClick={toggle} className="grid h-9 w-9 place-items-center rounded-btn text-secondary transition hover:bg-fg/5 hover:text-fg" aria-label="Toggle theme">
          <AnimatePresence mode="wait" initial={false}>
            <motion.span key={theme} initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }} transition={{ duration: 0.18 }}>
              {theme === 'dark' ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
            </motion.span>
          </AnimatePresence>
        </button>
      </Tooltip>
      <UserMenu />
    </header>
  );
}
