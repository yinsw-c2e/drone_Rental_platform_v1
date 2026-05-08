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
  const ownerLabel = supply.owner?.nickname || `机主 #${(supply as any).owner_user_id}`;
  const droneLabel = supply.drone ? `${supply.drone.brand} ${supply.drone.model}` : '未关联设备';
  const statusMeta = getObjectStatusMeta('supply', supply.status);

  return (
    <View style={{ flex: 1, backgroundColor: '#F5F7FA' }}>
      <ScrollView scrollY >
        {/* Hero */}
        <View className="supply-hero">
          <View className="supply-hero-top">
            <View className="supply-hero-tags">
              <Text style={{ fontSize: '11px', fontWeight: '700', background: '#E6F4FF', color: '#1677FF', padding: '4px 8px', borderRadius: '6px' }}>服务供给</Text>
              <Text style={{ fontSize: '11px', fontWeight: '700', background: '#F6FFED', color: '#52C41A', padding: '4px 8px', borderRadius: '6px' }}>{statusMeta.label}</Text>
            </View>
            <Text className="supply-hero-no">{supply.supply_no}</Text>
          </View>
          <Text className="supply-hero-title">{supply.title}</Text>
          <View className="supply-hero-price-row">
            <Text className="supply-hero-price">{formatMoney(supply.base_price_amount)}{PRICING_UNITS[supply.pricing_unit] || ''}</Text>
            {supply.accepts_direct_order && <Text className="supply-hero-direct-tag">支持直达下单</Text>}
          </View>
        </View>

        {/* Owner & Drone */}
        <View className="card" style={{ marginTop: '12px' }}>
          <Text className="section-title">机组与能力</Text>
          <View className="supply-owner-row">
            <View className="supply-owner-avatar"><Text className="supply-owner-avatar-text">{ownerLabel.charAt(0)}</Text></View>
            <View>
              <Text className="supply-owner-name">{ownerLabel}</Text>
              <Text className="supply-owner-sub">{droneLabel}</Text>
            </View>
          </View>
          <View className="supply-grid">
            <View className="supply-grid-item">
              <Text className="supply-grid-label">起飞重量</Text>
              <Text className="supply-grid-value">{supply.mtow_kg || 0}kg</Text>
            </View>
            <View className="supply-grid-item">
              <Text className="supply-grid-label">最大吊重</Text>
              <Text className="supply-grid-value">{supply.max_payload_kg || 0}kg</Text>
            </View>
            <View className="supply-grid-item">
              <Text className="supply-grid-label">作业场景</Text>
              <Text className="supply-grid-value">{(supply.cargo_scenes || []).map((s: string) => getSupplySceneLabel(s)).join('/') || '重载吊运'}</Text>
            </View>
          </View>
        </View>

        {/* Service area */}
        <View className="card">
          <Text className="section-title">服务范围</Text>
          <Row l="覆盖地区" v={(supply as any).service_area_snapshot?.region || '-'} />
          <Row l="计价规则" v={`${formatMoney(supply.base_price_amount)}${PRICING_UNITS[supply.pricing_unit] || ''}`} />
        </View>

        {/* Description */}
        <View className="card">
          <Text className="section-title">服务说明</Text>
          <Text style={{ fontSize: '14px', lineHeight: '22px', color: '#6B7280' }}>{supply.description || '机主未提供详细文字说明。'}</Text>
        </View>
      </ScrollView>

      {/* Footer */}
      <View className="supply-footer" style={{ paddingBottom: '24px' }}>
        {isMySupply ? (
          <View className="supply-footer-btn supply-footer-btn-primary" style={{ flex: 1 }} onClick={() => Taro.navigateTo({ url: '/pages/profile/my-offers/index' })}>
            <Text style={{ color: '#FFF', fontSize: '15px', fontWeight: '800' }}>管理我的服务</Text>
          </View>
        ) : (
          <>
            <View className="supply-footer-btn supply-footer-btn-secondary">
              <Text style={{ color: '#1A1D26', fontSize: '15px', fontWeight: '700' }}>联系机主</Text>
            </View>
            <View className={`supply-footer-btn supply-footer-btn-primary ${!canOrder ? 'supply-footer-btn-disabled' : ''}`}
              onClick={() => canOrder && Taro.navigateTo({ url: `/pages/supply/detail/index?supplyId=${supplyId}` })}>
              <Text style={{ color: '#FFF', fontSize: '15px', fontWeight: '800' }}>立即下单</Text>
            </View>
          </>
        )}
      </View>
    </View>
  );
}
