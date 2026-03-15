import React, {useCallback, useMemo, useState} from 'react';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {useFocusEffect} from '@react-navigation/native';
import {useSelector} from 'react-redux';

import ObjectCard from '../../components/business/ObjectCard';
import EmptyState from '../../components/business/EmptyState';
import StatusBadge from '../../components/business/StatusBadge';
import {orderFinanceV2Service} from '../../services/orderFinanceV2';
import {orderV2Service} from '../../services/orderV2';
import {RootState} from '../../store/store';
import {OrderPartySummary, V2OrderDetail, V2ReviewSummary} from '../../types';

type ReviewTarget = {
  userId: number;
  role: 'client' | 'owner' | 'pilot';
  label: string;
  subtitle: string;
};

const formatDateTime = (value?: string | null) => {
  if (!value) {
    return '-';
  }
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hour = String(date.getHours()).padStart(2, '0');
  const minute = String(date.getMinutes()).padStart(2, '0');
  return `${month}-${day} ${hour}:${minute}`;
};

const buildTargetSummary = (party?: OrderPartySummary | null, fallbackRole?: string) => {
  if (!party) {
    return fallbackRole || '参与方';
  }
  return party.nickname || `${fallbackRole || '参与方'} #${party.user_id}`;
};

const buildReviewTargets = (detail: V2OrderDetail | null, currentUserId: number): ReviewTarget[] => {
  if (!detail || !detail.participants) {
    return [];
  }
  const targets: ReviewTarget[] = [];
  const pushTarget = (party: OrderPartySummary | null | undefined, role: ReviewTarget['role'], label: string) => {
    if (!party?.user_id || party.user_id === currentUserId) {
      return;
    }
    targets.push({
      userId: party.user_id,
      role,
      label,
      subtitle: buildTargetSummary(party, label),
    });
  };

  pushTarget(detail.participants.client, 'client', '客户');
  pushTarget(detail.participants.provider, 'owner', '承接方');
  pushTarget(detail.participants.executor, 'pilot', '执行飞手');

  const unique = new Map<string, ReviewTarget>();
  targets.forEach(item => unique.set(`${item.role}:${item.userId}`, item));
  return Array.from(unique.values());
};

export default function ReviewScreen({route, navigation}: any) {
  const currentUserId = Number(useSelector((state: RootState) => state.auth.user?.id || 0));
  const orderId = Number(route.params?.orderId || route.params?.id || route.params?.order?.id || 0);
  const [detail, setDetail] = useState<V2OrderDetail | null>(null);
  const [reviews, setReviews] = useState<V2ReviewSummary[]>([]);
  const [rating, setRating] = useState(5);
  const [content, setContent] = useState('');
  const [selectedTargetKey, setSelectedTargetKey] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const loadData = useCallback(async () => {
    if (!orderId) {
      setDetail(null);
      setLoading(false);
      setRefreshing(false);
      return;
    }
    try {
      const [detailRes, reviewRes] = await Promise.all([
        orderV2Service.get(orderId),
        orderFinanceV2Service.listReviews(orderId),
      ]);
      setDetail(detailRes.data || null);
      setReviews(reviewRes.data?.items || []);
    } catch (error: any) {
      Alert.alert('加载失败', error?.message || '请稍后重试');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [orderId]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData]),
  );

  const targets = useMemo(() => buildReviewTargets(detail, currentUserId), [detail, currentUserId]);
  const existingMyReview = useMemo(
    () => reviews.find(item => Number(item.reviewer_user_id) === currentUserId) || null,
    [currentUserId, reviews],
  );

  const selectedTarget = useMemo(
    () => targets.find(item => `${item.role}:${item.userId}` === selectedTargetKey) || null,
    [selectedTargetKey, targets],
  );

  const canReview = !!detail && detail.status === 'completed' && !existingMyReview;

  const handleSubmit = async () => {
    if (!detail || !selectedTarget) {
      Alert.alert('提示', '请选择评价对象');
      return;
    }
    if (!content.trim()) {
      Alert.alert('提示', '请输入评价内容');
      return;
    }
    setSubmitting(true);
    try {
      await orderFinanceV2Service.createReview(detail.id, {
        target_user_id: selectedTarget.userId,
        target_role: selectedTarget.role,
        rating,
        content: content.trim(),
      });
      Alert.alert('提交成功', '评价已挂在当前订单下，你和对方都可以在订单维度回看。');
      setContent('');
      await loadData();
    } catch (error: any) {
      Alert.alert('提交失败', error?.message || '请稍后重试');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerState}>
          <ActivityIndicator color="#114178" />
          <Text style={styles.stateText}>正在加载订单评价信息...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!detail) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerState}>
          <Text style={styles.stateText}>订单信息缺失</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => {
          setRefreshing(true);
          loadData();
        }} />}
      >
        <View style={styles.hero}>
          <Text style={styles.heroOrderNo}>{detail.order_no}</Text>
          <Text style={styles.heroTitle}>订单评价</Text>
          <Text style={styles.heroHint}>评价动作现在直接挂在订单对象下，后续履约、售后和评价都可以在同一订单里回看。</Text>
        </View>

        <ObjectCard style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>订单摘要</Text>
          <View style={styles.row}><Text style={styles.rowLabel}>订单标题</Text><Text style={styles.rowValue}>{detail.title}</Text></View>
          <View style={styles.row}><Text style={styles.rowLabel}>当前状态</Text><Text style={styles.rowValue}>{detail.status}</Text></View>
          <View style={styles.row}><Text style={styles.rowLabel}>客户</Text><Text style={styles.rowValue}>{buildTargetSummary(detail.participants?.client, '客户')}</Text></View>
          <View style={styles.row}><Text style={styles.rowLabel}>承接方</Text><Text style={styles.rowValue}>{buildTargetSummary(detail.participants?.provider, '承接方')}</Text></View>
          <View style={styles.row}><Text style={styles.rowLabel}>执行飞手</Text><Text style={styles.rowValue}>{buildTargetSummary(detail.participants?.executor, '执行飞手')}</Text></View>
        </ObjectCard>

        <ObjectCard style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>提交评价</Text>
          {!canReview ? (
            existingMyReview ? (
              <EmptyState
                icon="📝"
                title="你已经评价过这笔订单"
                description="当前账号对同一订单只保留一条评价，后续可以在下方查看历史内容。"
              />
            ) : (
              <EmptyState
                icon="⌛"
                title="订单完成后才能评价"
                description="后端当前只允许 completed 订单提交评价，避免在履约未结束时提前形成结论。"
              />
            )
          ) : (
            <>
              <Text style={styles.fieldLabel}>评价对象</Text>
              <View style={styles.targetGrid}>
                {targets.map(target => {
                  const key = `${target.role}:${target.userId}`;
                  return (
                    <TouchableOpacity
                      key={key}
                      style={[styles.targetChip, selectedTargetKey === key && styles.targetChipActive]}
                      onPress={() => setSelectedTargetKey(key)}>
                      <Text style={[styles.targetChipLabel, selectedTargetKey === key && styles.targetChipLabelActive]}>{target.label}</Text>
                      <Text style={[styles.targetChipDesc, selectedTargetKey === key && styles.targetChipLabelActive]}>{target.subtitle}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={styles.fieldLabel}>评分</Text>
              <View style={styles.starRow}>
                {[1, 2, 3, 4, 5].map(item => (
                  <TouchableOpacity key={item} onPress={() => setRating(item)} style={styles.starBtn}>
                    <Text style={[styles.star, item <= rating && styles.starActive]}>★</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.fieldLabel}>评价内容</Text>
              <TextInput
                style={styles.textArea}
                multiline
                numberOfLines={5}
                placeholder="请描述本次履约体验、沟通质量或执行表现..."
                value={content}
                onChangeText={setContent}
                maxLength={500}
                textAlignVertical="top"
              />
              <Text style={styles.charCount}>{content.length}/500</Text>

              <TouchableOpacity
                style={[styles.primaryBtn, (submitting || !selectedTarget) && styles.primaryBtnDisabled]}
                disabled={submitting || !selectedTarget}
                onPress={handleSubmit}>
                {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>提交评价</Text>}
              </TouchableOpacity>
            </>
          )}
        </ObjectCard>

        <ObjectCard style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>订单评价记录</Text>
          {reviews.length === 0 ? (
            <Text style={styles.emptyText}>当前还没有评价记录。</Text>
          ) : (
            reviews.map(item => (
              <View key={item.id} style={styles.reviewItem}>
                <View style={styles.reviewHeader}>
                  <Text style={styles.reviewTitle}>评价对象：{item.target_role}</Text>
                  <StatusBadge label={`${item.rating} 分`} tone={item.rating >= 4 ? 'green' : item.rating === 3 ? 'orange' : 'red'} />
                </View>
                <Text style={styles.reviewContent}>{item.content}</Text>
                <Text style={styles.reviewMeta}>提交时间：{formatDateTime(item.created_at)}</Text>
              </View>
            ))
          )}
        </ObjectCard>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#eef3f8',
  },
  centerState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  stateText: {
    fontSize: 14,
    color: '#6b7280',
  },
  content: {
    padding: 14,
    paddingBottom: 24,
  },
  hero: {
    borderRadius: 24,
    backgroundColor: '#114178',
    padding: 20,
    marginBottom: 12,
  },
  heroOrderNo: {
    fontSize: 13,
    color: '#d6e4ff',
    fontWeight: '700',
  },
  heroTitle: {
    marginTop: 12,
    fontSize: 28,
    color: '#fff',
    fontWeight: '800',
  },
  heroHint: {
    marginTop: 10,
    fontSize: 13,
    lineHeight: 20,
    color: '#d6e4ff',
  },
  sectionCard: {
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    color: '#1f1f1f',
    fontWeight: '800',
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  rowLabel: {
    fontSize: 13,
    color: '#8c8c8c',
  },
  rowValue: {
    maxWidth: '62%',
    fontSize: 14,
    color: '#1f1f1f',
    fontWeight: '700',
    textAlign: 'right',
  },
  fieldLabel: {
    marginTop: 10,
    marginBottom: 8,
    fontSize: 13,
    color: '#595959',
    fontWeight: '700',
  },
  targetGrid: {
    gap: 10,
  },
  targetChip: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#d9d9d9',
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: '#fff',
  },
  targetChipActive: {
    borderColor: '#114178',
    backgroundColor: '#f6fbff',
  },
  targetChipLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1f1f1f',
  },
  targetChipDesc: {
    marginTop: 4,
    fontSize: 12,
    color: '#8c8c8c',
  },
  targetChipLabelActive: {
    color: '#114178',
  },
  starRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
  },
  starBtn: {
    paddingHorizontal: 8,
  },
  star: {
    fontSize: 34,
    color: '#d9d9d9',
  },
  starActive: {
    color: '#faad14',
  },
  textArea: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#d9d9d9',
    backgroundColor: '#fafafa',
    padding: 14,
    minHeight: 128,
    fontSize: 14,
    color: '#1f1f1f',
  },
  charCount: {
    marginTop: 8,
    textAlign: 'right',
    fontSize: 12,
    color: '#8c8c8c',
  },
  primaryBtn: {
    marginTop: 14,
    borderRadius: 999,
    backgroundColor: '#114178',
    alignItems: 'center',
    paddingVertical: 13,
  },
  primaryBtnDisabled: {
    backgroundColor: '#91a8c2',
  },
  primaryBtnText: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '800',
  },
  emptyText: {
    fontSize: 13,
    lineHeight: 20,
    color: '#8c8c8c',
  },
  reviewItem: {
    marginTop: 10,
    borderRadius: 16,
    backgroundColor: '#fafafa',
    borderWidth: 1,
    borderColor: '#f0f0f0',
    padding: 12,
  },
  reviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  reviewTitle: {
    fontSize: 13,
    color: '#595959',
    fontWeight: '700',
  },
  reviewContent: {
    marginTop: 10,
    fontSize: 14,
    lineHeight: 20,
    color: '#1f1f1f',
  },
  reviewMeta: {
    marginTop: 8,
    fontSize: 12,
    color: '#8c8c8c',
  },
});
