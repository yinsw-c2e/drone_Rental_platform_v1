import api from './api';
import {ApiResponse, Message, ConversationSummary, PageData} from '../types';

export const messageService = {
  getConversations: () =>
    api.get<any, ApiResponse<ConversationSummary[]>>('/message/conversations'),

  getMessages: (conversationId: string, page?: number, pageSize?: number) =>
    api.get<any, ApiResponse<PageData<Message>>>(`/message/${conversationId}`, {
      params: {page, page_size: pageSize},
    }),

  // Get messages by peer ID (handles inconsistent conversation_id formats)
  getMessagesByPeer: (peerId: number, page?: number, pageSize?: number) =>
    api.get<any, ApiResponse<PageData<Message>>>(`/message/peer/${peerId}`, {
      params: {page, page_size: pageSize},
    }),

  send: (receiverId: number, content: string, messageType?: string) =>
    api.post<any, ApiResponse<Message>>('/message', {
      receiver_id: receiverId,
      content,
      message_type: messageType || 'text',
    }),

  markRead: (conversationId: string) =>
    api.put<any, ApiResponse>(`/message/${conversationId}/read`),

  // Mark messages from peer as read
  markReadByPeer: (peerId: number) =>
    api.put<any, ApiResponse>(`/message/peer/${peerId}/read`),

  getUnreadCount: () =>
    api.get<any, ApiResponse<{count: number}>>('/message/unread-count'),
};
