import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import clsx from 'clsx';
import { Camera, Cpu, IndianRupee, DollarSign, Moon, PowerOff, Save, Sun, Target, UserRound } from 'lucide-react';
import Card, { stagger } from '../components/ui/Card';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import { Avatar, PageHeader } from '../components/ui/misc';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { authApi } from '../api/auth';
import { titleCase } from '../lib/format';

function Choice({ active, onClick, icon: Icon, label, hint }) {
  return (
    <button onClick={onClick} className={clsx('flex flex-1 items-center gap-3 rounded-xl border p-3.5 text-left transition', active ? 'border-brand-violet/60 bg-brand-violet/[0.07] ring-1 ring-brand-violet/30' : 'border-line hover:border-line-strong')}>
      <span className={clsx('grid h-9 w-9 place-items-center rounded-lg', active ? 'bg-brand text-white' : 'bg-fg/[0.05] text-secondary')}><Icon className="h-4 w-4" /></span>
      <span>
        <span className="block text-[13px] font-medium">{label}</span>
        <span className="block text-[11px] text-muted">{hint}</span>
      </span>
    </button>
  );
}

function Threshold({ icon: Icon, label, hint, value, onChange, min, max, step = 1, unit }) {
  return (
    <div className="rounded-xl border border-line bg-fg/[0.02] p-4">
      <div className="flex items-start gap-3">
        <span className="grid h-9 w-9 place-items-center rounded-lg bg-brand-soft text-brand-violet"><Icon className="h-4 w-4" /></span>
        <div className="flex-1">
          <div className="text-[13px] font-medium">{label}</div>
          <div className="text-[11px] text-muted">{hint}</div>
        </div>
        <div className="flex items-center gap-1.5">
          <input type="number" value={value} min={min} max={max} step={step} onChange={(e) => onChange(Number(e.target.value))} className="input num h-9 w-20 text-right" />
          <span className="w-8 text-xs text-muted">{unit}</span>
        </div>
      </div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="mt-3 w-full accent-[#8B5CF6]" />
    </div>
  );
}

export default function Settings() {
  const { user, setUser, config } = useAuth();
  const { theme, setTheme } = useTheme();
  const [name, setName] = useState(user.name);
  const [s, setS] = useState(user.settings);
  const [saving, setSaving] = useState(false);
  useEffect(() => setS(user.settings), [user.settings]);
  const set = (k) => (v) => setS((x) => ({ ...x, [k]: v }));

  const dirty = name !== user.name || JSON.stringify(s) !== JSON.stringify(user.settings);

  async function save() {
    setSaving(true);
    try {
      const d = await authApi.updateMe({
        name,
        settings: { currency: s.currency, idleCpuThreshold: s.idleCpuThreshold, snapshotAgeDays: s.snapshotAgeDays, stoppedVmDays: s.stoppedVmDays, minMonthlySaving: s.minMonthlySaving, theme },
      });
      setUser(d.user);
      toast.success('Settings saved', { description: 'New thresholds apply the next time analysis runs.' });
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <PageHeader title="Settings" description="Your profile, display preferences and the thresholds the optimization engines use." actions={<Button variant="primary" icon={Save} loading={saving} disabled={!dirty} onClick={save}>Save changes</Button>} />
      <motion.div variants={stagger} initial="hidden" animate="show" className="grid gap-4 xl:grid-cols-3">
        <Card title="Profile" subtitle="How you appear in the audit log">
          <div className="flex items-center gap-4">
            <Avatar name={name} color={user.avatarColor} size={56} />
            <div>
              <div className="font-medium">{user.email}</div>
              <Badge tone="brand" className="mt-1">{titleCase(user.role)}</Badge>
            </div>
          </div>
          <label className="mt-5 block">
            <span className="mb-1.5 block text-xs font-medium text-secondary">Display name</span>
            <div className="relative">
              <UserRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <input value={name} onChange={(e) => setName(e.target.value)} className="input pl-10" />
            </div>
          </label>
          <p className="mt-4 text-[11px] text-muted">Role changes are made by an administrator.</p>
        </Card>

        <Card title="Appearance & currency" subtitle="Theme is stored in this browser; currency on your profile" className="xl:col-span-2">
          <div className="label mb-2">Theme</div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Choice active={theme === 'dark'} onClick={() => setTheme('dark')} icon={Moon} label="Dark" hint="Default command-center look" />
            <Choice active={theme === 'light'} onClick={() => setTheme('light')} icon={Sun} label="Light" hint="High-contrast daylight theme" />
          </div>
          <div className="label mb-2 mt-5">Currency</div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Choice active={s.currency === 'USD'} onClick={() => set('currency')('USD')} icon={DollarSign} label="US Dollar" hint="Native billing currency" />
            <Choice active={s.currency === 'INR'} onClick={() => set('currency')('INR')} icon={IndianRupee} label="Indian Rupee" hint={`Converted at ₹${config.usdToInr} / $1`} />
          </div>
        </Card>

        <Card title="Optimization thresholds" subtitle="Used by the idle detector and right-sizer when you run an analysis" className="xl:col-span-3">
          <div className="grid gap-3 md:grid-cols-2">
            <Threshold icon={Cpu} label="Idle CPU threshold" hint="VM is idle when 14-day p95 CPU is below this" value={s.idleCpuThreshold} onChange={set('idleCpuThreshold')} min={1} max={20} step={0.5} unit="%" />
            <Threshold icon={Camera} label="Snapshot age" hint="Snapshots older than this are flagged" value={s.snapshotAgeDays} onChange={set('snapshotAgeDays')} min={7} max={365} unit="days" />
            <Threshold icon={PowerOff} label="Stopped VM grace period" hint="Stopped VMs with disks are flagged after" value={s.stoppedVmDays} onChange={set('stoppedVmDays')} min={1} max={60} unit="days" />
            <Threshold icon={Target} label="Minimum right-size saving" hint="Skip right-sizing below this monthly saving" value={s.minMonthlySaving} onChange={set('minMonthlySaving')} min={0} max={100} unit="USD" />
          </div>
        </Card>
      </motion.div>
    </div>
  );
}
