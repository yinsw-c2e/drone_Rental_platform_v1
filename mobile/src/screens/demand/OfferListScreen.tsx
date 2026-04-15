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

  const onStartDateChange = (_event: any, selectedDate?: Date) => {
    setShowStartPicker(Platform.OS === 'ios');
    if (!selectedDate) {
      return;
    }
    setStartDate(selectedDate);
    if (selectedDate >= endDate) {
      const nextEnd = buildDefaultEndDate(selectedDate);
      setEndDate(nextEnd);
    }
  };

  const onEndDateChange = (_event: any, selectedDate?: Date) => {
    setShowEndPicker(Platform.OS === 'ios');
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
              <Text style={styles.heroEyebrow}>{quickOrderMode ? '快速下单' : '服务市场'}</Text>
              <Text style={styles.heroTitle}>{heroTitle}</Text>
              <Text style={styles.heroDesc}>{heroDesc}</Text>
              <View style={styles.heroActionRow}>
                {quickOrderMode ? (
                  <TouchableOpacity style={styles.heroGhostBtn} onPress={handleBrowseMode}>
                    <Text style={styles.heroGhostBtnText}>先浏览全部服务</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    style={styles.heroGhostBtn}
                    onPress={() => {
                      setQuickOrderMode(true);
                      setHasQuickOrderSearch(false);
                      setLastQuickOrderDraft(null);
                      setSupplies([]);
                    }}>
                    <Text style={styles.heroGhostBtnText}>切到快速下单</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {quickOrderMode ? (
              <ObjectCard style={styles.filterCard}>
                <Text style={styles.filterTitle}>
                  {hasQuickOrderSearch && !editQuickOrder ? '第 2 步：挑选推荐服务' : '第 1 步：先补最小下单信息'}
                </Text>
                <Text style={styles.helperText}>
                  {hasQuickOrderSearch && !editQuickOrder
                    ? '系统已经按你的起终点、吊重和场景筛了一遍。觉得不合适时，再展开修改条件。'
                    : '标准化场景先走这里。你只需要告诉我起终点、货物和时间，剩下的先交给系统筛服务。'}
                </Text>

                <View style={styles.quickSummaryCard}>
                  <Text style={styles.quickSummaryTitle}>本次输入摘要</Text>
                  <Text style={styles.quickSummaryText}>
                    {summarizeAddress(departureAddress)}
                    {' -> '}
                    {summarizeAddress(destinationAddress)}
                  </Text>
                  <Text style={styles.quickSummaryText}>
                    {getSupplySceneLabel(quickCargoScene)} / {quickCargoWeight || '--'}kg /{' '}
                    {quickCargoType.trim() || '重载物资'}
                  </Text>
                  <Text style={styles.quickSummaryText}>
                    {formatDateTime(startDate)} - {formatDateTime(endDate)}
                  </Text>
                  {quickOrderBlockedMessage ? (
                    <Text style={styles.quickSummaryHint}>{quickOrderBlockedMessage}</Text>
                  ) : (
                    <Text style={styles.quickSummaryHint}>
                      系统会优先按送达区域和吊重能力筛选支持直达下单的服务。
                    </Text>
                  )}
                </View>

                {hasQuickOrderSearch && !editQuickOrder ? (
                  <View style={styles.primaryActionRow}>
                    <TouchableOpacity style={styles.searchBtn} onPress={() => setEditQuickOrder(true)}>
                      <Text style={styles.searchBtnText}>修改条件重新匹配</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.secondaryActionBtn} onPress={handlePublishTask}>
                      <Text style={styles.secondaryActionBtnText}>这条路不合适，改为发布任务</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <>
                    <Text style={styles.inputLabel}>起点地址 *</Text>
                    <AddressInputField
                      value={departureAddress}
                      placeholder="点击选择起点地址"
                      onSelect={setDepartureAddress}
                    />

                    <Text style={styles.inputLabel}>终点地址 *</Text>
                    <AddressInputField
                      value={destinationAddress}
                      placeholder="点击选择终点地址"
                      onSelect={setDestinationAddress}
                    />

                    <Text style={styles.inputLabel}>作业场景 *</Text>
                    <View style={styles.filterChipRow}>
                      {SCENE_FILTERS.filter(filter => filter.key).map(filter => (
                        <TouchableOpacity
                          key={filter.key}
                          style={[
                            styles.filterChip,
                            quickCargoScene === filter.key && styles.filterChipActive,
                          ]}
                          onPress={() => setQuickCargoScene(filter.key)}>
                          <Text
                            style={[
                              styles.filterChipText,
                              quickCargoScene === filter.key && styles.filterChipTextActive,
                            ]}>
                            {filter.label}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>

                    <Text style={styles.inputLabel}>货物类型</Text>
                    <TextInput
                      style={styles.searchInput}
                      placeholder="例如：塔材、设备箱、救援物资"
                      placeholderTextColor={theme.textHint}
                      value={quickCargoType}
                      onChangeText={setQuickCargoType}
                    />

                    <Text style={styles.inputLabel}>货物重量 (kg) *</Text>
                    <TextInput
                      style={styles.searchInput}
                      placeholder="例如：120"
                      placeholderTextColor={theme.textHint}
                      keyboardType="numeric"
                      value={quickCargoWeight}
                      onChangeText={setQuickCargoWeight}
                    />

                    <Text style={styles.inputLabel}>期望开始时间 *</Text>
                    <TouchableOpacity style={styles.dateInput} onPress={() => setShowStartPicker(true)}>
                      <Text style={styles.dateText}>{formatDateTime(startDate)}</Text>
                    </TouchableOpacity>
                    {showStartPicker ? (
                      <DateTimePicker
                        value={startDate}
                        mode="datetime"
                        display="default"
                        onChange={onStartDateChange}
                        minimumDate={new Date()}
                      />
                    ) : null}

                    <Text style={styles.inputLabel}>期望结束时间 *</Text>
                    <TouchableOpacity style={styles.dateInput} onPress={() => setShowEndPicker(true)}>
                      <Text style={styles.dateText}>{formatDateTime(endDate)}</Text>
                    </TouchableOpacity>
                    {showEndPicker ? (
                      <DateTimePicker
                        value={endDate}
                        mode="datetime"
                        display="default"
                        onChange={onEndDateChange}
                        minimumDate={startDate}
                      />
                    ) : null}

                    <View style={styles.primaryActionRow}>
                      <TouchableOpacity
                        style={[styles.searchBtn, Boolean(quickOrderBlockedMessage) && styles.disabledBtn]}
                        onPress={handleQuickOrderSearch}
                        disabled={Boolean(quickOrderBlockedMessage)}>
                        <Text style={styles.searchBtnText}>第 2 步：查看推荐服务</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.secondaryActionBtn} onPress={handlePublishTask}>
                        <Text style={styles.secondaryActionBtnText}>改为发布任务</Text>
                      </TouchableOpacity>
                    </View>
                  </>
                )}
              </ObjectCard>
            ) : (
              <ObjectCard style={styles.filterCard}>
                <Text style={styles.filterTitle}>筛选条件</Text>
                <TextInput
                  style={styles.searchInput}
                  placeholder="按作业区域筛选，例如：广东、海岛、高原"
                  placeholderTextColor={theme.textHint}
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
            )}
          </View>
        }
        ListEmptyComponent={listEmptyComponent}
        ListFooterComponent={
          hasMore && supplies.length > 0 ? (
            <ActivityIndicator style={styles.footerLoading} color={theme.primary} />
          ) : null
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
    heroActionRow: {
      marginTop: 14,
      flexDirection: 'row',
      justifyContent: 'flex-start',
    },
    heroGhostBtn: {
      borderRadius: 999,
      paddingHorizontal: 14,
      paddingVertical: 10,
      backgroundColor: 'rgba(255,255,255,0.16)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.22)',
    },
    heroGhostBtnText: {
      fontSize: 12,
      color: '#FFFFFF',
      fontWeight: '800',
    },
    filterCard: {
      marginBottom: 12,
    },
    filterTitle: {
      fontSize: 16,
      color: theme.text,
      fontWeight: '800',
      marginBottom: 8,
    },
    helperText: {
      fontSize: 13,
      lineHeight: 20,
      color: theme.textSub,
      marginBottom: 12,
    },
    inputLabel: {
      marginTop: 6,
      marginBottom: 8,
      fontSize: 13,
      color: theme.textSub,
      fontWeight: '700',
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
    dateInput: {
      borderWidth: 1,
      borderColor: theme.inputBorder,
      borderRadius: 12,
      backgroundColor: theme.bgSecondary,
      paddingHorizontal: 14,
      paddingVertical: 12,
    },
    dateText: {
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
    quickSummaryCard: {
      marginTop: 14,
      borderRadius: 14,
      padding: 14,
      backgroundColor: theme.bgSecondary,
      borderWidth: 1,
      borderColor: theme.inputBorder,
      gap: 6,
    },
    quickSummaryTitle: {
      fontSize: 13,
      color: theme.text,
      fontWeight: '800',
    },
    quickSummaryText: {
      fontSize: 13,
      lineHeight: 20,
      color: theme.text,
    },
    quickSummaryHint: {
      fontSize: 12,
      lineHeight: 18,
      color: theme.textSub,
    },
    primaryActionRow: {
      marginTop: 14,
      gap: 10,
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
    secondaryActionBtn: {
      borderRadius: 12,
      paddingVertical: 12,
      alignItems: 'center',
      backgroundColor: theme.card,
      borderWidth: 1,
      borderColor: theme.inputBorder,
    },
    secondaryActionBtnText: {
      fontSize: 14,
      color: theme.text,
      fontWeight: '700',
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
    disabledBtn: {
      opacity: 0.55,
    },
  });
