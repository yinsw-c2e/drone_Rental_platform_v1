import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  ActivityIndicator,
  FlatList,
  Platform,
  RefreshControl,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import {useSelector} from 'react-redux';

import AddressInputField from '../../components/AddressInputField';
import EmptyState from '../../components/business/EmptyState';
import ObjectCard from '../../components/business/ObjectCard';
import SourceTag from '../../components/business/SourceTag';
import StatusBadge from '../../components/business/StatusBadge';
import {getObjectStatusMeta} from '../../components/business/visuals';
import {supplyService} from '../../services/supply';
import {RootState} from '../../store/store';
import {AddressData, QuickOrderDraft, SupplySummary} from '../../types';
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

function formatDateTime(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  const hour = `${date.getHours()}`.padStart(2, '0');
  const minute = `${date.getMinutes()}`.padStart(2, '0');
  return `${year}-${month}-${day} ${hour}:${minute}`;
}

function buildDefaultStartDate(): Date {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  date.setHours(9, 0, 0, 0);
  return date;
}

function buildDefaultEndDate(startDate: Date): Date {
  const date = new Date(startDate.getTime());
  date.setHours(date.getHours() + 2);
  return date;
}

function parseDraftDate(value: string | undefined, fallback: Date): Date {
  if (!value) {
    return fallback;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return fallback;
  }
  return parsed;
}

function resolveMatchRegion(draft: QuickOrderDraft): string {
  return (
    draft.match_region?.trim() ||
    draft.destination_address?.city?.trim() ||
    draft.departure_address?.city?.trim() ||
    draft.destination_address?.district?.trim() ||
    draft.departure_address?.district?.trim() ||
    draft.destination_address?.address?.trim() ||
    draft.departure_address?.address?.trim() ||
    ''
  );
}

function summarizeAddress(address?: AddressData | null): string {
  if (!address) {
    return '待补充';
  }
  return address.name || address.address || '待补充';
}

function normalizeInitialQuickOrderDraft(params: any): QuickOrderDraft | undefined {
  if (params?.quickOrderDraft) {
    return params.quickOrderDraft as QuickOrderDraft;
  }
  if (params?.quickOrder) {
    return {
      cargo_scene: params.quickOrder.cargoScene || SCENE_FILTERS[1].key,
      cargo_weight_kg: Number(params.quickOrder.cargoWeight) || undefined,
      departure_address: params.quickOrder.pickupAddress || null,
      destination_address: params.quickOrder.deliveryAddress || null,
    };
  }
  return undefined;
}

function SceneTag({label}: {label: string}) {
  const {theme} = useTheme();
  const styles = getStyles(theme);
  return (
    <View style={styles.sceneTag}>
      <Text style={styles.sceneTagText}>{label}</Text>
    </View>
  );
}

export default function OfferListScreen({route, navigation}: any) {
  const {theme} = useTheme();
  const styles = getStyles(theme);
  const currentUser = useSelector((state: RootState) => state.auth.user);
  const initialQuickOrderDraft = useMemo(() => normalizeInitialQuickOrderDraft(route?.params), [route?.params]);
  const quickEntryRequested = Boolean(route?.params?.quickOrderMode || initialQuickOrderDraft);
  const initializedRef = useRef(false);
  const defaultQuickStart = useMemo(
    () => parseDraftDate(initialQuickOrderDraft?.scheduled_start_at, buildDefaultStartDate()),
    [initialQuickOrderDraft?.scheduled_start_at],
  );
  const defaultQuickEnd = useMemo(
    () => parseDraftDate(initialQuickOrderDraft?.scheduled_end_at, buildDefaultEndDate(defaultQuickStart)),
    [defaultQuickStart, initialQuickOrderDraft?.scheduled_end_at],
  );

  const [supplies, setSupplies] = useState<SupplySummary[]>([]);
  const [loading, setLoading] = useState(!quickEntryRequested || Boolean(initialQuickOrderDraft));
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [quickOrderMode, setQuickOrderMode] = useState(quickEntryRequested);
  const [hasQuickOrderSearch, setHasQuickOrderSearch] = useState(Boolean(initialQuickOrderDraft));
  const [lastQuickOrderDraft, setLastQuickOrderDraft] = useState<QuickOrderDraft | null>(
    initialQuickOrderDraft || null,
  );
  const [editQuickOrder, setEditQuickOrder] = useState(!initialQuickOrderDraft);

  const [region, setRegion] = useState(initialQuickOrderDraft ? resolveMatchRegion(initialQuickOrderDraft) : '');
  const [activeScene, setActiveScene] = useState(initialQuickOrderDraft?.cargo_scene || '');
  const [minPayloadKg, setMinPayloadKg] = useState<number | undefined>(
    initialQuickOrderDraft?.cargo_weight_kg,
  );

  const [departureAddress, setDepartureAddress] = useState<AddressData | null>(
    initialQuickOrderDraft?.departure_address || null,
  );
  const [destinationAddress, setDestinationAddress] = useState<AddressData | null>(
    initialQuickOrderDraft?.destination_address || null,
  );
  const [quickCargoScene, setQuickCargoScene] = useState(
    initialQuickOrderDraft?.cargo_scene || SCENE_FILTERS[1].key,
  );
  const [quickCargoWeight, setQuickCargoWeight] = useState(
    initialQuickOrderDraft?.cargo_weight_kg ? String(initialQuickOrderDraft.cargo_weight_kg) : '',
  );
  const [quickCargoType, setQuickCargoType] = useState(initialQuickOrderDraft?.cargo_type || '');
  const [startDate, setStartDate] = useState<Date>(defaultQuickStart);
  const [endDate, setEndDate] = useState<Date>(defaultQuickEnd);
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);

  const fetchSupplies = useCallback(
    async (
      pageNum = 1,
      isRefresh = false,
      query?: {
        region?: string;
        cargoScene?: string;
        minPayloadKg?: number;
      },
    ) => {
      const targetRegion = query?.region || '';
      const targetScene = query?.cargoScene || '';
      const targetMinPayloadKg = query?.minPayloadKg;

      try {
        const res = await supplyService.list({
          page: pageNum,
          page_size: 10,
          region: targetRegion.trim() || undefined,
          cargo_scene: targetScene || undefined,
          min_payload_kg: targetMinPayloadKg,
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
    [],
  );

  useEffect(() => {
    if (initializedRef.current) {
      return;
    }
    initializedRef.current = true;

    if (quickOrderMode && !hasQuickOrderSearch) {
      setSupplies([]);
      setHasMore(false);
      setLoading(false);
      return;
    }
    const initialRegion = initialQuickOrderDraft ? resolveMatchRegion(initialQuickOrderDraft) : region;
    const initialScene = initialQuickOrderDraft?.cargo_scene || activeScene;
    const initialMinPayloadKg = initialQuickOrderDraft?.cargo_weight_kg || minPayloadKg;

    setLoading(true);
    setPage(1);
    fetchSupplies(1, true, {
      region: initialRegion,
      cargoScene: initialScene,
      minPayloadKg: initialMinPayloadKg,
    });
  }, [fetchSupplies, hasQuickOrderSearch, initialQuickOrderDraft, quickOrderMode, activeScene, minPayloadKg, region]);

  const buildQuickOrderDraft = useCallback(
    (overrides?: Partial<QuickOrderDraft>): QuickOrderDraft => {
      const weight = Number(quickCargoWeight);
      const fallbackDraft: QuickOrderDraft = {
        cargo_scene: quickCargoScene || SCENE_FILTERS[1].key,
        cargo_type: quickCargoType.trim() || '重载物资',
        cargo_weight_kg: Number.isFinite(weight) && weight > 0 ? weight : undefined,
        departure_address: departureAddress,
        destination_address: destinationAddress,
        scheduled_start_at: startDate.toISOString(),
        scheduled_end_at: endDate.toISOString(),
        match_region: resolveMatchRegion({
          cargo_scene: quickCargoScene || SCENE_FILTERS[1].key,
          departure_address: departureAddress,
          destination_address: destinationAddress,
        }),
      };

      return {
        ...fallbackDraft,
        ...overrides,
      };
    },
    [
      departureAddress,
      destinationAddress,
      endDate,
      quickCargoScene,
      quickCargoType,
      quickCargoWeight,
      startDate,
    ],
  );

  const handleQuickOrderSearch = useCallback(async () => {
    if (!departureAddress || !destinationAddress) {
      return;
    }

    const weight = Number(quickCargoWeight);
    if (!weight || weight <= 0) {
      return;
    }
    if (endDate <= startDate) {
      return;
    }

    const nextDraft = buildQuickOrderDraft({
      cargo_weight_kg: weight,
    });
    const matchRegion = resolveMatchRegion(nextDraft);

    setLastQuickOrderDraft({...nextDraft, match_region: matchRegion});
    setQuickOrderMode(true);
    setHasQuickOrderSearch(true);
    setEditQuickOrder(false);
    setRegion(matchRegion);
    setActiveScene(nextDraft.cargo_scene);
    setMinPayloadKg(weight);
    setPage(1);
    setLoading(true);
    await fetchSupplies(1, true, {
      region: matchRegion,
      cargoScene: nextDraft.cargo_scene,
      minPayloadKg: weight,
    });
  }, [
    buildQuickOrderDraft,
    departureAddress,
    destinationAddress,
    endDate,
    fetchSupplies,
    quickCargoWeight,
    startDate,
  ]);

  const handlePublishTask = useCallback(() => {
    navigation.navigate('PublishCargo', {
      quickOrderDraft: buildQuickOrderDraft(),
    });
  }, [buildQuickOrderDraft, navigation]);

  const handleBrowseMode = useCallback(async () => {
    setQuickOrderMode(false);
    setHasQuickOrderSearch(false);
    setLastQuickOrderDraft(null);
    setEditQuickOrder(false);
    setRegion('');
    setActiveScene('');
    setMinPayloadKg(undefined);
    setPage(1);
    setLoading(true);
    await fetchSupplies(1, true, {
      region: '',
      cargoScene: '',
      minPayloadKg: undefined,
    });
  }, [fetchSupplies]);

  const onRefresh = useCallback(() => {
    if (quickOrderMode && !hasQuickOrderSearch) {
      setRefreshing(false);
      return;
    }
    setRefreshing(true);
    setPage(1);
    fetchSupplies(1, true, {
      region,
      cargoScene: activeScene,
      minPayloadKg,
    });
  }, [activeScene, fetchSupplies, hasQuickOrderSearch, minPayloadKg, quickOrderMode, region]);

  const onSearch = useCallback(() => {
    setLoading(true);
    setPage(1);
    fetchSupplies(1, true, {
      region,
      cargoScene: activeScene,
      minPayloadKg,
    });
  }, [activeScene, fetchSupplies, minPayloadKg, region]);

  const onLoadMore = useCallback(() => {
    if (loading || refreshing || !hasMore || (quickOrderMode && !hasQuickOrderSearch)) {
      return;
    }
    const nextPage = page + 1;
    setPage(nextPage);
    fetchSupplies(nextPage, false, {
      region,
      cargoScene: activeScene,
      minPayloadKg,
    });
  }, [activeScene, fetchSupplies, hasMore, hasQuickOrderSearch, loading, minPayloadKg, page, quickOrderMode, refreshing, region]);

  const onStartDateChange = (event: any, selectedDate?: Date) => {
    setShowStartPicker(Platform.OS === 'ios');
    if (Platform.OS === 'android' && event?.type === 'dismissed') {
      return;
    }
    if (!selectedDate) {
      return;
    }
    setStartDate(selectedDate);
    if (selectedDate >= endDate) {
      const nextEnd = buildDefaultEndDate(selectedDate);
      setEndDate(nextEnd);
    }
  };

  const onEndDateChange = (event: any, selectedDate?: Date) => {
    setShowEndPicker(Platform.OS === 'ios');
    if (Platform.OS === 'android' && event?.type === 'dismissed') {
      return;
    }
    if (selectedDate) {
      setEndDate(selectedDate);
    }
  };

  const heroTitle = useMemo(() => {
    if (quickOrderMode) {
      if (hasQuickOrderSearch && lastQuickOrderDraft) {
        return '已为你筛出可直接下单的服务';
      }
      return '先填最少信息，我来帮你筛服务';
    }
    if (region.trim()) {
      return `${region.trim()} 服务市场`;
    }
    return '重载吊运服务市场';
  }, [hasQuickOrderSearch, lastQuickOrderDraft, quickOrderMode, region]);

  const heroDesc = useMemo(() => {
    if (quickOrderMode) {
      if (hasQuickOrderSearch && lastQuickOrderDraft) {
        const regionText = resolveMatchRegion(lastQuickOrderDraft) || '当前区域';
        return `当前按 ${regionText}、${getSupplySceneLabel(lastQuickOrderDraft.cargo_scene)} 和 ${
          lastQuickOrderDraft.cargo_weight_kg || 0
        }kg 吊重需求筛选。合适就继续确认方案，不合适就一键改为发布任务。`;
      }
      return '输入起点、终点、货物和时间后，系统只推荐支持直达下单的服务，尽量把流程压缩成最短链路。';
    }
    return '这里只展示满足平台重载门槛、并支持客户直达下单的服务，不再混任务卡片和订单卡片。';
  }, [hasQuickOrderSearch, lastQuickOrderDraft, quickOrderMode]);

  const quickOrderBlockedMessage = useMemo(() => {
    if (!departureAddress || !destinationAddress) {
      return '先补起点和终点，系统才能判断服务范围。';
    }
    if (!(Number(quickCargoWeight) > 0)) {
      return '补上货物重量后，才能筛出吊重能力匹配的服务。';
    }
    if (endDate <= startDate) {
      return '结束时间需要晚于开始时间。';
    }
    return '';
  }, [departureAddress, destinationAddress, endDate, quickCargoWeight, startDate]);

  const renderItem = ({item}: {item: SupplySummary}) => {
    const isMySupply = item.owner_user_id === currentUser?.id;
    const isQuickOrderResult = Boolean(lastQuickOrderDraft);
    return (
      <ObjectCard
        style={styles.card}
        onPress={() =>
          navigation.navigate('OfferDetail', {
            id: item.id,
            quickOrderDraft: isQuickOrderResult ? lastQuickOrderDraft : undefined,
          })
        }>
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
          {isQuickOrderResult && lastQuickOrderDraft?.cargo_weight_kg ? (
            <Text style={styles.metricText}>你的货物 {lastQuickOrderDraft.cargo_weight_kg}kg</Text>
          ) : null}
        </View>

        <View style={styles.cardFooter}>
          <Text style={styles.price}>{formatSupplyPricing(item.base_price_amount, item.pricing_unit)}</Text>
          <TouchableOpacity
            style={[styles.detailBtn, isMySupply && styles.detailBtnOwner]}
            onPress={() =>
              navigation.navigate('OfferDetail', {
                id: item.id,
                quickOrderDraft: isQuickOrderResult ? lastQuickOrderDraft : undefined,
              })
            }>
            <Text style={[styles.detailBtnText, isMySupply && styles.detailBtnTextOwner]}>
              {isMySupply ? '查看供给' : isQuickOrderResult ? '确认方案' : '查看详情'}
            </Text>
          </TouchableOpacity>
        </View>
      </ObjectCard>
    );
  };

  const listEmptyComponent = () => {
    if (loading) {
      return <ActivityIndicator style={styles.loading} color={theme.primary} />;
    }

    if (quickOrderMode && !hasQuickOrderSearch) {
      return (
        <ObjectCard>
          <EmptyState
            icon="📍"
            title="先填写快速下单信息"
            description="输入起点、终点、货物和时间后，我会只展示当前可直接下单的服务。"
            actionText="改为浏览全部服务"
            onAction={handleBrowseMode}
          />
        </ObjectCard>
      );
    }

    return (
      <ObjectCard>
        <EmptyState
          icon="🛩️"
          title={lastQuickOrderDraft ? '这次没有筛到可直接下单的服务' : '当前没有匹配的服务'}
          description={
            lastQuickOrderDraft
              ? '已保留你的起终点和货物摘要，可以一键改为发布任务，让平台继续反向撮合。'
              : '可以调整场景或区域筛选，或者先发布任务，让平台反向撮合合适机主。'
          }
          actionText="发布任务"
          onAction={() =>
            navigation.navigate('PublishCargo', {
              quickOrderDraft: lastQuickOrderDraft || buildQuickOrderDraft(),
            })
          }
        />
      </ObjectCard>
    );
  };

  return (
    <SafeAreaView style={[styles.container, {backgroundColor: theme.bg}]}>
      <View style={styles.stepHeader}>
        <View style={styles.stepTrack}>
          <View style={[styles.stepDot, styles.stepDotCompleted]} />
          <View style={[styles.stepLine, styles.stepLineCompleted]} />
          <View style={[styles.stepDot, styles.stepDotActive]} />
          <View style={styles.stepLine} />
          <View style={styles.stepDot} />
        </View>
        <View style={styles.stepLabels}>
          <Text style={[styles.stepLabelText, styles.stepLabelTextCompleted]}>填写信息</Text>
          <Text style={[styles.stepLabelText, styles.stepLabelTextActive]}>挑选服务</Text>
          <Text style={styles.stepLabelText}>确认下单</Text>
        </View>
      </View>

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
            {quickOrderMode ? (
              <View style={styles.quickOrderHeader}>
                <View style={styles.headerTitleRow}>
                  <Text style={styles.headerTitle}>为您匹配到以下机组</Text>
                  <TouchableOpacity style={styles.editBtn} onPress={() => setEditQuickOrder(!editQuickOrder)}>
                    <Text style={styles.editBtnText}>{editQuickOrder ? '收起' : '修改条件'}</Text>
                  </TouchableOpacity>
                </View>

                {editQuickOrder ? (
                  <ObjectCard style={styles.editCard}>
                    <Text style={styles.inputLabel}>起点地址</Text>
                    <AddressInputField
                      value={departureAddress}
                      onSelect={setDepartureAddress}
                    />
                    <Text style={styles.inputLabel}>终点地址</Text>
                    <AddressInputField
                      value={destinationAddress}
                      onSelect={setDestinationAddress}
                    />
                    <View style={styles.cargoRow}>
                      <View style={{flex: 1}}>
                        <Text style={styles.inputLabel}>重量 (kg)</Text>
                        <TextInput
                          style={styles.inlineInput}
                          keyboardType="numeric"
                          value={quickCargoWeight}
                          onChangeText={setQuickCargoWeight}
                        />
                      </View>
                      <View style={{flex: 1}}>
                        <Text style={styles.inputLabel}>场景</Text>
                        <TouchableOpacity
                          style={styles.sceneSelect}
                          onPress={() => {
                            const currentIndex = SCENE_FILTERS.findIndex(f => f.key === quickCargoScene);
                            const nextIndex = (currentIndex + 1) % SCENE_FILTERS.length;
                            setQuickCargoScene(SCENE_FILTERS[nextIndex === 0 ? 1 : nextIndex].key);
                          }}
                        >
                          <Text style={styles.sceneSelectText}>{getSupplySceneLabel(quickCargoScene)}</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                    <TouchableOpacity style={styles.applyBtn} onPress={handleQuickOrderSearch}>
                      <Text style={styles.applyBtnText}>重新匹配</Text>
                    </TouchableOpacity>
                  </ObjectCard>
                ) : (
                  <View style={styles.summaryBadge}>
                    <Text style={styles.summaryBadgeText} numberOfLines={1}>
                      {summarizeAddress(departureAddress)} → {summarizeAddress(destinationAddress)} | {quickCargoWeight}kg
                    </Text>
                  </View>
                )}

                {supplies.length > 0 && !loading && (
                  <Text style={styles.resultCount}>找到 {supplies.length} 个支持直接下单的优质服务</Text>
                )}
              </View>
            ) : (
              <View style={styles.hero}>
                <Text style={styles.heroEyebrow}>服务市场</Text>
                <Text style={styles.heroTitle}>{heroTitle}</Text>
                <Text style={styles.heroDesc}>{heroDesc}</Text>
                <View style={styles.heroActionRow}>
                  <TouchableOpacity
                    style={styles.heroGhostBtn}
                    onPress={() => {
                      setQuickOrderMode(true);
                      setHasQuickOrderSearch(false);
                      setLastQuickOrderDraft(null);
                      setSupplies([]);
                    }}>
                    <Text style={styles.heroGhostBtnText}>切换到快速下单模式</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        }
        ListEmptyComponent={listEmptyComponent}
      />
    </SafeAreaView>
  );
}

const getStyles = (theme: AppTheme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.bg,
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
    content: {
      padding: 16,
      paddingBottom: 28,
    },
    quickOrderHeader: {
      marginBottom: 16,
    },
    headerTitleRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12,
    },
    headerTitle: {
      fontSize: 20,
      fontWeight: '800',
      color: theme.text,
    },
    editBtn: {
      paddingHorizontal: 10,
      paddingVertical: 4,
    },
    editBtnText: {
      fontSize: 13,
      color: theme.primary,
      fontWeight: '700',
    },
    summaryBadge: {
      backgroundColor: theme.bgSecondary,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderWidth: 1,
      borderColor: theme.divider,
    },
    summaryBadgeText: {
      fontSize: 12,
      color: theme.textSub,
      fontWeight: '600',
    },
    editCard: {
      padding: 14,
      borderRadius: 16,
      marginBottom: 10,
    },
    inputLabel: {
      fontSize: 11,
      fontWeight: '700',
      color: theme.textHint,
      marginBottom: 4,
    },
    cargoRow: {
      flexDirection: 'row',
      gap: 12,
      marginTop: 8,
    },
    inlineInput: {
      backgroundColor: theme.bgSecondary,
      borderRadius: 8,
      paddingHorizontal: 10,
      paddingVertical: 8,
      fontSize: 14,
      color: theme.text,
    },
    sceneSelect: {
      backgroundColor: theme.bgSecondary,
      borderRadius: 8,
      paddingHorizontal: 10,
      paddingVertical: 8,
      justifyContent: 'center',
    },
    sceneSelectText: {
      fontSize: 14,
      color: theme.text,
      fontWeight: '600',
    },
    applyBtn: {
      marginTop: 14,
      backgroundColor: theme.primary,
      borderRadius: 10,
      paddingVertical: 10,
      alignItems: 'center',
    },
    applyBtnText: {
      color: '#FFFFFF',
      fontSize: 14,
      fontWeight: '700',
    },
    resultCount: {
      marginTop: 16,
      fontSize: 13,
      color: theme.textSub,
      fontWeight: '600',
    },
    hero: {
      backgroundColor: theme.primary,
      borderRadius: 24,
      padding: 20,
      marginBottom: 16,
    },
    heroEyebrow: {
      fontSize: 11,
      color: 'rgba(255,255,255,0.7)',
      fontWeight: '700',
    },
    heroTitle: {
      marginTop: 4,
      fontSize: 24,
      color: '#FFFFFF',
      fontWeight: '800',
    },
    heroDesc: {
      marginTop: 8,
      fontSize: 13,
      lineHeight: 18,
      color: 'rgba(255,255,255,0.85)',
    },
    heroActionRow: {
      marginTop: 12,
    },
    heroGhostBtn: {
      alignSelf: 'flex-start',
      backgroundColor: 'rgba(255,255,255,0.15)',
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.3)',
    },
    heroGhostBtnText: {
      color: '#FFFFFF',
      fontSize: 12,
      fontWeight: '700',
    },
    card: {
      marginBottom: 12,
      borderRadius: 20,
      overflow: 'hidden',
    },
    cardHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    cardHeaderLeft: {
      flexDirection: 'row',
      gap: 6,
    },
    directPill: {
      backgroundColor: theme.success + '15',
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 6,
    },
    directPillText: {
      fontSize: 10,
      color: theme.success,
      fontWeight: '800',
    },
    supplyNo: {
      marginTop: 10,
      fontSize: 10,
      color: theme.textHint,
      fontWeight: '700',
    },
    title: {
      fontSize: 16,
      fontWeight: '800',
      color: theme.text,
      marginTop: 4,
    },
    sceneRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
      marginTop: 10,
    },
    sceneTag: {
      backgroundColor: theme.bgSecondary,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 6,
    },
    sceneTagText: {
      fontSize: 10,
      color: theme.textSub,
      fontWeight: '700',
    },
    metricRow: {
      flexDirection: 'row',
      marginTop: 12,
      gap: 12,
    },
    metricText: {
      fontSize: 11,
      color: theme.textSub,
      fontWeight: '500',
    },
    cardFooter: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: 14,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: theme.divider,
    },
    price: {
      fontSize: 17,
      color: theme.danger,
      fontWeight: '800',
    },
    detailBtn: {
      backgroundColor: theme.primary,
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 10,
    },
    detailBtnOwner: {
      backgroundColor: theme.card,
      borderWidth: 1,
      borderColor: theme.primary,
    },
    detailBtnText: {
      color: '#FFFFFF',
      fontSize: 13,
      fontWeight: '700',
    },
    detailBtnTextOwner: {
      color: theme.primaryText,
    },
    loading: {
      paddingVertical: 40,
    },
  });
