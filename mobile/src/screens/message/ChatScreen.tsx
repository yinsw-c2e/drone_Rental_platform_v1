import React, {useEffect, useState, useCallback} from 'react';
import {View, Text, FlatList, TextInput, TouchableOpacity, StyleSheet, SafeAreaView, KeyboardAvoidingView, Platform} from 'react-native';
import {messageService} from '../../services/message';
import {Message} from '../../types';
import {useSelector} from 'react-redux';
import {RootState} from '../../store/store';

export default function ChatScreen({route, navigation}: any) {
  const {peerId, peerName} = route.params;
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const currentUser = useSelector((state: RootState) => state.auth.user);

  const fetchMessages = async () => {
    try {
      // Use peerId to fetch messages, handles inconsistent conversation_id formats
      const res = await messageService.getMessagesByPeer(peerId, 1, 50);
      setMessages((res.data.list || []).reverse());
      messageService.markReadByPeer(peerId);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => { fetchMessages(); }, [peerId]);

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
          <Text style={[styles.msgText, isMine && {color: '#fff'}]}>{item.content}</Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
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
      <KeyboardAvoidingView style={{flex: 1}} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <FlatList
          data={messages}
          keyExtractor={item => String(item.id)}
          renderItem={renderMessage}
          contentContainerStyle={{padding: 12}}
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

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#f5f5f5'},
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#fff', paddingHorizontal: 12, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#e8e8e8',
  },
  backBtn: {paddingHorizontal: 8, paddingVertical: 4},
  backText: {fontSize: 16, color: '#1890ff'},
  headerTitle: {fontSize: 17, fontWeight: '600', color: '#333', flex: 1, textAlign: 'center'},
  listBtn: {paddingHorizontal: 8, paddingVertical: 4},
  listText: {fontSize: 15, color: '#1890ff'},
  msgRow: {flexDirection: 'row', marginBottom: 12},
  msgRowRight: {justifyContent: 'flex-end'},
  bubble: {maxWidth: '75%', padding: 12, borderRadius: 12},
  bubbleMine: {backgroundColor: '#1890ff', borderBottomRightRadius: 4},
  bubbleOther: {backgroundColor: '#fff', borderBottomLeftRadius: 4},
  msgText: {fontSize: 15, color: '#333'},
  inputBar: {flexDirection: 'row', padding: 8, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#eee'},
  input: {flex: 1, height: 40, backgroundColor: '#f5f5f5', borderRadius: 20, paddingHorizontal: 16, fontSize: 15},
  sendBtn: {width: 60, height: 40, backgroundColor: '#1890ff', borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginLeft: 8},
  sendText: {color: '#fff', fontSize: 15, fontWeight: 'bold'},
});
