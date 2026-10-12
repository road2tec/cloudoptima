import { useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { formatMoney } from '../lib/format';

// Currency-aware money formatter driven by the user's settings.
export function useMoney() {
  const { user, config } = useAuth();
  const currency = user?.settings?.currency || 'USD';
  const rate = config?.usdToInr || 83.5;
  const fmt = useCallback((usd, opts = {}) => formatMoney(usd, { currency, rate, ...opts }), [currency, rate]);
  fmt.currency = currency;
  fmt.rate = rate;
  fmt.convert = (usd) => (currency === 'INR' ? usd * rate : usd);
  return fmt;
}
