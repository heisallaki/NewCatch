import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { api } from '@/services/api';
import { WS_URL } from '@/services/config';
import type { ChatEvent } from '@/types';

export type SocketStatus = 'connecting' | 'connected' | 'offline';

const PING_MS = 25000;

export function useChatSocket(onEvent: (event: ChatEvent) => void) {
  const [status, setStatus] = useState<SocketStatus>(WS_URL ? 'connecting' : 'offline');
  const socketRef = useRef<WebSocket | null>(null);
  const handlerRef = useRef(onEvent);
  handlerRef.current = onEvent;

  useEffect(() => {
    if (!WS_URL) return;
    let cancelled = false;
    let attempt = 0;
    let opening = false;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let pingTimer: ReturnType<typeof setInterval> | undefined;

    function stopPing() {
      if (pingTimer) {
        clearInterval(pingTimer);
        pingTimer = undefined;
      }
    }

    function scheduleRetry() {
      if (cancelled || retryTimer) return;
      attempt += 1;
      setStatus('offline');
      retryTimer = setTimeout(
        () => {
          retryTimer = undefined;
          connect();
        },
        Math.min(1000 * 2 ** Math.min(attempt, 4), 15000)
      );
    }

    async function connect() {
      if (cancelled || opening) return;
      const existing = socketRef.current;
      if (existing && existing.readyState <= 1) return;
      opening = true;
      setStatus('connecting');
      try {
        const { ticket } = await api<{ ticket: string }>('/chat/ticket', { method: 'POST' });
        if (cancelled) return;
        const socket = new WebSocket(`${WS_URL}/chat/ws?ticket=${encodeURIComponent(ticket)}`);
        socketRef.current = socket;
        socket.onopen = () => {
          attempt = 0;
          setStatus('connected');
          stopPing();
          pingTimer = setInterval(() => {
            if (socket.readyState === 1) socket.send(JSON.stringify({ type: 'ping' }));
          }, PING_MS);
        };
        socket.onmessage = (event) => {
          try {
            const data = JSON.parse(String(event.data));
            if (data && data.type && data.type !== 'pong') handlerRef.current(data as ChatEvent);
          } catch {
            return;
          }
        };
        socket.onclose = () => {
          stopPing();
          if (socketRef.current === socket) socketRef.current = null;
          scheduleRetry();
        };
        socket.onerror = () => {
          try {
            socket.close();
          } catch {
            return;
          }
        };
      } catch {
        scheduleRetry();
      } finally {
        opening = false;
      }
    }

    function reconnectNow() {
      if (cancelled) return;
      if (retryTimer) {
        clearTimeout(retryTimer);
        retryTimer = undefined;
      }
      const stale = socketRef.current;
      if (stale) {
        socketRef.current = null;
        stale.onclose = null;
        try {
          stale.close();
        } catch {
          stopPing();
        }
      }
      stopPing();
      connect();
    }

    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'active') reconnectNow();
    });

    connect();

    return () => {
      cancelled = true;
      appState.remove();
      stopPing();
      if (retryTimer) clearTimeout(retryTimer);
      const socket = socketRef.current;
      socketRef.current = null;
      if (socket) socket.close();
    };
  }, []);

  const send = useCallback((payload: object) => {
    const socket = socketRef.current;
    if (!socket || socket.readyState !== 1) return false;
    socket.send(JSON.stringify(payload));
    return true;
  }, []);

  return { status, connected: status === 'connected', send };
}