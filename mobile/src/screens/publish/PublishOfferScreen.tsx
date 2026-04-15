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

  const [currentStep, setCurrentStep] = useState(1);
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

  const droneCertStatus = useMemo(() => {
    if (!selectedDrone) return {ready: false, count: 0};
    const certs = [
      selectedDrone.certification_status,
      selectedDrone.uom_verified,
      selectedDrone.insurance_verified,
      selectedDrone.airworthiness_verified,
    ];
    const approved = certs.filter(v => isApprovedStatus(v)).length;
    return {ready: approved === 4, count: approved};
  }, [selectedDrone]);

  const isDroneMarketReady = droneCertStatus.ready;

  useEffect(() => {
    navigation.setOptions({title: isEditing ? '完善供给方案' : '创建供给方案'});
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
      Alert.alert('暂时不能上架', '当前设备资质还没有全部通过（目前已通过 ' + droneCertStatus.count + '/4）。建议先保存服务草稿，等基础资质、UOM、保险和适航状态都达标后再正式上架。', [
        {text: '先存草稿', onPress: () => handleSubmit('draft')},
        {text: '去管理资质', onPress: () => navigation.navigate('DroneCertification', {id: selectedDroneId})},
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
      Alert.alert('成功', status === 'active' ? '供给已保存并成功上架市场' : '供给草稿已妥善保存', [
        {text: '查看我的服务', onPress: () => navigation.navigate('MyOffers')},
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
          <Text style={styles.emptyIcon}>🚁</Text>
          <Text style={styles.emptyTitle}>名下暂无可用无人机</Text>
          <Text style={styles.emptyDesc}>请先在“我的无人机”中添加设备基础信息，再来创建对应的服务方案。</Text>
          <TouchableOpacity style={styles.primaryAction} onPress={() => navigation.navigate('AddDrone')}>
            <Text style={styles.primaryActionText}>去添加设备</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, {backgroundColor: theme.bg}]}>
      <View style={styles.stepHeader}>
        <View style={styles.stepTrack}>
          <View style={[styles.stepDot, currentStep >= 1 && styles.stepDotActive]} />
          <View style={[styles.stepLine, currentStep >= 2 && styles.stepLineActive]} />
          <View style={[styles.stepDot, currentStep >= 2 && styles.stepDotActive]} />
        </View>
        <View style={styles.stepLabels}>
          <Text style={[styles.stepLabel, currentStep === 1 && styles.stepLabelActive]}>设备与方案</Text>
          <Text style={[styles.stepLabel, currentStep === 2 && styles.stepLabelActive]}>价格与规则</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {currentStep === 1 ? (
          <>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>1. 执行设备资产</Text>
              <Text style={styles.sectionDesc}>选择本方案关联的无人机，系统会自动关联其最大吊重与资质状态。</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.droneRow}>
                {drones.map(drone => {
                  const active = drone.id === selectedDroneId;
                  const certs = [drone.certification_status, drone.uom_verified, drone.insurance_verified, drone.airworthiness_verified];
                  const approved = certs.filter(v => isApprovedStatus(v)).length;
                  return (
                    <TouchableOpacity
                      key={drone.id}
                      style={[styles.droneCard, active && styles.droneCardActive]}
                      onPress={() => setSelectedDroneId(drone.id)}>
                      <View style={styles.droneCardTop}>
                        <Text style={[styles.droneTitle, active && {color: theme.primaryText}]}>{drone.brand} {drone.model}</Text>
                        {active && <Text style={{fontSize: 14}}>✓</Text>}
                      </View>
                      <Text style={styles.droneMeta}>吊重 {drone.max_load || 0}kg · 航程 {drone.max_distance || 0}km</Text>
                      <View style={styles.droneCertRow}>
                        <View style={[styles.certPill, {backgroundColor: approved === 4 ? theme.success + '15' : theme.warning + '15'}]}>
                          <Text style={[styles.certPillText, {color: approved === 4 ? theme.success : theme.warning}]}>
                            资质 {approved}/4
                          </Text>
                        </View>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
              {selectedDrone && !isDroneMarketReady && (
                <TouchableOpacity style={styles.certAlert} onPress={() => navigation.navigate('DroneCertification', {id: selectedDrone.id})}>
                  <Text style={styles.certAlertText}>⚠️ 当前设备资质未齐，仅能作为草稿保存 ˃</Text>
                </TouchableOpacity>
              )}
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>2. 服务方案设置</Text>
              <View style={styles.inputGroup}>
                <Text style={styles.fieldLabel}>服务标题</Text>
                <TextInput
                  style={styles.fieldInput}
                  placeholder="例如：海岛补给重载吊运服务"
                  value={title}
                  onChangeText={setTitle}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.fieldLabel}>适用场景</Text>
                <View style={styles.sceneGrid}>
                  {SCENE_OPTIONS.map(option => {
                    const active = selectedScenes.includes(option.key);
                    return (
                      <TouchableOpacity
                        key={option.key}
                        style={[styles.sceneBtn, active && styles.sceneBtnActive]}
                        onPress={() => toggleScene(option.key)}>
                        <Text style={[styles.sceneBtnText, active && styles.sceneBtnTextActive]}>{option.label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.fieldLabel}>服务说明</Text>
                <TextInput
                  style={[styles.fieldInput, styles.fieldArea]}
                  placeholder="说明你的执行经验、具体适用范围和交付保障能力"
                  value={description}
                  onChangeText={setDescription}
                  multiline
                  textAlignVertical="top"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.fieldLabel}>服务区域</Text>
                <AddressInputField
                  value={address}
                  placeholder={isEditing ? summarizeServiceArea(address?.address || '') : '点击选择主要作业省市'}
                  onSelect={setAddress}
                  style={styles.addressInput}
                />
              </View>
            </View>
          </>
        ) : (
          <>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>3. 经营价格规则</Text>
              <View style={styles.inputGroup}>
                <Text style={styles.fieldLabel}>基础价格（元）</Text>
                <View style={styles.priceInputRow}>
                  <Text style={styles.currency}>¥</Text>
                  <TextInput
                    style={[styles.fieldInput, {flex: 1, borderWidth: 0, backgroundColor: 'transparent'}]}
                    placeholder="0.00"
                    keyboardType="numeric"
                    value={pricingText}
                    onChangeText={setPricingText}
                  />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.fieldLabel}>计价方式</Text>
                <View style={styles.sceneGrid}>
                  {PRICING_OPTIONS.map(option => {
                    const active = pricingUnit === option.key;
                    return (
                      <TouchableOpacity
                        key={option.key}
                        style={[styles.sceneBtn, active && styles.sceneBtnActive]}
                        onPress={() => setPricingUnit(option.key)}>
                        <Text style={[styles.sceneBtnText, active && styles.sceneBtnTextActive]}>{option.label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.fieldLabel}>价格详情说明</Text>
                <TextInput
                  style={[styles.fieldInput, styles.fieldArea]}
                  placeholder="例如：基础价含 1 架次，超出的按 300/架计算，不含现场二次搬运费"
                  value={pricingRuleSummary}
                  onChangeText={setPricingRuleSummary}
                  multiline
                  textAlignVertical="top"
                />
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>4. 响应与成交</Text>
              <View style={styles.inputGroup}>
                <Text style={styles.fieldLabel}>可响应时段</Text>
                <TextInput
                  style={[styles.fieldInput, styles.fieldArea]}
                  placeholder="例如：工作日 09:00-18:00；紧急任务请提前 4 小时电话预约"
                  value={availableSlotsSummary}
                  onChangeText={setAvailableSlotsSummary}
                  multiline
                  textAlignVertical="top"
                />
              </View>

              <View style={styles.switchBox}>
                <View style={{flex: 1, paddingRight: 16}}>
                  <Text style={styles.switchTitle}>开启客户直达下单</Text>
                  <Text style={styles.switchDesc}>允许客户直接根据当前价格创建订单。关闭后则仅参与市场展示和后续撮合报价。</Text>
                </View>
                <Switch
                  value={acceptsDirectOrder}
                  onValueChange={setAcceptsDirectOrder}
                  trackColor={{false: theme.divider, true: theme.primary}}
                />
              </View>
            </View>
          </>
        )}

        <View style={styles.bottomSummary}>
          <Text style={styles.summaryTitle}>方案预览</Text>
          <View style={styles.summaryGrid}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>关联设备</Text>
              <Text style={styles.summaryValue} numberOfLines={1}>{selectedDrone?.brand || '-'} {selectedDrone?.model || ''}</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>资质状态</Text>
              <Text style={[styles.summaryValue, {color: isDroneMarketReady ? theme.success : theme.warning}]}>
                {isDroneMarketReady ? '通过 (4/4)' : `待补齐 (${droneCertStatus.count}/4)`}
              </Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>基础价格</Text>
              <Text style={styles.summaryValue}>¥{Number(pricingText || 0).toFixed(0)}/{PRICING_OPTIONS.find(i => i.key === pricingUnit)?.label || '-'}</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>直达下单</Text>
              <Text style={styles.summaryValue}>{acceptsDirectOrder ? '已开启' : '已关闭'}</Text>
            </View>
          </View>
        </View>

        <View style={styles.formActions}>
          {currentStep === 1 ? (
            <TouchableOpacity style={styles.nextBtn} onPress={() => setCurrentStep(2)}>
              <Text style={styles.nextBtnText}>下一步：设置价格规则</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.submitRow}>
              <TouchableOpacity style={styles.prevBtn} onPress={() => setCurrentStep(1)}>
                <Text style={styles.prevBtnText}>上一步</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.draftBtn} onPress={() => handleSubmit('draft')} disabled={submitting}>
                <Text style={styles.draftBtnText}>保存草稿</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.publishBtn, (!isDroneMarketReady || submitting) && styles.publishBtnDisabled]}
                onPress={() => handleSubmit('active')}
                disabled={submitting}
              >
                <Text style={styles.publishBtnText}>正式上架</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const getStyles = (theme: AppTheme) => StyleSheet.create({
  container: {flex: 1, backgroundColor: theme.bg},
  stepHeader: {
    paddingHorizontal: 40,
    paddingVertical: 16,
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
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: theme.divider,
  },
  stepDotActive: {
    backgroundColor: theme.primary,
  },
  stepLine: {
    flex: 1,
    height: 2,
    backgroundColor: theme.divider,
    marginHorizontal: 4,
  },
  stepLineActive: {
    backgroundColor: theme.primary,
  },
  stepLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  stepLabel: {
    fontSize: 11,
    color: theme.textHint,
    fontWeight: '600',
  },
  stepLabelActive: {
    color: theme.primaryText,
    fontWeight: '800',
  },
  content: {paddingBottom: 40},
  loading: {marginTop: 120},
  section: {
    padding: 20,
    borderBottomWidth: 8,
    borderBottomColor: theme.bgSecondary,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: theme.text,
    marginBottom: 4,
  },
  sectionDesc: {
    fontSize: 13,
    color: theme.textSub,
    marginBottom: 16,
    lineHeight: 18,
  },
  inputGroup: {
    marginTop: 16,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.textSub,
    marginBottom: 8,
  },
  fieldInput: {
    backgroundColor: theme.bgSecondary,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: theme.text,
    borderWidth: 1,
    borderColor: theme.divider,
  },
  fieldArea: {
    minHeight: 80,
  },
  priceInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.bgSecondary,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.divider,
    paddingHorizontal: 14,
  },
  currency: {
    fontSize: 18,
    fontWeight: '800',
    color: theme.text,
    marginRight: 4,
  },
  addressInput: {
    backgroundColor: theme.bgSecondary,
    borderWidth: 1,
    borderColor: theme.divider,
    borderRadius: 12,
  },
  droneRow: {
    gap: 12,
    paddingVertical: 4,
  },
  droneCard: {
    width: 180,
    backgroundColor: theme.card,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: theme.divider,
  },
  droneCardActive: {
    borderColor: theme.primary,
    backgroundColor: theme.primaryBg,
  },
  droneCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  droneTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: theme.text,
  },
  droneMeta: {
    fontSize: 11,
    color: theme.textSub,
  },
  droneCertRow: {
    marginTop: 10,
  },
  certPill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  certPillText: {
    fontSize: 10,
    fontWeight: '800',
  },
  certAlert: {
    marginTop: 12,
    padding: 10,
    backgroundColor: theme.warning + '10',
    borderRadius: 8,
  },
  certAlertText: {
    fontSize: 12,
    color: theme.warning,
    fontWeight: '700',
  },
  sceneGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  sceneBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: theme.bgSecondary,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  sceneBtnActive: {
    borderColor: theme.primary,
    backgroundColor: theme.primaryBg,
  },
  sceneBtnText: {
    fontSize: 13,
    color: theme.textSub,
    fontWeight: '600',
  },
  sceneBtnTextActive: {
    color: theme.primaryText,
    fontWeight: '700',
  },
  switchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.bgSecondary,
    padding: 16,
    borderRadius: 16,
    marginTop: 8,
  },
  switchTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.text,
  },
  switchDesc: {
    fontSize: 12,
    color: theme.textSub,
    marginTop: 4,
    lineHeight: 18,
  },
  bottomSummary: {
    margin: 20,
    padding: 16,
    backgroundColor: theme.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: theme.divider,
  },
  summaryTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: theme.textHint,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  summaryItem: {
    width: '45%',
  },
  summaryLabel: {
    fontSize: 11,
    color: theme.textSub,
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.text,
  },
  formActions: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  nextBtn: {
    backgroundColor: theme.primary,
    height: 54,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: theme.primary,
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  nextBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  submitRow: {
    flexDirection: 'row',
    gap: 10,
  },
  prevBtn: {
    flex: 1,
    height: 54,
    borderRadius: 16,
    backgroundColor: theme.bgSecondary,
    borderWidth: 1,
    borderColor: theme.divider,
    alignItems: 'center',
    justifyContent: 'center',
  },
  prevBtnText: {
    fontSize: 15,
    color: theme.textSub,
    fontWeight: '700',
  },
  draftBtn: {
    flex: 1.5,
    height: 54,
    borderRadius: 16,
    backgroundColor: theme.card,
    borderWidth: 1,
    borderColor: theme.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  draftBtnText: {
    fontSize: 15,
    color: theme.primaryText,
    fontWeight: '700',
  },
  publishBtn: {
    flex: 2,
    height: 54,
    borderRadius: 16,
    backgroundColor: theme.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  publishBtnDisabled: {
    opacity: 0.5,
  },
  publishBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  emptyIcon: {fontSize: 64, marginBottom: 20},
  emptyTitle: {fontSize: 20, fontWeight: '800', color: theme.text},
  emptyDesc: {fontSize: 14, color: theme.textSub, textAlign: 'center', marginTop: 12, lineHeight: 22, marginBottom: 32},
  primaryAction: {
    backgroundColor: theme.primary,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 14,
  },
  primaryActionText: {color: '#FFFFFF', fontSize: 16, fontWeight: '800'},
});
