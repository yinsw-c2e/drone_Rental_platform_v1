import Taro, { useDidShow } from '@tarojs/taro';
import React, { useState } from 'react';
import { View, Text, ScrollView } from '@tarojs/components';
import { useSelector } from 'react-redux';
import { RootState } from '../../../store/store';
import { supplyService } from '../../../services/supply';
import { SupplyDetail } from '../../../types';
import { getObjectStatusMeta, getSupplySceneLabel } from '../../../utils';
import './index.scss';

const formatMoney = (v?: number) => `¥${((v || 0) / 100).toFixed(2)}`;
const PRICING_UNITS: Record<string, string> = { per_trip: '/架次', per_km: '/公里', per_hour: '/小时', per_kg: '/公斤' };

function Row({ l, v }: { l: string; v: string }) {
  return <View className="detail-row"><Text className="detail-row-label">{l}</Text><Text className="detail-row-value">{v || '-'}</Text></View>;
}

export default function SupplyDetailPage() {
  const user = useSelector((state: RootState) => state.auth.user);
  const roleSummary = useSelector((state: RootState) => state.auth.roleSummary);
  const params = Taro.getCurrentInstance().router?.params || {};
  const supplyId = Number(params.id || params.supplyId || 0);

  const [supply, setSupply] = useState<SupplyDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useDidShow(() => {
    if (!supplyId) { setLoading(false); return; }
    supplyService.getById(supplyId).then(res => setSupply(res as any)).catch(() => {}).finally(() => setLoading(false));
  });

  if (loading) return <View style={{ padding: '60px', textAlign: 'center' }}><Text>加载中...</Text></View>;
  if (!supply) return <View style={{ padding: '60px', textAlign: 'center' }}><Text>服务不存在</Text></View>;

  const isMySupply = (supply as any).owner_user_id === user?.id;
  const canOrder = !isMySupply && roleSummary?.has_client_role && supply.status === 'active' && supply.accepts_direct_order;
  const ownerUserId = Number((supply as any).owner_user_id || supply.owner?.id || 0);
  const canContactOwner = ownerUserId > 0 && ownerUserId !== user?.id;
  const ownerLabel = supply.owner?.nickname || `机主 #${(supply as any).owner_user_id}`;
  const droneLabel = supply.drone ? `${supply.drone.brand} ${supply.drone.model}` : '未关联设备';
  const statusMeta = getObjectStatusMeta('supply', supply.status);
  const sceneLabel = (supply.cargo_scenes || []).map((s: string) => getSupplySceneLabel(s)).join(' / ') || '重载吊运';

  const handleContactOwner = () => {
    if (!ownerUserId) {
      Taro.showToast({ title: '该服务暂未提供可联系的机主账号', icon: 'none' });
      return;
    }
    if (ownerUserId === user?.id) {
      Taro.showToast({ title: '这是您自己的服务', icon: 'none' });
      return;
    }
    Taro.navigateTo({
      url: `/pages/chat/index?peerId=${ownerUserId}&peerName=${encodeURIComponent(ownerLabel)}&peerAvatar=${encodeURIComponent(supply.owner?.avatar_url || '')}`,
    });
  };

  return (
    <View className="supply-detail-page">
      <ScrollView className="supply-detail-scroll" scrollY>
        <View className="supply-detail-content">
        <View className="supply-hero">
          <View className="supply-hero-top">
            <View className="supply-hero-tags">
              <Text className="supply-tag supply-tag-source">服务供给</Text>
              <Text className="supply-tag supply-tag-status">{statusMeta.label}</Text>
            </View>
            <Text className="supply-hero-no">{supply.supply_no}</Text>
          </View>
          <Text className="supply-hero-title">{supply.title}</Text>
          <View className="supply-hero-price-row">
            <Text className="supply-hero-price">{formatMoney(supply.base_price_amount)}{PRICING_UNITS[supply.pricing_unit] || ''}</Text>
            {supply.accepts_direct_order && <Text className="supply-hero-direct-tag">支持直达下单</Text>}
          </View>
        </View>

        <View className="card supply-section-card">
          <Text className="section-title">机组与能力</Text>
          <View className="supply-owner-row">
            <View className="supply-owner-avatar"><Text className="supply-owner-avatar-text">{ownerLabel.charAt(0)}</Text></View>
            <View className="supply-owner-info">
              <Text className="supply-owner-name">{ownerLabel}</Text>
              <Text className="supply-owner-sub">{droneLabel}</Text>
            </View>
          </View>
          <View className="supply-grid">
            <View className="supply-metric-row">
              <View className="supply-grid-item">
                <Text className="supply-grid-label">起飞重量</Text>
                <Text className="supply-grid-value">{supply.mtow_kg || 0}kg</Text>
              </View>
              <View className="supply-grid-item">
                <Text className="supply-grid-label">最大吊重</Text>
                <Text className="supply-grid-value">{supply.max_payload_kg || 0}kg</Text>
              </View>
            </View>
            <View className="supply-scene-row">
              <Text className="supply-grid-label">作业场景</Text>
              <Text className="supply-scene-value">{sceneLabel}</Text>
            </View>
          </View>
        </View>

        <View className="card">
          <Text className="section-title">服务范围</Text>
          <Row l="覆盖地区" v={(supply as any).service_area_snapshot?.region || '-'} />
          <Row l="计价规则" v={`${formatMoney(supply.base_price_amount)}${PRICING_UNITS[supply.pricing_unit] || ''}`} />
        </View>

        <View className="card">
          <Text className="section-title">服务说明</Text>
          <Text className="supply-desc">{supply.description || '机主未提供详细文字说明。'}</Text>
        </View>
        </View>
      </ScrollView>

      <View className="supply-footer">
        {isMySupply ? (
          <View className="supply-footer-btn supply-footer-btn-primary" style={{ flex: 1 }} onClick={() => Taro.navigateTo({ url: '/pages/profile/my-offers/index' })}>
            <Text className="supply-footer-btn-primary-text">管理我的服务</Text>
          </View>
        ) : (
          <>
            <View
              className={`supply-footer-btn supply-footer-btn-secondary ${!canContactOwner ? 'supply-footer-btn-disabled' : ''}`}
              onClick={handleContactOwner}
            >
              <Text className="supply-footer-btn-secondary-text">联系机主</Text>
            </View>
            <View className={`supply-footer-btn supply-footer-btn-primary ${!canOrder ? 'supply-footer-btn-disabled' : ''}`}
              onClick={() => canOrder && Taro.navigateTo({ url: `/pages/publish/quick-order/index?supplyId=${supplyId}` })}>
              <Text className="supply-footer-btn-primary-text">立即下单</Text>
            </View>
          </>
        )}
      </View>
    </View>
  );
}
