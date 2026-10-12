// React Query hooks — the only way pages read or change server data.
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { accountsApi } from '../api/accounts';
import { auditApi } from '../api/audit';
import { costsApi } from '../api/costs';
import { forecastsApi } from '../api/forecasts';
import { recommendationsApi } from '../api/recommendations';
import { resourcesApi } from '../api/resources';

// ---------- reads ----------
export const useOverview = () => useQuery({ queryKey: ['overview'], queryFn: costsApi.overview, refetchInterval: 60_000 });
export const useCostSummary = () => useQuery({ queryKey: ['costs', 'summary'], queryFn: costsApi.summary });
export const useCostTrend = (params) => useQuery({ queryKey: ['costs', 'trend', params], queryFn: () => costsApi.trend(params), placeholderData: keepPreviousData });
export const useCostBreakdown = (params) => useQuery({ queryKey: ['costs', 'breakdown', params], queryFn: () => costsApi.breakdown(params), placeholderData: keepPreviousData });

// Pass `null` to disable (e.g. while a search box is empty).
export const useResources = (params) => useQuery({ queryKey: ['resources', params], queryFn: () => resourcesApi.list(params), placeholderData: keepPreviousData, enabled: params !== null });
export const useResourceFacets = () => useQuery({ queryKey: ['resources', 'facets'], queryFn: resourcesApi.facets, staleTime: 5 * 60_000 });
export const useResource = (id) => useQuery({ queryKey: ['resource', id], queryFn: () => resourcesApi.get(id), enabled: Boolean(id) });
export const useMetrics = (id, params) => useQuery({ queryKey: ['metrics', id, params], queryFn: () => resourcesApi.metrics(id, params), enabled: Boolean(id) });

export const useFleetForecast = () => useQuery({ queryKey: ['forecasts', 'fleet'], queryFn: forecastsApi.fleet });
export const useResourceForecast = (id) => useQuery({ queryKey: ['forecasts', id], queryFn: () => forecastsApi.resource(id), enabled: Boolean(id) });

export const useRecommendations = (params) => useQuery({ queryKey: ['recommendations', params], queryFn: () => recommendationsApi.list(params), placeholderData: keepPreviousData });

export const useAccounts = () =>
  useQuery({
    queryKey: ['accounts'],
    queryFn: accountsApi.list,
    // Poll while any account is syncing so the status flips even without sockets.
    refetchInterval: (q) => (q.state.data?.some((a) => a.status === 'syncing') ? 1500 : false),
  });
export const useProviderCatalog = () => useQuery({ queryKey: ['accounts', 'catalog'], queryFn: accountsApi.catalog, staleTime: Infinity });

export const useAudit = (params) => useQuery({ queryKey: ['audit', params], queryFn: () => auditApi.list(params), placeholderData: keepPreviousData });
export const useAuditFacets = () => useQuery({ queryKey: ['audit', 'facets'], queryFn: auditApi.facets });

// ---------- writes ----------
function useInvalidatingMutation(fn, { success, keys = [] } = {}) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: (data, vars) => {
      keys.forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
      if (success) toast.success(typeof success === 'function' ? success(data, vars) : success);
    },
    onError: (err) => toast.error(err.message),
  });
}

const REC_KEYS = ['recommendations', 'overview', 'audit'];
export const useApprove = () => useInvalidatingMutation(({ id, note }) => recommendationsApi.approve(id, note), { success: 'Recommendation approved', keys: REC_KEYS });
export const useReject = () => useInvalidatingMutation(({ id, note }) => recommendationsApi.reject(id, note), { success: 'Recommendation rejected', keys: REC_KEYS });
export const useBulkApprove = () =>
  useInvalidatingMutation((ids) => recommendationsApi.bulkApprove(ids), { success: (d) => `${d.approved} low-risk recommendation(s) approved`, keys: REC_KEYS });

// Execution is driven step by step by the UI, so this hook only invalidates afterwards.
export function useExecuteFinished() {
  const qc = useQueryClient();
  return () => ['recommendations', 'overview', 'audit', 'resources', 'resource', 'accounts', 'costs'].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
}

export const useConnectAccount = () => useInvalidatingMutation(accountsApi.connect, { success: (d) => `${d.name} connected — initial sync running`, keys: ['accounts', 'audit'] });
export const useSyncAccount = () => useInvalidatingMutation(accountsApi.sync, { keys: ['accounts', 'audit'] });
export const useDeleteAccount = () => useInvalidatingMutation(accountsApi.remove, { success: 'Account disconnected', keys: ['accounts', 'overview', 'resources', 'recommendations', 'costs', 'audit'] });
