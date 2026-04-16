import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
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
import {QuickOrderDraft, SupplyDetail} from '../../types';
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

function summarizeDraftAddress(address?: QuickOrderDraft['departure_address']): string {
  if (!address) {
    return '待补充';
  }
  return address.name || address.address || '待补充';
}

function summarizeDraftTimeRange(draft?: QuickOrderDraft): string {
  if (!draft?.scheduled_start_at || !draft?.scheduled_end_at) {
    return '待与机主确认';
  }
  return `${draft.scheduled_start_at.slice(0, 16).replace('T', ' ')} - ${draft.scheduled_end_at
    .slice(0, 16)
    .replace('T', ' ')}`;
}

export default function OfferDetailScreen({route, navigation}: any) {
  const {theme} = useTheme();
  const styles = getStyles(theme);
  const {id, quickOrderDraft, quickOrder} = route.params;
  const draft = (quickOrderDraft ||
    (quickOrder
      ? {
          cargo_scene: quickOrder.cargoScene,
          cargo_weight_kg: Number(quickOrder.cargoWeight) || undefined,
          departure_address: quickOrder.pickupAddress,
          destination_address: quickOrder.deliveryAddress,
        }
      : undefined)) as QuickOrderDraft | undefined;
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
      Alert.alert('获取失败', error.message || '获取服务详情失败');
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
      paused: '暂停服务',
      closed: '关闭服务',
    };

    Alert.alert('确认操作', `确认${actionTextMap[status] || '更新服务状态'}？`, [
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
              title="服务信息不存在"
              description="这条服务可能已下架，或当前账号无权查看。"
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
      {draft ? (
        <View style={styles.contextHeader}>
          <View style={styles.contextRow}>
            <Text style={styles.contextIcon}>📍</Text>
            <Text style={styles.contextText} numberOfLines={1}>
              {summarizeDraftAddress(draft.departure_address)} → {summarizeDraftAddress(draft.destination_address)}
            </Text>
          </View>
          <View style={styles.contextDivider} />
          <View style={styles.contextRow}>
            <Text style={styles.contextIcon}>📦</Text>
            <Text style={styles.contextText}>{draft.cargo_weight_kg || '--'}kg {draft.cargo_type || '物资'}</Text>
          </View>
        </View>
      ) : (
        <View style={styles.stepHeader}>
          <View style={styles.stepTrack}>
            <View style={[styles.stepDot, styles.stepDotCompleted]} />
            <View style={[styles.stepLine, styles.stepLineCompleted]} />
            <View style={[styles.stepDot, styles.stepDotCompleted]} />
            <View style={[styles.stepLine, styles.stepLineCompleted]} />
            <View style={[styles.stepDot, styles.stepDotActive]} />
          </View>
          <View style={styles.stepLabels}>
            <Text style={[styles.stepLabelText, styles.stepLabelTextCompleted]}>填写信息</Text>
            <Text style={[styles.stepLabelText, styles.stepLabelTextCompleted]}>挑选服务</Text>
            <Text style={[styles.stepLabelText, styles.stepLabelTextActive]}>确认下单</Text>
          </View>
        </View>
      )}

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
          <View style={styles.priceRow}>
            <Text style={styles.price}>{formatSupplyPricing(supply.base_price_amount, supply.pricing_unit)}</Text>
            {supply.accepts_direct_order && (
              <View style={styles.directTag}>
                <Text style={styles.directTagText}>支持直达下单</Text>
              </View>
            )}
          </View>
        </ObjectCard>

        <ObjectCard>
          <Text style={styles.sectionTitle}>机组与能力</Text>
          <View style={styles.ownerRow}>
            <View style={styles.ownerAvatar}>
              <Text style={styles.avatarText}>{ownerLabel.charAt(0)}</Text>
            </View>
            <View>
              <Text style={styles.ownerName}>{ownerLabel}</Text>
              <Text style={styles.ownerSub}>{droneLabel}</Text>
            </View>
          </View>
          <View style={styles.grid}>
            <View style={styles.gridItem}>
              <Text style={styles.gridLabel}>起飞重量</Text>
              <Text style={styles.gridValue}>{supply.mtow_kg || 0}kg</Text>
            </View>
            <View style={styles.gridItem}>
              <Text style={styles.gridLabel}>最大吊重</Text>
              <Text style={styles.gridValue}>{supply.max_payload_kg || 0}kg</Text>
            </View>
            <View style={styles.gridItem}>
              <Text style={styles.gridLabel}>作业场景</Text>
              <Text style={styles.gridValue} numberOfLines={1}>
                {(supply.cargo_scenes || []).map(s => getSupplySceneLabel(s)).join('/') || '重载吊运'}
              </Text>
            </View>
          </View>
        </ObjectCard>

        <ObjectCard>
          <Text style={styles.sectionTitle}>服务范围</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>覆盖地区</Text>
            <Text style={styles.infoValue}>{serviceAreaText}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>计价规则</Text>
            <Text style={styles.infoValue}>{pricingRuleText}</Text>
          </View>
        </ObjectCard>

        <ObjectCard>
          <Text style={styles.sectionTitle}>服务说明</Text>
          <Text style={styles.description}>{supply.description || '机主未提供详细文字说明。'}</Text>
        </ObjectCard>
      </ScrollView>

      <View style={styles.footer}>
        {isMySupply ? (
          <TouchableOpacity
            style={[styles.primaryBtn, styles.footerBtn]}
            onPress={() => navigation.navigate('MyOffers')}>
            <Text style={styles.primaryBtnText}>管理我的服务</Text>
          </TouchableOpacity>
        ) : (
          <>
            <TouchableOpacity
              style={[styles.secondaryBtn, {flex: 1}]}
              onPress={() => {
                navigation.navigate('Messages', {
                  screen: 'Chat',
                  params: {
                    peerId: supply.owner?.id || 0,
                    peerName: supply.owner?.nickname || '机主',
                  },
                });
              }}>
              <Text style={styles.secondaryBtnText}>联系机主</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.primaryBtn, {flex: 2}, !canCreateDirectOrder && styles.disabledBtn]}
              onPress={() => navigation.navigate('SupplyDirectOrderConfirm', {supply, quickOrderDraft: draft})}
              disabled={!canCreateDirectOrder}>
              <Text style={styles.primaryBtnText}>
                {draft ? '确认并继续' : '立即下单'}
              </Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const getStyles = (theme: AppTheme) => StyleSheet.create({
  container: {flex: 1, backgroundColor: theme.bg},
  contextHeader: {
    backgroundColor: theme.bgSecondary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: theme.divider,
  },
  contextRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  contextIcon: {
    fontSize: 12,
    marginRight: 6,
  },
  contextText: {
    fontSize: 11,
    color: theme.textSub,
    fontWeight: '700',
  },
  contextDivider: {
    width: 1,
    height: 12,
    backgroundColor: theme.divider,
    marginHorizontal: 10,
  },
  stepHeader: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: theme.bg,
    borderBottomWidth: 1,
    borderBottomColor: theme.divider,
  },
  stepTrack: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.divider,
  },
  stepDotActive: {
    backgroundColor: theme.primary,
    width: 10,
    height: 10,
  },
  stepDotCompleted: {
    backgroundColor: theme.primary,
  },
  stepLine: {
    width: 50,
    height: 2,
    backgroundColor: theme.divider,
    marginHorizontal: 4,
  },
  stepLineCompleted: {
    backgroundColor: theme.primary,
  },
  stepLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  stepLabelText: {
    fontSize: 10,
    color: theme.textHint,
    fontWeight: '600',
  },
  stepLabelTextActive: {
    color: theme.primary,
    fontWeight: '700',
  },
  stepLabelTextCompleted: {
    color: theme.textSub,
  },
  content: {padding: 16, paddingBottom: 100, gap: 12},
  loading: {paddingTop: 120},
  emptyWrap: {padding: 14, paddingTop: 48},
  heroCard: {
    backgroundColor: theme.card,
    borderRadius: 24,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  heroTop: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'},
  heroTags: {flexDirection: 'row', gap: 6},
  supplyNo: {fontSize: 10, color: theme.textHint, fontWeight: '700'},
  title: {marginTop: 12, fontSize: 22, lineHeight: 28, color: theme.text, fontWeight: '800'},
  priceRow: {flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12},
  price: {fontSize: 20, color: theme.danger, fontWeight: '800'},
  directTag: {backgroundColor: theme.success + '15', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6},
  directTagText: {fontSize: 10, color: theme.success, fontWeight: '800'},
  sectionTitle: {fontSize: 16, fontWeight: '800', color: theme.text, marginBottom: 16},
  sceneTag: {backgroundColor: theme.primaryBg, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6},
  sceneTagText: {fontSize: 12, color: theme.primaryText, fontWeight: '600'},
  ownerRow: {flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16},
  ownerAvatar: {width: 44, height: 44, borderRadius: 22, backgroundColor: theme.primaryBg, alignItems: 'center', justifyContent: 'center'},
  avatarText: {fontSize: 18, fontWeight: '800', color: theme.primaryText},
  ownerName: {fontSize: 15, fontWeight: '700', color: theme.text},
  ownerSub: {fontSize: 12, color: theme.textSub, marginTop: 2},
  grid: {flexDirection: 'row', backgroundColor: theme.bgSecondary, borderRadius: 16, padding: 14},
  gridItem: {flex: 1, alignItems: 'center'},
  gridLabel: {fontSize: 10, color: theme.textHint, fontWeight: '700', marginBottom: 4},
  gridValue: {fontSize: 14, fontWeight: '800', color: theme.text},
  infoRow: {flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8},
  infoLabel: {fontSize: 13, color: theme.textSub, fontWeight: '600'},
  infoValue: {fontSize: 13, color: theme.text, fontWeight: '700', flex: 1, textAlign: 'right', marginLeft: 12},
  description: {fontSize: 14, lineHeight: 22, color: theme.textSub},
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: 16,
    paddingBottom: Platform.OS === 'ios' ? 32 : 16,
    backgroundColor: theme.card,
    borderTopWidth: 1,
    borderTopColor: theme.divider,
    flexDirection: 'row',
    gap: 12,
  },
  footerBtn: {flex: 1},
  secondaryBtn: {
    height: 52,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.divider,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.card,
  },
  secondaryBtnText: {fontSize: 15, color: theme.text, fontWeight: '700'},
  primaryBtn: {
    height: 52,
    borderRadius: 16,
    backgroundColor: theme.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: theme.primary,
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryBtnText: {fontSize: 15, color: '#FFFFFF', fontWeight: '800'},
  disabledBtn: {opacity: 0.5},
});
