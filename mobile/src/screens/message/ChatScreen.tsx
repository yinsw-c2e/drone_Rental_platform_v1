import React, {useCallback, useEffect, useState} from 'react';
import {View, Text, FlatList, TextInput, TouchableOpacity, StyleSheet, SafeAreaView, KeyboardAvoidingView, Platform} from 'react-native';
import {messageService} from '../../services/message';
import {Message} from '../../types';
import {useSelector} from 'react-redux';
import {RootState} from '../../store/store';
import {useTheme} from '../../theme/ThemeContext';
import type {AppTheme} from '../../theme/index';

export default function ChatScreen({route, navigation}: any) {
  const {theme} = useTheme();
  const styles = getStyles(theme);
  const {conversationId, peerId, peerName} = route.params;
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const currentUser = useSelector((state: RootState) => state.auth.user);

  const fetchMessages = useCallback(async () => {
    try {
      if (conversationId) {
        const res = await messageService.getMessages(conversationId, 1, 50);
        setMessages((res.data?.items || []).reverse());
        messageService.markRead(conversationId);
      } else {
        const res = await messageService.getMessagesByPeer(peerId, 1, 50);
        setMessages((res.data.list || []).reverse());
        messageService.markReadByPeer(peerId);
      }
    } catch (e) {
      console.error(e);
    }
  }, [conversationId, peerId]);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  // 监听页面获得焦点时刷新消息
  useEffect(() => {
    const unsubscribe = navigation?.addListener?.('focus', () => {
      fetchMessages();
    });
    return unsubscribe;
  }, [navigation, fetchMessages]);

  const handleSend = async () => {
    if (!inputText.trim()) return;
    try {
      const res = await messageService.send(peerId, inputText.trim());
      setMessages(prev => [...prev, res.data]);
      setInputText('');
      // 触发全局事件通知会话列表刷新
      if (route.params?.onMessageSent) {
        route.params.onMessageSent();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const renderMessage = ({item}: {item: Message}) => {
    const isMine = item.sender_id === currentUser?.id;
    return (
      <View style={[styles.msgRow, isMine && styles.msgRowRight]}>
        <View style={[styles.bubble, isMine ? styles.bubbleMine : styles.bubbleOther]}>
          <Text style={[styles.msgText, isMine && {color: theme.btnPrimaryText}]}>{item.content}</Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.container, {backgroundColor: theme.bg}]}>
      {/* Header with back button */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>{'<'} 返回</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{peerName || `用户 ${peerId}`}</Text>
        <TouchableOpacity 
          style={styles.listBtn} 
          onPress={() => navigation.navigate('ConversationList')}>
          <Text style={styles.listText}>列表</Text>
        </TouchableOpacity>
      </View>
      <KeyboardAvoidingView style={styles.flexOne} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.noticeBanner}>
          <Text style={styles.noticeTitle}>沟通消息</Text>
          <Text style={styles.noticeText}>聊天仅用于沟通协作，订单确认、派单接受、退款处理等正式状态，请以系统通知和业务页面为准。</Text>
        </View>
        <FlatList
          data={messages}
          keyExtractor={item => String(item.id)}
          renderItem={renderMessage}
          contentContainerStyle={styles.listContent}
        />
        <View style={styles.inputBar}>
          <TextInput
            style={styles.input}
            placeholder="输入消息..."
            value={inputText}
            onChangeText={setInputText}
            onSubmitEditing={handleSend}
          />
          <TouchableOpacity style={styles.sendBtn} onPress={handleSend}>
            <Text style={styles.sendText}>发送</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const getStyles = (theme: AppTheme) => StyleSheet.create({
  container: {flex: 1, backgroundColor: theme.bgSecondary},
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: theme.card, paddingHorizontal: 12, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: theme.divider,
  },
  backBtn: {paddingHorizontal: 8, paddingVertical: 4},
  backText: {fontSize: 16, color: theme.primaryText},
  headerTitle: {fontSize: 17, fontWeight: '600', color: theme.text, flex: 1, textAlign: 'center'},
  listBtn: {paddingHorizontal: 8, paddingVertical: 4},
  listText: {fontSize: 15, color: theme.primaryText},
  noticeBanner: {
    marginHorizontal: 12,
    marginTop: 12,
    marginBottom: 4,
    backgroundColor: theme.warning + '22',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  noticeTitle: {fontSize: 13, fontWeight: '700', color: theme.warning},
  noticeText: {marginTop: 4, fontSize: 12, lineHeight: 18, color: theme.warning},
  msgRow: {flexDirection: 'row', marginBottom: 12},
  msgRowRight: {justifyContent: 'flex-end'},
  flexOne: {flex: 1},
  listContent: {padding: 12},
  bubble: {maxWidth: '75%', padding: 12, borderRadius: 12},
  bubbleMine: {backgroundColor: theme.primary, borderBottomRightRadius: 4},
  bubbleOther: {backgroundColor: theme.card, borderBottomLeftRadius: 4},
  msgText: {fontSize: 15, color: theme.text},
  inputBar: {flexDirection: 'row', padding: 8, backgroundColor: theme.card, borderTopWidth: 1, borderTopColor: theme.divider},
  input: {flex: 1, height: 40, backgroundColor: theme.bgSecondary, borderRadius: 20, paddingHorizontal: 16, fontSize: 15},
  sendBtn: {width: 60, height: 40, backgroundColor: theme.primary, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginLeft: 8},
  sendText: {color: theme.btnPrimaryText, fontSize: 15, fontWeight: 'bold'},
});
