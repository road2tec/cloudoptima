import { Suspense, useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import CommandPalette from './CommandPalette';
import PageFallback from './PageFallback';

export default function AppShell() {
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('co-sidebar') === 'collapsed');
  const [mobileOpen, setMobileOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);

  useEffect(() => localStorage.setItem('co-sidebar', collapsed ? 'collapsed' : 'open'), [collapsed]);
  useEffect(() => setMobileOpen(false), [location.pathname]);

  // Ctrl/Cmd + K opens the command palette from anywhere.
  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="flex h-full overflow-hidden">
      <div className="hidden lg:block">
        <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} />
      </div>

      {/* Mobile / tablet drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <motion.div className="absolute inset-0 bg-black/55 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setMobileOpen(false)} />
            <motion.div className="absolute inset-y-0 left-0" initial={{ x: -260 }} animate={{ x: 0 }} exit={{ x: -260 }} transition={{ type: 'spring', stiffness: 360, damping: 36 }}>
              <Sidebar mobile collapsed={false} onNavigate={() => setMobileOpen(false)} />
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <div className="relative flex min-w-0 flex-1 flex-col overflow-y-auto">
        {/* ambient brand glow */}
        <div className="pointer-events-none absolute left-1/3 top-0 h-72 w-[60%] -translate-y-1/2 rounded-full bg-brand opacity-[0.07] blur-3xl" />
        <Topbar onMenu={() => setMobileOpen(true)} onSearch={() => setPaletteOpen(true)} />
        <main className="relative mx-auto w-full max-w-[1480px] flex-1 px-4 py-6 sm:px-6 lg:px-8">
          {/* Entrance-only transition: an exit + "wait" step can stall while a lazy page chunk
              is still loading, leaving the new page stuck at opacity 0. */}
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          >
            <Suspense fallback={<PageFallback />}>
              <Outlet />
            </Suspense>
          </motion.div>
        </main>
      </div>
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </div>
  );
}
