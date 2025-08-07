import { Server } from 'socket.io';
import { prisma } from './prisma.js';
import { aiService } from '../services/aiService.js';

let io;

export const initializeSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: [
        process.env.FRONTEND_URL || "http://localhost:8080",
        "https://roomzi.up.railway.app",
        "https://balanced-forgiveness-production2.up.railway.app"
      ],
      methods: ["GET", "POST"],
      credentials: true
    }
  });

  io.on('connection', (socket) => {
    console.log('🔌 User connected:', socket.id);

    // Join a chat room and load messages
    socket.on('join-chat', async (chatId) => {
      socket.join(`chat-${chatId}`);
      console.log(`👥 User ${socket.id} joined chat: ${chatId}`);
      
      try {
        // Load recent messages for the chat
        const messages = await prisma.messages.findMany({
          where: { chat_id: chatId },
          orderBy: { created_at: 'desc' },
          take: 50, // Load last 50 messages
        });
        
        // Send messages to the user who joined
        socket.emit('chat-messages', {
          chatId,
          messages: messages.reverse() // Send in chronological order
        });
      } catch (error) {
        console.error('Error loading chat messages:', error);
        socket.emit('chat-messages-error', { 
          chatId, 
          error: 'Failed to load messages' 
        });
      }
    });

    // Leave a chat room
    socket.on('leave-chat', (chatId) => {
      socket.leave(`chat-${chatId}`);
      console.log(`👋 User ${socket.id} left chat: ${chatId}`);
    });

    // Handle typing indicators
    socket.on('typing', (data) => {
      socket.to(`chat-${data.chatId}`).emit('user-typing', {
        userId: data.userId,
        userName: data.userName
      });
    });

    // Handle stop typing
    socket.on('stop-typing', (data) => {
      socket.to(`chat-${data.chatId}`).emit('user-stop-typing', {
        userId: data.userId
      });
    });

    // Handle marking chat as read
    socket.on('mark-chat-read', async (data) => {
      try {
        const { chatId, userId, userType } = data;
        
        if (!['tenant', 'landlord'].includes(userType)) {
          socket.emit('mark-read-error', { error: 'Invalid user type' });
          return;
        }

        const updateField = userType === 'tenant' ? 'tenant_last_read' : 'landlord_last_read';

        await prisma.chats.update({
          where: { id: chatId },
          data: {
            [updateField]: new Date(),
          },
        });

        socket.emit('chat-marked-read', { chatId, success: true });
      } catch (error) {
        console.error('Error marking chat as read:', error);
        socket.emit('mark-read-error', { error: 'Failed to mark chat as read' });
      }
    });

    // Handle new messages with persistence
    socket.on('send-message', async (data) => {
      try {
        // Validate sender_type
        if (!['tenant', 'landlord'].includes(data.senderType)) {
          socket.emit('message-error', { error: 'Invalid sender type' });
          return;
        }

        // Verify chat exists
        const chat = await prisma.chats.findUnique({
          where: { id: data.chatId },
        });

        if (!chat) {
          socket.emit('message-error', { error: 'Chat not found' });
          return;
        }

        // Persist message to database
        const message = await prisma.messages.create({
          data: {
            chat_id: data.chatId,
            sender_id: data.senderId,
            content: data.content,
            sender_type: data.senderType,
            reply_to_id: data.replyToId || null,
          },
        });

        // Broadcast message to all users in the chat room
        console.log(`📡 Broadcasting new-message to chat-${data.chatId}:`, {
          id: message.id,
          chat_id: message.chat_id,
          sender_id: message.sender_id,
          content: message.content,
          sender_type: message.sender_type,
          created_at: message.created_at,
          reply_to_id: message.reply_to_id,
        });
        io.to(`chat-${data.chatId}`).emit('new-message', {
          id: message.id,
          chat_id: message.chat_id,
          sender_id: message.sender_id,
          content: message.content,
          sender_type: message.sender_type,
          created_at: message.created_at,
          reply_to_id: message.reply_to_id,
        });

        // Send success confirmation to sender
        socket.emit('message-sent', {
          tempId: data.tempId,
          messageId: message.id
        });

        // Trigger AI response if message is from tenant
        console.log('🔍 Checking landlord auto-reply:', { senderType: data.senderType, aiAvailable: aiService.isAvailable() });
        if (data.senderType === 'tenant' && aiService.isAvailable()) {
          console.log('🏠 Generating landlord response for tenant message:', message.content);
          await handleAIResponse(data.chatId, message, chat);
        } else {
          console.log('⏭️ Skipping auto-reply:', data.senderType !== 'tenant' ? 'not tenant message' : 'landlord replies disabled');
        }

      } catch (error) {
        console.error('Error handling message:', error);
        socket.emit('message-error', { 
          error: 'Failed to send message',
          tempId: data.tempId
        });
      }
    });

    socket.on('disconnect', () => {
      console.log('🔌 User disconnected:', socket.id);
    });
  });

  return io;
};

/**
 * Handle AI response generation for tenant messages
 * @param {string} chatId - Chat room ID
 * @param {Object} tenantMessage - The tenant's message object
 * @param {Object} chat - Chat room object with IDs
 */
async function handleAIResponse(chatId, tenantMessage, chat) {
  try {
    // Process AI response immediately for faster responses
    try {
        // Get recent messages for context
        const recentMessages = await prisma.messages.findMany({
          where: { chat_id: chatId },
          orderBy: { created_at: 'desc' },
          take: 10
        });

        // Get landlord and tenant profile information
        const [landlordProfile, tenantProfile] = await Promise.all([
          prisma.landlord_profiles.findUnique({
            where: { id: chat.landlord_id },
            select: { full_name: true }
          }),
          prisma.tenant_profiles.findUnique({
            where: { id: chat.tenant_id },
            select: { full_name: true }
          })
        ]);

        // Get property information
        let propertyTitle = 'Property';
        if (chat.property_id && !isNaN(chat.property_id)) {
          const listing = await prisma.listings.findUnique({
            where: { id: BigInt(chat.property_id) },
            select: { title: true }
          });
          propertyTitle = listing?.title || 'Property';
        }

        // Prepare context for AI service
        const context = {
          tenantMessage: tenantMessage.content,
          propertyTitle,
          tenantName: tenantProfile?.full_name || 'Tenant',
          landlordName: landlordProfile?.full_name || 'Landlord',
          recentMessages: recentMessages.reverse(), // Chronological order for context
          // Additional context for scheduling functionality
          landlordId: chat.landlord_id,
          tenantId: chat.tenant_id,
          propertyId: chat.property_id,
          chatId: chatId
        };

        // Generate AI response
        const aiResponse = await aiService.generateLandlordResponse(context);
        
        if (aiResponse) {
          // Create AI message in database
          const aiMessage = await prisma.messages.create({
            data: {
              chat_id: chatId,
              sender_id: chat.landlord_id,
              content: aiResponse,
              sender_type: 'landlord'
            }
          });

          // Broadcast landlord response to chat room
          console.log(`🏠 Broadcasting landlord response to chat-${chatId}: ${aiResponse}`);
          io.to(`chat-${chatId}`).emit('new-message', {
            id: aiMessage.id,
            chat_id: aiMessage.chat_id,
            sender_id: aiMessage.sender_id,
            content: aiMessage.content,
            sender_type: aiMessage.sender_type,
            created_at: aiMessage.created_at,
            reply_to_id: aiMessage.reply_to_id,
            isAiGenerated: true // Flag to identify AI messages on frontend
          });
        }
    } catch (error) {
      console.error('Error generating AI response:', error);
    }
  } catch (error) {
    console.error('Error in handleAIResponse setup:', error);
  }
}

export const getIO = () => {
  if (!io) {
    throw new Error('Socket.io not initialized!');
  }
  return io;
}; 