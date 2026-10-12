import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import clsx from 'clsx';
import { ArrowRight, Check, Mail, User } from 'lucide-react';
import AuthLayout from './AuthLayout';
import PasswordInput from './PasswordInput';
import Button from '../components/ui/Button';
import { useAuth } from '../context/AuthContext';

const RULES = [
  { test: (p) => p.length >= 8, label: '8+ characters' },
  { test: (p) => /[A-Z]/.test(p), label: 'Uppercase letter' },
  { test: (p) => /[0-9]/.test(p), label: 'Number' },
];

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [busy, setBusy] = useState(false);
  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: typeof v === 'string' ? v : v.target.value }));

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    try {
      await register(form);
      toast.success('Account created', { description: 'You have analyst (read-only) access.' });
      navigate('/', { replace: true });
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthLayout>
      <h2 className="text-2xl font-semibold tracking-tight">Create your account</h2>
      <p className="mt-1.5 text-[13px] text-secondary">New accounts start with the analyst role. An admin can grant approver access.</p>
      <form onSubmit={submit} className="mt-7 space-y-4">
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-secondary">Full name</span>
          <div className="relative">
            <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <input value={form.name} onChange={set('name')} placeholder="Priya Sharma" autoComplete="name" className="input h-11 pl-10" required minLength={2} />
          </div>
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-secondary">Work email</span>
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <input type="email" value={form.email} onChange={set('email')} placeholder="you@company.com" autoComplete="email" className="input h-11 pl-10" required />
          </div>
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-secondary">Password</span>
          <PasswordInput value={form.password} onChange={set('password')} autoComplete="new-password" />
        </label>
        <div className="flex flex-wrap gap-2">
          {RULES.map((r) => {
            const ok = r.test(form.password);
            return (
              <span key={r.label} className={clsx('inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium transition', ok ? 'bg-success/10 text-success' : 'bg-fg/[0.05] text-muted')}>
                <Check className="h-3 w-3" /> {r.label}
              </span>
            );
          })}
        </div>
        <Button type="submit" variant="primary" className="h-11 w-full justify-center" loading={busy} disabled={!RULES.every((r) => r.test(form.password))} iconRight={ArrowRight}>
          Create account
        </Button>
      </form>
      <p className="mt-6 text-center text-[13px] text-secondary">
        Already have an account?{' '}
        <Link to="/login" className="font-medium text-brand-violet hover:underline">
          Sign in
        </Link>
      </p>
    </AuthLayout>
  );
}
