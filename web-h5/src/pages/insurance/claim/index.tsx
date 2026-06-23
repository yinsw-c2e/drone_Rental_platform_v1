import Taro, { useDidShow } from '@tarojs/taro';
import React, { useState } from 'react';
import { View, Text, ScrollView } from '@tarojs/components';
import { insuranceService, getClaimStatusText } from '../../../services/insurance';
import './index.scss';

const STATUS_TONE: Record<string, string> = {
  reported: 'orange',
  investigating: 'blue',
  liability_determined: 'blue',
  approved: 'green',
  rejected: 'red',
  paid: 'green',
  closed: 'gray',
  disputed: 'red',
};

const INCIDENT_MAP: Record<string, string> = {
  crash: '坠机', collision: '碰撞', cargo_damage: '货物损坏',
  cargo_loss: '货物丢失', personal_injury: '人身伤害', third_party: '第三方损失',
};

export default function ClaimPage() {
  const [claims, setClaims] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useDidShow(() => {
    setLoading(true);
    insuranceService.getMyClaims({ page: 1, page_size: 50 }).then(res => {
      setClaims(res.data?.list || res.list || res.data || []);
    }).catch(() => {}).finally(() => setLoading(false));
  });

  return (
    <ScrollView scrollY className="page-wrap">
      {loading ? (
        <View className="empty"><Text className="empty-text">加载中...</Text></View>
      ) : claims.length === 0 ? (
        <View className="empty"><Text className="empty-text">暂无理赔数据</Text></View>
      ) : (
        claims.map(item => {
          const tone = STATUS_TONE[item.status] || 'gray';
          return (
            <View key={item.id} className="c-card">
              <View className="c-header">
                <Text className="c-title">{INCIDENT_MAP[item.incident_type] || item.incident_type}理赔</Text>
                <View className={`badge badge-${tone}`}><Text className={`badge-text text-${tone}`}>{getClaimStatusText(item.status)}</Text></View>
              </View>

              <View className="c-info-row">
                <Text className="c-label">保单号</Text>
                <Text className="c-value">{item.policy_no}</Text>
              </View>
              <View className="c-info-row">
                <Text className="c-label">出险时间</Text>
                <Text className="c-value">{new Date(item.incident_time).toLocaleString()}</Text>
              </View>
              <View className="c-info-row">
                <Text className="c-label">索赔金额</Text>
                <Text className="c-value" style={{ color: '#EF4444' }}>¥{(item.claim_amount / 100).toFixed(2)}</Text>
              </View>

              <View className="c-footer">
                <Text className="c-no">赔案号: {item.claim_no}</Text>
              </View>
            </View>
          );
        })
      )}
    </ScrollView>
  );
}
