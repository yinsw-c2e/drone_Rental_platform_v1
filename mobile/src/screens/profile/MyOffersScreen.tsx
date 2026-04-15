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

import EmptyState from '../../components/business/EmptyState';
import ObjectCard from '../../components/business/ObjectCard';
import SourceTag from '../../components/business/SourceTag';
import StatusBadge from '../../components/business/StatusBadge';
import {getObjectStatusMeta} from '../../components/business/visuals';
import {ownerService} from '../../services/owner';
import {supplyService} from '../../services/supply';
import {SupplySummary} from '../../types';
import {formatSupplyPricing, getSupplySceneLabel} from '../../utils/supplyMeta';
import {useTheme} from '../../theme/ThemeContext';
import type {AppTheme} from '../../theme/index';

const STATUS_GROUPS = [
  {key: 'all', label: '全部'},
  {key: 'draft', label: '草稿'},
  {key: 'active', label: '生效中'},
  {key: 'paused', label: '已暂停'},
  {key: 'closed', label: '已关闭'},
] as const;

type StatusGroupKey = (typeof STATUS_GROUPS)[number]['key'];

const NEXT_STATUS_ACTIONS: Partial<Record<string, {status: string; label: string}>> = {
  draft: {status: 'active', label: '立即上架'},
  active: {status: 'paused', label: '暂停供给'},
  paused: {status: 'active', label: '恢复上架'},
};

export default function MyOffersScreen({navigation}: any) {
  const {theme} = useTheme();
  const styles = getStyles(theme);
  const [offers, setOffers] = useState<SupplySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [activeGroup, setActiveGroup] = useState<StatusGroupKey>('all');

  const fetchData = useCallback(async () => {
    try {
      const res = await ownerService.listMySupplies({page: 1, page_size: 100});
      setOffers(res.data?.items || []);
    } catch (error) {
      console.warn('获取我的供给失败:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData();
  }, [fetchData]);

  const filteredOffers = useMemo(
    () => offers.filter(item => activeGroup === 'all' || item.status === activeGroup),
    [activeGroup, offers],
  );

  const handleStatusAction = useCallback(
    async (item: SupplySummary) => {
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
    [fetchData],
  );

  const renderItem = ({item}: {item: SupplySummary}) => {
    const action = NEXT_STATUS_ACTIONS[item.status];
    const isUpdating = updatingId === item.id;
    const isDraft = item.status === 'draft';
    const isPaused = item.status === 'paused';

    return (
      <TouchableOpacity
        activeOpacity={0.8}
        style={[styles.offerCard, {backgroundColor: theme.card, borderColor: theme.cardBorder}, isPaused && styles.cardPaused]}
        onPress={() => navigation.navigate('OfferDetail', {id: item.id})}>

        <View style={styles.cardHeader}>
          <View style={styles.headerLeft}>
            <StatusBadge label="" meta={getObjectStatusMeta('supply', item.status)} />
            <Text style={styles.supplyNo}>{item.supply_no}</Text>
          </View>
          {isDraft && (
            <View style={styles.draftHintBadge}>
              <Text style={styles.draftHintText}>待补资质</Text>
            </View>
          )}
        </View>

        <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>

        <View style={styles.droneInfoRow}>
          <View style={styles.droneIconBox}>
            <Text style={{fontSize: 16}}>🚁</Text>
          </View>
          <View style={{flex: 1}}>
            <Text style={styles.droneName}>{item.drone?.brand || '未关联'} {item.drone?.model || ''}</Text>
            <Text style={styles.droneSpecs}>最大载重 {item.max_payload_kg || 0}kg · 起飞重量 {item.mtow_kg || 0}kg</Text>
          </View>
        </View>

        <View style={styles.sceneRow}>
          {(item.cargo_scenes || []).slice(0, 3).map(scene => (
            <View key={scene} style={styles.sceneBadge}>
              <Text style={styles.sceneBadgeText}>{getSupplySceneLabel(scene)}</Text>
            </View>
          ))}
        </View>

        <View style={styles.cardFooter}>
          <View style={styles.pricingBox}>
            <Text style={styles.pricingLabel}>基准价</Text>
            <Text style={styles.pricingValue}>{formatSupplyPricing(item.base_price_amount, item.pricing_unit)}</Text>
          </View>
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={styles.inlineGhostBtn}
              onPress={() => navigation.navigate('PublishOffer', {supplyId: item.id})}>
              <Text style={styles.inlineGhostBtnText}>{isDraft ? '去完善' : '编辑'}</Text>
            </TouchableOpacity>
            {action && (
              <TouchableOpacity
                style={[styles.inlineMainBtn, isDraft && styles.draftMainBtn, isUpdating && styles.btnDisabled]}
                disabled={isUpdating}
                onPress={() => handleStatusAction(item)}>
                <Text style={[styles.inlineMainBtnText, isDraft && styles.draftMainBtnText]}>
                  {isUpdating ? '...' : action.label}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={[styles.container, {backgroundColor: theme.bg}]}>
      <FlatList
        data={filteredOffers}
        keyExtractor={item => String(item.id)}
        renderItem={renderItem}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[theme.refreshColor]} />
        }
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <View>
            <View style={styles.hero}>
              <Text style={styles.heroEyebrow}>我的服务</Text>
              <Text style={styles.heroTitle}>服务与市场入口已经拆开</Text>
              <Text style={styles.heroDesc}>
                这里展示自己发布的服务方案。可先建服务草稿，等补充资质达标后再正式上架。
              </Text>
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
                    onPress={() => setActiveGroup(group.key)}>
                    <Text
                      style={[
                        styles.filterChipText,
                        activeGroup === group.key && styles.filterChipTextActive,
                      ]}>
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
                title={activeGroup === 'all' ? '还没有发布供给' : '这个分组下暂无供给'}
                description="机主供给会先以草稿存在，确认设备能力、价格规则和资质后再上架。"
                actionText="发布供给"
                onAction={() => navigation.navigate('PublishOffer')}
              />
            </ObjectCard>
          )
        }
      />
    </SafeAreaView>
  );
}

const getStyles = (theme: AppTheme) => StyleSheet.create({
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
  heroEyebrow: {
    fontSize: 12,
    color: theme.isDark ? theme.primaryText : 'rgba(255,255,255,0.7)',
    fontWeight: '700',
  },
  heroTitle: {
    marginTop: 8,
    fontSize: 28,
    lineHeight: 34,
    color: theme.isDark ? theme.text : '#FFFFFF',
    fontWeight: '800',
  },
  heroDesc: {
    marginTop: 10,
    fontSize: 13,
    lineHeight: 20,
    color: theme.isDark ? theme.textSub : 'rgba(255,255,255,0.85)',
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
  offerCard: {
    borderRadius: 24,
    borderWidth: 1,
    padding: 18,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 3,
  },
  cardPaused: {
    opacity: 0.7,
    backgroundColor: theme.bgSecondary,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  supplyNo: {
    fontSize: 11,
    color: theme.textHint,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  draftHintBadge: {
    backgroundColor: theme.warning + '15',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  draftHintText: {
    fontSize: 10,
    color: theme.warning,
    fontWeight: '800',
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: theme.text,
    lineHeight: 24,
    marginBottom: 16,
  },
  droneInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: theme.bgSecondary,
    padding: 12,
    borderRadius: 14,
    marginBottom: 16,
  },
  droneIconBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  droneName: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.text,
  },
  droneSpecs: {
    fontSize: 11,
    color: theme.textSub,
    marginTop: 2,
  },
  sceneRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 18,
  },
  sceneBadge: {
    backgroundColor: theme.primaryBg,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  sceneBadgeText: {
    fontSize: 11,
    color: theme.primaryText,
    fontWeight: '700',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.divider,
    paddingTop: 16,
  },
  pricingBox: {
    gap: 2,
  },
  pricingLabel: {
    fontSize: 10,
    color: theme.textHint,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  pricingValue: {
    fontSize: 16,
    fontWeight: '800',
    color: theme.danger,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  inlineGhostBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.divider,
  },
  inlineGhostBtnText: {
    fontSize: 13,
    color: theme.textSub,
    fontWeight: '700',
  },
  inlineMainBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: theme.primary,
  },
  inlineMainBtnText: {
    fontSize: 13,
    color: '#FFFFFF',
    fontWeight: '800',
  },
  draftMainBtn: {
    backgroundColor: theme.warning,
  },
  draftMainBtnText: {
    color: '#FFFFFF',
  },
  btnDisabled: {
    opacity: 0.5,
  },
  card: {
    marginBottom: 12,
  },
});
