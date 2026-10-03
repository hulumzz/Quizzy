import { useCallback, useEffect, useRef, useState } from 'react';
import { faceErrorMessage, startFaceCamera, stopFaceCamera, warmFaceEngine } from './face-engine';
import { scanGuidedFace } from './guided-face-scan';

function stopRun(run) {
  run?.stream?.getTracks().forEach((track) => track.stop());
  if (run?.video && run.video.srcObject === run.stream) stopFaceCamera(run.video);
}

export default function useGuidedFaceScan() {
  const videoRef = useRef(null);
  const runRef = useRef(null);
  const [scan, setScan] = useState({ stage: 'idle', current: 0, hold: 0 });
  const [error, setError] = useState('');
  const cancel = useCallback((reset = true) => {
    const run = runRef.current;
    runRef.current = null;
    run?.controller.abort();
    stopRun(run);
    if (reset) setScan({ stage: 'idle', current: 0, hold: 0 });
  }, []);
  useEffect(() => () => cancel(false), [cancel]);

  const start = async ({ steps, profile, onComplete, finishStage = 'saving' }) => {
    cancel(false);
    const run = { controller: new AbortController(), video: null };
    runRef.current = run;
    const signal = run.controller.signal;
    const active = () => runRef.current === run && !signal.aborted;
    setError(''); setScan({ stage: 'camera', current: 0, hold: 0 });
    try {
      await new Promise((resolve) => requestAnimationFrame(resolve));
      if (!active()) return;
      run.video = videoRef.current;
      run.stream = await startFaceCamera(run.video, { signal });
      if (!active()) return;
      setScan({ stage: 'loading', current: 0, hold: 0 });
      await warmFaceEngine();
      if (!active()) return;
      const result = await scanGuidedFace(run.video, { steps, profile, signal, onProgress: (progress) => { if (active()) setScan(progress); } });
      if (!active()) return;
      stopRun(run);
      setScan((previous) => ({ ...previous, stage: finishStage }));
      await onComplete(result);
      if (active()) setScan((previous) => ({ ...previous, stage: 'complete' }));
    } catch (caught) {
      if (active()) { setError(caught?.message && !caught?.code && caught?.name === 'Error' ? caught.message : faceErrorMessage(caught)); setScan((previous) => ({ ...previous, stage: 'error' })); }
    } finally { stopRun(run); }
  };
  return { videoRef, scan, error, start, cancel, busy: !['idle', 'error', 'complete'].includes(scan.stage) };
}
