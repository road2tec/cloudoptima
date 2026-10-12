import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { authApi } from '../api/auth';
import { TOKEN_KEY } from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const qc = useQueryClient();
  const [user, setUser] = useState(null);
  const [config, setConfig] = useState({ usdToInr: 83.5 });
  const [loading, setLoading] = useState(() => Boolean(localStorage.getItem(TOKEN_KEY)));

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setUser(null);
    qc.clear();
  }, [qc]);

  // Restore the session on first load.
  useEffect(() => {
    if (!localStorage.getItem(TOKEN_KEY)) return;
    authApi
      .me()
      .then((d) => {
        setUser(d.user);
        setConfig(d.config);
      })
      .catch(() => logout())
      .finally(() => setLoading(false));
  }, [logout]);

  // The axios interceptor fires this when the token is rejected.
  useEffect(() => {
    const onLogout = () => setUser(null);
    window.addEventListener('co:logout', onLogout);
    return () => window.removeEventListener('co:logout', onLogout);
  }, []);

  const startSession = useCallback((d) => {
    localStorage.setItem(TOKEN_KEY, d.token);
    setUser(d.user);
    setConfig(d.config);
    return d.user;
  }, []);

  const value = useMemo(
    () => ({
      user,
      config,
      loading,
      login: (email, password) => authApi.login({ email, password }).then(startSession),
      register: (body) => authApi.register(body).then(startSession),
      logout,
      setUser,
      // Approve / execute / sync need an approver or admin.
      canOperate: user?.role === 'admin' || user?.role === 'approver',
      isAdmin: user?.role === 'admin',
    }),
    [user, config, loading, logout, startSession]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
