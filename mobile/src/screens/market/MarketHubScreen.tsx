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
import ObjectCard from '../../components/business/ObjectCard';
import SourceTag from '../../components/business/SourceTag';
import StatusBadge from '../../components/business/StatusBadge';
import {getObjectStatusMeta} from '../../components/business/visuals';
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
    <ObjectCard
      style={styles.card}
      onPress={() => navigation.navigate('DemandDetail', {id: item.id})}>
      <View style={styles.cardHeader}>
        <View style={styles.cardHeaderLeft}>
          <SourceTag source="demand" />
          <StatusBadge meta={getObjectStatusMeta('demand', item.status)} label="" />
        </View>
        <Text style={styles.budget}>{formatDemandBudget(item.budget_min, item.budget_max)}</Text>
      </View>
      <Text style={styles.title} numberOfLines={2}>{item.title}</Text>
      <View style={styles.metaBlock}>
        <Text style={styles.metaText}>场景：{getDemandSceneLabel(item.cargo_scene)}</Text>
        <Text style={styles.metaText}>区域：{resolveDemandPrimaryAddress(item)}</Text>
        <Text style={styles.metaText}>时间：{formatDemandSchedule(item.scheduled_start_at, item.scheduled_end_at)}</Text>
      </View>
    </ObjectCard>
  );

  const renderSupplyItem = ({item}: {item: SupplySummary}) => (
    <ObjectCard
      style={styles.card}
      onPress={() => navigation.navigate('OfferDetail', {id: item.id})}>
      <View style={styles.cardHeader}>
        <View style={styles.cardHeaderLeft}>
          <SourceTag source="supply" />
          <StatusBadge meta={getObjectStatusMeta('supply', item.status)} label="" />
        </View>
        <Text style={styles.price}>{formatSupplyPricing(item.base_price_amount, item.pricing_unit)}</Text>
      </View>
      <Text style={styles.title} numberOfLines={2}>{item.title}</Text>
      <View style={styles.metaBlock}>
        <Text style={styles.metaText}>吊重：{item.max_payload_kg || 0}kg</Text>
        <Text style={styles.metaText}>场景：{(item.cargo_scenes || []).map(s => getSupplySceneLabel(s)).join('、')}</Text>
      </View>
    </ObjectCard>
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
            <Text style={styles.entryEyebrow}>客户开始方式</Text>
            <Text style={styles.entryTitle}>先决定是快速下单，还是发布任务</Text>
            <Text style={styles.entryDesc}>
              标准化场景先看可直接下单的服务；复杂、非标或需要比价的场景再发布任务。
            </Text>
            <View style={styles.entryActionRow}>
              <TouchableOpacity
                style={[styles.entryActionBtn, styles.entryPrimaryBtn]}
                onPress={handleQuickOrderPress}>
                <Text style={styles.entryPrimaryTitle}>快速下单</Text>
                <Text style={styles.entryPrimaryDesc}>先找可下单服务</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.entryActionBtn, styles.entrySecondaryBtn]}
                onPress={handlePublishTaskPress}>
                <Text style={styles.entrySecondaryTitle}>发布任务</Text>
                <Text style={styles.entrySecondaryDesc}>复杂需求更合适</Text>
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

      <FlatList
        data={activeTab === 'demand' ? demands : supplies}
        keyExtractor={item => String(item.id)}
        renderItem={activeTab === 'demand' ? renderDemandItem : renderSupplyItem}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[theme.refreshColor]} />}
        ListHeaderComponent={
          <View style={styles.listHeader}>
            <View style={styles.hero}>
              <Text style={styles.heroTitle}>
                {isClientFocused
                  ? activeTab === 'demand'
                    ? '先发任务，后续再慢慢比方案'
                    : '先看可直接下单的服务'
                  : activeTab === 'demand'
                    ? '发现新需求'
                    : '挑选重载服务'}
              </Text>
              <Text style={styles.heroDesc}>
                {isClientFocused
                  ? activeTab === 'demand'
                    ? '适合路线复杂、信息还没补全或想比较多个方案的场景。先发起任务，后面再补细节。'
                    : '这里优先展示支持直达下单的服务。标准化场景可以直接看服务详情并继续下单。'
                  : activeTab === 'demand'
                    ? '机主和飞手可在此寻找作业机会，公开需求报价不等于成交。'
                    : '客户可在此挑选合规供给，支持从详情页发起直达下单。'}
              </Text>
            </View>
          </View>
        }
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
              description={
                isClientFocused
                  ? activeTab === 'demand'
                    ? '可以先去发布任务，等机主来报价。'
                    : '如果暂时没有匹配服务，可以直接发布任务，让平台反向撮合。'
                  : '市场内容正在更新中，请稍后再试。'
              }
            />
          )
        }
      />

      <View style={styles.footer}>
        {isClientFocused ? (
          <View style={styles.clientFooterRow}>
            <TouchableOpacity
              style={[styles.clientFooterBtn, styles.clientFooterGhostBtn]}
              onPress={handleQuickOrderPress}>
              <Text style={styles.clientFooterGhostText}>快速下单</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.clientFooterBtn, styles.mainBtn]}
              onPress={handlePublishTaskPress}>
              <Text style={styles.mainBtnText}>发布任务</Text>
            </TouchableOpacity>
          </View>
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
    padding: 16,
    marginBottom: 12,
    backgroundColor: theme.isDark ? 'rgba(0,212,255,0.08)' : theme.primaryBg,
    borderWidth: 1,
    borderColor: theme.isDark ? 'rgba(0,212,255,0.16)' : theme.primaryBorder,
  },
  entryEyebrow: {
    fontSize: 12,
    color: theme.primary,
    fontWeight: '700',
  },
  entryTitle: {
    marginTop: 8,
    fontSize: 20,
    lineHeight: 26,
    color: theme.text,
    fontWeight: '800',
  },
  entryDesc: {
    marginTop: 8,
    fontSize: 13,
    lineHeight: 20,
    color: theme.textSub,
  },
  entryActionRow: {
    marginTop: 14,
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
  },
  entryPrimaryDesc: {
    marginTop: 6,
    fontSize: 12,
    lineHeight: 18,
    color: 'rgba(255,255,255,0.82)',
  },
  entrySecondaryTitle: {
    fontSize: 15,
    color: theme.text,
    fontWeight: '800',
  },
  entrySecondaryDesc: {
    marginTop: 6,
    fontSize: 12,
    lineHeight: 18,
    color: theme.textSub,
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
  listHeader: {
    marginBottom: 16,
  },
  hero: {
    backgroundColor: theme.isDark ? 'rgba(0,212,255,0.08)' : theme.primary,
    borderRadius: 20,
    padding: 18,
  },
  heroTitle: {
    fontSize: 20,
    color: theme.isDark ? theme.text : '#FFFFFF',
    fontWeight: '800',
    marginBottom: 6,
  },
  heroDesc: {
    fontSize: 13,
    lineHeight: 18,
    color: theme.isDark ? theme.textSub : 'rgba(255,255,255,0.85)',
  },
  card: {
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  budget: {
    fontSize: 16,
    color: theme.danger,
    fontWeight: '700',
  },
  price: {
    fontSize: 16,
    color: theme.danger,
    fontWeight: '700',
  },
  title: {
    fontSize: 16,
    lineHeight: 22,
    color: theme.text,
    fontWeight: '700',
    marginBottom: 10,
  },
  metaBlock: {
    gap: 4,
  },
  metaText: {
    fontSize: 12,
    color: theme.textSub,
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
  clientFooterRow: {
    flexDirection: 'row',
    gap: 10,
  },
  clientFooterBtn: {
    flex: 1,
  },
  clientFooterGhostBtn: {
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: theme.card,
    borderWidth: 1,
    borderColor: theme.cardBorder,
  },
  clientFooterGhostText: {
    fontSize: 15,
    color: theme.text,
    fontWeight: '800',
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
