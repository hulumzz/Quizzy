import { useCallback, useEffect, useState } from 'react';
import { appEnv } from '../../../config/env';
import { listAttendance } from '../../../services/attendance.service';

export function useAttendance(classId) {
  const configured = Boolean(appEnv.apiUrl);
  const [state, setState] = useState({ status: configured ? 'loading' : 'unconfigured', attendance: [], error: null });
  const load = useCallback(async (signal, quiet = false) => {
    if (!configured) {
      setState({ status: 'unconfigured', attendance: [], error: null });
      return [];
    }
    if (!quiet) setState((current) => ({ ...current, status: 'loading', error: null }));
    try {
      const attendance = await listAttendance(classId, { signal });
      setState({ status: 'success', attendance, error: null });
      return attendance;
    } catch (error) {
      if (error.name !== 'AbortError') setState((current) => ({ ...current, status: 'error', error }));
      throw error;
    }
  }, [classId, configured]);

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal).catch(() => {});
    return () => controller.abort();
  }, [load]);

  return { ...state, configured, reload: () => load(undefined, true) };
}
