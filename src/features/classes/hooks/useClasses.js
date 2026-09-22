import { useCallback, useEffect, useState } from 'react';
import { appEnv } from '../../../config/env';
import { createClass as createClassRequest, joinClass as joinClassRequest, listClasses } from '../../../services/class.service';

export function useClasses({ scope = 'owned' } = {}) {
  const configured = Boolean(appEnv.apiUrl);
  const [state, setState] = useState({
    status: configured ? 'loading' : 'unconfigured',
    classes: [],
    error: null,
  });

  const load = useCallback(async (signal) => {
    if (!configured) {
      setState({ status: 'unconfigured', classes: [], error: null });
      return;
    }
    setState((current) => ({ ...current, status: 'loading', error: null }));
    try {
      const classes = await listClasses({ scope, signal });
      setState({ status: 'success', classes, error: null });
    } catch (error) {
      if (error.name === 'AbortError') return;
      setState((current) => ({ ...current, status: 'error', error }));
    }
  }, [configured, scope]);

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const createClass = useCallback(async (input) => {
    const created = await createClassRequest(input);
    setState((current) => ({
      status: 'success',
      error: null,
      classes: [created, ...current.classes.filter((item) => item.id !== created.id)],
    }));
    return created;
  }, []);

  const joinClass = useCallback(async (code) => {
    const joined = await joinClassRequest(code);
    setState((current) => ({
      status: 'success',
      error: null,
      classes: [joined, ...current.classes.filter((item) => item.id !== joined.id)],
    }));
    return joined;
  }, []);

  return {
    ...state,
    configured,
    reload: () => load(),
    createClass,
    joinClass,
  };
}
