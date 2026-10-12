import { Archive, BadgeDollarSign, Camera, Cpu, Globe, HardDrive, Moon, PowerOff, Scaling, Server } from 'lucide-react';

export const PROVIDERS = {
  aws: { label: 'AWS', name: 'Amazon Web Services', color: '#FF9900' },
  azure: { label: 'Azure', name: 'Microsoft Azure', color: '#0089D6' },
  gcp: { label: 'GCP', name: 'Google Cloud', color: '#34A853' },
};
export const providerColor = (p) => PROVIDERS[p]?.color || '#8B90A3';

// Palette for non-provider series (services, regions, teams).
export const SERIES_COLORS = ['#8B5CF6', '#22D3EE', '#10B981', '#F59E0B', '#F43F5E', '#6366F1', '#64748B'];
export const seriesColor = (key, i) => PROVIDERS[key]?.color || SERIES_COLORS[i % SERIES_COLORS.length];

export const CATEGORIES = {
  rightsize: { label: 'Right-size', icon: Scaling, color: '#8B5CF6' },
  'idle-vm': { label: 'Idle VM', icon: Moon, color: '#22D3EE' },
  'unattached-disk': { label: 'Unattached disk', icon: HardDrive, color: '#F59E0B' },
  'unused-ip': { label: 'Unused IP', icon: Globe, color: '#10B981' },
  'old-snapshot': { label: 'Old snapshot', icon: Camera, color: '#F43F5E' },
  'stopped-vm': { label: 'Stopped VM', icon: PowerOff, color: '#6366F1' },
};

export const RESOURCE_TYPES = {
  vm: { label: 'Virtual machine', short: 'VM', icon: Server },
  disk: { label: 'Disk', short: 'Disk', icon: HardDrive },
  ip: { label: 'Public IP', short: 'IP', icon: Globe },
  snapshot: { label: 'Snapshot', short: 'Snapshot', icon: Archive },
};

export const STATE_TONES = {
  running: 'success',
  'in-use': 'success',
  stopped: 'warning',
  available: 'neutral',
  terminated: 'danger',
};

export const RISK_TONES = { low: 'success', medium: 'warning', high: 'danger' };
export const STATUS_TONES = { open: 'brand', approved: 'info', rejected: 'danger', executed: 'success' };

export const ICONS = { Cpu, BadgeDollarSign };
