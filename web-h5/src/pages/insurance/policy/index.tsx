import Taro, { useDidShow } from '@tarojs/taro';
import React, { useState } from 'react';
import { View, Text, ScrollView } from '@tarojs/components';
import { insuranceService, getPolicyTypeText, getPolicyStatusText } from '../../../services/insurance';
import './index.scss';

const STATUS_TONE: Record<string, string> = {
  pending: 'orange',
  active: 'green',
  expired: 'gray',
  cancelled: 'red',
  claimed: 'blue',
};

export default function PolicyPage() {
  const [policies, setPolicies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useDidShow(() => {
    setLoading(true);
    insuranceService.getMyPolicies({ page: 1, page_size: 50 }).then(res => {
      setPolicies(res.data?.list || res.list || res.data || []);
    }).catch(() => {}).finally(() => setLoading(false));
  });

  return (
    <ScrollView scrollY className="page-wrap">
      {loading ? (
        <View className="empty"><Text className="empty-text">加载中...</Text></View>
      ) : policies.length === 0 ? (
        <View className="empty"><Text className="empty-text">暂无保单数据</Text></View>
      ) : (
        policies.map(item => {
          const tone = STATUS_TONE[item.status] || 'gray';
          return (
            <View key={item.id} className="p-card">
              <View className="p-header">
                <Text className="p-title">{getPolicyTypeText(item.policy_type)}</Text>
                <View className={`badge badge-${tone}`}><Text className={`badge-text text-${tone}`}>{getPolicyStatusText(item.status)}</Text></View>
              </View>
              <Text className="p-company">{item.insurer_name} - {item.insurance_product}</Text>

              <View className="p-grid">
                <View className="p-grid-item">
                  <Text className="p-grid-label">保额(元)</Text>
                  <Text className="p-grid-value">{(item.coverage_amount / 100).toFixed(2)}</Text>
                </View>
                <View className="p-grid-item">
                  <Text className="p-grid-label">保费(元)</Text>
                  <Text className="p-grid-value">{(item.premium / 100).toFixed(2)}</Text>
                </View>
                <View className="p-grid-item">
                  <Text className="p-grid-label">被保对象</Text>
                  <Text className="p-grid-value" numberOfLines={1}>{item.insured_name}</Text>
                </View>
              </View>

              <View className="p-footer">
                <Text className="p-time">有效期: {item.effective_from ? new Date(item.effective_from).toLocaleDateString() : '-'} 至 {item.effective_to ? new Date(item.effective_to).toLocaleDateString() : '-'}</Text>
                <Text className="p-no">保单号: {item.policy_no}</Text>
              </View>
            </View>
          );
        })
      )}
    </ScrollView>
  );
}
