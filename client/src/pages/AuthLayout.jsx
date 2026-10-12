import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { Boxes, Lightbulb, PiggyBank } from 'lucide-react';
import Logo from '../components/layout/Logo';
import ProviderLogo from '../components/ui/ProviderLogo';
import AnimatedNumber from '../components/ui/AnimatedNumber';
import { authApi } from '../api/auth';
import { formatMoney } from '../lib/format';

function FloatingStat({ icon: Icon, label, value, format, accent, className, delay }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className={`absolute ${className}`}
    >
      <div className="glass animate-float rounded-2xl border border-white/10 p-4 shadow-lift" style={{ animationDelay: `${delay * 2}s` }}>
        <div className="flex items-center gap-3">
          <span className="grid h-9 w-9 place-items-center rounded-xl" style={{ background: `${accent}26`, color: accent }}>
            <Icon className="h-4 w-4" />
          </span>
          <div>
            <div className="text-[11px] font-medium uppercase tracking-wider text-white/55">{label}</div>
            <AnimatedNumber value={value} format={format} className="num text-lg font-semibold text-white" />
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// Split screen: animated gradient mesh + live platform stats on the left, form on the right.
export default function AuthLayout({ children }) {
  const { data } = useQuery({ queryKey: ['health'], queryFn: authApi.health, retry: false });
  const stats = data?.stats;
  return (
    <div className="flex min-h-full">
      <div className="relative hidden w-[52%] overflow-hidden bg-[#07080C] lg:block">
        {/* gradient mesh */}
        <div className="absolute -left-24 top-10 h-[420px] w-[420px] animate-mesh rounded-full bg-[#8B5CF6] opacity-40 blur-[110px]" />
        <div className="absolute bottom-0 right-0 h-[460px] w-[460px] animate-mesh rounded-full bg-[#22D3EE] opacity-30 blur-[120px]" style={{ animationDelay: '-6s' }} />
        <div className="absolute left-1/3 top-1/2 h-[300px] w-[300px] animate-mesh rounded-full bg-[#6366F1] opacity-30 blur-[100px]" style={{ animationDelay: '-12s' }} />
        <div className="absolute inset-0 opacity-[0.07]" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.6) 1px, transparent 1px)', backgroundSize: '44px 44px', maskImage: 'radial-gradient(circle at 40% 40%, black, transparent 75%)' }} />

        <div className="relative flex h-full flex-col justify-between p-12 text-white">
          <div className="[&_*]:text-white">
            <Logo size={36} />
          </div>
          <div className="max-w-[380px]">
            <motion.h1 initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="text-[40px] font-semibold leading-[1.1] tracking-tight">
              One command center for <span className="bg-gradient-to-r from-[#A78BFA] to-[#22D3EE] bg-clip-text text-transparent">every cloud dollar.</span>
            </motion.h1>
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2, duration: 0.6 }} className="mt-4 text-[15px] leading-relaxed text-white/60">
              Unified inventory, cost and utilization across AWS, Azure and Google Cloud — with forecasting and approve-to-execute optimization.
            </motion.p>
            <div className="mt-6 flex items-center gap-2">
              {['aws', 'azure', 'gcp'].map((p) => (
                <ProviderLogo key={p} provider={p} size={30} />
              ))}
            </div>
          </div>
          <p className="text-xs text-white/35">Phase 1 · Simulated multi-cloud estate · MERN stack</p>
        </div>

        {stats && (
          <>
            <FloatingStat icon={Boxes} label="Resources tracked" value={stats.resources} accent="#22D3EE" className="right-10 top-24" delay={0.3} />
            <FloatingStat icon={PiggyBank} label="Potential savings / mo" value={stats.potentialSavings} format={(v) => formatMoney(v, { compact: true })} accent="#10B981" className="right-8 top-[42%]" delay={0.5} />
            <FloatingStat icon={Lightbulb} label="Open recommendations" value={stats.openRecommendations} accent="#A78BFA" className="bottom-24 right-24" delay={0.7} />
          </>
        )}
      </div>

      <div className="flex flex-1 items-center justify-center px-6 py-12">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="w-full max-w-[400px]">
          <div className="mb-8 lg:hidden">
            <Logo />
          </div>
          {children}
        </motion.div>
      </div>
    </div>
  );
}
