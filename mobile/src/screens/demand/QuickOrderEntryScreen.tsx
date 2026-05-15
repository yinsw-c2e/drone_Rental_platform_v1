import React, {useEffect, useMemo, useState} from 'react';
import {
  Alert,
  Image,
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
import AirspaceRiskNotice from '../../components/business/AirspaceRiskNotice';
import ObjectCard from '../../components/business/ObjectCard';
import {checkAirspaceAvailability, AirspaceCheckResult} from '../../services/airspace';
import {AddressData, QuickOrderDraft} from '../../types';
import {useTheme} from '../../theme/ThemeContext';
import type {AppTheme} from '../../theme/index';
import {isAirspaceHardBlocked} from '../../utils/airspaceRisk';
import {quickOrderAssets} from '../../assets/miniProgramAssets';

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

export default function QuickOrderEntryScreen({navigation}: any) {
  const {theme} = useTheme();
  const styles = getStyles(theme);
  const defaultStartDate = useMemo(() => buildDefaultStartDate(), []);

  const [cargoScene, setCargoScene] = useState(sceneOptions[0].key);
  const [customCargoScene, setCustomCargoScene] = useState('');
  const [cargoWeight, setCargoWeight] = useState('');
  const [cargoLength, setCargoLength] = useState('');
  const [cargoWidth, setCargoWidth] = useState('');
  const [cargoHeight, setCargoHeight] = useState('');
  const [cargoType, setCargoType] = useState('');
  const [pickupAddress, setPickupAddress] = useState<AddressData | null>(null);
  const [deliveryAddress, setDeliveryAddress] = useState<AddressData | null>(null);
  const [startDate, setStartDate] = useState(defaultStartDate);
  const [endDate, setEndDate] = useState(buildDefaultEndDate(defaultStartDate));
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [pickupAirspace, setPickupAirspace] = useState<AirspaceCheckResult | null>(null);
  const [deliveryAirspace, setDeliveryAirspace] = useState<AirspaceCheckResult | null>(null);
  const [checkingPickupAirspace, setCheckingPickupAirspace] = useState(false);
  const [checkingDeliveryAirspace, setCheckingDeliveryAirspace] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!pickupAddress?.latitude || !pickupAddress?.longitude) {
      setPickupAirspace(null);
      setCheckingPickupAirspace(false);
      return () => {
        cancelled = true;
      };
    }
    setCheckingPickupAirspace(true);
    checkAirspaceAvailability(pickupAddress.latitude, pickupAddress.longitude, 120)
      .then(result => {
        if (!cancelled) {
          setPickupAirspace(result);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setPickupAirspace(null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setCheckingPickupAirspace(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [pickupAddress?.latitude, pickupAddress?.longitude]);

  useEffect(() => {
    let cancelled = false;
    if (!deliveryAddress?.latitude || !deliveryAddress?.longitude) {
      setDeliveryAirspace(null);
      setCheckingDeliveryAirspace(false);
      return () => {
        cancelled = true;
      };
    }
    setCheckingDeliveryAirspace(true);
    checkAirspaceAvailability(deliveryAddress.latitude, deliveryAddress.longitude, 120)
      .then(result => {
        if (!cancelled) {
          setDeliveryAirspace(result);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setDeliveryAirspace(null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setCheckingDeliveryAirspace(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [deliveryAddress?.latitude, deliveryAddress?.longitude]);

  const hasAirspaceHardBlock =
    isAirspaceHardBlocked(pickupAirspace) || isAirspaceHardBlocked(deliveryAirspace);
  const effectiveCargoScene = customCargoScene.trim() || cargoScene;

  const buildDraft = (): QuickOrderDraft => {
    const lengthCM = Number(cargoLength);
    const widthCM = Number(cargoWidth);
    const heightCM = Number(cargoHeight);
    return {
      cargo_scene: effectiveCargoScene,
      cargo_type: cargoType.trim() || '重载物资',
      cargo_weight_kg: Number(cargoWeight) || undefined,
      cargo_length_cm: lengthCM > 0 ? lengthCM : undefined,
      cargo_width_cm: widthCM > 0 ? widthCM : undefined,
      cargo_height_cm: heightCM > 0 ? heightCM : undefined,
      cargo_volume_m3: lengthCM > 0 && widthCM > 0 && heightCM > 0
        ? lengthCM * widthCM * heightCM / 1000000
        : undefined,
      departure_address: pickupAddress,
      destination_address: deliveryAddress,
      scheduled_start_at: startDate.toISOString(),
      scheduled_end_at: endDate.toISOString(),
    };
  };

  const handleNext = () => {
    if (!pickupAddress || !deliveryAddress) {
      Alert.alert('提示', '请先填写起点和终点地址，平台将据此匹配服务。');
      return;
    }
    if (!cargoWeight || Number(cargoWeight) <= 0) {
      Alert.alert('提示', '请填写货物预估重量，用于筛选有足够吊重的设备。');
      return;
    }
    if (hasAirspaceHardBlock) {
      Alert.alert('当前位置受限', '起点或终点命中禁飞区，当前无法继续匹配推荐服务，请先调整地址。');
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
        <View style={styles.heroCard}>
          <View style={styles.heroIconWrap}>
            <Image source={quickOrderAssets.target} style={styles.heroIcon} resizeMode="contain" />
          </View>
          <View style={styles.heroCopy}>
            <Text style={styles.heroEyebrow}>快速下单</Text>
            <Text style={styles.heroTitle}>先填核心需求，再挑选推荐服务</Text>
            <Text style={styles.heroSub}>系统会根据地址、载重和时间匹配可承接服务。</Text>
          </View>
        </View>

        <ObjectCard>
          <View style={styles.sectionTitleRow}>
            <Image source={quickOrderAssets.grid} style={styles.sectionIcon} resizeMode="contain" />
            <Text style={styles.sectionTitle}>第 1 步：填写最小信息</Text>
          </View>

          <View style={styles.labelRow}>
            <Image source={quickOrderAssets.pinStart} style={styles.labelIcon} resizeMode="contain" />
            <Text style={styles.label}>起点地址 *</Text>
          </View>
          <AddressInputField value={pickupAddress} placeholder="点击选择起点地址" onSelect={setPickupAddress} />
          <AirspaceRiskNotice
            label="起点"
            result={pickupAirspace}
            checking={checkingPickupAirspace}
            onOpenDetails={
              pickupAddress
                ? () => navigation.navigate('NoFlyZone', {latitude: pickupAddress.latitude, longitude: pickupAddress.longitude})
                : undefined
            }
          />

          <View style={styles.labelRow}>
            <Image source={quickOrderAssets.pinEnd} style={styles.labelIcon} resizeMode="contain" />
            <Text style={styles.label}>终点地址 *</Text>
          </View>
          <AddressInputField value={deliveryAddress} placeholder="点击选择终点地址" onSelect={setDeliveryAddress} />
          <AirspaceRiskNotice
            label="终点"
            result={deliveryAirspace}
            checking={checkingDeliveryAirspace}
            onOpenDetails={
              deliveryAddress
                ? () => navigation.navigate('NoFlyZone', {latitude: deliveryAddress.latitude, longitude: deliveryAddress.longitude})
                : undefined
            }
          />

          <View style={styles.labelRow}>
            <Image source={quickOrderAssets.weightBag} style={styles.labelIcon} resizeMode="contain" />
            <Text style={styles.label}>货物重量预估 (kg) *</Text>
          </View>
          <TextInput
            style={styles.input}
            keyboardType="numeric"
            placeholder="例如：120"
            placeholderTextColor={theme.textHint}
            value={cargoWeight}
            onChangeText={setCargoWeight}
          />

          <View style={styles.labelRow}>
            <Image source={quickOrderAssets.cube} style={styles.labelIcon} resizeMode="contain" />
            <Text style={styles.label}>货物类型</Text>
          </View>
          <TextInput
            style={styles.input}
            placeholder="例如：塔材、设备箱、海鲜补给"
            placeholderTextColor={theme.textHint}
            value={cargoType}
            onChangeText={setCargoType}
          />

          <View style={styles.labelRow}>
            <Image source={quickOrderAssets.ruler} style={styles.labelIcon} resizeMode="contain" />
            <Text style={styles.label}>货物尺寸 (cm)</Text>
          </View>
          <View style={styles.dimensionRow}>
            <TextInput
              style={[styles.input, styles.dimensionInput]}
              keyboardType="numeric"
              placeholder="长"
              placeholderTextColor={theme.textHint}
              value={cargoLength}
              onChangeText={setCargoLength}
            />
            <TextInput
              style={[styles.input, styles.dimensionInput]}
              keyboardType="numeric"
              placeholder="宽"
              placeholderTextColor={theme.textHint}
              value={cargoWidth}
              onChangeText={setCargoWidth}
            />
            <TextInput
              style={[styles.input, styles.dimensionInput]}
              keyboardType="numeric"
              placeholder="高"
              placeholderTextColor={theme.textHint}
              value={cargoHeight}
              onChangeText={setCargoHeight}
            />
          </View>

          <View style={styles.labelRow}>
            <Image source={quickOrderAssets.grid} style={styles.labelIcon} resizeMode="contain" />
            <Text style={styles.label}>作业场景 *</Text>
          </View>
          <View style={styles.optionRow}>
            {sceneOptions.map(option => (
              <TouchableOpacity
                key={option.key}
                style={[styles.optionBtn, !customCargoScene.trim() && cargoScene === option.key && styles.optionBtnActive]}
                onPress={() => {
                  setCargoScene(option.key);
                  setCustomCargoScene('');
                }}>
                <Text style={[styles.optionText, !customCargoScene.trim() && cargoScene === option.key && styles.optionTextActive]}>
                  {option.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <TextInput
            style={styles.input}
            placeholder="其他场景，可直接填写"
            placeholderTextColor={theme.textHint}
            value={customCargoScene}
            onChangeText={setCustomCargoScene}
          />

          <View style={styles.labelRow}>
            <Image source={quickOrderAssets.calendar} style={styles.labelIcon} resizeMode="contain" />
            <Text style={styles.label}>期望开始时间 *</Text>
          </View>
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

          <View style={styles.labelRow}>
            <Image source={quickOrderAssets.clock} style={styles.labelIcon} resizeMode="contain" />
            <Text style={styles.label}>期望结束时间 *</Text>
          </View>
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

        {hasAirspaceHardBlock ? (
          <Text style={styles.blockedHint}>当前起点或终点命中禁飞区，请先更换地址后再继续匹配服务。</Text>
        ) : null}

        <TouchableOpacity style={[styles.submitBtn, hasAirspaceHardBlock && styles.disabledBtn]} onPress={handleNext}>
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
    container: {flex: 1, backgroundColor: theme.bg},
    content: {padding: 12, paddingBottom: 40, gap: 12},
    heroCard: {
      minHeight: 124,
      borderRadius: 18,
      padding: 16,
      backgroundColor: '#E6F4FF',
      borderWidth: 1,
      borderColor: '#91CAFF',
      flexDirection: 'row',
      alignItems: 'center',
      shadowColor: '#142850',
      shadowOffset: {width: 0, height: 8},
      shadowOpacity: theme.isDark ? 0 : 0.06,
      shadowRadius: 18,
      elevation: 2,
    },
    heroIconWrap: {
      width: 58,
      height: 58,
      borderRadius: 18,
      backgroundColor: '#FFFFFF',
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 14,
    },
    heroIcon: {
      width: 36,
      height: 36,
    },
    heroCopy: {
      flex: 1,
      minWidth: 0,
    },
    heroEyebrow: {
      fontSize: 12,
      color: theme.primary,
      fontWeight: '800',
    },
    heroTitle: {
      marginTop: 6,
      fontSize: 19,
      lineHeight: 24,
      color: theme.text,
      fontWeight: '900',
    },
    heroSub: {
      marginTop: 6,
      fontSize: 12,
      lineHeight: 18,
      color: theme.textSub,
      fontWeight: '600',
    },
    sectionTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 4,
    },
    sectionIcon: {
      width: 22,
      height: 22,
      marginRight: 8,
    },
    sectionTitle: {
      fontSize: 17,
      fontWeight: '800',
      color: theme.text,
    },
    labelRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 8,
      marginTop: 16,
    },
    labelIcon: {
      width: 18,
      height: 18,
      marginRight: 8,
    },
    label: {
      fontSize: 14,
      fontWeight: '700',
      color: theme.text,
    },
    input: {
      borderWidth: 1,
      borderColor: theme.inputBorder,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontSize: 15,
      backgroundColor: theme.inputBg,
      color: theme.text,
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
    dimensionRow: {
      flexDirection: 'row',
      gap: 10,
    },
    dimensionInput: {
      flex: 1,
      minWidth: 0,
    },
    submitBtn: {
      marginTop: 8,
      height: 50,
      borderRadius: 14,
      backgroundColor: theme.primary,
      justifyContent: 'center',
      alignItems: 'center',
    },
    disabledBtn: {
      opacity: 0.45,
    },
    submitBtnText: {color: theme.btnPrimaryText, fontSize: 16, fontWeight: '800'},
    blockedHint: {
      marginTop: 4,
      fontSize: 12,
      lineHeight: 18,
      color: theme.danger,
      fontWeight: '600',
    },
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
