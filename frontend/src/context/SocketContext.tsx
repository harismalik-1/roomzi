import React, { createContext, useContext, useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';

interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
  joinChat: (chatId: string) => void;
  leaveChat: (chatId: string) => void;
  sendMessage: (data: {
    chatId: string;
    senderId: string;
    content: string;
    senderType: 'tenant' | 'landlord';
    tempId?: string;
    replyToId?: string;
  }) => void;
  sendTyping: (data: {
    chatId: string;
    userId: string;
    userName: string;
  }) => void;
  sendStopTyping: (data: {
    chatId: string;
    userId: string;
  }) => void;
  markChatAsRead: (data: {
    chatId: string;
    userId: string;
    userType: 'tenant' | 'landlord';
  }) => void;
}

const SocketContext = createContext<SocketContextType | undefined>(undefined);

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (context === undefined) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};

interface SocketProviderProps {
  children: React.ReactNode;
}

export const SocketProvider: React.FC<SocketProviderProps> = ({ children }) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
    
    console.log('🔌 Environment check - VITE_API_URL:', import.meta.env.VITE_API_URL);
    console.log('🔌 Connecting to WebSocket at:', API_URL);
    
    const newSocket = io(API_URL, {
      transports: ['websocket'],
      autoConnect: true,
      forceNew: true,
    });

    newSocket.on('connect', () => {
      console.log('🔌 Connected to WebSocket server');
      setIsConnected(true);
    });

    newSocket.on('disconnect', () => {
      console.log('🔌 Disconnected from WebSocket server');
      setIsConnected(false);
    });

    newSocket.on('connect_error', (error) => {
      console.error('🔌 WebSocket connection error:', error);
      setIsConnected(false);
    });

    setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  }, []);

  const joinChat = (chatId: string) => {
    if (socket && isConnected) {
      socket.emit('join-chat', chatId);
    }
  };

  const leaveChat = (chatId: string) => {
    if (socket && isConnected) {
      socket.emit('leave-chat', chatId);
    }
  };

  const sendMessage = (data: {
    chatId: string;
    senderId: string;
    content: string;
    senderType: 'tenant' | 'landlord';
    tempId?: string;
    replyToId?: string;
  }) => {
    if (socket && isConnected) {
      socket.emit('send-message', {
        ...data,
        createdAt: new Date().toISOString()
      });
    }
  };

  const sendTyping = (data: {
    chatId: string;
    userId: string;
    userName: string;
  }) => {
    if (socket && isConnected) {
      socket.emit('typing', data);
    }
  };

  const sendStopTyping = (data: {
    chatId: string;
    userId: string;
  }) => {
    if (socket && isConnected) {
      socket.emit('stop-typing', data);
    }
  };

  const markChatAsRead = (data: {
    chatId: string;
    userId: string;
    userType: 'tenant' | 'landlord';
  }) => {
    if (socket && isConnected) {
      socket.emit('mark-chat-read', data);
    }
  };

  const value: SocketContextType = {
    socket,
    isConnected,
    joinChat,
    leaveChat,
    sendMessage,
    sendTyping,
    sendStopTyping,
    markChatAsRead,
  };

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  );
}; 