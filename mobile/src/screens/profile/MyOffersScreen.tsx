import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import ProviderAccessNotice from '../../components/business/ProviderAccessNotice';
import SourceTag from '../../components/business/SourceTag';
import StatusBadge from '../../components/business/StatusBadge';
import { getObjectStatusMeta } from '../../components/business/visuals';
import { ownerService } from '../../services/owner';
import { supplyService } from '../../services/supply';
import { SupplySummary } from '../../types';
import {
  formatSupplyPricing,
  getSupplySceneLabel,
} from '../../utils/supplyMeta';
import {RootState} from '../../store/store';
import {getEffectiveRoleSummary, resolveProviderCapabilities} from '../../utils/roleSummary';
import { useTheme } from '../../theme/ThemeContext';
import type { AppTheme } from '../../theme/index';

const STATUS_GROUPS = [
  { key: 'all', label: '全部' },
  { key: 'draft', label: '草稿' },
  { key: 'active', label: '生效中' },
  { key: 'paused', label: '已暂停' },
  { key: 'closed', label: '已关闭' },
] as const;

type StatusGroupKey = (typeof STATUS_GROUPS)[number]['key'];

const NEXT_STATUS_ACTIONS: Partial<
  Record<string, { status: string; label: string }>
> = {
  draft: { status: 'active', label: '立即上架' },
  active: { status: 'paused', label: '暂停供给' },
  paused: { status: 'active', label: '恢复上架' },
};

const MY_SERVICE_HELP =
  '这里用于管理你对外提供的无人机运输服务。你可以先保存为草稿，确认设备、价格和资质都没问题后再上架。';

export default function MyOffersScreen({ navigation }: any) {
  const { theme } = useTheme();
  const styles = getStyles(theme);
  const isAuthenticated = useSelector((state: RootState) => state.auth.isAuthenticated);
  const roleSummary = useSelector((state: RootState) => state.auth.roleSummary);
  const providerCapabilities = useMemo(
    () => resolveProviderCapabilities(getEffectiveRoleSummary(roleSummary)),
    [roleSummary],
  );
  const canManageServices = Boolean(isAuthenticated && providerCapabilities.canUseWorkbench && providerCapabilities.canPublishSupply);
  const [offers, setOffers] = useState<SupplySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [activeGroup, setActiveGroup] = useState<StatusGroupKey>('all');

  const fetchData = useCallback(async () => {
    if (!canManageServices) {
      setOffers([]);
      setLoading(false);
      setRefreshing(false);
      return;
    }
    try {
      const res = await ownerService.listMySupplies({
        page: 1,
        page_size: 50,
      });
      setOffers(res.data?.items || []);
    } catch (error) {
      console.warn('获取我的供给失败:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [canManageServices]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData();
  }, [fetchData]);

  const filteredOffers = useMemo(
    () =>
      offers.filter(
        item => activeGroup === 'all' || item.status === activeGroup,
      ),
    [activeGroup, offers],
  );

  const handleStatusAction = useCallback(
    async (item: SupplySummary) => {
      if (!canManageServices) {
        Alert.alert('无法操作', '服务商设备能力审核通过后才能管理正式服务。');
        return;
      }
      const action = NEXT_STATUS_ACTIONS[item.status];
      if (!action) {
        return;
      }
      setUpdatingId(item.id);
      try {
        await supplyService.updateStatus(item.id, action.status);
        await fetchData();
      } catch (error) {
        console.warn('更新供给状态失败:', error);
      } finally {
        setUpdatingId(null);
      }
    },
    [canManageServices, fetchData],
  );

  const showPageHelp = useCallback(() => {
    Alert.alert('我的服务', MY_SERVICE_HELP);
  }, []);

  if (!canManageServices) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
        <ProviderAccessNotice
          title={isAuthenticated ? '服务商设备能力未开通' : '请先登录服务商账号'}
          description={isAuthenticated ? '设备与关键资质审核通过后，才能查看、编辑和上架正式服务。' : '登录后才能查看服务商服务列表。'}
          actionText={isAuthenticated ? '查看服务商入驻' : undefined}
          onAction={isAuthenticated ? () => navigation.navigate('ProviderOnboarding') : undefined}
        />
      </SafeAreaView>
    );
  }

  const renderItem = ({ item }: { item: SupplySummary }) => {
    const action = NEXT_STATUS_ACTIONS[item.status];
    const isUpdating = updatingId === item.id;

    return (
      <ObjectCard style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.cardHeaderLeft}>
            <SourceTag source="supply" />
            <StatusBadge
              label=""
              meta={getObjectStatusMeta('supply', item.status)}
            />
          </View>
          <Text style={styles.code}>{item.supply_no}</Text>
        </View>

        <Text style={styles.title}>{item.title}</Text>

        <View style={styles.sceneRow}>
          {(item.cargo_scenes || []).slice(0, 3).map(scene => (
            <View key={scene} style={styles.sceneTag}>
              <Text style={styles.sceneTagText}>
                {getSupplySceneLabel(scene)}
              </Text>
            </View>
          ))}
        </View>

        <View style={styles.metricRow}>
          <Text style={styles.metricText}>
            关联无人机：{item.drone?.brand || '未关联'}{' '}
            {item.drone?.model || ''}
          </Text>
          <Text style={styles.metricText}>
            最大吊重：{item.max_payload_kg || 0}kg
          </Text>
        </View>

        <View style={styles.metricRow}>
          <Text style={styles.metricText}>起飞重量：{item.mtow_kg || 0}kg</Text>
          <Text style={styles.metricText}>
            报价方式：
            {formatSupplyPricing(item.base_price_amount, item.pricing_unit)}
          </Text>
        </View>

        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={() =>
              navigation.navigate('PublishOffer', { supplyId: item.id })
            }
          >
            <Text style={styles.secondaryBtnText}>编辑供给</Text>
          </TouchableOpacity>
          {item.status === 'active' ? (
            <TouchableOpacity
              style={styles.secondaryBtn}
              onPress={() =>
                navigation.navigate('OfferDetail', { id: item.id })
              }
            >
              <Text style={styles.secondaryBtnText}>查看详情</Text>
            </TouchableOpacity>
          ) : null}
          {action ? (
            <TouchableOpacity
              style={[
                styles.primaryBtn,
                isUpdating && styles.primaryBtnDisabled,
              ]}
              disabled={isUpdating}
              onPress={() => handleStatusAction(item)}
            >
              <Text style={styles.primaryBtnText}>
                {isUpdating ? '处理中...' : action.label}
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </ObjectCard>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
      <FlatList
        data={filteredOffers}
        keyExtractor={item => String(item.id)}
        renderItem={renderItem}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[theme.refreshColor]}
          />
        }
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <View>
            <View style={styles.hero}>
              <View style={styles.heroHeader}>
                <View style={styles.heroTitleWrap}>
                  <Text style={styles.heroEyebrow}>我的服务</Text>
                  <Text style={styles.heroTitle}>管理已发布服务</Text>
                </View>
                <TouchableOpacity
                  style={styles.helpIcon}
                  activeOpacity={0.75}
                  onPress={showPageHelp}
                >
                  <Text style={styles.helpIconText}>?</Text>
                </TouchableOpacity>
              </View>
            </View>

            <ObjectCard style={styles.filterCard}>
              <Text style={styles.filterTitle}>服务分组</Text>
              <View style={styles.filterRow}>
                {STATUS_GROUPS.map(group => (
                  <TouchableOpacity
                    key={group.key}
                    style={[
                      styles.filterChip,
                      activeGroup === group.key && styles.filterChipActive,
                    ]}
                    onPress={() => setActiveGroup(group.key)}
                  >
                    <Text
                      style={[
                        styles.filterChipText,
                        activeGroup === group.key &&
                          styles.filterChipTextActive,
                      ]}
                    >
                      {group.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ObjectCard>
          </View>
        }
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator style={styles.loading} color={theme.primary} />
          ) : (
            <ObjectCard>
              <EmptyState
                icon="🛩️"
                title={
                  activeGroup === 'all'
                    ? '还没有发布服务'
                    : '这个分组下暂无服务'
                }
                actionText="发布服务"
                onAction={() => navigation.navigate('PublishOffer')}
              />
            </ObjectCard>
          )
        }
      />
    </SafeAreaView>
  );
}

const getStyles = (theme: AppTheme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.bgSecondary,
    },
    content: {
      padding: 14,
      paddingBottom: 28,
    },
    hero: {
      backgroundColor: theme.isDark ? 'rgba(0,212,255,0.08)' : theme.primary,
      borderRadius: 24,
      padding: 20,
      marginBottom: 12,
      borderWidth: theme.isDark ? 1 : 0,
      borderColor: theme.isDark ? theme.primaryBorder : 'transparent',
    },
    heroHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: 12,
    },
    heroTitleWrap: {
      flex: 1,
    },
    heroEyebrow: {
      fontSize: 12,
      color: theme.isDark ? theme.primaryText : 'rgba(255,255,255,0.7)',
      fontWeight: '700',
    },
    heroTitle: {
      marginTop: 8,
      fontSize: 24,
      lineHeight: 30,
      color: theme.isDark ? theme.text : '#FFFFFF',
      fontWeight: '800',
    },
    helpIcon: {
      width: 30,
      height: 30,
      borderRadius: 15,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.isDark ? theme.primaryBg : 'rgba(255,255,255,0.18)',
      borderWidth: 1,
      borderColor: theme.isDark ? theme.primaryBorder : 'rgba(255,255,255,0.28)',
    },
    helpIconText: {
      fontSize: 15,
      fontWeight: '800',
      color: theme.isDark ? theme.primaryText : '#FFFFFF',
    },
    filterCard: {
      marginBottom: 12,
    },
    filterTitle: {
      fontSize: 14,
      color: theme.text,
      fontWeight: '700',
      marginBottom: 12,
    },
    filterRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    filterChip: {
      borderRadius: 999,
      borderWidth: 1,
      borderColor: theme.divider,
      paddingHorizontal: 12,
      paddingVertical: 8,
      backgroundColor: theme.card,
    },
    filterChipActive: {
      borderColor: theme.primary,
      backgroundColor: theme.primaryBg,
    },
    filterChipText: {
      fontSize: 12,
      color: theme.textSub,
      fontWeight: '600',
    },
    filterChipTextActive: {
      color: theme.primaryText,
    },
    loading: {
      paddingVertical: 48,
    },
    card: {
      marginBottom: 12,
    },
    cardHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    cardHeaderLeft: {
      flexDirection: 'row',
      gap: 8,
      alignItems: 'center',
    },
    code: {
      fontSize: 12,
      color: theme.textSub,
      fontWeight: '600',
    },
    title: {
      marginTop: 14,
      fontSize: 17,
      lineHeight: 24,
      color: theme.text,
      fontWeight: '700',
    },
    sceneRow: {
      marginTop: 12,
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    sceneTag: {
      borderRadius: 999,
      backgroundColor: theme.primaryBg,
      paddingHorizontal: 10,
      paddingVertical: 6,
    },
    sceneTagText: {
      fontSize: 11,
      color: theme.primaryText,
      fontWeight: '700',
    },
    metricRow: {
      marginTop: 12,
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: 12,
    },
    metricText: {
      flex: 1,
      fontSize: 12,
      lineHeight: 18,
      color: theme.textSub,
    },
    footer: {
      marginTop: 16,
      flexDirection: 'row',
      justifyContent: 'flex-end',
      gap: 10,
    },
    secondaryBtn: {
      borderRadius: 999,
      borderWidth: 1,
      borderColor: theme.divider,
      paddingHorizontal: 14,
      paddingVertical: 10,
    },
    secondaryBtnText: {
      fontSize: 12,
      color: theme.textSub,
      fontWeight: '700',
    },
    primaryBtn: {
      borderRadius: 999,
      backgroundColor: theme.primary,
      paddingHorizontal: 14,
      paddingVertical: 10,
    },
    primaryBtnDisabled: {
      opacity: 0.6,
    },
    primaryBtnText: {
      fontSize: 12,
      color: theme.btnPrimaryText,
      fontWeight: '700',
    },
  });
