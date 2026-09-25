import { useEffect, useRef, useState } from 'react';

export function useBranchRealtime(branchId, onInvalidate) {
  const branchIds = Array.isArray(branchId) ? branchId.filter(Boolean) : [branchId].filter(Boolean);
  const branchKey = branchIds.join('|');
  const callbackRef = useRef(onInvalidate);
  const connectedOnceRef = useRef(false);
  const [status, setStatus] = useState('disconnected');
  const [error, setError] = useState(null);

  useEffect(() => {
    callbackRef.current = onInvalidate;
  }, [onInvalidate]);

  useEffect(() => {
    if (branchIds.length === 0) {
      setStatus('disconnected');
      return undefined;
    }

    const controllers = [];
    const reconnectTimers = [];
    let stopped = false;
    const lastEventIds = new Map();
    const connectedBranches = new Set();

    const connect = async (currentBranchId, index, retryDelay = 1000) => {
      if (stopped) return;
      setStatus('connecting');
      setError(null);

      try {
        const controller = new AbortController();
        controllers[index] = controller;
        const token = localStorage.getItem('murg_token');
        const response = await fetch(`/api/realtime/branch?branchId=${encodeURIComponent(currentBranchId)}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          signal: controller.signal,
        });

        if (!response.ok || !response.body) {
          throw new Error(`Real-time connection failed (${response.status})`);
        }

        connectedBranches.add(currentBranchId);
        setStatus(connectedBranches.size === branchIds.length ? 'connected' : 'connecting');
        if (connectedOnceRef.current && connectedBranches.size === branchIds.length) {
          callbackRef.current?.('reconnected');
        }
        if (connectedBranches.size === branchIds.length) connectedOnceRef.current = true;

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (!stopped) {
          const { value, done } = await reader.read();
          if (done) throw new Error('Real-time connection closed');
          buffer += decoder.decode(value, { stream: true });

          const frames = buffer.split('\n\n');
          buffer = frames.pop() || '';
          for (const frame of frames) {
            const data = frame
              .split('\n')
              .filter((line) => line.startsWith('data:'))
              .map((line) => line.slice(5).trim())
              .join('\n');
            if (!data) continue;

            const event = JSON.parse(data);
            if (event.type === 'branch-operation') {
              if (event.id && event.id === lastEventIds.get(currentBranchId)) continue;
              lastEventIds.set(currentBranchId, event.id || lastEventIds.get(currentBranchId));
              callbackRef.current?.(event);
            }
          }
        }
      } catch (streamError) {
        if (stopped || streamError.name === 'AbortError') return;
        connectedBranches.delete(currentBranchId);
        setStatus('disconnected');
        setError(streamError.message || 'Real-time connection lost.');
        reconnectTimers[index] = window.setTimeout(
          () => connect(currentBranchId, index, Math.min(retryDelay * 2, 10000)),
          retryDelay
        );
      }
    };

    branchIds.forEach((currentBranchId, index) => connect(currentBranchId, index));
    return () => {
      stopped = true;
      controllers.forEach((controller) => controller?.abort());
      reconnectTimers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [branchKey]);

  return { status, error };
}
