import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {
  ActivityIndicator,
  Alert,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {useSelector} from 'react-redux';

import EmptyState from '../../components/business/EmptyState';
import ObjectCard from '../../components/business/ObjectCard';
import SourceTag from '../../components/business/SourceTag';
import StatusBadge from '../../components/business/StatusBadge';
import {getObjectStatusMeta} from '../../components/business/visuals';
import {supplyService} from '../../services/supply';
import {RootState} from '../../store/store';
import {SupplyDetail} from '../../types';
import {getEffectiveRoleSummary} from '../../utils/roleSummary';
import {
  formatSupplyPricing,
  getSupplySceneLabel,
  summarizeFlexibleValue,
  summarizeServiceArea,
} from '../../utils/supplyMeta';
import {useTheme} from '../../theme/ThemeContext';
import type {AppTheme} from '../../theme/index';

function SceneTag({label}: {label: string}) {
  const {theme} = useTheme();
  const styles = getStyles(theme);
  return (
    <View style={styles.sceneTag}>
      <Text style={styles.sceneTagText}>{label}</Text>
    </View>
  );
}

export default function OfferDetailScreen({route, navigation}: any) {
  const {theme} = useTheme();
  const styles = getStyles(theme);
  const {id} = route.params;
  const {user, roleSummary} = useSelector((state: RootState) => state.auth);

  const [supply, setSupply] = useState<SupplyDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  const effectiveRoleSummary = useMemo(
    () => getEffectiveRoleSummary(roleSummary, user),
    [roleSummary, user],
  );

  const fetchSupply = useCallback(async () => {
    setLoading(true);
    try {
      const res = await supplyService.getById(id);
      setSupply(res.data);
    } catch (error: any) {
      Alert.alert('获取失败', error.message || '获取供给详情失败');
      setSupply(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchSupply();
  }, [fetchSupply]);

  const isMySupply = supply?.owner_user_id === user?.id;
  const canCreateDirectOrder =
    !isMySupply && effectiveRoleSummary.has_client_role && supply?.status === 'active' && supply.accepts_direct_order;

  const handleUpdateStatus = async (status: string) => {
    if (!supply) {
      return;
    }
    const actionTextMap: Record<string, string> = {
      active: '恢复上架',
      paused: '暂停供给',
      closed: '关闭供给',
    };

    Alert.alert('确认操作', `确认${actionTextMap[status] || '更新供给状态'}？`, [
      {text: '取消', style: 'cancel'},
      {
        text: '确认',
        onPress: async () => {
          setUpdatingStatus(true);
          try {
            await supplyService.updateStatus(supply.id, status);
            await fetchSupply();
          } catch (error: any) {
            Alert.alert('操作失败', error.message || '请稍后重试');
          } finally {
            setUpdatingStatus(false);
          }
        },
      },
    ]);
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, {backgroundColor: theme.bg}]}>
        <ActivityIndicator style={styles.loading} color={theme.primary} />
      </SafeAreaView>
    );
  }

  if (!supply) {
    return (
      <SafeAreaView style={[styles.container, {backgroundColor: theme.bg}]}>
        <View style={styles.emptyWrap}>
          <ObjectCard>
            <EmptyState
              icon="🛩️"
              title="供给信息不存在"
              description="这条供给可能已下架，或当前账号无权查看。"
              actionText="返回市场"
              onAction={() => navigation.goBack()}
            />
          </ObjectCard>
        </View>
      </SafeAreaView>
    );
  }

  const ownerLabel = supply.owner?.nickname || `机主 #${supply.owner_user_id}`;
  const droneLabel = supply.drone ? `${supply.drone.brand} ${supply.drone.model}` : '未关联设备';
  const serviceAreaText = summarizeServiceArea(supply.service_area_snapshot);
  const timeSlotText = summarizeFlexibleValue(supply.available_time_slots, '未设置服务时间段');
  const pricingRuleText = summarizeFlexibleValue(supply.pricing_rule, '按基础价格执行');

  return (
    <SafeAreaView style={[styles.container, {backgroundColor: theme.bg}]}>
      <ScrollView contentContainerStyle={styles.content}>
        <ObjectCard style={styles.heroCard}>
          <View style={styles.heroTop}>
            <View style={styles.heroTags}>
              <SourceTag source="supply" />
              <StatusBadge label="" meta={getObjectStatusMeta('supply', supply.status)} />
            </View>
            <Text style={styles.supplyNo}>{supply.supply_no}</Text>
          </View>
          <Text style={styles.title}>{supply.title}</Text>
          <Text style={styles.price}>{formatSupplyPricing(supply.base_price_amount, supply.pricing_unit)}</Text>
          <Text style={styles.heroDesc}>这是一条新版供给对象。客户在这里确认能力和范围后，再发起直达下单。</Text>
        </ObjectCard>

        <ObjectCard>
          <Text style={styles.sectionTitle}>能力信息</Text>
          <View style={styles.sceneRow}>
            {(supply.cargo_scenes || []).length > 0 ? (
              supply.cargo_scenes.map(scene => <SceneTag key={scene} label={getSupplySceneLabel(scene)} />)
            ) : (
              <SceneTag label="未标注场景" />
            )}
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>服务类型</Text>
            <Text style={styles.infoValue}>重载吊运</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>设备摘要</Text>
            <Text style={styles.infoValue}>{droneLabel}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>起飞重量</Text>
            <Text style={styles.infoValue}>{supply.mtow_kg || 0} kg</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>最大吊重</Text>
            <Text style={styles.infoValue}>{supply.max_payload_kg || 0} kg</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>最大航程</Text>
            <Text style={styles.infoValue}>{supply.max_range_km || 0} km</Text>
          </View>
        </ObjectCard>

        <ObjectCard>
          <Text style={styles.sectionTitle}>覆盖范围</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>服务区域</Text>
            <Text style={styles.infoValue}>{serviceAreaText}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>服务时段</Text>
            <Text style={styles.infoValue}>{timeSlotText}</Text>
          </View>
          {supply.drone?.city ? (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>设备所在城市</Text>
              <Text style={styles.infoValue}>{supply.drone.city}</Text>
            </View>
          ) : null}
        </ObjectCard>

        <ObjectCard>
          <Text style={styles.sectionTitle}>价格与规则</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>基础价格</Text>
            <Text style={styles.infoValue}>{formatSupplyPricing(supply.base_price_amount, supply.pricing_unit)}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>计价规则</Text>
            <Text style={styles.infoValue}>{pricingRuleText}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>直达下单</Text>
            <Text style={styles.infoValue}>{supply.accepts_direct_order ? '支持' : '暂不支持'}</Text>
          </View>
        </ObjectCard>

        <ObjectCard>
          <Text style={styles.sectionTitle}>机主与说明</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>机主</Text>
            <Text style={styles.infoValue}>{ownerLabel}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>发布时间</Text>
            <Text style={styles.infoValue}>{supply.created_at?.slice(0, 10) || '-'}</Text>
          </View>
          <Text style={styles.description}>{supply.description || '当前供给暂未补充更详细的说明。'}</Text>
        </ObjectCard>

        {!supply.accepts_direct_order ? (
          <ObjectCard highlightColor={theme.warning + '88'}>
            <Text style={styles.sectionTitle}>下单提醒</Text>
            <Text style={styles.noticeText}>这条供给当前不接受客户直达下单。你可以联系机主沟通需求，或返回市场继续浏览其他供给。</Text>
          </ObjectCard>
        ) : null}
      </ScrollView>

      <View style={styles.footer}>
        {isMySupply ? (
          <>
            <TouchableOpacity style={[styles.secondaryBtn, styles.footerBtn]} onPress={() => navigation.navigate('MyOffers')}>
              <Text style={styles.secondaryBtnText}>我的供给</Text>
            </TouchableOpacity>
            {supply.status === 'active' ? (
              <TouchableOpacity
                style={[styles.primaryBtn, styles.footerBtn, updatingStatus && styles.disabledBtn]}
                onPress={() => handleUpdateStatus('paused')}
                disabled={updatingStatus}>
                <Text style={styles.primaryBtnText}>{updatingStatus ? '处理中...' : '暂停供给'}</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[styles.primaryBtn, styles.footerBtn, updatingStatus && styles.disabledBtn]}
                onPress={() => handleUpdateStatus('active')}
                disabled={updatingStatus}>
                <Text style={styles.primaryBtnText}>{updatingStatus ? '处理中...' : '恢复上架'}</Text>
              </TouchableOpacity>
            )}
          </>
        ) : (
          <>
            <TouchableOpacity
              style={[styles.secondaryBtn, styles.footerBtn]}
              onPress={() => {
                if (!supply.owner?.id) {
                  Alert.alert('暂不可联系', '机主信息暂不完整。');
                  return;
                }
                navigation.navigate('Messages', {
                  screen: 'Chat',
                  params: {
                    peerId: supply.owner.id,
                    peerName: supply.owner.nickname,
                  },
                });
              }}>
              <Text style={styles.secondaryBtnText}>联系机主</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.primaryBtn, styles.footerBtn, !canCreateDirectOrder && styles.disabledBtn]}
              onPress={() => navigation.navigate('SupplyDirectOrderConfirm', {supply})}
              disabled={!canCreateDirectOrder}>
              <Text style={styles.primaryBtnText}>{canCreateDirectOrder ? '发起直达下单' : '当前不可直达下单'}</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const getStyles = (theme: AppTheme) => StyleSheet.create({
  container: {flex: 1, backgroundColor: theme.bgSecondary},
  content: {padding: 14, paddingBottom: 96, gap: 12},
  loading: {paddingTop: 120},
  emptyWrap: {padding: 14, paddingTop: 48},
  heroCard: {backgroundColor: theme.isDark ? 'rgba(0,212,255,0.08)' : theme.primary, borderWidth: theme.isDark ? 1 : 0, borderColor: theme.isDark ? theme.primaryBorder : 'transparent'},
  heroTop: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12},
  heroTags: {flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center'},
  supplyNo: {fontSize: 12, color: theme.isDark ? theme.primaryText : 'rgba(255,255,255,0.7)', fontWeight: '700'},
  title: {marginTop: 14, fontSize: 26, lineHeight: 32, color: theme.isDark ? theme.text : '#FFFFFF', fontWeight: '800'},
  price: {marginTop: 10, fontSize: 18, color: theme.isDark ? '#FFE4C4' : '#fff7e6', fontWeight: '800'},
  heroDesc: {marginTop: 10, fontSize: 13, lineHeight: 20, color: theme.isDark ? theme.textSub : 'rgba(255,255,255,0.85)'},
  sectionTitle: {fontSize: 17, fontWeight: '700', color: theme.text, marginBottom: 10},
  sceneRow: {flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10},
  sceneTag: {backgroundColor: theme.primaryBg, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6},
  sceneTagText: {fontSize: 12, color: theme.primaryText, fontWeight: '600'},
  infoRow: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, marginTop: 8},
  infoLabel: {fontSize: 13, color: theme.textSub},
  infoValue: {flex: 1, textAlign: 'right', fontSize: 14, color: theme.text, fontWeight: '600'},
  description: {marginTop: 10, fontSize: 13, lineHeight: 22, color: theme.text},
  noticeText: {fontSize: 13, lineHeight: 21, color: theme.warning},
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: theme.card,
    borderTopWidth: 1,
    borderTopColor: theme.divider,
    flexDirection: 'row',
    gap: 10,
  },
  footerBtn: {flex: 1},
  secondaryBtn: {
    height: 46,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.primaryBorder,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.primaryBg,
  },
  secondaryBtnText: {fontSize: 15, color: theme.primaryText, fontWeight: '700'},
  primaryBtn: {
    height: 46,
    borderRadius: 12,
    backgroundColor: theme.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryBtnText: {fontSize: 15, color: theme.btnPrimaryText, fontWeight: '700'},
  disabledBtn: {opacity: 0.5},
});
