import { apiV1, apiV2 } from './api';
import { Message, ConversationSummary, V2ListData } from '../types';

export const messageService = {
  getConversations: () =>
    apiV2.get<V2ListData<ConversationSummary>>('/conversations'),

  getMessages: (conversationId: string, page?: number, pageSize?: number) =>
    apiV2.get<V2ListData<Message>>(`/conversations/${encodeURIComponent(conversationId)}/messages`, {
      page,
      page_size: pageSize,
    }),

  getMessagesByPeer: (peerId: number, page?: number, pageSize?: number) =>
    apiV1.get<{ list: Message[]; total: number }>(`/message/peer/${peerId}`, { page, page_size: pageSize }),

  send: (receiverId: number, content: string, messageType?: string) =>
    apiV1.post<Message>('/message', { receiver_id: receiverId, content, message_type: messageType || 'text' }),

  markRead: (conversationId: string) =>
    apiV2.post(`/conversations/${encodeURIComponent(conversationId)}/read`),

  deleteConversation: (conversationId: string) =>
    apiV2.delete(`/conversations/${encodeURIComponent(conversationId)}`),

  markReadByPeer: (peerId: number) =>
    apiV1.put(`/message/peer/${peerId}/read`),

  getUnreadCount: () =>
    apiV1.get<{ count: number }>('/message/unread-count'),
};
