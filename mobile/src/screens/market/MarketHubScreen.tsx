import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Modal,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {useSelector} from 'react-redux';

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
import {marketAssets} from '../../assets/miniProgramAssets';

type MarketTab = 'demand' | 'supply';

const serviceThumbs = [
  marketAssets.cardDrone1,
  marketAssets.cardDrone2,
  marketAssets.cardDrone3,
];

const capabilityLabels = ['专业飞手团队', '合规运营', '安全可靠'];

const regionFilters = [
  {label: '全部地区', value: ''},
  {label: '佛山', value: '佛山'},
  {label: '广州', value: '广州'},
  {label: '深圳', value: '深圳'},
  {label: '东莞', value: '东莞'},
  {label: '中山', value: '中山'},
];

const payloadFilters = [
  {label: '全部载重', value: 0},
  {label: '50kg以上', value: 50},
  {label: '80kg以上', value: 80},
  {label: '100kg以上', value: 100},
];

const sceneFilters = [
  {label: '全部场景', value: ''},
  {label: '电网建设', value: 'power_grid'},
  {label: '山区农副产品', value: 'mountain_agriculture'},
  {label: '高原给养', value: 'plateau_supply'},
  {label: '海岛补给', value: 'island_supply'},
  {label: '应急救援', value: 'emergency'},
];

const getSceneValueFromKeyword = (keyword: string) => {
  const text = keyword.trim().toLowerCase();
  if (!text) {
    return '';
  }
  const matched = sceneFilters.slice(1).find(item =>
    item.value.toLowerCase().includes(text) ||
    item.label.toLowerCase().includes(text) ||
    text.includes(item.label.toLowerCase()),
  );
  return matched?.value || '';
};

const getSupplySearchableText = (item: any) => [
  item.title,
  item.supply_no,
  item.service_area_snapshot?.text,
  item.service_area_snapshot?.city,
  item.service_area_snapshot?.district,
  item.drone?.city,
  item.drone?.brand,
  item.drone?.model,
  item.drone?.serial_number,
  ...(item.cargo_scenes || []),
  ...(item.cargo_scenes || []).map((scene: string) => getSupplySceneLabel(scene)),
].filter(Boolean).join(' ').toLowerCase();

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
  const [searchText, setSearchText] = useState('');
  const [appliedKeyword, setAppliedKeyword] = useState('');
  const [filterPanelVisible, setFilterPanelVisible] = useState(false);
  const [regionIndex, setRegionIndex] = useState(0);
  const [payloadIndex, setPayloadIndex] = useState(0);
  const [sceneIndex, setSceneIndex] = useState(0);

  const selectedRegion = regionFilters[regionIndex] || regionFilters[0];
  const selectedPayload = payloadFilters[payloadIndex] || payloadFilters[0];
  const selectedScene = sceneFilters[sceneIndex] || sceneFilters[0];
  const hasActiveFilters = Boolean(
    appliedKeyword ||
    selectedRegion.value ||
    selectedPayload.value ||
    selectedScene.value,
  );

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
      const sceneFromKeyword = getSceneValueFromKeyword(appliedKeyword);
      const res = await supplyService.list({
        page: 1,
        page_size: 20,
        keyword: sceneFromKeyword && !selectedScene.value ? undefined : appliedKeyword || undefined,
        region: selectedRegion.value || undefined,
        min_payload_kg: selectedPayload.value || undefined,
        cargo_scene: selectedScene.value || sceneFromKeyword || undefined,
        accepts_direct_order: true,
        service_type: 'heavy_cargo_lift_transport',
      });
      setSupplies(res.data?.items || []);
    } catch (error) {
      console.warn('获取服务流失败:', error);
    }
  }, [appliedKeyword, selectedPayload.value, selectedRegion.value, selectedScene.value]);

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

  useEffect(() => {
    const timer = setTimeout(() => {
      setAppliedKeyword(searchText.trim());
    }, 300);
    return () => clearTimeout(timer);
  }, [searchText]);

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

  const applySearch = useCallback(() => {
    setAppliedKeyword(searchText.trim());
  }, [searchText]);

  const resetFilters = useCallback(() => {
    setSearchText('');
    setAppliedKeyword('');
    setRegionIndex(0);
    setPayloadIndex(0);
    setSceneIndex(0);
  }, []);

  const handleFilterButton = useCallback(() => {
    setAppliedKeyword(searchText.trim());
    setFilterPanelVisible(true);
  }, [searchText]);

  const confirmFilterPanel = useCallback(() => {
    setAppliedKeyword(searchText.trim());
    setFilterPanelVisible(false);
  }, [searchText]);

  const closeFilterPanel = useCallback(() => {
    setFilterPanelVisible(false);
  }, []);

  const filteredDemands = useMemo(() => {
    const keyword = appliedKeyword.trim().toLowerCase();
    return demands.filter((item: any) => {
      const sceneLabel = getDemandSceneLabel(item.cargo_scene);
      const searchable = [
        item.title,
        item.cargo_scene,
        sceneLabel,
        resolveDemandPrimaryAddress(item),
        item.departure_address?.text,
        item.destination_address?.text,
        item.service_address?.text,
      ].filter(Boolean).join(' ').toLowerCase();
      if (keyword && !searchable.includes(keyword)) {
        return false;
      }
      if (selectedRegion.value && !searchable.includes(selectedRegion.value.toLowerCase())) {
        return false;
      }
      if (selectedPayload.value && Number(item.cargo_weight_kg || item.max_payload_kg || 0) < selectedPayload.value) {
        return false;
      }
      if (selectedScene.value && String(item.cargo_scene || '') !== selectedScene.value) {
        return false;
      }
      return true;
    });
  }, [appliedKeyword, demands, selectedPayload.value, selectedRegion.value, selectedScene.value]);

  const filteredSupplies = useMemo(() => {
    const keyword = appliedKeyword.trim().toLowerCase();
    return supplies.filter((item: any) => {
      const searchable = getSupplySearchableText(item);
      if (keyword && !searchable.includes(keyword)) {
        return false;
      }
      if (selectedRegion.value && !searchable.includes(selectedRegion.value.toLowerCase())) {
        return false;
      }
      if (selectedPayload.value && Number(item.max_payload_kg || 0) < selectedPayload.value) {
        return false;
      }
      if (selectedScene.value && !(item.cargo_scenes || []).includes(selectedScene.value)) {
        return false;
      }
      return true;
    });
  }, [appliedKeyword, selectedPayload.value, selectedRegion.value, selectedScene.value, supplies]);

  const items = activeTab === 'demand' ? filteredDemands : filteredSupplies;

  const renderDemandItem = ({item}: {item: DemandSummary}) => (
    <TouchableOpacity
      activeOpacity={0.8}
      style={[styles.demandCard, {backgroundColor: theme.card, borderColor: theme.cardBorder}]}
      onPress={() => navigation.navigate('DemandDetail', {id: item.id})}>
      <View style={styles.demandMain}>
        <View style={styles.demandIconWrap}>
          <Image source={marketAssets.taskHall} style={styles.demandIcon} resizeMode="contain" />
        </View>
        <View style={styles.demandInfo}>
          <Text style={[styles.title, {color: theme.text}]} numberOfLines={2}>
            {item.title}
          </Text>
          <View style={styles.demandMetaBadges}>
            <View style={[styles.metaBadge, {backgroundColor: theme.bgSecondary}]}>
              <Text style={[styles.metaBadgeText, {color: theme.textSub}]}>{getDemandSceneLabel(item.cargo_scene)}</Text>
            </View>
            <View style={[styles.metaBadge, styles.addressBadge, {backgroundColor: theme.bgSecondary}]}>
              <Text style={[styles.metaBadgeText, {color: theme.textSub}]} numberOfLines={1}>
                {resolveDemandPrimaryAddress(item)}
              </Text>
            </View>
          </View>
        </View>
      </View>
      <View style={styles.cardFooter}>
        <Text style={[styles.timeText, {color: theme.textHint}]}>{formatDemandSchedule(item.scheduled_start_at, item.scheduled_end_at)}</Text>
        <Text style={styles.budget}>{formatDemandBudget(item.budget_min, item.budget_max)}</Text>
      </View>
    </TouchableOpacity>
  );

  const renderSupplyItem = ({item, index}: {item: SupplySummary; index: number}) => (
    <TouchableOpacity
      activeOpacity={0.8}
      style={[styles.serviceCard, {backgroundColor: theme.card, borderColor: theme.cardBorder}]}
      onPress={() => navigation.navigate('OfferDetail', {id: item.id})}>
      <View style={styles.serviceImagePlaceholder}>
        <Image
          source={serviceThumbs[index % serviceThumbs.length]}
          style={styles.serviceImage}
          resizeMode="cover"
        />
      </View>
      <View style={styles.serviceInfo}>
        <Text style={[styles.title, {color: theme.text}]} numberOfLines={2}>{item.title}</Text>
        <View style={styles.supplyMetaRow}>
          <View style={styles.supplyMetaItem}>
            <Image source={marketAssets.markerHex} style={styles.supplyMetaIcon} resizeMode="contain" />
            <Text style={[styles.supplyMetaText, {color: theme.textSub}]}>最大载重 {item.max_payload_kg || 0}kg</Text>
          </View>
          {(item.cargo_scenes || []).slice(0, 2).map(scene => (
            <View key={scene} style={styles.supplyMetaItem}>
              <Image source={marketAssets.markerHex} style={styles.supplyMetaIcon} resizeMode="contain" />
              <Text style={[styles.supplySceneText, {color: theme.textSub}]} numberOfLines={1}>
                {getSupplySceneLabel(scene)}
              </Text>
            </View>
          ))}
          {(item.cargo_scenes || []).length === 0 ? (
            <View style={styles.supplyMetaItem}>
              <Image source={marketAssets.markerHex} style={styles.supplyMetaIcon} resizeMode="contain" />
              <Text style={[styles.supplySceneText, {color: theme.textSub}]} numberOfLines={1}>
                服务场景待补充
              </Text>
            </View>
          ) : null}
        </View>
        <View style={styles.capabilityRow}>
          {capabilityLabels.map(label => (
            <Text key={label} style={styles.capabilityText}>{label}</Text>
          ))}
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
  }, [activeTab, effectiveRoleSummary, navigation]);

  const handleBack = () => {
    if (navigation.canGoBack?.()) {
      navigation.goBack();
      return;
    }
    navigation.navigate('MainTabs', {screen: 'Home'});
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.navBar}>
        <View style={styles.navSide}>
          <TouchableOpacity style={styles.navBack} onPress={handleBack} activeOpacity={0.82}>
            <Image source={marketAssets.back} style={styles.navBackIcon} resizeMode="contain" />
          </TouchableOpacity>
        </View>
        <Text style={styles.navTitle}>服务市场</Text>
        <View style={[styles.navSide, styles.navSideRight]} />
      </View>
      <View style={styles.header}>
        <View style={styles.entryGrid}>
          {isClientFocused ? (
            <View style={styles.entryActionRow}>
              <TouchableOpacity
                style={[styles.entryActionBtn, styles.entryPrimaryBtn]}
                onPress={handleQuickOrderPress}>
                <Image source={marketAssets.lightning} style={styles.entryActionIcon} resizeMode="contain" />
                <Text style={styles.entryPrimaryTitle}>快速下单</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.entryActionBtn, styles.entrySecondaryBtn]}
                onPress={handlePublishTaskPress}>
                <Image source={marketAssets.plusBox} style={styles.entryActionIcon} resizeMode="contain" />
                <Text style={styles.entrySecondaryTitle}>发布任务</Text>
              </TouchableOpacity>
            </View>
          ) : null}
          <View style={styles.entryActionRow}>
            <TouchableOpacity
              style={[styles.entryActionBtn, activeTab === 'demand' && styles.entrySoftActive]}
              onPress={() => setActiveTab('demand')}>
              <Image source={marketAssets.taskHall} style={styles.entryActionIcon} resizeMode="contain" />
              <Text style={[styles.entrySecondaryTitle, activeTab === 'demand' && styles.entrySoftActiveText]}>
                {isClientFocused ? '任务大厅' : '看需求'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.entryActionBtn, activeTab === 'supply' && styles.entrySoftActive]}
              onPress={() => setActiveTab('supply')}>
              <Image source={marketAssets.serviceHex} style={styles.entryActionIcon} resizeMode="contain" />
              <Text style={[styles.entrySecondaryTitle, activeTab === 'supply' && styles.entrySoftActiveText]}>
                {isClientFocused ? '找服务' : '看服务'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
        <View style={styles.filterPanel}>
          <View style={styles.searchRow}>
            <View style={[styles.searchBox, appliedKeyword && styles.searchBoxActive]}>
              <Image source={marketAssets.search} style={styles.searchIcon} resizeMode="contain" />
              <TextInput
                value={searchText}
                onChangeText={value => {
                  setSearchText(value);
                  if (!value.trim()) {
                    setAppliedKeyword('');
                  }
                }}
                onSubmitEditing={applySearch}
                onBlur={applySearch}
                placeholder={activeTab === 'demand' ? '搜索任务名称、地址或场景' : '搜索服务名称、场景或关键词'}
                placeholderTextColor="#AEB8C8"
                style={styles.searchInput}
                returnKeyType="search"
              />
            </View>
            <TouchableOpacity
              style={[styles.filterBtn, hasActiveFilters && styles.filterBtnActive]}
              onPress={handleFilterButton}
              activeOpacity={0.82}>
              <Image source={marketAssets.filter} style={styles.filterIcon} resizeMode="contain" />
              <Text style={[styles.filterBtnText, hasActiveFilters && styles.filterBtnTextActive]}>筛选</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.filterChipRow}>
            {[
              {item: selectedRegion, active: Boolean(selectedRegion.value), onPress: () => setFilterPanelVisible(true)},
              {item: selectedPayload, active: Boolean(selectedPayload.value), onPress: () => setFilterPanelVisible(true)},
              {item: selectedScene, active: Boolean(selectedScene.value), onPress: () => setFilterPanelVisible(true)},
            ].map(({item, active, onPress}) => (
              <TouchableOpacity
                key={item.label}
                style={[styles.filterChip, active && styles.filterChipActive]}
                onPress={onPress}
                activeOpacity={0.82}>
                <Text style={[styles.filterChipText, active && styles.filterChipTextActive]} numberOfLines={1}>
                  {item.label}
                </Text>
                <Image source={marketAssets.chevronDown} style={styles.filterChipIcon} resizeMode="contain" />
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>

      <FlatList<any>
        data={items}
        keyExtractor={item => String(item.id)}
        renderItem={activeTab === 'demand' ? renderDemandItem : renderSupplyItem}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[theme.refreshColor]} />}
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator style={styles.loading} color={theme.primary} />
          ) : (
            <View style={styles.emptyState}>
              <Image
                source={activeTab === 'demand' ? marketAssets.taskHall : marketAssets.serviceHex}
                style={styles.emptyStateIcon}
                resizeMode="contain"
              />
              <Text style={styles.emptyStateText}>
                {isClientFocused
                  ? activeTab === 'demand'
                    ? '当前还没有公开任务'
                    : '当前还没有可快速下单的服务'
                  : `暂无公开${activeTab === 'demand' ? '需求' : '服务'}`}
              </Text>
            </View>
          )
        }
      />

      <View style={styles.footer}>
        {isClientFocused ? (
          <TouchableOpacity
            style={styles.mainBtn}
            onPress={handlePublishTaskPress}>
            <Image source={marketAssets.docCta} style={styles.ctaIcon} resizeMode="contain" />
            <Text style={styles.mainBtnText}>找不到合适服务？发布任务</Text>
            <Image source={marketAssets.arrowRight} style={styles.ctaArrow} resizeMode="contain" />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.mainBtn} onPress={mainAction.onPress}>
            <Text style={styles.mainBtnText}>{mainAction.label}</Text>
          </TouchableOpacity>
        )}
      </View>

      <Modal
        visible={filterPanelVisible}
        transparent
        animationType="slide"
        onRequestClose={closeFilterPanel}>
        <TouchableOpacity style={styles.filterMask} activeOpacity={1} onPress={closeFilterPanel}>
          <View style={styles.filterSheet} onStartShouldSetResponder={() => true}>
            <View style={styles.filterSheetHead}>
              <Text style={styles.filterSheetTitle}>{activeTab === 'demand' ? '筛选任务' : '筛选服务'}</Text>
              <TouchableOpacity onPress={resetFilters} activeOpacity={0.82}>
                <Text style={styles.filterReset}>重置</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {[
                {title: '地区', options: regionFilters, activeIndex: regionIndex, setIndex: setRegionIndex},
                {title: '载重', options: payloadFilters, activeIndex: payloadIndex, setIndex: setPayloadIndex},
                {title: '场景', options: sceneFilters, activeIndex: sceneIndex, setIndex: setSceneIndex},
              ].map(group => (
                <View key={group.title} style={styles.filterGroup}>
                  <Text style={styles.filterGroupTitle}>{group.title}</Text>
                  <View style={styles.filterOptionRow}>
                    {group.options.map((option, index) => (
                      <TouchableOpacity
                        key={option.label}
                        style={[styles.filterOption, group.activeIndex === index && styles.filterOptionActive]}
                        onPress={() => group.setIndex(index)}
                        activeOpacity={0.82}>
                        <Text style={[styles.filterOptionText, group.activeIndex === index && styles.filterOptionTextActive]}>
                          {option.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              ))}
            </ScrollView>

            <View style={styles.filterSheetActions}>
              <TouchableOpacity style={styles.filterCancelBtn} onPress={closeFilterPanel} activeOpacity={0.82}>
                <Text style={styles.filterCancelText}>取消</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.filterConfirmBtn} onPress={confirmFilterPanel} activeOpacity={0.86}>
                <Text style={styles.filterConfirmText}>完成筛选</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const getStyles = (theme: AppTheme) => StyleSheet.create({
  container: {flex: 1, backgroundColor: '#F5F7FB'},
  navBar: {
    minHeight: 56,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
  },
  navSide: {
    width: 92,
    flexDirection: 'row',
    alignItems: 'center',
  },
  navSideRight: {
    justifyContent: 'flex-end',
  },
  navBack: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navBackIcon: {
    width: 18,
    height: 18,
  },
  navTitle: {
    flex: 1,
    color: '#111827',
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '700',
    textAlign: 'center',
  },
  header: {
    backgroundColor: '#F5F7FB',
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 10,
  },
  entryGrid: {
    gap: 9,
  },
  entryActionRow: {
    flexDirection: 'row',
    gap: 9,
  },
  entryActionBtn: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 7,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E4EAF3',
    shadowColor: '#162A4E',
    shadowOffset: {width: 0, height: 5},
    shadowOpacity: theme.isDark ? 0 : 0.04,
    shadowRadius: 14,
    elevation: 1,
  },
  entryActionIcon: {
    width: 18,
    height: 18,
  },
  entryPrimaryBtn: {
    backgroundColor: '#1B6CFF',
    borderColor: 'transparent',
  },
  entrySecondaryBtn: {
    backgroundColor: '#FFFFFF',
  },
  entryPrimaryTitle: {
    fontSize: 15,
    color: '#FFFFFF',
    fontWeight: '800',
    textAlign: 'center',
  },
  entrySecondaryTitle: {
    fontSize: 14,
    color: '#334155',
    fontWeight: '700',
    textAlign: 'center',
  },
  entrySoftActive: {
    backgroundColor: '#EDF3FF',
    borderColor: '#DDE8FF',
  },
  entrySoftActiveText: {
    color: '#1B6CFF',
  },
  filterPanel: {
    marginTop: 10,
  },
  searchRow: {
    flexDirection: 'row',
    gap: 8,
  },
  searchBox: {
    flex: 1,
    minWidth: 0,
    height: 41,
    paddingHorizontal: 12,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: '#E4EAF3',
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  searchBoxActive: {
    borderColor: '#C7D8FF',
    backgroundColor: '#FBFDFF',
  },
  searchIcon: {
    width: 14,
    height: 14,
  },
  searchInput: {
    flex: 1,
    minWidth: 0,
    height: 39,
    paddingVertical: 0,
    paddingHorizontal: 0,
    color: '#151D2D',
    fontSize: 12,
    fontWeight: '500',
  },
  filterBtn: {
    width: 75,
    height: 41,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: '#E4EAF3',
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  filterBtnActive: {
    borderColor: '#C7D8FF',
    backgroundColor: '#EDF3FF',
  },
  filterIcon: {
    width: 14,
    height: 14,
  },
  filterBtnText: {
    color: '#334155',
    fontSize: 12,
    fontWeight: '600',
  },
  filterBtnTextActive: {
    color: '#1B6CFF',
  },
  filterChipRow: {
    marginTop: 9,
    flexDirection: 'row',
    gap: 8,
  },
  filterChip: {
    flex: 1,
    minWidth: 0,
    height: 35,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: '#E4EAF3',
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingHorizontal: 8,
  },
  filterChipActive: {
    borderColor: '#C7D8FF',
    backgroundColor: '#EDF3FF',
  },
  filterChipText: {
    color: '#46516B',
    fontSize: 11,
    fontWeight: '500',
    flexShrink: 1,
  },
  filterChipTextActive: {
    color: '#1B6CFF',
    fontWeight: '600',
  },
  filterChipIcon: {
    width: 9,
    height: 9,
  },
  listContent: {
    padding: 12,
    paddingBottom: 100,
  },
  demandCard: {
    marginBottom: 11,
    padding: 12,
    borderRadius: 15,
    borderWidth: 1,
    shadowColor: '#162A4E',
    shadowOffset: {width: 0, height: 5},
    shadowOpacity: 0.06,
    shadowRadius: 14,
    elevation: 2,
  },
  serviceCard: {
    marginBottom: 11,
    padding: 12,
    borderRadius: 15,
    borderWidth: 1,
    shadowColor: '#162A4E',
    shadowOffset: {width: 0, height: 5},
    shadowOpacity: 0.06,
    shadowRadius: 14,
    elevation: 2,
    flexDirection: 'row',
    gap: 11,
  },
  serviceImagePlaceholder: {
    width: 121,
    height: 118,
    borderRadius: 10,
    backgroundColor: '#EAF0FA',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  serviceImage: {
    width: '100%',
    height: '100%',
  },
  serviceInfo: {
    flex: 1,
    minWidth: 0,
  },
  demandMain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  demandIconWrap: {
    width: 58,
    height: 58,
    borderRadius: 13,
    backgroundColor: '#EDF3FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  demandIcon: {
    width: 24,
    height: 24,
  },
  demandInfo: {
    flex: 1,
    minWidth: 0,
  },
  budget: {
    fontSize: 17,
    lineHeight: 23,
    color: theme.danger,
    fontWeight: '700',
    flexShrink: 0,
  },
  price: {
    fontSize: 17,
    lineHeight: 23,
    color: theme.danger,
    fontWeight: '700',
    flexShrink: 1,
  },
  title: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '700',
  },
  demandMetaBadges: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    minWidth: 0,
  },
  metaBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    maxWidth: '100%',
  },
  addressBadge: {
    flex: 1,
    minWidth: 0,
  },
  metaBadgeText: {
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '600',
  },
  metaBlockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    paddingHorizontal: 14,
  },
  supplyMetaRow: {
    marginTop: 9,
    flexDirection: 'row',
    flexWrap: 'nowrap',
    alignItems: 'center',
    gap: 6,
    minWidth: 0,
  },
  supplyMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    minWidth: 0,
  },
  supplyMetaIcon: {
    width: 10,
    height: 10,
    flexShrink: 0,
  },
  supplyMetaText: {
    fontSize: 10.5,
    lineHeight: 15,
    fontWeight: '500',
    flexShrink: 0,
  },
  supplySceneText: {
    maxWidth: 58,
    minWidth: 0,
    fontSize: 10.5,
    lineHeight: 15,
    fontWeight: '500',
    flexShrink: 1,
  },
  capabilityRow: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    gap: 8,
    marginTop: 10,
    minWidth: 0,
  },
  capabilityText: {
    paddingRight: 8,
    color: '#98A2B3',
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '500',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F3F6',
  },
  serviceFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    marginTop: 14,
  },
  timeText: {
    flex: 1,
    minWidth: 0,
    fontSize: 12,
    lineHeight: 17,
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
  emptyState: {
    marginTop: 22,
    paddingVertical: 34,
    paddingHorizontal: 18,
    borderRadius: 15,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#162A4E',
    shadowOffset: {width: 0, height: 5},
    shadowOpacity: 0.04,
    shadowRadius: 14,
    elevation: 1,
  },
  emptyStateIcon: {
    width: 30,
    height: 30,
    marginBottom: 10,
  },
  emptyStateText: {
    color: '#657189',
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
    textAlign: 'center',
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
    backgroundColor: '#1B6CFF',
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
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
  ctaIcon: {
    width: 17,
    height: 17,
  },
  ctaArrow: {
    width: 11,
    height: 11,
  },
  filterMask: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.28)',
    justifyContent: 'flex-end',
  },
  filterSheet: {
    maxHeight: '78%',
    paddingTop: 18,
    paddingHorizontal: 16,
    paddingBottom: 22,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    backgroundColor: '#FFFFFF',
    shadowColor: '#162A4E',
    shadowOffset: {width: 0, height: -10},
    shadowOpacity: 0.16,
    shadowRadius: 32,
    elevation: 10,
  },
  filterSheetHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  filterSheetTitle: {
    color: '#101828',
    fontSize: 17,
    lineHeight: 24,
    fontWeight: '700',
  },
  filterReset: {
    color: '#1B6CFF',
    fontSize: 13,
    lineHeight: 20,
    fontWeight: '600',
  },
  filterGroup: {
    marginTop: 13,
  },
  filterGroupTitle: {
    marginBottom: 9,
    color: '#334155',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
  },
  filterOptionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 9,
  },
  filterOption: {
    minWidth: 76,
    height: 34,
    paddingHorizontal: 12,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: '#E4EAF3',
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterOptionActive: {
    borderColor: '#1B6CFF',
    backgroundColor: '#EDF3FF',
  },
  filterOptionText: {
    color: '#46516B',
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '500',
  },
  filterOptionTextActive: {
    color: '#1B6CFF',
    fontWeight: '700',
  },
  filterSheetActions: {
    marginTop: 20,
    flexDirection: 'row',
    gap: 10,
  },
  filterCancelBtn: {
    flex: 1,
    height: 43,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#E4EAF3',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterConfirmBtn: {
    flex: 1,
    height: 43,
    borderRadius: 22,
    backgroundColor: '#1B6CFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#1B6CFF',
    shadowOffset: {width: 0, height: 8},
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 4,
  },
  filterCancelText: {
    color: '#334155',
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
  },
  filterConfirmText: {
    color: '#FFFFFF',
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
  },
});
