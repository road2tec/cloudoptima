import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowRight, Mail, ShieldCheck, UserRound } from 'lucide-react';
import AuthLayout from './AuthLayout';
import PasswordInput from './PasswordInput';
import Button from '../components/ui/Button';
import { useAuth } from '../context/AuthContext';

const DEMO = [
  { label: 'Admin', email: 'admin@cloudoptima.io', password: 'Admin@123', icon: ShieldCheck, hint: 'Full access' },
  { label: 'Analyst', email: 'analyst@cloudoptima.io', password: 'Analyst@123', icon: UserRound, hint: 'Read-only' },
];

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(null);

  async function submit(e, creds) {
    e?.preventDefault();
    const c = creds || { email, password };
    setBusy(creds?.label || 'form');
    try {
      const user = await login(c.email, c.password);
      toast.success(`Welcome back, ${user.name.split(' ')[0]}`);
      navigate(location.state?.from || '/', { replace: true });
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <AuthLayout>
      <h2 className="text-2xl font-semibold tracking-tight">Sign in</h2>
      <p className="mt-1.5 text-[13px] text-secondary">Welcome back. Pick a demo role or use your credentials.</p>

      <div className="mt-7 grid grid-cols-2 gap-3">
        {DEMO.map((d) => (
          <button
            key={d.label}
            onClick={() => submit(null, d)}
            disabled={Boolean(busy)}
            className="card group flex items-center gap-3 p-3 text-left transition hover:border-brand-violet/40 hover:bg-brand-violet/[0.04] disabled:opacity-60"
          >
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-soft text-brand-violet">
              <d.icon className="h-4 w-4" />
            </span>
            <span className="min-w-0">
              <span className="block text-[13px] font-medium">{busy === d.label ? 'Signing in…' : `Demo ${d.label}`}</span>
              <span className="block text-[11px] text-muted">{d.hint}</span>
            </span>
          </button>
        ))}
      </div>

      <div className="my-6 flex items-center gap-3 text-[11px] uppercase tracking-wider text-muted">
        <span className="h-px flex-1 bg-line-strong" /> or with email <span className="h-px flex-1 bg-line-strong" />
      </div>

      <form onSubmit={submit} className="space-y-4">
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-secondary">Email</span>
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" autoComplete="email" className="input h-11 pl-10" required />
          </div>
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-secondary">Password</span>
          <PasswordInput value={password} onChange={setPassword} />
        </label>
        <Button type="submit" variant="primary" className="h-11 w-full justify-center" loading={busy === 'form'} iconRight={ArrowRight}>
          Sign in
        </Button>
      </form>

      <p className="mt-6 text-center text-[13px] text-secondary">
        New to CloudOptima?{' '}
        <Link to="/register" className="font-medium text-brand-violet hover:underline">
          Create an account
        </Link>
      </p>
    </AuthLayout>
  );
}
