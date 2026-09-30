import { useCallback, useEffect, useRef, useState } from 'react';

import { api, API_URL } from '@/services/api';
import type { ChatEvent } from '@/types';

export function useChatSocket(onEvent: (event: ChatEvent) => void) {
  const [connected, setConnected] = useState(false);
  const socketRef = useRef<WebSocket | null>(null);
  const handlerRef = useRef(onEvent);
  handlerRef.current = onEvent;

  useEffect(() => {
    let cancelled = false;
    let retry = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;

    function schedule() {
      retry += 1;
      timer = setTimeout(connect, Math.min(1000 * 2 ** retry, 15000));
    }

    async function connect() {
      try {
        const { ticket } = await api<{ ticket: string }>('/chat/ticket', { method: 'POST' });
        if (cancelled) return;
        const url = `${API_URL.replace(/^http/, 'ws')}/chat/ws?ticket=${encodeURIComponent(ticket)}`;
        const socket = new WebSocket(url);
        socketRef.current = socket;
        socket.onopen = () => {
          retry = 0;
          setConnected(true);
        };
        socket.onmessage = (event) => {
          try {
            handlerRef.current(JSON.parse(String(event.data)) as ChatEvent);
          } catch {
            return;
          }
        };
        socket.onclose = () => {
          setConnected(false);
          socketRef.current = null;
          if (!cancelled) schedule();
        };
        socket.onerror = () => socket.close();
      } catch {
        if (!cancelled) schedule();
      }
    }

    connect();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      socketRef.current?.close();
    };
  }, []);

  const send = useCallback((payload: object) => {
    const socket = socketRef.current;
    if (!socket || socket.readyState !== 1) return false;
    socket.send(JSON.stringify(payload));
    return true;
  }, []);

  return { connected, send };
}