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

import AddressInputField from '../../components/AddressInputField';
import ObjectCard from '../../components/business/ObjectCard';
import {AddressData, QuickOrderDraft} from '../../types';
import {useTheme} from '../../theme/ThemeContext';
import type {AppTheme} from '../../theme/index';

const sceneOptions = [
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

function summarizeAddress(address?: AddressData | null): string {
  if (!address) {
    return '待补充';
  }
  return address.name || address.address || '待补充';
}

export default function QuickOrderEntryScreen({navigation}: any) {
  const {theme} = useTheme();
  const styles = getStyles(theme);
  const defaultStartDate = useMemo(() => buildDefaultStartDate(), []);

  const [cargoScene, setCargoScene] = useState(sceneOptions[0].key);
  const [cargoWeight, setCargoWeight] = useState('');
  const [cargoType, setCargoType] = useState('');
  const [pickupAddress, setPickupAddress] = useState<AddressData | null>(null);
  const [deliveryAddress, setDeliveryAddress] = useState<AddressData | null>(null);
  const [startDate, setStartDate] = useState(defaultStartDate);
  const [endDate, setEndDate] = useState(buildDefaultEndDate(defaultStartDate));
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);

  const buildDraft = (): QuickOrderDraft => ({
    cargo_scene: cargoScene,
    cargo_type: cargoType.trim() || '重载物资',
    cargo_weight_kg: Number(cargoWeight) || undefined,
    departure_address: pickupAddress,
    destination_address: deliveryAddress,
    scheduled_start_at: startDate.toISOString(),
    scheduled_end_at: endDate.toISOString(),
  });

  const handleNext = () => {
    if (!pickupAddress || !deliveryAddress) {
      Alert.alert('提示', '请先填写起点和终点地址，平台将据此匹配服务。');
      return;
    }
    if (!cargoWeight || Number(cargoWeight) <= 0) {
      Alert.alert('提示', '请填写货物预估重量，用于筛选有足够吊重的设备。');
      return;
    }
    if (endDate <= startDate) {
      Alert.alert('提示', '结束时间需要晚于开始时间。');
      return;
    }
    navigation.navigate('OfferList', {
      quickOrderDraft: buildDraft(),
    });
  };

  const handleFallbackToPublish = () => {
    navigation.navigate('PublishCargo', {
      quickOrderDraft: buildDraft(),
    });
  };

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
      setEndDate(buildDefaultEndDate(selectedDate));
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

  return (
    <SafeAreaView style={[styles.container, {backgroundColor: theme.bg}]}>
      <ScrollView contentContainerStyle={styles.content}>
        <ObjectCard style={styles.heroCard}>
          <Text style={styles.heroEyebrow}>快速下单</Text>
          <Text style={styles.title}>先告诉我这次怎么运</Text>
          <Text style={styles.subtitle}>
            这里只收最小成单信息。下一步系统会直接筛出支持直达下单的服务，不让你先发完整任务再慢慢等。
          </Text>
        </ObjectCard>

        <ObjectCard>
          <Text style={styles.sectionTitle}>第 1 步：填写最小信息</Text>

          <Text style={styles.label}>起点地址 *</Text>
          <AddressInputField value={pickupAddress} placeholder="点击选择起点地址" onSelect={setPickupAddress} />

          <Text style={styles.label}>终点地址 *</Text>
          <AddressInputField value={deliveryAddress} placeholder="点击选择终点地址" onSelect={setDeliveryAddress} />

          <Text style={styles.label}>货物重量预估 (kg) *</Text>
          <TextInput
            style={styles.input}
            keyboardType="numeric"
            placeholder="例如：120"
            placeholderTextColor={theme.textHint}
            value={cargoWeight}
            onChangeText={setCargoWeight}
          />

          <Text style={styles.label}>货物类型</Text>
          <TextInput
            style={styles.input}
            placeholder="例如：塔材、设备箱、海鲜补给"
            placeholderTextColor={theme.textHint}
            value={cargoType}
            onChangeText={setCargoType}
          />

          <Text style={styles.label}>作业场景 *</Text>
          <View style={styles.optionRow}>
            {sceneOptions.map(option => (
              <TouchableOpacity
                key={option.key}
                style={[styles.optionBtn, cargoScene === option.key && styles.optionBtnActive]}
                onPress={() => setCargoScene(option.key)}>
                <Text style={[styles.optionText, cargoScene === option.key && styles.optionTextActive]}>
                  {option.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>期望开始时间 *</Text>
          <TouchableOpacity style={styles.input} onPress={() => setShowStartPicker(true)}>
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

          <Text style={styles.label}>期望结束时间 *</Text>
          <TouchableOpacity style={styles.input} onPress={() => setShowEndPicker(true)}>
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
          <Text style={styles.sectionTitle}>本次需求摘要</Text>
          <Text style={styles.summaryText}>
            {summarizeAddress(pickupAddress)}
            {' -> '}
            {summarizeAddress(deliveryAddress)}
          </Text>
          <Text style={styles.summaryText}>
            {cargoWeight || '--'}kg / {cargoType.trim() || '重载物资'}
          </Text>
          <Text style={styles.summaryHint}>
            如果下一步没有筛到合适服务，系统会保留这些信息，让你一键改为发布任务。
          </Text>
        </ObjectCard>

        <TouchableOpacity style={styles.submitBtn} onPress={handleNext}>
          <Text style={styles.submitBtnText}>第 2 步：查看推荐服务</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.secondaryBtn} onPress={handleFallbackToPublish}>
          <Text style={styles.secondaryBtnText}>复杂需求？直接发布任务</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const getStyles = (theme: AppTheme) =>
  StyleSheet.create({
    container: {flex: 1, backgroundColor: theme.card},
    content: {padding: 16, paddingBottom: 40, gap: 12},
    heroCard: {
      backgroundColor: theme.isDark ? 'rgba(0,212,255,0.08)' : theme.primary,
      borderWidth: theme.isDark ? 1 : 0,
      borderColor: theme.isDark ? theme.primaryBorder : 'transparent',
    },
    heroEyebrow: {
      fontSize: 12,
      fontWeight: '700',
      color: theme.isDark ? theme.primaryText : 'rgba(255,255,255,0.72)',
    },
    title: {
      marginTop: 8,
      fontSize: 26,
      lineHeight: 32,
      fontWeight: '800',
      color: theme.isDark ? theme.text : '#FFFFFF',
    },
    subtitle: {
      marginTop: 10,
      fontSize: 13,
      lineHeight: 20,
      color: theme.isDark ? theme.textSub : 'rgba(255,255,255,0.85)',
    },
    sectionTitle: {
      fontSize: 17,
      fontWeight: '800',
      color: theme.text,
      marginBottom: 4,
    },
    label: {
      fontSize: 14,
      fontWeight: '700',
      color: theme.text,
      marginBottom: 8,
      marginTop: 16,
    },
    input: {
      borderWidth: 1,
      borderColor: theme.cardBorder,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontSize: 15,
      backgroundColor: theme.bgSecondary,
    },
    dateText: {
      fontSize: 15,
      color: theme.text,
    },
    optionRow: {flexDirection: 'row', flexWrap: 'wrap'},
    optionBtn: {
      paddingHorizontal: 14,
      paddingVertical: 9,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: theme.cardBorder,
      marginRight: 8,
      marginBottom: 8,
      backgroundColor: theme.card,
    },
    optionBtnActive: {
      borderColor: theme.primary,
      backgroundColor: theme.primary + '22',
    },
    optionText: {fontSize: 13, color: theme.textSub},
    optionTextActive: {color: theme.primary, fontWeight: '700'},
    summaryText: {
      fontSize: 14,
      lineHeight: 22,
      color: theme.text,
      marginTop: 6,
    },
    summaryHint: {
      fontSize: 12,
      lineHeight: 18,
      color: theme.textSub,
      marginTop: 10,
    },
    submitBtn: {
      marginTop: 8,
      height: 50,
      borderRadius: 14,
      backgroundColor: theme.primary,
      justifyContent: 'center',
      alignItems: 'center',
    },
    submitBtnText: {color: theme.btnPrimaryText, fontSize: 16, fontWeight: '800'},
    secondaryBtn: {
      height: 48,
      borderRadius: 14,
      backgroundColor: theme.card,
      borderWidth: 1,
      borderColor: theme.cardBorder,
      justifyContent: 'center',
      alignItems: 'center',
    },
    secondaryBtnText: {color: theme.text, fontSize: 15, fontWeight: '700'},
  });
