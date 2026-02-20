import React, {useEffect, useState} from 'react';
import {View, Text, FlatList, TextInput, TouchableOpacity, StyleSheet, SafeAreaView, KeyboardAvoidingView, Platform} from 'react-native';
import {messageService} from '../../services/message';
import {Message} from '../../types';
import {useSelector} from 'react-redux';
import {RootState} from '../../store/store';

export default function ChatScreen({route}: any) {
  const {conversationId, peerId} = route.params;
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const currentUser = useSelector((state: RootState) => state.auth.user);

  const fetchMessages = async () => {
    try {
      const res = await messageService.getMessages(conversationId, 1, 50);
      setMessages((res.data.list || []).reverse());
      messageService.markRead(conversationId);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => { fetchMessages(); }, []);

  const handleSend = async () => {
    if (!inputText.trim()) return;
    try {
      const res = await messageService.send(peerId, inputText.trim());
      setMessages(prev => [...prev, res.data]);
      setInputText('');
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
