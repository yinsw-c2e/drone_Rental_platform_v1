import api, {apiV2} from './api';
import {
  ApiResponse,
  Message,
  ConversationSummary,
  PageData,
  V2ApiResponse,
  V2ListData,
  V2PageMeta,
} from '../types';

export const messageService = {
  getConversations: () =>
    apiV2.get<any, V2ApiResponse<V2ListData<ConversationSummary>, V2PageMeta>>('/conversations'),

  getMessages: (conversationId: string, page?: number, pageSize?: number) =>
    apiV2.get<any, V2ApiResponse<V2ListData<Message>, V2PageMeta>>(`/conversations/${encodeURIComponent(conversationId)}/messages`, {
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
