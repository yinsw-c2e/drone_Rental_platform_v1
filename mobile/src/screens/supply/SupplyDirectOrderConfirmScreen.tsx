import React, {useEffect, useMemo, useState} from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import {useSelector} from 'react-redux';

import AddressInputField from '../../components/AddressInputField';
import ObjectCard from '../../components/business/ObjectCard';
import {ClientEligibility, getClientEligibility} from '../../services/client';
import {supplyService} from '../../services/supply';
import {RootState} from '../../store/store';
import {AddressData, QuickOrderDraft, SupplyDetail} from '../../types';
import {getEffectiveRoleSummary} from '../../utils/roleSummary';
import {
  formatAmountYuan,
  formatSupplyPricing,
} from '../../utils/supplyMeta';
import {useTheme} from '../../theme/ThemeContext';
import type {AppTheme} from '../../theme/index';

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

function toAddressSnapshot(address: AddressData) {
  return {
    text: address.address,
    province: address.province,
    city: address.city,
    district: address.district,
    latitude: address.latitude,
    longitude: address.longitude,
  };
}

export default function SupplyDirectOrderConfirmScreen({route, navigation}: any) {
  const {theme} = useTheme();
  const styles = getStyles(theme);
  const {supply, quickOrderDraft, quickOrder} = route.params as {
    supply: SupplyDetail;
    quickOrderDraft?: QuickOrderDraft;
    quickOrder?: any;
  };
  const {user, roleSummary} = useSelector((state: RootState) => state.auth);

  const effectiveRoleSummary = useMemo(
    () => getEffectiveRoleSummary(roleSummary, user),
    [roleSummary, user],
  );
  const canCreateOrder = effectiveRoleSummary.has_client_role;

  const sceneOptions = useMemo(
    () => (supply.cargo_scenes?.length ? supply.cargo_scenes : ['emergency']),
    [supply.cargo_scenes],
  );
  const normalizedQuickOrderDraft = useMemo(
    () =>
      (quickOrderDraft ||
        (quickOrder
          ? {
              cargo_scene: quickOrder.cargoScene,
              cargo_weight_kg: Number(quickOrder.cargoWeight) || undefined,
              departure_address: quickOrder.pickupAddress,
              destination_address: quickOrder.deliveryAddress,
            }
          : undefined)) as QuickOrderDraft | undefined,
    [quickOrder, quickOrderDraft],
  );
  const initialStartDate = useMemo(
    () => parseDraftDate(normalizedQuickOrderDraft?.scheduled_start_at, buildDefaultStartDate()),
    [normalizedQuickOrderDraft?.scheduled_start_at],
  );
  const initialEndDate = useMemo(
    () => parseDraftDate(normalizedQuickOrderDraft?.scheduled_end_at, buildDefaultEndDate(initialStartDate)),
    [initialStartDate, normalizedQuickOrderDraft?.scheduled_end_at],
  );

  const [cargoScene] = useState(() => {
    const preferredScene = normalizedQuickOrderDraft?.cargo_scene;
    return preferredScene && sceneOptions.includes(preferredScene) ? preferredScene : sceneOptions[0];
  });
  const [departureAddress, setDepartureAddress] = useState<AddressData | null>(
    normalizedQuickOrderDraft?.departure_address || null,
  );
  const [destinationAddress, setDestinationAddress] = useState<AddressData | null>(
    normalizedQuickOrderDraft?.destination_address || null,
  );
  const [startDate, setStartDate] = useState<Date>(initialStartDate);
  const [endDate, setEndDate] = useState<Date>(initialEndDate);
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [cargoWeight, setCargoWeight] = useState(
    normalizedQuickOrderDraft?.cargo_weight_kg ? String(normalizedQuickOrderDraft.cargo_weight_kg) : '',
  );
  const cargoVolume = normalizedQuickOrderDraft?.cargo_volume_m3
    ? String(normalizedQuickOrderDraft.cargo_volume_m3)
    : '';
  const [cargoType, setCargoType] = useState(normalizedQuickOrderDraft?.cargo_type || '');
  const [specialRequirements, setSpecialRequirements] = useState(
    normalizedQuickOrderDraft?.special_requirements || '',
  );
  const description = normalizedQuickOrderDraft?.description || '';
  const [submitting, setSubmitting] = useState(false);
  const [eligibility, setEligibility] = useState<ClientEligibility | null>(null);
  const [eligibilityLoading, setEligibilityLoading] = useState(false);

  const estimatedAmount = supply.base_price_amount || 0;
  const ownerLabel = supply.owner?.nickname || `机主 #${supply.owner_user_id}`;
  const orderReady = canCreateOrder && (eligibility?.can_create_direct_order ?? true);

  useEffect(() => {
    let active = true;
    if (!canCreateOrder) {
      setEligibility(null);
      return () => {
        active = false;
      };
    }

    setEligibilityLoading(true);
    getClientEligibility()
      .then(nextEligibility => {
        if (active) {
          setEligibility(nextEligibility);
        }
      })
      .catch(() => {
        if (active) {
          setEligibility(null);
        }
      })
      .finally(() => {
        if (active) {
          setEligibilityLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [canCreateOrder]);

  const handleSubmit = async () => {
    if (!canCreateOrder) {
      Alert.alert('当前不可下单', '当前账号没有客户能力，无法从供给发起直达下单。');
      return;
    }
    try {
      const currentEligibility = await getClientEligibility();
      setEligibility(currentEligibility);
      if (!currentEligibility.can_create_direct_order) {
        const blocker = currentEligibility.blockers?.[0];
        if (blocker?.suggested_action === 'verify_identity') {
          Alert.alert('请先完成实名认证', blocker.message, [
            {text: '稍后再说', style: 'cancel'},
            {text: '去认证', onPress: () => navigation.navigate('Verification')},
          ]);
        } else {
          Alert.alert('当前暂不可下单', blocker?.message || '当前客户资格未就绪，请稍后重试。');
        }
        return;
      }
    } catch (error: any) {
      Alert.alert('资格检查失败', error?.message || '请稍后重试');
      return;
    }
    if (!departureAddress || !destinationAddress) {
      Alert.alert('请补充信息', '请先填写起运地址和送达地址。');
      return;
    }

    const weight = Number(cargoWeight);
    const volume = Number(cargoVolume || 0);
    if (!weight || weight <= 0) {
      Alert.alert('请补充信息', '请填写有效的货物重量。');
      return;
    }
    if (endDate <= startDate) {
      Alert.alert('时间有误', '结束时间必须晚于开始时间。');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        service_type: 'heavy_cargo_lift_transport' as const,
        cargo_scene: cargoScene,
        departure_address: toAddressSnapshot(departureAddress),
        destination_address: toAddressSnapshot(destinationAddress),
        service_address: null,
        scheduled_start_at: startDate.toISOString(),
        scheduled_end_at: endDate.toISOString(),
        cargo_weight_kg: weight,
        cargo_volume_m3: volume > 0 ? volume : undefined,
        cargo_type: cargoType.trim() || '重载物资',
        cargo_special_requirements: specialRequirements.trim() || undefined,
        description: description.trim() || undefined,
      };

      const res = await supplyService.createDirectOrder(supply.id, payload);
      const nextOrderId = res.data.order_id;
      navigation.reset({
        index: 2,
        routes: [
          {name: 'MainTabs'},
          {name: 'OrderDetail', params: {orderId: nextOrderId, id: nextOrderId}},
          {name: 'Contract', params: {orderId: nextOrderId}},
        ],
      });
    } catch (error: any) {
      Alert.alert('提交失败', error.message || '请稍后重试');
    } finally {
      setSubmitting(false);
    }
  };

  const onStartDateChange = (_event: any, selectedDate?: Date) => {
    setShowStartPicker(Platform.OS === 'ios');
    if (!selectedDate) {
      return;
    }
    setStartDate(selectedDate);
    if (selectedDate >= endDate) {
      const nextEnd = new Date(selectedDate.getTime());
      nextEnd.setHours(nextEnd.getHours() + 2);
      setEndDate(nextEnd);
    }
  };

  const onEndDateChange = (_event: any, selectedDate?: Date) => {
    setShowEndPicker(Platform.OS === 'ios');
    if (selectedDate) {
      setEndDate(selectedDate);
    }
  };

  return (
    <SafeAreaView style={[styles.container, {backgroundColor: theme.bg}]}>
      <View style={styles.stepHeader}>
        <View style={styles.stepTrack}>
          <View style={[styles.stepDot, styles.stepDotCompleted]} />
          <View style={[styles.stepLine, styles.stepLineCompleted]} />
          <View style={[styles.stepDot, styles.stepDotCompleted]} />
          <View style={[styles.stepLine, styles.stepLineCompleted]} />
          <View style={[styles.stepDot, styles.stepDotActive]} />
        </View>
        <View style={styles.stepLabels}>
          <Text style={[styles.stepLabelText, styles.stepLabelTextCompleted]}>填写信息</Text>
          <Text style={[styles.stepLabelText, styles.stepLabelTextCompleted]}>挑选服务</Text>
          <Text style={[styles.stepLabelText, styles.stepLabelTextActive]}>确认下单</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <ObjectCard style={styles.serviceReviewCard}>
          <View style={styles.serviceRow}>
            <View style={styles.serviceAvatar}>
              <Text style={styles.avatarText}>🚁</Text>
            </View>
            <View style={{flex: 1}}>
              <Text style={styles.serviceTitle} numberOfLines={1}>{supply.title}</Text>
              <Text style={styles.serviceOwner}>{ownerLabel} | {formatSupplyPricing(supply.base_price_amount, supply.pricing_unit)}</Text>
            </View>
          </View>
        </ObjectCard>

        <ObjectCard>
          <Text style={styles.sectionTitle}>核对运输方案</Text>
          <View style={styles.reviewGroup}>
            <View style={styles.reviewItem}>
              <Text style={styles.reviewLabel}>起运点</Text>
              <AddressInputField
                value={departureAddress}
                placeholder="请选择起运点"
                onSelect={setDepartureAddress}
                style={styles.inlineAddress}
              />
            </View>
            <View style={styles.reviewItem}>
              <Text style={styles.reviewLabel}>目的地</Text>
              <AddressInputField
                value={destinationAddress}
                placeholder="请选择目的地"
                onSelect={setDestinationAddress}
                style={styles.inlineAddress}
              />
            </View>
          </View>

          <View style={styles.reviewRow}>
            <View style={[styles.reviewItem, {flex: 1}]}>
              <Text style={styles.reviewLabel}>开始时间</Text>
              <TouchableOpacity style={styles.inlineDate} onPress={() => setShowStartPicker(true)}>
                <Text style={styles.inlineDateText}>{formatDateTime(startDate)}</Text>
              </TouchableOpacity>
            </View>
            <View style={[styles.reviewItem, {flex: 1}]}>
              <Text style={styles.reviewLabel}>结束时间</Text>
              <TouchableOpacity style={styles.inlineDate} onPress={() => setShowEndPicker(true)}>
                <Text style={styles.inlineDateText}>{formatDateTime(endDate)}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ObjectCard>

        <ObjectCard>
          <Text style={styles.sectionTitle}>货物详细信息</Text>
          <View style={styles.cargoGrid}>
            <View style={styles.cargoInputWrap}>
              <Text style={styles.inputLabel}>货物类型</Text>
              <TextInput
                style={styles.flatInput}
                value={cargoType}
                onChangeText={setCargoType}
                placeholder="如：塔材"
              />
            </View>
            <View style={styles.cargoInputWrap}>
              <Text style={styles.inputLabel}>重量 (kg)</Text>
              <TextInput
                style={styles.flatInput}
                keyboardType="numeric"
                value={cargoWeight}
                onChangeText={setCargoWeight}
                placeholder="重量"
              />
            </View>
          </View>

          <Text style={styles.inputLabel}>特殊要求（可选）</Text>
          <TextInput
            style={styles.flatTextArea}
            value={specialRequirements}
            onChangeText={setSpecialRequirements}
            placeholder="如：限时送达、防震要求等"
            multiline
          />
        </ObjectCard>

        <View style={styles.priceSummary}>
          <Text style={styles.sectionTitle}>预估费用拆分</Text>
          <View style={styles.priceDetailRow}>
            <Text style={styles.priceDetailLabel}>基础运输服务费 (含税)</Text>
            <Text style={styles.priceDetailValue}>¥{formatAmountYuan(estimatedAmount)}</Text>
          </View>
          <View style={styles.priceDetailRow}>
            <Text style={styles.priceDetailLabel}>履约保证金 (任务完结后全额返还)</Text>
            <Text style={styles.priceDetailValue}>¥{formatAmountYuan(0)}</Text>
          </View>
          <View style={styles.priceTotalRow}>
            <Text style={styles.priceTotalLabel}>合计预付总额</Text>
            <Text style={styles.priceTotalValue}>¥{formatAmountYuan(estimatedAmount)}</Text>
          </View>
          <Text style={styles.priceTip}>* 实际费用将以机主确认后的方案为准，保证金将在您确认签收后原路退回。</Text>
        </View>

        {eligibilityLoading && (
          <View style={styles.loadingBanner}>
            <ActivityIndicator size="small" color={theme.primary} />
            <Text style={styles.loadingBannerText}>正在检查账号资格...</Text>
          </View>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.primaryBtn, (!orderReady || submitting || eligibilityLoading) && styles.disabledBtn]}
          onPress={handleSubmit}
          disabled={!orderReady || submitting || eligibilityLoading}>
          <Text style={styles.primaryBtnText}>
            {submitting ? '正在提交...' : '确认并提交订单'}
          </Text>
        </TouchableOpacity>
      </View>

      {showStartPicker && (
        <DateTimePicker
          value={startDate}
          mode="datetime"
          display="default"
          onChange={onStartDateChange}
          minimumDate={new Date()}
        />
      )}
      {showEndPicker && (
        <DateTimePicker
          value={endDate}
          mode="datetime"
          display="default"
          onChange={onEndDateChange}
          minimumDate={startDate}
        />
      )}
    </SafeAreaView>
  );
}

const getStyles = (theme: AppTheme) => StyleSheet.create({
  container: {flex: 1, backgroundColor: theme.bg},
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
  content: {padding: 16, paddingBottom: 100, gap: 12},
  serviceReviewCard: {
    backgroundColor: theme.bgSecondary,
    borderWidth: 0,
    padding: 12,
  },
  serviceRow: {flexDirection: 'row', alignItems: 'center', gap: 12},
  serviceAvatar: {width: 40, height: 40, borderRadius: 10, backgroundColor: theme.primaryBg, alignItems: 'center', justifyContent: 'center'},
  avatarText: {fontSize: 18, fontWeight: '800', color: theme.primaryText},
  serviceTitle: {fontSize: 15, fontWeight: '800', color: theme.text},
  serviceOwner: {fontSize: 12, color: theme.textSub, marginTop: 2},
  sectionTitle: {fontSize: 16, fontWeight: '800', color: theme.text, marginBottom: 14},
  reviewGroup: {gap: 12},
  reviewItem: {marginBottom: 10},
  reviewLabel: {fontSize: 11, fontWeight: '700', color: theme.textHint, marginBottom: 6, textTransform: 'uppercase'},
  inlineAddress: {backgroundColor: theme.bgSecondary, borderRadius: 10, borderWidth: 1, borderColor: theme.divider},
  reviewRow: {flexDirection: 'row', gap: 12},
  inlineDate: {backgroundColor: theme.bgSecondary, borderRadius: 10, borderWidth: 1, borderColor: theme.divider, padding: 12},
  inlineDateText: {fontSize: 13, color: theme.text, fontWeight: '600'},
  cargoGrid: {flexDirection: 'row', gap: 12},
  cargoInputWrap: {flex: 1},
  inputLabel: {fontSize: 11, fontWeight: '700', color: theme.textHint, marginBottom: 6, textTransform: 'uppercase'},
  flatInput: {backgroundColor: theme.bgSecondary, borderRadius: 10, borderWidth: 1, borderColor: theme.divider, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: theme.text},
  flatTextArea: {backgroundColor: theme.bgSecondary, borderRadius: 10, borderWidth: 1, borderColor: theme.divider, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: theme.text, minHeight: 80, textAlignVertical: 'top'},
  priceSummary: {marginTop: 10, padding: 20, backgroundColor: theme.primaryBg, borderRadius: 20},
  priceDetailRow: {flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8},
  priceDetailLabel: {fontSize: 12, color: theme.textSub, fontWeight: '500'},
  priceDetailValue: {fontSize: 13, color: theme.text, fontWeight: '700'},
  priceTotalRow: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, paddingTop: 12, borderTopWidth: 1, borderTopColor: theme.divider},
  priceTotalLabel: {fontSize: 15, fontWeight: '800', color: theme.text},
  priceTotalValue: {fontSize: 20, fontWeight: '900', color: theme.danger},
  priceTip: {fontSize: 11, color: theme.primaryText, opacity: 0.7, marginTop: 12, lineHeight: 16},
  loadingBanner: {flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 10},
  loadingBannerText: {fontSize: 12, color: theme.textSub},
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: 16,
    paddingBottom: Platform.OS === 'ios' ? 32 : 16,
    backgroundColor: theme.card,
    borderTopWidth: 1,
    borderTopColor: theme.divider,
  },
  primaryBtn: {
    height: 54,
    borderRadius: 18,
    backgroundColor: theme.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: theme.primary,
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryBtnText: {fontSize: 16, color: '#FFFFFF', fontWeight: '800'},
  secondaryBtn: {
    height: 54,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: theme.divider,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.card,
  },
  secondaryBtnText: {fontSize: 16, color: theme.text, fontWeight: '700'},
  disabledBtn: {opacity: 0.5},
  successHero: {alignItems: 'center', paddingVertical: 32},
  successIconWrap: {width: 64, height: 64, borderRadius: 32, backgroundColor: theme.success, alignItems: 'center', justifyContent: 'center', marginBottom: 16},
  successIcon: {fontSize: 32, color: '#FFFFFF', fontWeight: '800'},
  successTitle: {fontSize: 24, fontWeight: '800', color: theme.text},
  successDesc: {fontSize: 14, color: theme.textSub, textAlign: 'center', marginTop: 10, paddingHorizontal: 40, lineHeight: 22},
  orderSummaryCard: {padding: 16, gap: 12},
  orderSummaryItem: {flexDirection: 'row', justifyContent: 'space-between'},
  orderSummaryLabel: {fontSize: 13, color: theme.textSub},
  orderSummaryValue: {fontSize: 14, fontWeight: '700', color: theme.text},
  successActions: {marginTop: 20, gap: 12},
});
