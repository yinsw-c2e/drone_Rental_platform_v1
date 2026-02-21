import React, {useState} from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, SafeAreaView,
  TextInput, ScrollView, Alert, ActivityIndicator,
} from 'react-native';
import {useSelector} from 'react-redux';
import {RootState} from '../../store/store';
import {reviewService} from '../../services/review';
import {Order} from '../../types';

export default function ReviewScreen({route, navigation}: any) {
  const order: Order = route.params?.order;
  const user = useSelector((state: RootState) => state.auth.user);
  const [rating, setRating] = useState(5);
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!order) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <Text style={{color: '#999'}}>订单信息缺失</Text>
        </View>
      </SafeAreaView>
    );
  }

  const isOwner = user?.id === order.owner_id;
  const reviewType = isOwner ? 'owner_to_renter' : 'renter_to_owner';
  const targetType = isOwner ? 'user' : 'drone';
  const targetId = isOwner ? order.renter_id : order.drone_id;
  const targetName = isOwner
    ? `承租方 ${order.renter?.nickname || ''}`
    : `${order.drone?.brand || ''} ${order.drone?.model || '无人机'}`;

  const handleSubmit = async () => {
    if (!content.trim()) {
      Alert.alert('提示', '请输入评价内容');
      return;
    }
    setSubmitting(true);
    try {
      await reviewService.create({
        order_id: order.id,
        review_type: reviewType,
        target_type: targetType,
        target_id: targetId,
        rating,
        content: content.trim(),
      });
      Alert.alert('成功', '评价已提交', [
        {text: '确定', onPress: () => navigation.goBack()},
      ]);
    } catch (e: any) {
      Alert.alert('提交失败', e?.response?.data?.message || '请稍后重试');
    }
    setSubmitting(false);
  };

  const renderStars = () => {
    const stars = [];
    for (let i = 1; i <= 5; i++) {
      stars.push(
        <TouchableOpacity key={i} onPress={() => setRating(i)} style={styles.starBtn}>
          <Text style={[styles.star, i <= rating && styles.starActive]}>
            {'\u2605'}
          </Text>
        </TouchableOpacity>,
      );
    }
    return <View style={styles.starRow}>{stars}</View>;
  };

  const ratingLabels = ['', '非常差', '较差', '一般', '满意', '非常满意'];

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.content}>
        {/* Order summary */}
        <View style={styles.card}>
          <Text style={styles.orderTitle}>{order.title}</Text>
          <Text style={styles.orderMeta}>订单号: {order.order_no}</Text>
        </View>

        {/* Target */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>评价对象</Text>
          <Text style={styles.targetName}>{targetName}</Text>
        </View>

        {/* Rating */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>评分</Text>
          {renderStars()}
          <Text style={styles.ratingLabel}>{ratingLabels[rating]}</Text>
        </View>

        {/* Content */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>评价内容</Text>
          <TextInput
            style={styles.textInput}
            multiline
            numberOfLines={5}
            placeholder="请输入您的评价内容..."
            placeholderTextColor="#ccc"
            value={content}
            onChangeText={setContent}
            textAlignVertical="top"
            maxLength={500}
          />
          <Text style={styles.charCount}>{content.length}/500</Text>
        </View>
      </ScrollView>

      {/* Submit */}
      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={submitting}>
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.submitBtnText}>提交评价</Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#f5f5f5'},
  center: {flex: 1, justifyContent: 'center', alignItems: 'center'},
  content: {flex: 1},

  card: {backgroundColor: '#fff', padding: 16, marginBottom: 10},

  orderTitle: {fontSize: 16, fontWeight: '600', color: '#333'},
  orderMeta: {fontSize: 13, color: '#999', marginTop: 6},

  sectionTitle: {fontSize: 16, fontWeight: '600', color: '#333', marginBottom: 12},
  targetName: {fontSize: 15, color: '#666'},

  // Stars
  starRow: {flexDirection: 'row', justifyContent: 'center', marginVertical: 8},
  starBtn: {paddingHorizontal: 8},
  star: {fontSize: 36, color: '#ddd'},
  starActive: {color: '#faad14'},
  ratingLabel: {textAlign: 'center', fontSize: 14, color: '#faad14', marginTop: 4},

  // Text input
  textInput: {
    borderWidth: 1, borderColor: '#e8e8e8', borderRadius: 8, padding: 12,
    fontSize: 14, color: '#333', minHeight: 120, backgroundColor: '#fafafa',
  },
  charCount: {textAlign: 'right', fontSize: 12, color: '#999', marginTop: 6},

  // Bottom
  bottomBar: {
    backgroundColor: '#fff', padding: 16, paddingBottom: 32,
    borderTopWidth: 1, borderTopColor: '#e8e8e8',
  },
  submitBtn: {
    height: 48, backgroundColor: '#1890ff', borderRadius: 24,
    justifyContent: 'center', alignItems: 'center',
  },
  submitBtnDisabled: {backgroundColor: '#91caff'},
  submitBtnText: {color: '#fff', fontSize: 17, fontWeight: '600'},
});
