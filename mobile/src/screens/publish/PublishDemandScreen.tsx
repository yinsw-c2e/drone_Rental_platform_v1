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
import {demandV2Service} from '../../services/demandV2';
import {AddressData} from '../../types';
import {useTheme} from '../../theme/ThemeContext';
import type {AppTheme} from '../../theme/index';

const sceneOptions = [
  {key: 'power_grid', label: '电网建设'},
  {key: 'mountain_agriculture', label: '山区农副产品'},
  {key: 'plateau_supply', label: '高原给养'},
  {key: 'island_supply', label: '海岛补给'},
  {key: 'emergency', label: '应急救援'},
];

function buildDefaultStart(): Date {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(9, 0, 0, 0);
  return d;
}

function buildDefaultEnd(start: Date): Date {
  const d = new Date(start);
  d.setHours(17, 0, 0, 0);
  return d;
}

function formatDateTime(date: Date): string {
  const y = date.getFullYear();
  const m = `${date.getMonth() + 1}`.padStart(2, '0');
  const d = `${date.getDate()}`.padStart(2, '0');
  const h = `${date.getHours()}`.padStart(2, '0');
  const mi = `${date.getMinutes()}`.padStart(2, '0');
  return `${y}-${m}-${d} ${h}:${mi}`;
}

const toAddressSnapshot = (value: AddressData | null | undefined) =>
  value
    ? {
        text: value.address,
        city: value.city,
        district: value.district,
        latitude: value.latitude,
        longitude: value.longitude,
      }
    : undefined;

export default function PublishDemandScreen({navigation}: any) {
  const {theme} = useTheme();
  const styles = getStyles(theme);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [cargoScene, setCargoScene] = useState(sceneOptions[0].key);
  const [cargoWeight, setCargoWeight] = useState('');
  const [tripCount, setTripCount] = useState('1');
  const [budgetMin, setBudgetMin] = useState('');
  const [budgetMax, setBudgetMax] = useState('');
  const [serviceAddress, setServiceAddress] = useState<AddressData | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const defaultStart = useMemo(() => buildDefaultStart(), []);
  const [startDate, setStartDate] = useState<Date>(defaultStart);
  const [endDate, setEndDate] = useState<Date>(buildDefaultEnd(defaultStart));
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);

  const expiresAt = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    d.setHours(23, 59, 59, 0);
    return d.toISOString();
  }, []);

  const onStartDateChange = (_event: any, selected?: Date) => {
    setShowStartPicker(Platform.OS === 'ios');
    if (!selected) return;
    setStartDate(selected);
    if (selected >= endDate) {
      const next = new Date(selected);
      next.setHours(next.getHours() + 2);
      setEndDate(next);
    }
  };

  const onEndDateChange = (_event: any, selected?: Date) => {
    setShowEndPicker(Platform.OS === 'ios');
    if (selected) setEndDate(selected);
  };

  const handleSubmit = async () => {
    if (!title.trim()) {
      Alert.alert('提示', '请输入需求标题');
      return;
    }
    if (!serviceAddress) {
      Alert.alert('提示', '请补充服务地址');
      return;
    }
    if (!(Number(cargoWeight) > 0)) {
      Alert.alert('提示', '请填写有效的货物重量');
      return;
    }

    setSubmitting(true);
    try {
      const created = await demandV2Service.create({
        title: title.trim(),
        service_type: 'heavy_cargo_lift_transport',
        cargo_scene: cargoScene,
        description: description.trim() || undefined,
        service_address: toAddressSnapshot(serviceAddress),
        scheduled_start_at: startDate.toISOString(),
        scheduled_end_at: endDate.toISOString(),
        cargo_weight_kg: Number(cargoWeight),
        estimated_trip_count: Math.max(Number(tripCount) || 1, 1),
        budget_min: budgetMin ? Math.round(Number(budgetMin) * 100) : undefined,
        budget_max: budgetMax ? Math.round(Number(budgetMax) * 100) : undefined,
        allows_pilot_candidate: true,
        expires_at: expiresAt,
      });
      await demandV2Service.publish(created.data.id);
      Alert.alert('发布成功', '需求已进入公开需求市场。', [
        {text: '查看需求', onPress: () => navigation.replace('DemandDetail', {id: created.data.id})},
      ]);
    } catch (error: any) {
      Alert.alert('发布失败', error.message || '请稍后重试');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, {backgroundColor: theme.bg}]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>发布重载吊运需求</Text>
        <Text style={styles.subtitle}>创建的是 v2 需求对象，发布后会进入公开需求市场，供机主报价、飞手候选。</Text>

        <Text style={styles.label}>需求标题 *</Text>
        <TextInput style={styles.input} placeholder="例如：山区电网建设塔材吊运" value={title} onChangeText={setTitle} />

        <Text style={styles.label}>作业场景 *</Text>
        <View style={styles.optionRow}>
          {sceneOptions.map(option => (
            <TouchableOpacity
              key={option.key}
              style={[styles.optionBtn, cargoScene === option.key && styles.optionBtnActive]}
              onPress={() => setCargoScene(option.key)}>
              <Text style={[styles.optionText, cargoScene === option.key && styles.optionTextActive]}>{option.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>服务地址 *</Text>
        <AddressInputField value={serviceAddress} placeholder="点击选择主要作业地址" onSelect={setServiceAddress} />

        <Text style={styles.label}>货物重量 (kg) *</Text>
        <TextInput style={styles.input} keyboardType="numeric" placeholder="例如：80" value={cargoWeight} onChangeText={setCargoWeight} />

        <Text style={styles.label}>预计架次</Text>
        <TextInput style={styles.input} keyboardType="numeric" placeholder="默认 1 架次" value={tripCount} onChangeText={setTripCount} />

        <Text style={styles.label}>预约开始时间</Text>
        <TouchableOpacity style={styles.dateInput} onPress={() => setShowStartPicker(true)}>
          <Text style={styles.dateText}>{formatDateTime(startDate)}</Text>
        </TouchableOpacity>
        {showStartPicker && (
          <DateTimePicker
            value={startDate}
            mode="datetime"
            display="default"
            onChange={onStartDateChange}
            minimumDate={new Date()}
          />
        )}

        <Text style={styles.label}>预约结束时间</Text>
        <TouchableOpacity style={styles.dateInput} onPress={() => setShowEndPicker(true)}>
          <Text style={styles.dateText}>{formatDateTime(endDate)}</Text>
        </TouchableOpacity>
        {showEndPicker && (
          <DateTimePicker
            value={endDate}
            mode="datetime"
            display="default"
            onChange={onEndDateChange}
            minimumDate={startDate}
          />
        )}

        <Text style={styles.label}>预算范围 (元)</Text>
        <View style={styles.budgetRow}>
          <TextInput style={[styles.input, styles.flexInput]} keyboardType="numeric" placeholder="最低预算" value={budgetMin} onChangeText={setBudgetMin} />
          <Text style={styles.split}>-</Text>
          <TextInput style={[styles.input, styles.flexInput]} keyboardType="numeric" placeholder="最高预算" value={budgetMax} onChangeText={setBudgetMax} />
        </View>

        <Text style={styles.label}>需求说明</Text>
        <TextInput
          style={[styles.input, styles.textarea]}
          placeholder="补充货物类型、现场条件、时效要求等"
          value={description}
          onChangeText={setDescription}
          multiline
          textAlignVertical="top"
        />

        <View style={styles.tipCard}>
          <Text style={styles.tipTitle}>提示</Text>
          <Text style={styles.tipText}>需求发布后有效期为 7 天，到期后自动关闭。发布后你可在“我的需求”里跟进报价。</Text>
        </View>

        <TouchableOpacity style={[styles.submitBtn, submitting && styles.submitBtnDisabled]} onPress={handleSubmit} disabled={submitting}>
          <Text style={styles.submitBtnText}>{submitting ? '发布中...' : '发布需求'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const getStyles = (theme: AppTheme) => StyleSheet.create({
  container: {flex: 1, backgroundColor: theme.card},
  content: {padding: 20, paddingBottom: 40},
  title: {fontSize: 24, fontWeight: '700', color: theme.text},
  subtitle: {fontSize: 13, lineHeight: 20, color: theme.textSub, marginTop: 8},
  label: {fontSize: 15, fontWeight: '600', color: theme.text, marginBottom: 8, marginTop: 18},
  input: {
    borderWidth: 1,
    borderColor: theme.cardBorder,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    backgroundColor: theme.bgSecondary,
  },
  textarea: {height: 96},
  dateInput: {
    borderWidth: 1,
    borderColor: theme.cardBorder,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    backgroundColor: theme.bgSecondary,
  },
  dateText: {fontSize: 15, color: theme.text},
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
    backgroundColor: theme.primaryBg,
  },
  optionText: {fontSize: 13, color: theme.textSub},
  optionTextActive: {color: theme.primaryText, fontWeight: '600'},
  budgetRow: {flexDirection: 'row', alignItems: 'center'},
  flexInput: {flex: 1},
  split: {marginHorizontal: 10, color: theme.textHint},
  tipCard: {
    marginTop: 18,
    backgroundColor: theme.info + '18',
    borderWidth: 1,
    borderColor: theme.info + '44',
    borderRadius: 14,
    padding: 14,
  },
  tipTitle: {fontSize: 14, fontWeight: '700', color: theme.info, marginBottom: 6},
  tipText: {fontSize: 12, lineHeight: 18, color: theme.info},
  submitBtn: {
    marginTop: 28,
    height: 48,
    borderRadius: 12,
    backgroundColor: theme.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  submitBtnDisabled: {opacity: 0.6},
  submitBtnText: {color: theme.btnPrimaryText, fontSize: 17, fontWeight: '700'},
});
