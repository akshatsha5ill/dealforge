import { useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

let sharedSocket: Socket | null = null;

export const getSharedSocket = () => sharedSocket;

export const disconnectSocket = () => {
  if (sharedSocket) {
    sharedSocket.disconnect();
    sharedSocket = null;
  }
};

export const useWebSocket = () => {
  const socketRef = useRef(null);

  useEffect(() => {
    const setupSocket = async () => {
      if (!sharedSocket) {
        let token = undefined;
        try {
          const auth = (await import('../services/firebase/config')).auth;
          token = await auth.currentUser?.getIdToken();
        } catch (e) {}

        sharedSocket = io(window.location.origin, {
          auth: { token },
          transports: ['websocket', 'polling'],
          reconnection: true,
          reconnectionAttempts: 10,
          reconnectionDelay: 1000,
        });
      }
      socketRef.current = sharedSocket;
    };
    setupSocket();

    return () => {
      // Don't disconnect the shared socket on component unmount
    };
  }, []);

  const emit = useCallback((event, data) => {
    if (socketRef.current) {
      socketRef.current.emit(event, data);
    }
  }, []);

  const subscribe = useCallback((event, callback) => {
    const socket = socketRef.current;
    if (socket) {
      socket.on(event, callback);
    }
    return () => {
      if (socket) {
        socket.off(event, callback);
      }
    };
  }, []);

  const disconnect = useCallback(() => {
    disconnectSocket();
  }, []);

  return { emit, subscribe, disconnect, socket: socketRef.current };
};
