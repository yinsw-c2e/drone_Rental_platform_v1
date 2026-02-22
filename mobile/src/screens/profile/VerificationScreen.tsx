import React from 'react';
import {View, Text, StyleSheet, SafeAreaView} from 'react-native';

export default function VerificationScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.icon}>🆔</Text>
        <Text style={styles.title}>实名认证</Text>
        <Text style={styles.desc}>此功能开发中，敬请期待</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#f5f5f5'},
  content: {flex: 1, justifyContent: 'center', alignItems: 'center'},
  icon: {fontSize: 64, marginBottom: 16},
  title: {fontSize: 20, fontWeight: 'bold', color: '#333', marginBottom: 8},
  desc: {fontSize: 14, color: '#999'},
});
