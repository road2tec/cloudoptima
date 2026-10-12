import { Activity, Boxes, Cloud, LayoutDashboard, Lightbulb, LineChart, ScrollText, Settings, Wallet } from 'lucide-react';

export const NAV = [
  {
    group: 'Monitor',
    items: [
      { to: '/', label: 'Overview', icon: LayoutDashboard, end: true },
      { to: '/inventory', label: 'Inventory', icon: Boxes },
      { to: '/costs', label: 'Cost Explorer', icon: Wallet },
      { to: '/forecasts', label: 'Forecasts', icon: LineChart },
    ],
  },
  { group: 'Optimize', items: [{ to: '/recommendations', label: 'Recommendations', icon: Lightbulb }] },
  {
    group: 'Govern',
    items: [
      { to: '/accounts', label: 'Accounts', icon: Cloud },
      { to: '/audit', label: 'Audit Log', icon: ScrollText },
      { to: '/settings', label: 'Settings', icon: Settings },
    ],
  },
];

export const FLAT_NAV = NAV.flatMap((g) => g.items.map((i) => ({ ...i, group: g.group })));

export function routeMeta(pathname) {
  if (pathname.startsWith('/inventory/')) return { group: 'Monitor', title: 'Resource', parent: { to: '/inventory', label: 'Inventory' }, icon: Activity };
  const hit = FLAT_NAV.find((n) => (n.end ? pathname === n.to : pathname.startsWith(n.to)));
  return hit ? { group: hit.group, title: hit.label, icon: hit.icon } : { group: 'Monitor', title: 'Overview' };
}
