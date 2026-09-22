import { useCallback, useEffect, useState } from 'react';
import { appEnv } from '../../../config/env';
import { listDiscussions } from '../../../services/discussion.service';

export function useDiscussions(classId, materialId) {
  const configured = Boolean(appEnv.apiUrl);
  const [state, setState] = useState({ status: configured ? 'loading' : 'unconfigured', data: null, error: null });
  const load = useCallback(async (signal, quiet = false) => {
    if (!configured) {
      setState({ status: 'unconfigured', data: null, error: null });
      return null;
    }
    if (!quiet) setState((current) => ({ ...current, status: 'loading', error: null }));
    try {
      const data = await listDiscussions(classId, materialId, { signal });
      setState({ status: 'success', data, error: null });
      return data;
    } catch (error) {
      if (error.name !== 'AbortError') setState((current) => ({ ...current, status: 'error', error }));
      throw error;
    }
  }, [classId, configured, materialId]);

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal).catch(() => {});
    return () => controller.abort();
  }, [load]);

  return { ...state, configured, reload: () => load(undefined, true) };
}
