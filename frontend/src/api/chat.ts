import axios from 'axios';

// Hardcode the production API URL to bypass Railway build issues
const getApiUrl = () => {
  const isProduction = window.location.hostname !== 'localhost';
  return isProduction ? 'https://roomzi-backend.up.railway.app' : 'http://localhost:3001';
};

const API_URL = `${getApiUrl()}/api`;

export interface ChatRoom {
  id: string;
  tenant_id: string;
  landlord_id: string;
  property_id: string;
  created_at: string;
}

export interface Message {
  id: string;
  chat_id: string;
  sender_id: string;
  content: string;
  sender_type: 'tenant' | 'landlord';
  created_at: string;
  image_url?: string;
}

export const chatApi = {
  // Create a new chat room
  createChatRoom: async (
    tenantId: string,
    landlordId: string,
    propertyId: string,
    tenantName?: string,
    propertyName?: string,
    landlordName?: string
  ) => {
    try {
      console.log('Creating chat room:', { tenantId, landlordId, propertyId, tenantName, propertyName, landlordName });
      const response = await axios.post(`${API_URL}/chats`, {
        tenant_id: tenantId,
        landlord_id: landlordId,
        property_id: propertyId
      });
      console.log('Chat room created:', response.data);
      return response.data;
    } catch (error) {
      console.error('Error creating chat room:', error);
      throw error;
    }
  },

  // Get all chat rooms for a user
  getChatRooms: async (userId: string) => {
    try {
      console.log('Fetching chat rooms for user:', userId);
      const response = await axios.get(`${API_URL}/chats/user/${userId}/tenant`);
      console.log('Chat rooms fetched:', response.data);
      return response.data;
    } catch (error) {
      console.error('Error fetching chat rooms:', error);
      throw error;
    }
  },

  // Get messages for a chat room
  getMessages: async (roomId: string) => {
    try {
      console.log('Fetching messages for room:', roomId);
      const response = await axios.get(`${API_URL}/chats/${roomId}/messages`);
      console.log('Messages fetched:', response.data);
      return response.data;
    } catch (error) {
      console.error('Error fetching messages:', error);
      throw error;
    }
  },

  // Send a message
  sendMessage: async (
    chatId: string,
    senderId: string,
    content: string,
    senderType: 'tenant' | 'landlord',
    replyToId?: string
  ) => {
    try {
      console.log('Sending message:', { chatId, senderId, content, senderType, replyToId });
      const response = await axios.post(`${API_URL}/chats/messages`, {
        chat_id: chatId,
        sender_id: senderId,
        content,
        sender_type: senderType,
        reply_to_id: replyToId || null
      });
      console.log('Message sent:', response.data);
      return response.data;
    } catch (error) {
      console.error('Error sending message:', error);
      throw error;
    }
  },

  // Find or create a chat room
  findOrCreateChatRoom: async (
    tenantId: string,
    landlordId: string,
    propertyId: string,
    tenantName?: string,
    propertyName?: string,
    landlordName?: string
  ) => {
    try {
      const response = await axios.post(`${API_URL}/chats`, {
        tenant_id: tenantId,
        landlord_id: landlordId,
        property_id: propertyId
      });
      return response.data;
    } catch (error) {
      console.error('Error finding or creating chat room:', error);
      throw error;
    }
  },

  // Delete a message by ID
  deleteMessage: async (messageId: string) => {
    try {
      const response = await axios.delete(`${API_URL}/chats/messages/${messageId}`);
      return response.data;
    } catch (error) {
      console.error('Error deleting message:', error);
      throw error;
    }
  },

  // Delete a chat room (landlord only)
  deleteChatRoom: async (roomId: string, landlordId: string) => {
    try {
      const response = await axios.delete(`${API_URL}/chats/${roomId}`, {
        data: { landlordId }
      });
      return response.data;
    } catch (error) {
      console.error('Error deleting chat room:', error);
      throw error;
    }
  }
}; 