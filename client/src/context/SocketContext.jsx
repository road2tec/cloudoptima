import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { io } from 'socket.io-client';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { TOKEN_KEY } from '../api/client';
import { useAuth } from './AuthContext';

const SocketContext = createContext({ connected: false, ticks: [], lastTick: null, lastEventAt: null });

export function SocketProvider({ children }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [connected, setConnected] = useState(false);
  const [ticks, setTicks] = useState([]);
  const [lastEventAt, setLastEventAt] = useState(null);

  useEffect(() => {
    if (!user) return undefined;
    const socket = io({ auth: { token: localStorage.getItem(TOKEN_KEY) }, transports: ['websocket', 'polling'] });
    socket.on('connect', () => {
      setConnected(true);
      setLastEventAt(Date.now());
    });
    socket.on('disconnect', () => setConnected(false));

    socket.on('metrics:tick', (t) => {
      setLastEventAt(Date.now());
      setTicks((prev) => [...prev.slice(-119), t]);
    });
    socket.on('account:sync', (e) => {
      qc.invalidateQueries({ queryKey: ['accounts'] });
      if (e.status === 'connected') {
        qc.invalidateQueries();
        toast.success('Sync complete', { description: e.result ? `${e.result.resources} resources · ${e.result.costs.toLocaleString()} cost records` : undefined });
      } else if (e.status === 'error') toast.error('Sync failed', { description: e.error });
    });
    socket.on('recommendations:updated', () => {
      qc.invalidateQueries({ queryKey: ['recommendations'] });
      qc.invalidateQueries({ queryKey: ['overview'] });
    });
    socket.on('audit:new', () => qc.invalidateQueries({ queryKey: ['audit'] }));
    return () => socket.disconnect();
  }, [user, qc]);

  const value = useMemo(() => ({ connected, ticks, lastTick: ticks.at(-1) || null, lastEventAt }), [connected, ticks, lastEventAt]);
  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
}

export const useLive = () => useContext(SocketContext);
