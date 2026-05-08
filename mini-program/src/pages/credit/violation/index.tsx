import Taro, { useDidShow } from '@tarojs/taro';
import React, { useState } from 'react';
import { View, Text, ScrollView } from '@tarojs/components';
import { creditService, getViolationLevelText, getViolationTypeText } from '../../../services/credit';
import { formatUnknownEnumLabel } from '../../../utils';
import './index.scss';

const STATUS_MAP: Record<string, { label: string; tone: string }> = {
  pending: { label: '待处理', tone: 'orange' },
  confirmed: { label: '已确认', tone: 'red' },
  appealing: { label: '申诉中', tone: 'blue' },
  revoked: { label: '已撤销', tone: 'green' },
};

export default function ViolationPage() {
  const [violations, setViolations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useDidShow(() => {
    setLoading(true);
    creditService.getMyViolations({ page: 1, page_size: 50 }).then(res => {
      setViolations(res.data?.list || res.list || res.data || []);
    }).catch(() => {}).finally(() => setLoading(false));
  });

  return (
    <ScrollView scrollY className="page-wrap">
      {loading ? (
        <View className="empty"><Text className="empty-text">加载中...</Text></View>
      ) : violations.length === 0 ? (
        <View className="empty"><Text className="empty-text">暂无违规记录，继续保持！</Text></View>
      ) : (
        violations.map(item => {
          const statusInfo = STATUS_MAP[item.status] || { label: formatUnknownEnumLabel(item.status, '状态未知'), tone: 'gray' };
          return (
            <View key={item.id} className="v-card">
              <View className="v-header">
                <Text className="v-title">{getViolationTypeText(item.violation_type)} ({getViolationLevelText(item.violation_level)})</Text>
                <View className={`badge badge-${statusInfo.tone}`}><Text className={`badge-text text-${statusInfo.tone}`}>{statusInfo.label}</Text></View>
              </View>
              <Text className="v-desc">{item.description}</Text>
              <View className="v-meta-row">
                <Text className="v-meta">扣分: <Text style={{ color: '#EF4444' }}>-{item.score_deduction}</Text></Text>
                {item.fine_amount > 0 && <Text className="v-meta">罚款: <Text style={{ color: '#EF4444' }}>¥{(item.fine_amount / 100).toFixed(2)}</Text></Text>}
              </View>
              <View className="v-footer">
                <Text className="v-time">{new Date(item.created_at).toLocaleString()}</Text>
                <Text className="v-no">单号: {item.violation_no}</Text>
              </View>
            </View>
          );
        })
      )}
    </ScrollView>
  );
}
