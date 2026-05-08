import Taro, { useDidShow } from '@tarojs/taro';
import React, { useState } from 'react';
import { View, Text, Textarea } from '@tarojs/components';
import { orderFinanceV2Service } from '../../services/orderFinanceV2';
import './index.scss';

export default function ReviewPage() {
  const params = Taro.getCurrentInstance().router?.params || {};
  const orderId = Number(params.orderId || params.id || 0);
  const [rating, setRating] = useState(0);
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (rating === 0) { Taro.showToast({ title: '请选择评分', icon: 'none' }); return; }
    setSubmitting(true);
    try {
      await orderFinanceV2Service.createReview(orderId, {
        target_user_id: 0, target_role: 'owner', rating, content: content.trim(),
      });
      Taro.showToast({ title: '评价成功', icon: 'success' });
      setTimeout(() => Taro.navigateBack(), 1200);
    } catch (e: any) {
      Taro.showToast({ title: e.message || '评价失败', icon: 'none' });
    } finally { setSubmitting(false); }
  };

  return (
    <View className="review-wrap">
      <View className="card">
        <Text className="section-title">订单评价</Text>

        {/* ── 5星评分 ── */}
        <Text className="review-label">评分</Text>
        <View className="review-stars-row">
          {[1, 2, 3, 4, 5].map(i => (
            <View key={i} className={`review-star ${i <= rating ? 'review-star-active' : ''}`}
              onClick={() => setRating(i)}>
              <Text className={`review-star-text ${i <= rating ? 'review-star-text-active' : ''}`}>
                {i <= rating ? '★' : '☆'}
              </Text>
            </View>
          ))}
          {rating > 0 && <Text className="review-rating-hint">{rating} / 5</Text>}
        </View>

        {/* ── 评价内容 ── */}
        <Text className="review-label">评价内容</Text>
        <Textarea
          className="review-textarea"
          value={content}
          onInput={e => setContent(e.detail.value)}
          placeholder="分享你的体验，帮助其他用户了解服务质量..."
          maxlength={500}
        />

        {/* ── 提交 ── */}
        <View className={`review-submit-btn ${submitting ? 'review-submit-disabled' : ''}`}
          onClick={handleSubmit}>
          <Text className="review-submit-text">{submitting ? '提交中...' : '提交评价'}</Text>
        </View>
      </View>
    </View>
  );
}
