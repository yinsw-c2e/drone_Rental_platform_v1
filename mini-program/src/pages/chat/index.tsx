import Taro, { useDidShow } from '@tarojs/taro';
import React, { useEffect, useRef, useState } from 'react';
import { View, Text, ScrollView, Input, Image } from '@tarojs/components';
import { useSelector } from 'react-redux';
import { messageService } from '../../services/message';
import { Message } from '../../types';
import { RootState } from '../../store/store';
import './index.scss';

const CHAT_PAGE_SIZE = 50;

function getMessageTime(message: Message) {
  const timestamp = message.created_at ? new Date(message.created_at).getTime() : 0;
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function normalizeChatMessages(messages: Message[]) {
  return [...messages].sort((a, b) => {
    const timeDelta = getMessageTime(a) - getMessageTime(b);
    if (timeDelta !== 0) return timeDelta;
    return Number(a.id || 0) - Number(b.id || 0);
  });
}

function getAvatarInitial(name?: string, fallback = '') {
  const text = (name || fallback).trim();
  return Array.from(text)[0] || '用';
}

export default function ChatPage() {
  const params = Taro.getCurrentInstance().router?.params || {};
  const convId = String(params.convId || '');
  const peerId = Number(params.peerId || 0);
  const peerName = decodeURIComponent(String(params.peerName || '')).trim();
  const peerAvatar = decodeURIComponent(String(params.peerAvatar || '')).trim();
  const currentUser = useSelector((state: RootState) => state.auth.user);
  const currentUserId = Number(currentUser?.id || 0);
  const [msgs, setMsgs] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [scrollIntoView, setScrollIntoView] = useState('chat-bottom-anchor');
  const scrollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useDidShow(() => {
    Taro.setNavigationBarTitle({ title: peerName || (peerId ? `用户 ${peerId}` : '聊天') }).catch(() => {});
    if (convId) {
      messageService.getMessages(convId, 1, CHAT_PAGE_SIZE).then(res => {
        setMsgs(normalizeChatMessages(((res as any).items || []) as Message[]));
      }).catch(() => {});
      messageService.markRead(convId).catch(() => {});
    } else if (peerId) {
      messageService.getMessagesByPeer(peerId, 1, CHAT_PAGE_SIZE).then(res => {
        setMsgs(normalizeChatMessages(res.list || []));
      }).catch(() => {});
      messageService.markReadByPeer(peerId).catch(() => {});
    }
  });

  useEffect(() => {
    const handleKeyboardChange = (res: { height?: number }) => {
      setKeyboardHeight(res.height || 0);
      scrollToBottom();
    };

    Taro.onKeyboardHeightChange?.(handleKeyboardChange as any);
    return () => {
      Taro.offKeyboardHeightChange?.(handleKeyboardChange as any);
      if (scrollTimerRef.current) {
        clearTimeout(scrollTimerRef.current);
      }
    };
  }, []);

  const scrollToBottom = () => {
    if (scrollTimerRef.current) {
      clearTimeout(scrollTimerRef.current);
    }
    setScrollIntoView('');
    scrollTimerRef.current = setTimeout(() => {
      setScrollIntoView('chat-bottom-anchor');
    }, 80);
  };

  useEffect(() => { scrollToBottom(); }, [msgs]);

  const send = async () => {
    if (!text.trim() || !peerId || sending) return;
    const t = text.trim();
    setText('');
    setSending(true);
    try {
      const sent = await messageService.send(peerId, t);
      const fallbackMessage = {
        id: Date.now(), sender_id: currentUserId, receiver_id: peerId, content: t,
        message_type: 'text', is_read: false, conversation_id: convId,
        created_at: new Date().toISOString(),
      } as Message;
      setMsgs(prev => normalizeChatMessages([...prev, sent || fallbackMessage]));
    } catch {
      setText(t);
      Taro.showToast({ title: '发送失败', icon: 'none' });
    } finally { setSending(false); }
  };

  const formatTime = (iso?: string) => {
    if (!iso) return '';
    const date = new Date(iso);
    if (Number.isFinite(date.getTime())) {
      return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
    }
    const matched = iso.match(/(\d{2}):(\d{2})/);
    return matched ? `${matched[1]}:${matched[2]}` : '';
  };

  const renderAvatar = (isSelf: boolean) => {
    const avatarUrl = isSelf ? currentUser?.avatar_url : peerAvatar;
    const initial = isSelf
      ? getAvatarInitial(currentUser?.nickname || currentUser?.phone, '我')
      : getAvatarInitial(peerName, '用');

    return (
      <View className={`chat-avatar ${isSelf ? 'chat-avatar-self' : 'chat-avatar-peer'}`}>
        {avatarUrl ? (
          <Image className="chat-avatar-img" src={avatarUrl} mode="aspectFill" />
        ) : (
          <Text className="chat-avatar-text">{initial}</Text>
        )}
      </View>
    );
  };

  return (
    <View className="chat-wrap">
      {/* ── 消息列表 ── */}
      <ScrollView
        scrollY
        className="chat-scroll"
        scrollWithAnimation
        scrollIntoView={scrollIntoView}
      >
        <View className="chat-msg-list">
          {msgs.length === 0 ? (
            <View className="empty-state">
              <Text className="empty-state-icon">💬</Text>
              <Text className="empty-state-text">暂无消息，发送第一条消息吧</Text>
            </View>
          ) : msgs.map(m => {
            const isSelf = currentUserId > 0
              ? m.sender_id === currentUserId
              : peerId > 0 && m.sender_id !== peerId;
            return (
              <View key={m.id} className={`chat-bubble-row ${isSelf ? 'chat-bubble-self' : 'chat-bubble-peer'}`}>
                {renderAvatar(isSelf)}
                <View className={`chat-message-main ${isSelf ? 'chat-message-main-self' : ''}`}>
                  <View className={`chat-bubble ${isSelf ? 'chat-bubble-blue' : 'chat-bubble-white'}`}>
                    <Text className={`chat-bubble-text ${isSelf ? 'chat-bubble-text-self' : ''}`}>{m.content}</Text>
                  </View>
                  <Text className="chat-time">{formatTime(m.created_at)}</Text>
                </View>
              </View>
            );
          })}
          <View id="chat-bottom-anchor" className="chat-bottom-anchor" />
        </View>
      </ScrollView>

      {/* ── 底部输入栏 ── */}
      <View
        className={`chat-input-bar ${keyboardHeight > 0 ? 'chat-input-bar-keyboard' : ''}`}
        style={{ bottom: `${keyboardHeight}px` }}
      >
        <Input
          className="chat-input"
          value={text}
          onInput={e => setText(e.detail.value)}
          placeholder="输入消息..."
          confirmType="send"
          cursorSpacing={12}
          adjustPosition={false}
          onConfirm={send}
        />
        <View className={`chat-send-btn ${(!text.trim() || sending) ? 'chat-send-disabled' : ''}`}
          onClick={send}>
          <Text className="chat-send-text">{sending ? '...' : '发送'}</Text>
        </View>
      </View>
    </View>
  );
}
