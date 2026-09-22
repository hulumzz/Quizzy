import { useCallback, useEffect, useState } from 'react';
import { appEnv } from '../../../config/env';
import { deleteMaterial as deleteRequest, listMaterials } from '../../../services/material.service';

export function useMaterials(classId) {
  const configured = Boolean(appEnv.apiUrl);
  const [state, setState] = useState({ status: configured ? 'loading' : 'unconfigured', materials: [], error: null });
  const load = useCallback(async (signal) => {
    if (!configured) {
      setState({ status: 'unconfigured', materials: [], error: null });
      return;
    }
    setState((current) => ({ ...current, status: 'loading', error: null }));
    try {
      const materials = await listMaterials(classId, { signal });
      setState({ status: 'success', materials, error: null });
    } catch (error) {
      if (error.name !== 'AbortError') setState((current) => ({ ...current, status: 'error', error }));
    }
  }, [classId, configured]);

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const remove = useCallback(async (materialId) => {
    await deleteRequest(classId, materialId);
    setState((current) => ({ ...current, materials: current.materials.filter((item) => item.id !== materialId) }));
  }, [classId]);

  return { ...state, configured, reload: () => load(), remove };
}
