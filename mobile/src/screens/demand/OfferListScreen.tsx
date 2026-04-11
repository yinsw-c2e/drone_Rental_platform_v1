import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
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
import {SupplySummary} from '../../types';
import {formatSupplyPricing, getSupplySceneLabel} from '../../utils/supplyMeta';
import {useTheme} from '../../theme/ThemeContext';
import type {AppTheme} from '../../theme/index';

const SCENE_FILTERS = [
  {key: '', label: '全部场景'},
  {key: 'power_grid', label: '电网建设'},
  {key: 'mountain_agriculture', label: '山区农副产品'},
  {key: 'plateau_supply', label: '高原给养'},
  {key: 'island_supply', label: '海岛补给'},
  {key: 'emergency', label: '应急救援'},
];

function SceneTag({label}: {label: string}) {
  const {theme} = useTheme();
  const styles = getStyles(theme);
  return (
    <View style={styles.sceneTag}>
      <Text style={styles.sceneTagText}>{label}</Text>
    </View>
  );
}

export default function OfferListScreen({navigation}: any) {
  const {theme} = useTheme();
  const styles = getStyles(theme);
  const currentUser = useSelector((state: RootState) => state.auth.user);

  const [supplies, setSupplies] = useState<SupplySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [region, setRegion] = useState('');
  const [activeScene, setActiveScene] = useState('');

  const fetchSupplies = useCallback(
    async (pageNum = 1, isRefresh = false) => {
      try {
        const res = await supplyService.list({
          page: pageNum,
          page_size: 10,
          region: region.trim() || undefined,
          cargo_scene: activeScene || undefined,
          accepts_direct_order: true,
          service_type: 'heavy_cargo_lift_transport',
        });
        const list = res.data?.items || [];
        if (isRefresh || pageNum === 1) {
          setSupplies(list);
        } else {
          setSupplies(prev => [...prev, ...list]);
        }
        const total = res.meta?.total || 0;
        setHasMore(pageNum * 10 < total);
      } catch (error) {
        console.error('获取供给市场失败:', error);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [activeScene, region],
  );

  useEffect(() => {
    setLoading(true);
    setPage(1);
    fetchSupplies(1, true);
  }, [activeScene]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setPage(1);
    fetchSupplies(1, true);
  }, [fetchSupplies]);

  const onSearch = useCallback(() => {
    setLoading(true);
    setPage(1);
    fetchSupplies(1, true);
  }, [fetchSupplies]);

  const onLoadMore = useCallback(() => {
    if (loading || refreshing || !hasMore) {
      return;
    }
    const nextPage = page + 1;
    setPage(nextPage);
    fetchSupplies(nextPage);
  }, [fetchSupplies, hasMore, loading, page, refreshing]);

  const heroTitle = useMemo(() => {
    if (region.trim()) {
      return `${region.trim()} 服务市场`;
    }
    return '重载吊运服务市场';
  }, [region]);

  const renderItem = ({item}: {item: SupplySummary}) => {
    const isMySupply = item.owner_user_id === currentUser?.id;
    return (
      <ObjectCard
        style={styles.card}
        onPress={() => navigation.navigate('OfferDetail', {id: item.id})}>
        <View style={styles.cardHeader}>
          <View style={styles.cardHeaderLeft}>
            <SourceTag source="supply" />
            <StatusBadge label="" meta={getObjectStatusMeta('supply', item.status)} />
          </View>
          {item.accepts_direct_order ? (
            <View style={styles.directPill}>
              <Text style={styles.directPillText}>支持直达下单</Text>
            </View>
          ) : null}
        </View>

        <Text style={styles.supplyNo}>{item.supply_no}</Text>
        <Text style={styles.title}>{item.title}</Text>

        <View style={styles.sceneRow}>
          {(item.cargo_scenes || []).slice(0, 3).map(scene => (
            <SceneTag key={scene} label={getSupplySceneLabel(scene)} />
          ))}
        </View>

        <View style={styles.metricRow}>
          <Text style={styles.metricText}>起飞重量 {item.mtow_kg || 0}kg</Text>
          <Text style={styles.metricText}>最大吊重 {item.max_payload_kg || 0}kg</Text>
        </View>

        <View style={styles.cardFooter}>
          <Text style={styles.price}>{formatSupplyPricing(item.base_price_amount, item.pricing_unit)}</Text>
          <TouchableOpacity
            style={[styles.detailBtn, isMySupply && styles.detailBtnOwner]}
            onPress={() => navigation.navigate('OfferDetail', {id: item.id})}>
            <Text style={[styles.detailBtnText, isMySupply && styles.detailBtnTextOwner]}>
              {isMySupply ? '查看供给' : '查看详情'}
            </Text>
          </TouchableOpacity>
        </View>
      </ObjectCard>
    );
  };

  return (
    <SafeAreaView style={[styles.container, {backgroundColor: theme.bg}]}>
      <FlatList
        data={supplies}
        keyExtractor={item => String(item.id)}
        renderItem={renderItem}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[theme.refreshColor]} />
        }
        onEndReached={onLoadMore}
        onEndReachedThreshold={0.35}
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <View>
            <View style={styles.hero}>
              <Text style={styles.heroEyebrow}>服务市场</Text>
              <Text style={styles.heroTitle}>{heroTitle}</Text>
              <Text style={styles.heroDesc}>
                这里只展示满足平台重载门槛、并支持客户直达下单的服务，不再混任务卡片和订单卡片。
              </Text>
            </View>

            <ObjectCard style={styles.filterCard}>
              <Text style={styles.filterTitle}>筛选条件</Text>
              <TextInput
                style={styles.searchInput}
                placeholder="按作业区域筛选，例如：广东、海岛、高原"
                value={region}
                onChangeText={setRegion}
                onSubmitEditing={onSearch}
              />

              <View style={styles.filterChipRow}>
                {SCENE_FILTERS.map(filter => (
                  <TouchableOpacity
                    key={filter.key || 'all'}
                    style={[
                      styles.filterChip,
                      activeScene === filter.key && styles.filterChipActive,
                    ]}
                    onPress={() => setActiveScene(filter.key)}>
                    <Text
                      style={[
                        styles.filterChipText,
                        activeScene === filter.key && styles.filterChipTextActive,
                      ]}>
                      {filter.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity style={styles.searchBtn} onPress={onSearch}>
                <Text style={styles.searchBtnText}>更新筛选结果</Text>
              </TouchableOpacity>
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
                title="当前没有匹配的服务"
                description="可以调整场景或区域筛选，或者先发布任务，让平台反向撮合合适机主。"
                actionText="发布任务"
                onAction={() => navigation.navigate('PublishCargo')}
              />
            </ObjectCard>
          )
        }
        ListFooterComponent={
          hasMore && supplies.length > 0 ? (
            <ActivityIndicator style={styles.footerLoading} color={theme.primary} />
          ) : null
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
    gap: 12,
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
    fontSize: 16,
    color: theme.text,
    fontWeight: '800',
    marginBottom: 12,
  },
  searchInput: {
    borderWidth: 1,
    borderColor: theme.inputBorder,
    borderRadius: 12,
    backgroundColor: theme.bgSecondary,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: theme.text,
  },
  filterChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  filterChip: {
    borderWidth: 1,
    borderColor: theme.inputBorder,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: theme.card,
  },
  filterChipActive: {
    borderColor: theme.primaryBorder,
    backgroundColor: theme.primaryBg,
  },
  filterChipText: {
    fontSize: 12,
    color: theme.textSub,
    fontWeight: '700',
  },
  filterChipTextActive: {
    color: theme.primaryText,
  },
  searchBtn: {
    marginTop: 12,
    backgroundColor: theme.primary,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  searchBtnText: {
    fontSize: 14,
    color: theme.btnPrimaryText,
    fontWeight: '800',
  },
  card: {
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    alignItems: 'center',
  },
  directPill: {
    borderRadius: 999,
    backgroundColor: theme.success + '18',
    borderWidth: 1,
    borderColor: theme.success + '44',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  directPillText: {
    fontSize: 11,
    color: theme.success,
    fontWeight: '800',
  },
  supplyNo: {
    marginTop: 12,
    fontSize: 12,
    color: theme.textHint,
    fontWeight: '700',
  },
  title: {
    marginTop: 6,
    fontSize: 17,
    lineHeight: 24,
    color: theme.text,
    fontWeight: '800',
  },
  sceneRow: {
    marginTop: 10,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  sceneTag: {
    backgroundColor: theme.bgSecondary,
    borderWidth: 1,
    borderColor: theme.inputBorder,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  sceneTagText: {
    fontSize: 11,
    color: theme.text,
    fontWeight: '700',
  },
  metricRow: {
    marginTop: 12,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  metricText: {
    fontSize: 12,
    color: theme.textSub,
  },
  cardFooter: {
    marginTop: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  price: {
    flex: 1,
    fontSize: 16,
    color: theme.danger,
    fontWeight: '800',
  },
  detailBtn: {
    borderRadius: 999,
    backgroundColor: theme.primary,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  detailBtnOwner: {
    backgroundColor: theme.card,
    borderWidth: 1,
    borderColor: theme.primary,
  },
  detailBtnText: {
    fontSize: 12,
    color: theme.btnPrimaryText,
    fontWeight: '800',
  },
  detailBtnTextOwner: {
    color: theme.primaryText,
  },
  loading: {
    paddingVertical: 36,
  },
  footerLoading: {
    paddingVertical: 18,
  },
});
