import Taro, { useDidShow } from '@tarojs/taro';
import React, { useEffect, useRef, useState } from 'react';
import { View, Text, ScrollView, Input } from '@tarojs/components';
import { messageService } from '../../services/message';
import { Message } from '../../types';
import './index.scss';

export default function ChatPage() {
  const params = Taro.getCurrentInstance().router?.params || {};
  const convId = String(params.convId || '');
  const peerId = Number(params.peerId || 0);
  const [msgs, setMsgs] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [scrollIntoView, setScrollIntoView] = useState('chat-bottom-anchor');

  useDidShow(() => {
    if (convId) {
      messageService.getMessages(convId).then(res => {
        setMsgs((res as any).items || []);
      }).catch(() => {});
    } else if (peerId) {
      messageService.getMessagesByPeer(peerId).then(res => {
        setMsgs(res.list || []);
      }).catch(() => {});
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
    };
  }, []);

  const scrollToBottom = () => {
    setScrollIntoView('');
    setTimeout(() => {
      setScrollIntoView('chat-bottom-anchor');
    }, 80);
  };

  useEffect(() => { scrollToBottom(); }, [msgs]);

  const send = async () => {
    if (!text.trim() || !peerId || sending) return;
    const t = text;
    setText('');
    setSending(true);
    try {
      await messageService.send(peerId, t);
      setMsgs(prev => [...prev, {
        id: Date.now(), sender_id: 0, receiver_id: peerId, content: t,
        message_type: 'text', is_read: false, conversation_id: convId,
        created_at: new Date().toISOString(),
      } as any]);
    } catch {
      setText(t);
      Taro.showToast({ title: '发送失败', icon: 'none' });
    } finally { setSending(false); }
  };

  const formatTime = (iso?: string) => {
    if (!iso) return '';
    const d = iso.split('T')[1];
    return d ? d.substring(0, 5) : '';
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
            const isSelf = m.sender_id !== peerId;
            return (
              <View key={m.id} className={`chat-bubble-row ${isSelf ? 'chat-bubble-self' : 'chat-bubble-peer'}`}>
                <View className={`chat-bubble ${isSelf ? 'chat-bubble-blue' : 'chat-bubble-white'}`}>
                  <Text className={`chat-bubble-text ${isSelf ? 'chat-bubble-text-self' : ''}`}>{m.content}</Text>
                </View>
                <Text className="chat-time">{formatTime(m.created_at)}</Text>
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
