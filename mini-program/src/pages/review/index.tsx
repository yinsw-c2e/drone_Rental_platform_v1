import Taro, { useDidShow } from '@tarojs/taro';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, Text, Textarea, View } from '@tarojs/components';
import { orderFinanceV2Service } from '../../services/orderFinanceV2';
import { orderV2Service } from '../../services/orderV2';
import { store } from '../../store/store';
import type { OrderPartySummary, V2OrderDetail, V2ReviewSummary } from '../../types';
import { friendlyErrorMessage } from '../../utils/errorMessage';
import './index.scss';

type ReviewTargetRole = 'client' | 'owner' | 'pilot';

type ReviewTarget = {
  userId: number;
  role: ReviewTargetRole;
  label: string;
  subtitle: string;
};

const formatDateTime = (value?: string | null) => {
  if (!value) return '-';
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return String(value).replace('T', ' ').slice(0, 16);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hour = String(date.getHours()).padStart(2, '0');
  const minute = String(date.getMinutes()).padStart(2, '0');
  return `${month}-${day} ${hour}:${minute}`;
};

const statusLabelOf = (status?: string) => {
  if (status === 'completed') return '已完成';
  if (status === 'delivered') return '待确认收货';
  if (status === 'in_transit') return '吊运中';
  if (status === 'pending_dispatch') return '待开始履约';
  if (status === 'pending_payment') return '待支付';
  if (status === 'cancelled') return '已取消';
  return status || '状态未知';
};

const roleLabelOf = (role?: string) => {
  if (role === 'client') return '客户';
  if (role === 'owner') return '承接方';
  if (role === 'pilot') return '履约方';
  return role || '参与方';
};

const buildTargetSummary = (party?: OrderPartySummary | null, fallbackRole = '参与方') => {
  if (!party) return fallbackRole;
  return party.nickname || `${fallbackRole} #${party.user_id}`;
};

const fallbackParty = (
  userId: number | null | undefined,
  role: ReviewTargetRole,
): OrderPartySummary | null => {
  const id = Number(userId || 0);
  return id > 0 ? { user_id: id, role } : null;
};

const buildReviewTargets = (detail: V2OrderDetail | null, currentUserId: number): ReviewTarget[] => {
  if (!detail || !currentUserId) return [];
  const participants = detail.participants || {};
  const client = participants.client || detail.client || fallbackParty(detail.contract?.client_user_id, 'client');
  const provider = participants.provider || detail.provider || fallbackParty(detail.provider_user_id, 'owner');
  const executor = participants.executor || detail.executor || fallbackParty(detail.executor_pilot_user_id, 'pilot');
  const targets: ReviewTarget[] = [];

  const pushTarget = (
    party: OrderPartySummary | null | undefined,
    role: ReviewTargetRole,
    label: string,
  ) => {
    if (!party?.user_id || party.user_id === currentUserId) return;
    targets.push({
      userId: party.user_id,
      role,
      label,
      subtitle: buildTargetSummary(party, label),
    });
  };

  pushTarget(client, 'client', '客户');
  pushTarget(provider, 'owner', '承接方');
  pushTarget(executor, 'pilot', '履约方');

  const unique = new Map<string, ReviewTarget>();
  targets.forEach((item) => unique.set(`${item.role}:${item.userId}`, item));
  return Array.from(unique.values());
};

const normalizeReviewItems = (res: any): V2ReviewSummary[] => {
  const data = res?.data || res;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data)) return data;
  return [];
};

export default function ReviewPage() {
  const params = Taro.getCurrentInstance().router?.params || {};
  const orderId = Number(params.orderId || params.id || 0);
  const currentUserId = Number(store.getState().auth.user?.id || 0);
  const [detail, setDetail] = useState<V2OrderDetail | null>(null);
  const [reviews, setReviews] = useState<V2ReviewSummary[]>([]);
  const [rating, setRating] = useState(5);
  const [content, setContent] = useState('');
  const [selectedTargetKey, setSelectedTargetKey] = useState('');
  const [loading, setLoading] = useState(Boolean(orderId));
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorText, setErrorText] = useState('');

  const load = useCallback(async () => {
    if (!orderId) {
      setDetail(null);
      setReviews([]);
      setErrorText('缺少订单信息，无法评价');
      setLoading(false);
      setRefreshing(false);
      return;
    }
    if (!store.getState().auth.accessToken) {
      setDetail(null);
      setReviews([]);
      setErrorText('请先登录后评价订单');
      setLoading(false);
      setRefreshing(false);
      return;
    }
    setErrorText('');
    try {
      const [detailRes, reviewRes] = await Promise.all([
        orderV2Service.get(orderId),
        orderFinanceV2Service.listReviews(orderId),
      ]);
      setDetail(((detailRes as any)?.data || detailRes) as V2OrderDetail);
      setReviews(normalizeReviewItems(reviewRes));
    } catch (e: any) {
      setDetail(null);
      setReviews([]);
      setErrorText(friendlyErrorMessage(e, '评价信息加载失败'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [orderId]);

  useDidShow(() => {
    load();
  });

  const targets = useMemo(
    () => buildReviewTargets(detail, currentUserId),
    [currentUserId, detail],
  );
  const existingMyReview = useMemo(
    () => reviews.find((item) => Number(item.reviewer_user_id) === currentUserId) || null,
    [currentUserId, reviews],
  );
  const selectedTarget = useMemo(
    () => targets.find((item) => `${item.role}:${item.userId}` === selectedTargetKey) || null,
    [selectedTargetKey, targets],
  );
  const canReview = !!detail && detail.status === 'completed' && !existingMyReview;

  useEffect(() => {
    if (selectedTargetKey && targets.some((item) => `${item.role}:${item.userId}` === selectedTargetKey)) {
      return;
    }
    setSelectedTargetKey(targets[0] ? `${targets[0].role}:${targets[0].userId}` : '');
  }, [selectedTargetKey, targets]);

  const refresh = () => {
    setRefreshing(true);
    load();
  };

  const handleSubmit = async () => {
    if (submitting) return;
    if (!detail || !canReview) {
      Taro.showToast({ title: existingMyReview ? '你已评价过该订单' : '订单完成后才能评价', icon: 'none' });
      return;
    }
    if (!selectedTarget) {
      Taro.showToast({ title: '请选择评价对象', icon: 'none' });
      return;
    }
    if (rating < 1 || rating > 5) {
      Taro.showToast({ title: '请选择评分', icon: 'none' });
      return;
    }
    const trimmedContent = content.trim();
    if (!trimmedContent) {
      Taro.showToast({ title: '请输入评价内容', icon: 'none' });
      return;
    }
    setSubmitting(true);
    try {
      await orderFinanceV2Service.createReview(detail.id, {
        target_user_id: selectedTarget.userId,
        target_role: selectedTarget.role,
        rating,
        content: trimmedContent,
      });
      Taro.showToast({ title: '评价成功', icon: 'success' });
      setContent('');
      await load();
    } catch (e: any) {
      Taro.showToast({ title: friendlyErrorMessage(e, '评价失败'), icon: 'none' });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View className="review-wrap review-center">
        <Text className="review-state-title">正在加载评价信息</Text>
        <Text className="review-state-desc">加载中…</Text>
      </View>
    );
  }

  if (!detail) {
    return (
      <View className="review-wrap review-center">
        <Text className="review-state-title">无法评价订单</Text>
        <Text className="review-state-desc">{errorText || '订单不存在或当前账号无权查看。'}</Text>
      </View>
    );
  }

  return (
    <ScrollView
      scrollY
      className="review-wrap"
      enhanced
      showScrollbar={false}
      refresherEnabled
      refresherTriggered={refreshing}
      onRefresherRefresh={refresh}
    >
      <View className="review-content">
        <View className="review-hero">
          <Text className="review-order-no">{detail.order_no}</Text>
          <Text className="review-title">订单评价</Text>
          <Text className="review-subtitle">
            评价会写入当前订单，并参与承接方后续评分统计。
          </Text>
        </View>

        <View className="review-card">
          <Text className="section-title">订单摘要</Text>
          <View className="review-info-row">
            <Text className="review-info-label">订单标题</Text>
            <Text className="review-info-value" numberOfLines={1}>{detail.title || '吊运订单'}</Text>
          </View>
          <View className="review-info-row">
            <Text className="review-info-label">当前状态</Text>
            <Text className="review-info-value">{statusLabelOf(detail.status)}</Text>
          </View>
          <View className="review-info-row">
            <Text className="review-info-label">客户</Text>
            <Text className="review-info-value" numberOfLines={1}>
              {buildTargetSummary(detail.participants?.client || detail.client, '客户')}
            </Text>
          </View>
          <View className="review-info-row">
            <Text className="review-info-label">承接方</Text>
            <Text className="review-info-value" numberOfLines={1}>
              {buildTargetSummary(detail.participants?.provider || detail.provider, '承接方')}
            </Text>
          </View>
          <View className="review-info-row review-info-row-last">
            <Text className="review-info-label">履约方</Text>
            <Text className="review-info-value" numberOfLines={1}>
              {buildTargetSummary(detail.participants?.executor || detail.executor, '未安排')}
            </Text>
          </View>
        </View>

        <View className="review-card">
          <Text className="section-title">提交评价</Text>
          {!canReview ? (
            <View className="review-empty">
              <Text className="review-empty-title">
                {existingMyReview ? '你已经评价过这笔订单' : '订单完成后才能评价'}
              </Text>
              <Text className="review-empty-desc">
                {existingMyReview
                  ? '当前账号对同一订单只保留一条评价，可在下方查看记录。'
                  : `当前订单状态为「${statusLabelOf(detail.status)}」，完成后再提交评价。`}
              </Text>
            </View>
          ) : targets.length === 0 ? (
            <View className="review-empty">
              <Text className="review-empty-title">未找到可评价参与方</Text>
              <Text className="review-empty-desc">当前订单缺少客户、承接方或履约信息，请先确认订单参与方已同步。</Text>
            </View>
          ) : (
            <>
              <Text className="review-label">评价对象</Text>
              <View className="review-target-list">
                {targets.map((target) => {
                  const key = `${target.role}:${target.userId}`;
                  const active = selectedTargetKey === key;
                  return (
                    <View
                      key={key}
                      className={`review-target ${active ? 'review-target-active' : ''}`}
                      onClick={() => setSelectedTargetKey(key)}
                    >
                      <Text className={`review-target-title ${active ? 'review-target-title-active' : ''}`}>
                        {target.label}
                      </Text>
                      <Text className={`review-target-desc ${active ? 'review-target-desc-active' : ''}`}>
                        {target.subtitle}
                      </Text>
                    </View>
                  );
                })}
              </View>

              <Text className="review-label">评分</Text>
              <View className="review-stars-row">
                {[1, 2, 3, 4, 5].map((i) => (
                  <View
                    key={i}
                    className={`review-star ${i <= rating ? 'review-star-active' : ''}`}
                    onClick={() => setRating(i)}
                  >
                    <Text className={`review-star-text ${i <= rating ? 'review-star-text-active' : ''}`}>
                      ★
                    </Text>
                  </View>
                ))}
                <Text className="review-rating-hint">{rating} / 5</Text>
              </View>

              <Text className="review-label">评价内容</Text>
              <Textarea
                className="review-textarea"
                value={content}
                onInput={(e) => setContent(e.detail.value)}
                placeholder="请描述本次履约体验、沟通质量或执行表现..."
                maxlength={500}
              />
              <Text className="review-count">{content.length}/500</Text>

              <View
                className={`review-submit-btn ${submitting || !selectedTarget ? 'review-submit-disabled' : ''}`}
                onClick={handleSubmit}
              >
                <Text className="review-submit-text">{submitting ? '提交中...' : '提交评价'}</Text>
              </View>
            </>
          )}
        </View>

        <View className="review-card">
          <Text className="section-title">评价记录</Text>
          {reviews.length === 0 ? (
            <Text className="review-record-empty">当前还没有评价记录。</Text>
          ) : (
            reviews.map((item) => (
              <View key={item.id} className="review-record">
                <View className="review-record-head">
                  <Text className="review-record-title">评价对象：{roleLabelOf(item.target_role)}</Text>
                  <Text className={`review-record-score ${item.rating >= 4 ? 'review-record-score-good' : ''}`}>
                    {item.rating} 分
                  </Text>
                </View>
                <Text className="review-record-content">{item.content}</Text>
                <Text className="review-record-meta">提交时间：{formatDateTime(item.created_at)}</Text>
              </View>
            ))
          )}
        </View>
      </View>
    </ScrollView>
  );
}
