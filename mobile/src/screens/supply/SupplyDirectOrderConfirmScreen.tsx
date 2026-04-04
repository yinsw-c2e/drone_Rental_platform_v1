import React, {useMemo, useState} from 'react';
import {
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
import EmptyState from '../../components/business/EmptyState';
import ObjectCard from '../../components/business/ObjectCard';
import StatusBadge from '../../components/business/StatusBadge';
import {getObjectStatusMeta} from '../../components/business/visuals';
import {supplyService} from '../../services/supply';
import {RootState} from '../../store/store';
import {AddressData, DirectOrderResult, SupplyDetail} from '../../types';
import {getEffectiveRoleSummary} from '../../utils/roleSummary';
import {
  formatAmountYuan,
  formatSupplyPricing,
  getSupplySceneLabel,
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
  const {supply} = route.params as {supply: SupplyDetail};
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

  const [cargoScene, setCargoScene] = useState(sceneOptions[0]);
  const [departureAddress, setDepartureAddress] = useState<AddressData | null>(null);
  const [destinationAddress, setDestinationAddress] = useState<AddressData | null>(null);
  const [startDate, setStartDate] = useState<Date>(buildDefaultStartDate());
  const [endDate, setEndDate] = useState<Date>(buildDefaultEndDate(buildDefaultStartDate()));
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [cargoWeight, setCargoWeight] = useState('');
  const [cargoVolume, setCargoVolume] = useState('');
  const [cargoType, setCargoType] = useState('');
  const [specialRequirements, setSpecialRequirements] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [createdOrder, setCreatedOrder] = useState<DirectOrderResult | null>(null);

  const estimatedAmount = supply.base_price_amount || 0;
  const ownerLabel = supply.owner?.nickname || `机主 #${supply.owner_user_id}`;

  const handleSubmit = async () => {
    if (!canCreateOrder) {
      Alert.alert('当前不可下单', '当前账号没有客户能力，无法从供给发起直达下单。');
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
      setCreatedOrder(res.data);
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

  if (createdOrder) {
    return (
      <SafeAreaView style={[styles.container, {backgroundColor: theme.bg}]}>
        <ScrollView contentContainerStyle={styles.content}>
          <ObjectCard style={styles.successHero}>
            <Text style={styles.successEyebrow}>直达下单已提交</Text>
            <Text style={styles.successTitle}>等待机主确认</Text>
            <Text style={styles.successDesc}>
              订单已经创建成功，但还不能直接进入支付。机主确认后，订单才会进入待支付阶段。
            </Text>
            <View style={styles.successBadgeRow}>
              <StatusBadge label="" meta={getObjectStatusMeta('order', createdOrder.status)} />
            </View>
          </ObjectCard>

          <ObjectCard>
            <Text style={styles.sectionTitle}>订单摘要</Text>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>订单编号</Text>
              <Text style={styles.infoValue}>{createdOrder.order_no}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>订单来源</Text>
              <Text style={styles.infoValue}>供给直达下单</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>机主</Text>
              <Text style={styles.infoValue}>{ownerLabel}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>基础价格</Text>
              <Text style={styles.infoValue}>{formatSupplyPricing(supply.base_price_amount, supply.pricing_unit)}</Text>
            </View>
          </ObjectCard>

          <ObjectCard>
            <Text style={styles.sectionTitle}>下一步</Text>
            <Text style={styles.bodyText}>
              订单已创建并自动生成合同，你可以查看并签署合同，等机主确认后再继续支付。
            </Text>
            <View style={styles.actionStack}>
              <TouchableOpacity
                style={[styles.primaryBtn, styles.fullWidthBtn]}
                onPress={() => navigation.navigate('Contract', {orderId: createdOrder.order_id})}>
                <Text style={styles.primaryBtnText}>查看并签署合同</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.secondaryBtn, styles.fullWidthBtn]}
                onPress={() =>
                  navigation.navigate('MyOrders', {
                    roleFilter: 'client',
                    statusFilter: 'pending',
                    serverStatus: 'pending_provider_confirmation',
                  })
                }>
                <Text style={styles.secondaryBtnText}>查看我的订单</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.secondaryBtn, styles.fullWidthBtn]}
                onPress={() => navigation.navigate('OfferDetail', {id: supply.id})}>
                <Text style={styles.secondaryBtnText}>返回供给详情</Text>
              </TouchableOpacity>
            </View>
          </ObjectCard>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, {backgroundColor: theme.bg}]}>
      <ScrollView contentContainerStyle={styles.content}>
        {!canCreateOrder ? (
          <ObjectCard>
            <EmptyState
              icon="🔒"
              title="当前账号暂不可直达下单"
              description="直达下单属于客户动作。先补齐客户能力后，再从供给详情发起下单。"
              actionText="返回供给详情"
              onAction={() => navigation.goBack()}
            />
          </ObjectCard>
        ) : null}

        <ObjectCard>
          <Text style={styles.sectionTitle}>供给摘要</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>供给编号</Text>
            <Text style={styles.infoValue}>{supply.supply_no}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>供给标题</Text>
            <Text style={styles.infoValue}>{supply.title}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>机主</Text>
            <Text style={styles.infoValue}>{ownerLabel}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>设备能力</Text>
            <Text style={styles.infoValue}>
              起飞重量 {supply.mtow_kg || 0}kg / 最大吊重 {supply.max_payload_kg || 0}kg
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>基础价格</Text>
            <Text style={styles.infoValue}>{formatSupplyPricing(supply.base_price_amount, supply.pricing_unit)}</Text>
          </View>
        </ObjectCard>

        <ObjectCard>
          <Text style={styles.sectionTitle}>服务信息</Text>
          <Text style={styles.inputLabel}>任务场景</Text>
          <View style={styles.chipRow}>
            {sceneOptions.map(scene => (
              <TouchableOpacity
                key={scene}
                style={[styles.sceneChip, cargoScene === scene && styles.sceneChipActive]}
                onPress={() => setCargoScene(scene)}>
                <Text style={[styles.sceneChipText, cargoScene === scene && styles.sceneChipTextActive]}>
                  {getSupplySceneLabel(scene)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.inputLabel}>起运地址</Text>
          <AddressInputField
            value={departureAddress}
            placeholder="点击选择起运地址"
            onSelect={setDepartureAddress}
          />

          <Text style={styles.inputLabel}>送达地址</Text>
          <AddressInputField
            value={destinationAddress}
            placeholder="点击选择送达地址"
            onSelect={setDestinationAddress}
          />

          <Text style={styles.inputLabel}>预约开始时间</Text>
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

          <Text style={styles.inputLabel}>预约结束时间</Text>
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
        </ObjectCard>

        <ObjectCard>
          <Text style={styles.sectionTitle}>货物信息</Text>
          <Text style={styles.inputLabel}>货物重量 (kg)</Text>
          <TextInput
            style={styles.textInput}
            keyboardType="numeric"
            value={cargoWeight}
            onChangeText={setCargoWeight}
            placeholder="请输入货物重量"
          />

          <Text style={styles.inputLabel}>货物体积 (m³，可选)</Text>
          <TextInput
            style={styles.textInput}
            keyboardType="numeric"
            value={cargoVolume}
            onChangeText={setCargoVolume}
            placeholder="请输入货物体积"
          />

          <Text style={styles.inputLabel}>货物类型</Text>
          <TextInput
            style={styles.textInput}
            value={cargoType}
            onChangeText={setCargoType}
            placeholder="如：设备箱、救援物资、海鲜补给"
          />

          <Text style={styles.inputLabel}>特殊要求（可选）</Text>
          <TextInput
            style={[styles.textInput, styles.textArea]}
            value={specialRequirements}
            onChangeText={setSpecialRequirements}
            placeholder="如：防震、防水、限时送达"
            multiline
          />

          <Text style={styles.inputLabel}>补充说明（可选）</Text>
          <TextInput
            style={[styles.textInput, styles.textArea]}
            value={description}
            onChangeText={setDescription}
            placeholder="补充现场条件、装卸要求等信息"
            multiline
          />
        </ObjectCard>

        <ObjectCard>
          <Text style={styles.sectionTitle}>价格说明</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>基础价格</Text>
            <Text style={styles.infoValue}>{formatSupplyPricing(supply.base_price_amount, supply.pricing_unit)}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>预估费用</Text>
            <Text style={styles.infoValue}>{formatAmountYuan(estimatedAmount)}</Text>
          </View>
          <Text style={styles.tipText}>
            当前仅展示供给基础价格。最终订单金额以后续机主确认和订单信息为准。
          </Text>
        </ObjectCard>

        <ObjectCard highlightColor="#ffd591">
          <Text style={styles.sectionTitle}>提交提醒</Text>
          <Text style={styles.tipText}>
            提交后会直接创建订单，但订单状态先进入“待机主确认”。机主确认后，你才能继续支付。
          </Text>
        </ObjectCard>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.primaryBtn, (!canCreateOrder || submitting) && styles.disabledBtn]}
          onPress={handleSubmit}
          disabled={!canCreateOrder || submitting}>
          <Text style={styles.primaryBtnText}>{submitting ? '提交中...' : '提交直达下单'}</Text>
        </TouchableOpacity>
      </View>
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
    paddingBottom: 96,
    gap: 12,
  },
  successHero: {
    backgroundColor: theme.isDark ? 'rgba(0,212,255,0.08)' : theme.primary,
    borderWidth: theme.isDark ? 1 : 0,
    borderColor: theme.isDark ? theme.primaryBorder : 'transparent',
  },
  successEyebrow: {
    fontSize: 12,
    color: theme.isDark ? theme.primaryText : 'rgba(255,255,255,0.7)',
    fontWeight: '700',
  },
  successTitle: {
    marginTop: 8,
    fontSize: 28,
    lineHeight: 34,
    color: theme.isDark ? theme.text : '#FFFFFF',
    fontWeight: '800',
  },
  successDesc: {
    marginTop: 10,
    fontSize: 13,
    lineHeight: 20,
    color: theme.isDark ? theme.textSub : 'rgba(255,255,255,0.85)',
  },
  successBadgeRow: {
    marginTop: 14,
    alignSelf: 'flex-start',
  },
  sectionTitle: {
    fontSize: 17,
    color: theme.text,
    fontWeight: '800',
    marginBottom: 12,
  },
  inputLabel: {
    marginTop: 4,
    marginBottom: 8,
    fontSize: 13,
    color: theme.textSub,
    fontWeight: '700',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  sceneChip: {
    borderWidth: 1,
    borderColor: theme.divider,
    backgroundColor: theme.card,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  sceneChipActive: {
    backgroundColor: theme.primaryBg,
    borderColor: theme.primaryBorder,
  },
  sceneChipText: {
    fontSize: 12,
    color: theme.textSub,
    fontWeight: '700',
  },
  sceneChipTextActive: {
    color: theme.primaryText,
  },
  dateInput: {
    borderWidth: 1,
    borderColor: theme.divider,
    borderRadius: 12,
    backgroundColor: theme.bgSecondary,
    paddingHorizontal: 14,
    paddingVertical: 13,
    marginBottom: 12,
  },
  dateText: {
    fontSize: 15,
    color: theme.text,
  },
  textInput: {
    borderWidth: 1,
    borderColor: theme.divider,
    borderRadius: 12,
    backgroundColor: theme.bgSecondary,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 15,
    color: theme.text,
    marginBottom: 12,
  },
  textArea: {
    minHeight: 88,
    textAlignVertical: 'top',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 8,
    gap: 12,
  },
  infoLabel: {
    width: 88,
    fontSize: 13,
    color: theme.textSub,
  },
  infoValue: {
    flex: 1,
    textAlign: 'right',
    fontSize: 14,
    lineHeight: 20,
    color: theme.text,
    fontWeight: '600',
  },
  tipText: {
    fontSize: 13,
    lineHeight: 20,
    color: theme.textSub,
  },
  bodyText: {
    fontSize: 14,
    lineHeight: 22,
    color: theme.textSub,
  },
  actionStack: {
    marginTop: 14,
    gap: 10,
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: theme.card,
    borderTopWidth: 1,
    borderTopColor: theme.divider,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  primaryBtn: {
    backgroundColor: theme.primary,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
  },
  primaryBtnText: {
    fontSize: 15,
    color: theme.btnPrimaryText,
    fontWeight: '800',
  },
  secondaryBtn: {
    backgroundColor: theme.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.divider,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
  },
  secondaryBtnText: {
    fontSize: 15,
    color: theme.text,
    fontWeight: '700',
  },
  fullWidthBtn: {
    width: '100%',
  },
  disabledBtn: {
    opacity: 0.55,
  },
});
