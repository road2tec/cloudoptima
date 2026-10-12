import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { Toaster } from 'sonner';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import { SocketProvider } from './context/SocketContext';
import AppShell from './components/layout/AppShell';
import Logo from './components/layout/Logo';

// Every page is code-split.
const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const Overview = lazy(() => import('./pages/Overview'));
const Inventory = lazy(() => import('./pages/Inventory'));
const ResourceDetail = lazy(() => import('./pages/ResourceDetail'));
const CostExplorer = lazy(() => import('./pages/CostExplorer'));
const Forecasts = lazy(() => import('./pages/Forecasts'));
const Recommendations = lazy(() => import('./pages/Recommendations'));
const Accounts = lazy(() => import('./pages/Accounts'));
const AuditLog = lazy(() => import('./pages/AuditLog'));
const Settings = lazy(() => import('./pages/Settings'));

function Splash() {
  return (
    <div className="grid h-full place-items-center">
      <div className="animate-pulse">
        <Logo size={40} />
      </div>
    </div>
  );
}

function Protected({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <Splash />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return children;
}

function PublicOnly({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <Splash />;
  return user ? <Navigate to="/" replace /> : children;
}

function ThemedToaster() {
  const { theme } = useTheme();
  return <Toaster theme={theme} position="bottom-right" richColors closeButton toastOptions={{ style: { borderRadius: 12 } }} />;
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <SocketProvider>
          <Suspense fallback={<Splash />}>
            <Routes>
              <Route path="/login" element={<PublicOnly><Login /></PublicOnly>} />
              <Route path="/register" element={<PublicOnly><Register /></PublicOnly>} />
              <Route element={<Protected><AppShell /></Protected>}>
                <Route index element={<Overview />} />
                <Route path="inventory" element={<Inventory />} />
                <Route path="inventory/:id" element={<ResourceDetail />} />
                <Route path="costs" element={<CostExplorer />} />
                <Route path="forecasts" element={<Forecasts />} />
                <Route path="recommendations" element={<Recommendations />} />
                <Route path="accounts" element={<Accounts />} />
                <Route path="audit" element={<AuditLog />} />
                <Route path="settings" element={<Settings />} />
              </Route>
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
          <ThemedToaster />
        </SocketProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
