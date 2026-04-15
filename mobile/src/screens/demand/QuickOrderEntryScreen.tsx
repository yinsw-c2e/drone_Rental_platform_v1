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
      Alert.alert('提示', '请先填写起点和终点地址。');
      return;
    }
    if (!cargoWeight || Number(cargoWeight) <= 0) {
      Alert.alert('提示', '请填写货物预估重量，用于精准匹配机型。');
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

  const onStartDateChange = (_event: any, selectedDate?: Date) => {
    setShowStartPicker(Platform.OS === 'ios');
    if (!selectedDate) {
      return;
    }
    setStartDate(selectedDate);
    if (selectedDate >= endDate) {
      setEndDate(buildDefaultEndDate(selectedDate));
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
          <View style={[styles.stepDot, styles.stepDotActive]} />
          <View style={styles.stepLine} />
          <View style={styles.stepDot} />
          <View style={styles.stepLine} />
          <View style={styles.stepDot} />
        </View>
        <View style={styles.stepLabels}>
          <Text style={[styles.stepLabelText, styles.stepLabelTextActive]}>填写信息</Text>
          <Text style={styles.stepLabelText}>挑选服务</Text>
          <Text style={styles.stepLabelText}>确认下单</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.heroSection}>
          <Text style={styles.title}>我们要运往哪里？</Text>
          <Text style={styles.subtitle}>
            只需填写最核心的运输需求，系统将为您即时匹配支持直达下单的专业机组。
          </Text>
        </View>

        <ObjectCard style={styles.inputSection}>
          <View style={styles.inputGroup}>
            <View style={styles.iconLabelRow}>
              <Text style={styles.iconEmoji}>📍</Text>
              <Text style={styles.label}>运输路线</Text>
            </View>
            <View style={styles.addressContainer}>
              <AddressInputField
                value={pickupAddress}
                placeholder="从哪起运？"
                onSelect={setPickupAddress}
                style={styles.addressInput}
              />
              <View style={styles.addressConnector}>
                <View style={styles.connectorLine} />
              </View>
              <AddressInputField
                value={deliveryAddress}
                placeholder="运往何处？"
                onSelect={setDeliveryAddress}
                style={styles.addressInput}
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <View style={styles.iconLabelRow}>
              <Text style={styles.iconEmoji}>📦</Text>
              <Text style={styles.label}>货物概况</Text>
            </View>
            <View style={styles.cargoRow}>
              <View style={[styles.inputWrap, {flex: 2}]}>
                <TextInput
                  style={styles.inlineInput}
                  placeholder="货物类型，如：塔材"
                  placeholderTextColor={theme.textHint}
                  value={cargoType}
                  onChangeText={setCargoType}
                />
              </View>
              <View style={[styles.inputWrap, {flex: 1.2}]}>
                <TextInput
                  style={[styles.inlineInput, {textAlign: 'right'}]}
                  keyboardType="numeric"
                  placeholder="重量 (kg)"
                  placeholderTextColor={theme.textHint}
                  value={cargoWeight}
                  onChangeText={setCargoWeight}
                />
              </View>
            </View>
          </View>

          <View style={styles.inputGroup}>
            <View style={styles.iconLabelRow}>
              <Text style={styles.iconEmoji}>🏗️</Text>
              <Text style={styles.label}>作业场景</Text>
            </View>
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
          </View>

          <View style={styles.inputGroup}>
            <View style={styles.iconLabelRow}>
              <Text style={styles.iconEmoji}>🕒</Text>
              <Text style={styles.label}>预约时间</Text>
            </View>
            <View style={styles.timeRow}>
              <TouchableOpacity style={styles.timePicker} onPress={() => setShowStartPicker(true)}>
                <Text style={styles.timePickerLabel}>开始时间</Text>
                <Text style={styles.timePickerValue}>{formatDateTime(startDate).split(' ')[1]}</Text>
                <Text style={styles.timePickerDate}>{formatDateTime(startDate).split(' ')[0]}</Text>
              </TouchableOpacity>
              <View style={styles.timeSeparator}>
                <Text style={styles.timeSeparatorText}>至</Text>
              </View>
              <TouchableOpacity style={styles.timePicker} onPress={() => setShowEndPicker(true)}>
                <Text style={styles.timePickerLabel}>结束时间</Text>
                <Text style={styles.timePickerValue}>{formatDateTime(endDate).split(' ')[1]}</Text>
                <Text style={styles.timePickerDate}>{formatDateTime(endDate).split(' ')[0]}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ObjectCard>

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

        <View style={styles.bottomActions}>
          <TouchableOpacity style={styles.submitBtn} onPress={handleNext}>
            <Text style={styles.submitBtnText}>查看推荐服务</Text>
            <Text style={styles.submitBtnSubtext}>系统将实时筛选支持直达下单的服务</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.secondaryLink}
            onPress={() => navigation.navigate('PublishCargo', {quickOrderDraft: buildDraft()})}
          >
            <Text style={styles.secondaryLinkText}>需求较复杂？发布任务让机主报价</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const getStyles = (theme: AppTheme) =>
  StyleSheet.create({
    container: {flex: 1, backgroundColor: theme.bg},
    stepHeader: {
      paddingHorizontal: 24,
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
      width: 12,
      height: 12,
    },
    stepLine: {
      width: 60,
      height: 2,
      backgroundColor: theme.divider,
      marginHorizontal: 4,
    },
    stepLabels: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: 8,
    },
    stepLabelText: {
      fontSize: 11,
      color: theme.textHint,
      fontWeight: '600',
    },
    stepLabelTextActive: {
      color: theme.primary,
      fontWeight: '700',
    },
    content: {paddingHorizontal: 16, paddingBottom: 40},
    heroSection: {
      marginTop: 24,
      marginBottom: 20,
    },
    title: {
      fontSize: 28,
      fontWeight: '800',
      color: theme.text,
      letterSpacing: -0.5,
    },
    subtitle: {
      marginTop: 10,
      fontSize: 14,
      lineHeight: 22,
      color: theme.textSub,
    },
    inputSection: {
      padding: 18,
      borderRadius: 20,
      backgroundColor: theme.card,
    },
    inputGroup: {
      marginBottom: 24,
    },
    iconLabelRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 12,
    },
    iconEmoji: {
      fontSize: 16,
      marginRight: 8,
    },
    label: {
      fontSize: 15,
      fontWeight: '800',
      color: theme.text,
    },
    addressContainer: {
      backgroundColor: theme.bgSecondary,
      borderRadius: 16,
      padding: 4,
    },
    addressInput: {
      backgroundColor: 'transparent',
      borderWidth: 0,
    },
    addressConnector: {
      paddingLeft: 44,
      height: 12,
      justifyContent: 'center',
    },
    connectorLine: {
      width: 1,
      height: '100%',
      backgroundColor: theme.divider,
      marginLeft: 2,
    },
    cargoRow: {
      flexDirection: 'row',
      gap: 10,
    },
    inputWrap: {
      backgroundColor: theme.bgSecondary,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 12,
    },
    inlineInput: {
      fontSize: 15,
      color: theme.text,
      padding: 0,
    },
    optionRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    optionBtn: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 10,
      backgroundColor: theme.bgSecondary,
      borderWidth: 1,
      borderColor: 'transparent',
    },
    optionBtnActive: {
      borderColor: theme.primary,
      backgroundColor: theme.primaryBg,
    },
    optionText: {
      fontSize: 13,
      color: theme.textSub,
      fontWeight: '600',
    },
    optionTextActive: {
      color: theme.primaryText,
      fontWeight: '800',
    },
    timeRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    timePicker: {
      flex: 1,
      backgroundColor: theme.bgSecondary,
      borderRadius: 12,
      padding: 12,
      alignItems: 'center',
    },
    timePickerLabel: {
      fontSize: 10,
      color: theme.textHint,
      textTransform: 'uppercase',
      fontWeight: '700',
      marginBottom: 4,
    },
    timePickerValue: {
      fontSize: 18,
      fontWeight: '800',
      color: theme.text,
    },
    timePickerDate: {
      fontSize: 11,
      color: theme.textSub,
      marginTop: 2,
    },
    timeSeparator: {
      paddingHorizontal: 10,
    },
    timeSeparatorText: {
      fontSize: 12,
      color: theme.textHint,
      fontWeight: '700',
    },
    bottomActions: {
      marginTop: 24,
      gap: 16,
    },
    submitBtn: {
      height: 64,
      borderRadius: 18,
      backgroundColor: theme.primary,
      justifyContent: 'center',
      alignItems: 'center',
      shadowColor: theme.primary,
      shadowOffset: {width: 0, height: 6},
      shadowOpacity: 0.2,
      shadowRadius: 10,
      elevation: 4,
    },
    submitBtnText: {
      color: '#FFFFFF',
      fontSize: 17,
      fontWeight: '800',
    },
    submitBtnSubtext: {
      color: 'rgba(255,255,255,0.7)',
      fontSize: 11,
      marginTop: 4,
      fontWeight: '600',
    },
    secondaryLink: {
      paddingVertical: 8,
      alignItems: 'center',
    },
    secondaryLinkText: {
      fontSize: 14,
      color: theme.textSub,
      fontWeight: '600',
      textDecorationLine: 'underline',
    },
  });
