import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {
  ActivityIndicator,
  Alert,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import AddressInputField from '../../components/AddressInputField';
import ObjectCard from '../../components/business/ObjectCard';
import {droneService} from '../../services/drone';
import {ownerService} from '../../services/owner';
import {AddressData, Drone, SupplyDetail} from '../../types';
import {summarizeFlexibleValue, summarizeServiceArea} from '../../utils/supplyMeta';
import {useTheme} from '../../theme/ThemeContext';
import type {AppTheme} from '../../theme/index';

const SCENE_OPTIONS = [
  {key: 'power_grid', label: '电网建设'},
  {key: 'mountain_agriculture', label: '山区农副产品'},
  {key: 'plateau_supply', label: '高原给养'},
  {key: 'island_supply', label: '海岛补给'},
  {key: 'emergency', label: '应急救援'},
];

const PRICING_OPTIONS = [
  {key: 'per_trip', label: '按架次'},
  {key: 'per_km', label: '按公里'},
  {key: 'per_hour', label: '按小时'},
  {key: 'per_kg', label: '按公斤'},
];

const isApprovedStatus = (value?: string) => value === 'approved' || value === 'verified';

const buildAddressSnapshot = (address?: AddressData | null) => {
  if (!address) {
    return null;
  }
  return {
    text: address.name || address.address,
    province: address.province,
    city: address.city,
    district: address.district,
    latitude: address.latitude,
    longitude: address.longitude,
  };
};

const parseAddressData = (snapshot: any): AddressData | null => {
  if (!snapshot) {
    return null;
  }
  if (typeof snapshot === 'string') {
    return {
      address: snapshot,
      name: snapshot,
      latitude: 0,
      longitude: 0,
    };
  }
  return {
    name: snapshot.text || snapshot.address || snapshot.region || '',
    address: snapshot.text || snapshot.address || snapshot.region || '',
    province: snapshot.province,
    city: snapshot.city,
    district: snapshot.district,
    latitude: typeof snapshot.latitude === 'number' ? snapshot.latitude : 0,
    longitude: typeof snapshot.longitude === 'number' ? snapshot.longitude : 0,
  };
};

export default function PublishOfferScreen({route, navigation}: any) {
  const {theme} = useTheme();
  const styles = getStyles(theme);
  const supplyId = Number(route?.params?.supplyId || route?.params?.id || 0) || 0;
  const isEditing = supplyId > 0;

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [pricingText, setPricingText] = useState('');
  const [pricingUnit, setPricingUnit] = useState('per_trip');
  const [pricingRuleSummary, setPricingRuleSummary] = useState('');
  const [availableSlotsSummary, setAvailableSlotsSummary] = useState('');
  const [address, setAddress] = useState<AddressData | null>(null);
  const [acceptsDirectOrder, setAcceptsDirectOrder] = useState(true);
  const [selectedScenes, setSelectedScenes] = useState<string[]>(['power_grid']);
  const [drones, setDrones] = useState<Drone[]>([]);
  const [selectedDroneId, setSelectedDroneId] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const selectedDrone = useMemo(
    () => drones.find(item => item.id === selectedDroneId) || null,
    [drones, selectedDroneId],
  );
  const isDroneMarketReady = useMemo(
    () =>
      Boolean(
        selectedDrone &&
          isApprovedStatus(selectedDrone.certification_status) &&
          isApprovedStatus(selectedDrone.uom_verified) &&
          isApprovedStatus(selectedDrone.insurance_verified) &&
          isApprovedStatus(selectedDrone.airworthiness_verified),
      ),
    [selectedDrone],
  );

  useEffect(() => {
    navigation.setOptions({title: isEditing ? '编辑供给' : '发布供给'});
  }, [isEditing, navigation]);

  const hydrateForm = useCallback((supply: SupplyDetail) => {
    setTitle(supply.title || '');
    setDescription(supply.description || '');
    setPricingText(supply.base_price_amount ? String((supply.base_price_amount / 100).toFixed(0)) : '');
    setPricingUnit(supply.pricing_unit || 'per_trip');
    setPricingRuleSummary(summarizeFlexibleValue(supply.pricing_rule, ''));
    setAvailableSlotsSummary(summarizeFlexibleValue(supply.available_time_slots, ''));
    setAddress(parseAddressData(supply.service_area_snapshot));
    setAcceptsDirectOrder(Boolean(supply.accepts_direct_order));
    setSelectedScenes((supply.cargo_scenes || []).length > 0 ? supply.cargo_scenes : ['power_grid']);
    setSelectedDroneId(supply.drone_id || supply.drone?.id || 0);
  }, []);

  const fetchBootstrap = useCallback(async () => {
    setLoading(true);
    try {
      const [droneRes, supplyRes] = await Promise.all([
        droneService.myDrones({page: 1, page_size: 100}),
        isEditing ? ownerService.getMySupplyById(supplyId) : Promise.resolve(null),
      ]);

      const droneList = droneRes.data?.list || [];
      setDrones(droneList);

      if (supplyRes?.data) {
        hydrateForm(supplyRes.data);
      } else if (droneList.length > 0) {
        setSelectedDroneId(droneList[0].id);
      }
    } catch (error) {
      console.warn('初始化供给表单失败:', error);
      Alert.alert('加载失败', '供给信息加载失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  }, [hydrateForm, isEditing, supplyId]);

  useEffect(() => {
    fetchBootstrap();
  }, [fetchBootstrap]);

  const toggleScene = (scene: string) => {
    setSelectedScenes(prev => {
      if (prev.includes(scene)) {
        const next = prev.filter(item => item !== scene);
        return next.length > 0 ? next : prev;
      }
      return [...prev, scene];
    });
  };

  const buildPayload = (status: 'draft' | 'active') => ({
    drone_id: selectedDroneId,
    title: title.trim(),
    description: description.trim(),
    service_types: ['heavy_cargo_lift_transport'],
    cargo_scenes: selectedScenes,
    service_area_snapshot: buildAddressSnapshot(address),
    base_price_amount: Math.round((Number(pricingText) || 0) * 100),
    pricing_unit: pricingUnit,
    pricing_rule: pricingRuleSummary.trim()
      ? {summary: pricingRuleSummary.trim()}
      : null,
    available_time_slots: availableSlotsSummary.trim()
      ? [{summary: availableSlotsSummary.trim()}]
      : [],
    accepts_direct_order: acceptsDirectOrder,
    status,
  });

  const handleSubmit = async (status: 'draft' | 'active') => {
    if (!title.trim()) {
      Alert.alert('提示', '请输入供给标题');
      return;
    }
    if (!selectedDroneId) {
      Alert.alert('提示', '请选择一架无人机');
      return;
    }
    if (selectedScenes.length === 0) {
      Alert.alert('提示', '请至少选择一个服务场景');
      return;
    }
    if (!pricingText || Number(pricingText) <= 0) {
      Alert.alert('提示', '请输入有效基础价格');
      return;
    }
    if (status === 'active' && !isDroneMarketReady) {
      Alert.alert('暂时不能上架', '当前设备资质还没有全部通过，建议先保存服务草稿，等基础资质、UOM、保险和适航状态都达标后再正式上架。', [
        {text: '知道了', style: 'cancel'},
        selectedDroneId
          ? {text: '去管理资质', onPress: () => navigation.navigate('DroneCertification', {id: selectedDroneId})}
          : {text: '好的'},
      ]);
      return;
    }

    setSubmitting(true);
    try {
      if (isEditing) {
        await ownerService.updateSupply(supplyId, buildPayload(status));
      } else {
        await ownerService.createSupply(buildPayload(status));
      }
      Alert.alert('成功', status === 'active' ? '供给已保存并上架' : '供给草稿已保存', [
        {text: '确定', onPress: () => navigation.navigate('MyOffers')},
      ]);
    } catch (error: any) {
      Alert.alert('保存失败', error?.message || '请稍后重试');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, {backgroundColor: theme.bg}]}>
        <ActivityIndicator style={styles.loading} color={theme.primary} />
      </SafeAreaView>
    );
  }

  if (drones.length === 0) {
    return (
      <SafeAreaView style={[styles.container, {backgroundColor: theme.bg}]}>
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyIcon}>🛩️</Text>
          <Text style={styles.emptyTitle}>还没有可用无人机</Text>
          <Text style={styles.emptyDesc}>请先添加无人机基础信息（无需立即完成所有资质），再来建立服务草稿。</Text>
          <TouchableOpacity style={styles.primaryAction} onPress={() => navigation.navigate('AddDrone')}>
            <Text style={styles.primaryActionText}>去添加无人机</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, {backgroundColor: theme.bg}]}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <Text style={styles.heroEyebrow}>机主供给</Text>
          <Text style={styles.heroTitle}>{isEditing ? '编辑你的供给方案' : '创建新的供给方案'}</Text>
          <Text style={styles.heroDesc}>
            先把无人机、服务能力和价格规则整理成草稿，再逐步补齐资质。只有资质达标后的服务，才会正式进入公开市场。
          </Text>
        </View>

        <ObjectCard>
          <Text style={styles.sectionTitle}>草稿优先，不用一次到位</Text>
          <Text style={styles.tipText}>
            这一步的目标不是一次把所有资质都补完，而是先形成一份可经营的服务草稿。设备资料、服务场景、价格和时间准备好后，随时都可以回来继续完善。
          </Text>
          {!isDroneMarketReady && selectedDrone ? (
            <TouchableOpacity style={styles.tipAction} onPress={() => navigation.navigate('DroneCertification', {id: selectedDrone.id})}>
              <Text style={styles.tipActionText}>当前设备资质未齐，去查看并行审核进度</Text>
            </TouchableOpacity>
          ) : null}
        </ObjectCard>

        <ObjectCard>
          <Text style={styles.sectionTitle}>1. 选择执行设备</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.droneRow}>
            {drones.map(drone => {
              const active = drone.id === selectedDroneId;
              return (
                <TouchableOpacity
                  key={drone.id}
                  style={[styles.droneCard, active && styles.droneCardActive]}
                  onPress={() => setSelectedDroneId(drone.id)}>
                  <Text style={styles.droneTitle}>{drone.brand} {drone.model}</Text>
                  <Text style={styles.droneMeta}>吊重 {drone.max_load || 0}kg</Text>
                  <Text style={styles.droneMeta}>航程 {drone.max_distance || 0}km</Text>
                  <Text style={styles.droneMeta}>状态 {drone.availability_status || 'unknown'}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </ObjectCard>

        <ObjectCard>
          <Text style={styles.sectionTitle}>2. 服务能力</Text>
          <Text style={styles.label}>供给标题</Text>
          <TextInput
            style={styles.input}
            placeholder="例如：海岛给养重载吊运服务"
            value={title}
            onChangeText={setTitle}
          />

          <Text style={styles.label}>供给说明</Text>
          <TextInput
            style={[styles.input, styles.multilineInput]}
            placeholder="说明你的设备能力、执行经验、适用场景和交付范围"
            value={description}
            onChangeText={setDescription}
            multiline
            textAlignVertical="top"
          />

          <Text style={styles.label}>服务场景</Text>
          <View style={styles.chipRow}>
            {SCENE_OPTIONS.map(option => {
              const active = selectedScenes.includes(option.key);
              return (
                <TouchableOpacity
                  key={option.key}
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() => toggleScene(option.key)}>
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>{option.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={styles.label}>服务区域</Text>
          <AddressInputField
            value={address}
            placeholder={isEditing ? summarizeServiceArea(address?.address || '') : '点击选择主要服务区域'}
            onSelect={setAddress}
          />
        </ObjectCard>

        <ObjectCard>
          <Text style={styles.sectionTitle}>3. 价格规则</Text>
          <Text style={styles.label}>基础价格（元）</Text>
          <TextInput
            style={styles.input}
            placeholder="例如：680"
            keyboardType="numeric"
            value={pricingText}
            onChangeText={setPricingText}
          />

          <Text style={styles.label}>计价单位</Text>
          <View style={styles.chipRow}>
            {PRICING_OPTIONS.map(option => {
              const active = pricingUnit === option.key;
              return (
                <TouchableOpacity
                  key={option.key}
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() => setPricingUnit(option.key)}>
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>{option.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={styles.label}>价格规则说明</Text>
          <TextInput
            style={[styles.input, styles.multilineInput]}
            placeholder="例如：基础价含 1 架次，不含二次转运和特殊夜航"
            value={pricingRuleSummary}
            onChangeText={setPricingRuleSummary}
            multiline
            textAlignVertical="top"
          />
        </ObjectCard>

        <ObjectCard>
          <Text style={styles.sectionTitle}>4. 时间与成交方式</Text>
          <Text style={styles.label}>可服务时间</Text>
          <TextInput
            style={[styles.input, styles.multilineInput]}
            placeholder="例如：工作日 08:00-18:00；紧急任务可提前 2 小时响应"
            value={availableSlotsSummary}
            onChangeText={setAvailableSlotsSummary}
            multiline
            textAlignVertical="top"
          />

          <View style={styles.switchRow}>
            <View style={{flex: 1}}>
              <Text style={styles.switchTitle}>接受客户直达下单</Text>
              <Text style={styles.switchDesc}>关闭后，这个供给只参与市场展示与后续撮合，不支持客户直接下单。</Text>
            </View>
            <Switch value={acceptsDirectOrder} onValueChange={setAcceptsDirectOrder} />
          </View>
        </ObjectCard>

        <ObjectCard>
          <Text style={styles.summaryTitle}>当前选择摘要</Text>
          <Text style={styles.summaryLine}>设备：{selectedDrone?.brand || '未选'} {selectedDrone?.model || ''}</Text>
          <Text style={styles.summaryLine}>场景：{selectedScenes.map(scene => SCENE_OPTIONS.find(item => item.key === scene)?.label || scene).join(' / ')}</Text>
          <Text style={styles.summaryLine}>价格：¥{Number(pricingText || 0).toFixed(0)} / {PRICING_OPTIONS.find(item => item.key === pricingUnit)?.label || pricingUnit}</Text>
          <Text style={styles.summaryLine}>直达下单：{acceptsDirectOrder ? '开启' : '关闭'}</Text>
          <Text style={styles.summaryLine}>市场状态：{isDroneMarketReady ? '资质已满足，可正式上架' : '建议先保存草稿，补齐资质后再上架'}</Text>
          {!isDroneMarketReady ? <Text style={styles.summaryHint}>基础资质、UOM、保险、适航四项可并行提交，无需串行等待。</Text> : null}
        </ObjectCard>

        <View style={styles.footerActions}>
          <TouchableOpacity
            style={[styles.secondaryAction, submitting && styles.actionDisabled]}
            disabled={submitting}
            onPress={() => handleSubmit('draft')}>
            <Text style={styles.secondaryActionText}>{submitting ? '保存中...' : '保存草稿'}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.primaryAction, (!isDroneMarketReady || submitting) && styles.actionDisabled]}
            disabled={!isDroneMarketReady || submitting}
            onPress={() => handleSubmit('active')}>
            <Text style={styles.primaryActionText}>
              {!isDroneMarketReady
                ? '资质未齐，暂不能上架'
                : submitting
                ? '提交中...'
                : isEditing
                ? '保存并上架'
                : '创建并上架'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const getStyles = (theme: AppTheme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.bgSecondary,
  },
  loading: {
    marginTop: 120,
  },
  content: {
    padding: 14,
    paddingBottom: 36,
    gap: 12,
  },
  hero: {
    backgroundColor: theme.isDark ? 'rgba(0,212,255,0.08)' : theme.primary,
    borderRadius: 24,
    padding: 20,
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
  tipText: {
    fontSize: 13,
    lineHeight: 20,
    color: theme.textSub,
  },
  tipAction: {
    alignSelf: 'flex-start',
    marginTop: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.primaryBorder,
    backgroundColor: theme.bgSecondary,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  tipActionText: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.primaryText,
  },
  sectionTitle: {
    fontSize: 16,
    color: theme.text,
    fontWeight: '800',
    marginBottom: 12,
  },
  label: {
    marginTop: 10,
    marginBottom: 8,
    fontSize: 13,
    color: theme.text,
    fontWeight: '700',
  },
  input: {
    borderWidth: 1,
    borderColor: theme.divider,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    backgroundColor: theme.bgSecondary,
    color: theme.text,
  },
  multilineInput: {
    minHeight: 88,
  },
  droneRow: {
    gap: 10,
  },
  droneCard: {
    width: 170,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.divider,
    backgroundColor: theme.card,
    padding: 14,
  },
  droneCardActive: {
    borderColor: theme.primary,
    backgroundColor: theme.primaryBg,
  },
  droneTitle: {
    fontSize: 14,
    color: theme.text,
    fontWeight: '800',
  },
  droneMeta: {
    marginTop: 6,
    fontSize: 12,
    color: theme.textSub,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.divider,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: theme.card,
  },
  chipActive: {
    borderColor: theme.primary,
    backgroundColor: theme.primaryBg,
  },
  chipText: {
    fontSize: 12,
    color: theme.textSub,
    fontWeight: '700',
  },
  chipTextActive: {
    color: theme.primaryText,
  },
  switchRow: {
    marginTop: 10,
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  switchTitle: {
    fontSize: 14,
    color: theme.text,
    fontWeight: '700',
  },
  switchDesc: {
    marginTop: 6,
    fontSize: 12,
    lineHeight: 18,
    color: theme.textSub,
  },
  summaryTitle: {
    fontSize: 15,
    color: theme.text,
    fontWeight: '800',
    marginBottom: 10,
  },
  summaryLine: {
    fontSize: 13,
    color: theme.textSub,
    lineHeight: 22,
  },
  summaryHint: {
    marginTop: 8,
    fontSize: 12,
    lineHeight: 18,
    color: theme.textSub,
  },
  footerActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  secondaryAction: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.divider,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: theme.card,
  },
  secondaryActionText: {
    fontSize: 14,
    color: theme.textSub,
    fontWeight: '800',
  },
  primaryAction: {
    flex: 1,
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: theme.primary,
  },
  primaryActionText: {
    fontSize: 14,
    color: theme.btnPrimaryText,
    fontWeight: '800',
  },
  actionDisabled: {
    opacity: 0.65,
  },
  emptyWrap: {
    alignItems: 'center',
    paddingHorizontal: 28,
    paddingTop: 120,
  },
  emptyIcon: {
    fontSize: 52,
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: theme.text,
  },
  emptyDesc: {
    marginTop: 8,
    fontSize: 13,
    lineHeight: 20,
    color: theme.textSub,
    textAlign: 'center',
    marginBottom: 20,
  },
});
