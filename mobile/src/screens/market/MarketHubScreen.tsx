import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {useSelector} from 'react-redux';

import EmptyState from '../../components/business/EmptyState';
import {demandV2Service} from '../../services/demandV2';
import {supplyService} from '../../services/supply';
import {RootState} from '../../store/store';
import {DemandSummary, SupplySummary} from '../../types';
import {
  formatDemandBudget,
  formatDemandSchedule,
  getDemandSceneLabel,
  resolveDemandPrimaryAddress,
} from '../../utils/demandMeta';
import {formatSupplyPricing, getSupplySceneLabel} from '../../utils/supplyMeta';
import {getEffectiveRoleSummary} from '../../utils/roleSummary';
import {useTheme} from '../../theme/ThemeContext';
import type {AppTheme} from '../../theme/index';

type MarketTab = 'demand' | 'supply';

export default function MarketHubScreen({navigation}: any) {
  const {theme} = useTheme();
  const styles = getStyles(theme);
  const user = useSelector((state: RootState) => state.auth.user);
  const roleSummary = useSelector((state: RootState) => state.auth.roleSummary);
  const effectiveRoleSummary = useMemo(() => getEffectiveRoleSummary(roleSummary, user), [roleSummary, user]);
  const isClientFocused = effectiveRoleSummary.has_client_role;

  const [activeTab, setActiveTab] = useState<MarketTab>(
    effectiveRoleSummary.has_client_role && !effectiveRoleSummary.has_owner_role && !effectiveRoleSummary.has_pilot_role
      ? 'supply'
      : 'demand',
  );
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [demands, setDemands] = useState<DemandSummary[]>([]);
  const [supplies, setSupplies] = useState<SupplySummary[]>([]);

  const fetchDemands = useCallback(async () => {
    try {
      // 优先展示市场推荐需求
      const res = await demandV2Service.listMarketplaceDemands({page: 1, page_size: 10});
      setDemands(res.data?.items || []);
    } catch (error) {
      console.warn('获取需求流失败:', error);
    }
  }, []);

  const fetchSupplies = useCallback(async () => {
    try {
      // 展示支持直达下单的重载供给
      const res = await supplyService.list({
        page: 1,
        page_size: 10,
        accepts_direct_order: true,
        service_type: 'heavy_cargo_lift_transport',
      });
      setSupplies(res.data?.items || []);
    } catch (error) {
      console.warn('获取服务流失败:', error);
    }
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    if (activeTab === 'demand') {
      await fetchDemands();
    } else {
      await fetchSupplies();
    }
    setLoading(false);
    setRefreshing(false);
  }, [activeTab, fetchDemands, fetchSupplies]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
  }, [loadData]);

  const handleQuickOrderPress = useCallback(() => {
    if (activeTab !== 'supply') {
      setActiveTab('supply');
    }
    navigation.navigate('QuickOrderEntry');
  }, [activeTab, navigation]);

  const handlePublishTaskPress = useCallback(() => {
    navigation.navigate('PublishCargo');
  }, [navigation]);

  const renderDemandItem = ({item}: {item: DemandSummary}) => (
    <TouchableOpacity
      activeOpacity={0.8}
      style={[styles.demandCard, {backgroundColor: theme.card, borderColor: theme.cardBorder}]}
      onPress={() => navigation.navigate('DemandDetail', {id: item.id})}>
      <View style={styles.cardHeader}>
        <View style={styles.cardTitleWrap}>
          <Text style={[styles.title, {color: theme.text}]} numberOfLines={2}>{item.title}</Text>
        </View>
      </View>
      <View style={styles.metaBlockRow}>
        <View style={[styles.metaBadge, {backgroundColor: theme.bgSecondary}]}>
          <Text style={[styles.metaBadgeText, {color: theme.textSub}]}>{getDemandSceneLabel(item.cargo_scene)}</Text>
        </View>
        <View style={[styles.metaBadge, {backgroundColor: theme.bgSecondary}]}>
          <Text style={[styles.metaBadgeText, {color: theme.textSub}]}>{resolveDemandPrimaryAddress(item)}</Text>
        </View>
      </View>
      <View style={styles.cardFooter}>
        <Text style={[styles.timeText, {color: theme.textHint}]}>{formatDemandSchedule(item.scheduled_start_at, item.scheduled_end_at)}</Text>
        <Text style={styles.budget}>{formatDemandBudget(item.budget_min, item.budget_max)}</Text>
      </View>
    </TouchableOpacity>
  );

  const renderSupplyItem = ({item}: {item: SupplySummary}) => (
    <TouchableOpacity
      activeOpacity={0.8}
      style={[styles.serviceCard, {backgroundColor: theme.card, borderColor: theme.cardBorder}]}
      onPress={() => navigation.navigate('OfferDetail', {id: item.id})}>
      <View style={styles.serviceImagePlaceholder}>
        <Text style={styles.serviceEmoji}>🚁</Text>
      </View>
      <View style={styles.serviceInfo}>
        <Text style={[styles.title, {color: theme.text}]} numberOfLines={2}>{item.title}</Text>
        <View style={styles.metaBlockRow}>
          <Text style={[styles.metaText, {color: theme.textSub}]}>最大载重 {item.max_payload_kg || 0}kg</Text>
          <Text style={[styles.metaText, {color: theme.textHint}]}> • </Text>
          <Text style={[styles.metaText, {color: theme.textSub}]} numberOfLines={1}>
            {(item.cargo_scenes || []).map(s => getSupplySceneLabel(s)).join('/')}
          </Text>
        </View>
        <View style={styles.serviceFooter}>
          <Text style={styles.price}>{formatSupplyPricing(item.base_price_amount, item.pricing_unit)}</Text>
          <TouchableOpacity activeOpacity={0.7} style={[styles.orderBtn, {backgroundColor: theme.primary}]} onPress={() => navigation.navigate('OfferDetail', {id: item.id})}>
            <Text style={styles.orderBtnText}>去下单</Text>
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );

  const mainAction = useMemo(() => {
    if (isClientFocused) {
      if (activeTab === 'supply') {
        return {
          label: '找不到合适服务？发布任务',
          onPress: handlePublishTaskPress,
        };
      }
      return {
        label: '先去找服务',
        onPress: handleQuickOrderPress,
      };
    }
    if (activeTab === 'demand') {
      return {
        label: effectiveRoleSummary.has_client_role ? '发布任务' : '查看全部任务',
        onPress: () => navigation.navigate(effectiveRoleSummary.has_client_role ? 'PublishDemand' : 'DemandList'),
      };
    }
    return {
      label: effectiveRoleSummary.has_owner_role ? '上架服务' : '查看全部服务',
      onPress: () => navigation.navigate(effectiveRoleSummary.has_owner_role ? 'PublishOffer' : 'OfferList'),
    };
  }, [activeTab, effectiveRoleSummary, handlePublishTaskPress, handleQuickOrderPress, isClientFocused, navigation]);

  return (
    <SafeAreaView style={[styles.container, {backgroundColor: theme.bg}]}>
      <View style={styles.header}>
        {isClientFocused ? (
          <View style={styles.entryCard}>
            <View style={styles.entryActionRow}>
              <TouchableOpacity
                style={[styles.entryActionBtn, styles.entryPrimaryBtn]}
                onPress={handleQuickOrderPress}>
                <Text style={styles.entryPrimaryTitle}>快速下单</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.entryActionBtn, styles.entrySecondaryBtn]}
                onPress={handlePublishTaskPress}>
                <Text style={styles.entrySecondaryTitle}>发布任务</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : null}
        <View style={styles.tabBar}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'demand' && styles.tabActive]}
            onPress={() => setActiveTab('demand')}>
            <Text style={[styles.tabText, activeTab === 'demand' && styles.tabTextActive]}>
              {isClientFocused ? '任务大厅' : '看需求'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'supply' && styles.tabActive]}
            onPress={() => setActiveTab('supply')}>
            <Text style={[styles.tabText, activeTab === 'supply' && styles.tabTextActive]}>
              {isClientFocused ? '找服务' : '看服务'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <FlatList<any>
        data={activeTab === 'demand' ? demands : supplies}
        keyExtractor={item => String(item.id)}
        renderItem={activeTab === 'demand' ? renderDemandItem : renderSupplyItem}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[theme.refreshColor]} />}
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator style={styles.loading} color={theme.primary} />
          ) : (
            <EmptyState
              icon={activeTab === 'demand' ? '📋' : '🛩️'}
              title={
                isClientFocused
                  ? activeTab === 'demand'
                    ? '当前还没有公开任务'
                    : '当前还没有可快速下单的服务'
                  : `暂无公开${activeTab === 'demand' ? '需求' : '服务'}`
              }
            />
          )
        }
      />

      <View style={styles.footer}>
        {isClientFocused ? (
          <TouchableOpacity
            style={styles.mainBtn}
            onPress={activeTab === 'supply' ? handlePublishTaskPress : handleQuickOrderPress}>
            <Text style={styles.mainBtnText}>
              {activeTab === 'supply' ? '没看到合适服务？发布任务' : '想直接成交？去快速下单'}
            </Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.mainBtn} onPress={mainAction.onPress}>
            <Text style={styles.mainBtnText}>{mainAction.label}</Text>
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
}

const getStyles = (theme: AppTheme) => StyleSheet.create({
  container: {flex: 1, backgroundColor: theme.bgSecondary},
  header: {
    backgroundColor: theme.bg,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.divider,
  },
  entryCard: {
    borderRadius: 18,
    padding: 10,
    marginBottom: 12,
    backgroundColor: theme.isDark ? 'rgba(0,212,255,0.08)' : theme.primaryBg,
    borderWidth: 1,
    borderColor: theme.isDark ? 'rgba(0,212,255,0.16)' : theme.primaryBorder,
  },
  entryActionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  entryActionBtn: {
    flex: 1,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  entryPrimaryBtn: {
    backgroundColor: theme.primary,
  },
  entrySecondaryBtn: {
    backgroundColor: theme.card,
    borderWidth: 1,
    borderColor: theme.cardBorder,
  },
  entryPrimaryTitle: {
    fontSize: 15,
    color: '#FFFFFF',
    fontWeight: '800',
    textAlign: 'center',
  },
  entrySecondaryTitle: {
    fontSize: 15,
    color: theme.text,
    fontWeight: '800',
    textAlign: 'center',
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: theme.bgSecondary,
    borderRadius: 12,
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
  },
  tabActive: {
    backgroundColor: theme.card,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  tabText: {
    fontSize: 14,
    color: theme.textSub,
    fontWeight: '600',
  },
  tabTextActive: {
    color: theme.primary,
    fontWeight: '700',
  },
  listContent: {
    padding: 16,
    paddingBottom: 100,
  },
  demandCard: {
    marginBottom: 14,
    borderRadius: 20,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  serviceCard: {
    marginBottom: 14,
    borderRadius: 20,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
    flexDirection: 'row',
  },
  serviceImagePlaceholder: {
    width: 100,
    backgroundColor: 'rgba(0,0,0,0.03)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  serviceEmoji: {
    fontSize: 32,
  },
  serviceInfo: {
    flex: 1,
    padding: 14,
  },
  cardHeader: {
    marginBottom: 8,
    paddingTop: 14,
    paddingHorizontal: 14,
  },
  cardTitleWrap: {
    flex: 1,
  },
  budget: {
    fontSize: 18,
    color: theme.danger,
    fontWeight: '800',
  },
  price: {
    fontSize: 18,
    color: theme.danger,
    fontWeight: '800',
    flexShrink: 1,
  },
  title: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '800',
    marginBottom: 8,
  },
  metaBlockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    paddingHorizontal: 14,
  },
  metaBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  metaBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  metaText: {
    fontSize: 12,
    fontWeight: '500',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingHorizontal: 14,
    paddingBottom: 14,
  },
  serviceFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    marginTop: 14,
  },
  timeText: {
    fontSize: 12,
    fontWeight: '500',
  },
  orderBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 14,
    marginLeft: 12,
  },
  orderBtnText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '800',
  },
  loading: {
    paddingVertical: 40,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderTopWidth: 1,
    borderTopColor: theme.divider,
  },
  mainBtn: {
    backgroundColor: theme.primary,
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: 'center',
    shadowColor: theme.primary,
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  mainBtnText: {
    fontSize: 15,
    color: '#FFFFFF',
    fontWeight: '800',
  },
});
