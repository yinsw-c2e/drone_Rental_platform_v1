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
import {getClientEligibility} from '../../services/client';
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

  const [step, setStep] = useState<1 | 2>(1);
  const [submitting, setSubmitting] = useState(false);

  // Step 1
  const [title, setTitle] = useState('');
  const [cargoScene, setCargoScene] = useState(sceneOptions[0].key);
  const [serviceAddress, setServiceAddress] = useState<AddressData | null>(null);
  const [cargoWeight, setCargoWeight] = useState('');

  // Step 2
  const [tripCount, setTripCount] = useState('1');
  const [budgetMin, setBudgetMin] = useState('');
  const [budgetMax, setBudgetMax] = useState('');
  const [description, setDescription] = useState('');

  const defaultStart = useMemo(() => buildDefaultStart(), []);
  const [startDate, setStartDate] = useState<Date>(defaultStart);
  const [endDate, setEndDate] = useState<Date>(buildDefaultEnd(defaultStart));
  const [startConfirmed, setStartConfirmed] = useState(false);
  const [endConfirmed, setEndConfirmed] = useState(false);
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
    setStartConfirmed(true);
    if (selected >= endDate) {
      const next = new Date(selected);
      next.setHours(next.getHours() + 2);
      setEndDate(next);
      setEndConfirmed(false);
    }
  };

  const onEndDateChange = (_event: any, selected?: Date) => {
    setShowEndPicker(Platform.OS === 'ios');
    if (selected) {
      setEndDate(selected);
      setEndConfirmed(true);
    }
  };

  const validateSchedule = () => {
    if (!startConfirmed || !endConfirmed) {
      Alert.alert('请确认执行时间', '为了避免默认时间被误用，请主动确认开始和结束时间。');
      return false;
    }
    if (startDate <= new Date()) {
      Alert.alert('时间有误', '开始时间需要晚于当前时间。');
      return false;
    }
    if (endDate <= startDate) {
      Alert.alert('时间有误', '结束时间必须晚于开始时间。');
      return false;
    }
    return true;
  };

  const checkEligibility = async () => {
    try {
      const eligibility = await getClientEligibility();
      if (!eligibility.can_publish_demand) {
        const blocker = eligibility.blockers?.[0];
        if (blocker?.suggested_action === 'verify_identity') {
          Alert.alert('请先完成实名认证', blocker.message, [
            {text: '稍后再说', style: 'cancel'},
            {text: '去认证', onPress: () => navigation.navigate('Verification')},
          ]);
        } else {
          Alert.alert('当前暂不可发布', blocker?.message || '当前客户资格未就绪，请稍后重试。');
        }
        return false;
      }
      return true;
    } catch (error: any) {
      Alert.alert('资格检查失败', error?.message || '请稍后重试');
      return false;
    }
  };

  const getPayload = () => ({
    title: title.trim(),
    service_type: 'heavy_cargo_lift_transport' as const,
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

  const handleNextStep = () => {
    if (!title.trim()) return Alert.alert('提示', '请输入需求标题');
    if (!serviceAddress) return Alert.alert('提示', '请补充服务地址');
    if (!(Number(cargoWeight) > 0)) return Alert.alert('提示', '请填写有效的货物重量');
    if (!validateSchedule()) return;
    setStep(2);
  };

  const handleSaveDraft = async () => {
    if (!title.trim()) return Alert.alert('提示', '请输入需求标题 (至少填写标题才能保存草稿)');
    
    setSubmitting(true);
    try {
      await demandV2Service.create(getPayload());
      Alert.alert('草稿已保存', '您可以在"我的需求"中继续补充和发布。', [
        {text: '返回', onPress: () => navigation.goBack()},
      ]);
    } catch (error: any) {
      Alert.alert('保存失败', error.message || '请稍后重试');
    } finally {
      setSubmitting(false);
    }
  };

  const handlePublish = async () => {
    if (!title.trim() || !serviceAddress || !(Number(cargoWeight) > 0)) {
      Alert.alert('提示', '请完善基础信息');
      return;
    }
    if (!validateSchedule()) {
      return;
    }

    setSubmitting(true);
    const eligible = await checkEligibility();
    if (!eligible) {
      setSubmitting(false);
      return;
    }

    try {
      const created = await demandV2Service.create(getPayload());
      await demandV2Service.publish(created.data.id);
      Alert.alert('发布成功', '任务已进入公开任务列表。', [
        {text: '查看任务', onPress: () => navigation.replace('DemandDetail', {id: created.data.id})},
      ]);
    } catch (error: any) {
      Alert.alert('发布失败', error.message || '请稍后重试');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, {backgroundColor: theme.bg}]}>
      {/* Progress Header */}
      <View style={styles.header}>
        <View style={styles.progressContainer}>
          <View style={[styles.progressStep, step >= 1 && styles.progressStepActive]} />
          <View style={[styles.progressStep, step >= 2 && styles.progressStepActive]} />
        </View>
        <Text style={styles.headerTitle}>
          {step === 1 ? '第 1/2 步：基础信息' : '第 2/2 步：运输细节与说明'}
        </Text>
        <Text style={styles.headerSubtitle}>
          {step === 1 ? '填写真实核心信息，方便快速成单' : '详细要求有助于获得更精准的报价'}
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {step === 1 && (
          <View style={styles.stepContainer}>
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

            <View style={styles.tipCard}>
              <Text style={styles.tipTitle}>💡 草稿提示</Text>
              <Text style={styles.tipText}>您可以随时保存当前进度为草稿，之后在“我的需求”里继续编辑。</Text>
            </View>

            <View style={styles.actionRow}>
              <TouchableOpacity style={[styles.btnSecondary, submitting && styles.btnDisabled]} onPress={handleSaveDraft} disabled={submitting}>
                <Text style={styles.btnSecondaryText}>保存草稿</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.btnPrimary, submitting && styles.btnDisabled]} onPress={handleNextStep} disabled={submitting}>
                <Text style={styles.btnPrimaryText}>下一步</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {step === 2 && (
          <View style={styles.stepContainer}>
            <Text style={styles.label}>预计架次</Text>
            <TextInput style={styles.input} keyboardType="numeric" placeholder="默认 1 架次" value={tripCount} onChangeText={setTripCount} />

            <Text style={styles.label}>预约开始时间 *</Text>
            <Text style={styles.timeHint}>请主动确认期望执行时间，系统不再直接替你使用默认值。</Text>
            <TouchableOpacity style={styles.dateInput} onPress={() => setShowStartPicker(true)}>
              <Text style={[styles.dateText, !startConfirmed && styles.datePlaceholderText]}>
                {startConfirmed ? formatDateTime(startDate) : '请选择期望开始时间'}
              </Text>
            </TouchableOpacity>
            {!startConfirmed ? <Text style={styles.timeRecommend}>建议参考：{formatDateTime(startDate)}</Text> : null}
            {showStartPicker && (
              <DateTimePicker
                value={startDate}
                mode="datetime"
                display="default"
                onChange={onStartDateChange}
                minimumDate={new Date()}
              />
            )}

            <Text style={styles.label}>预约结束时间 *</Text>
            <TouchableOpacity style={styles.dateInput} onPress={() => setShowEndPicker(true)}>
              <Text style={[styles.dateText, !endConfirmed && styles.datePlaceholderText]}>
                {endConfirmed ? formatDateTime(endDate) : '请选择期望结束时间'}
              </Text>
            </TouchableOpacity>
            {!endConfirmed ? <Text style={styles.timeRecommend}>建议参考：{formatDateTime(endDate)}</Text> : null}
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

            <View style={styles.actionRowMulti}>
              <TouchableOpacity style={[styles.btnTertiary, submitting && styles.btnDisabled]} onPress={() => setStep(1)} disabled={submitting}>
                <Text style={styles.btnTertiaryText}>上一步</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.btnSecondary, submitting && styles.btnDisabled]} onPress={handleSaveDraft} disabled={submitting}>
                <Text style={styles.btnSecondaryText}>保存草稿</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.btnPrimary, submitting && styles.btnDisabled]} onPress={handlePublish} disabled={submitting}>
                <Text style={styles.btnPrimaryText}>{submitting ? '发布中...' : '确认发布'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const getStyles = (theme: AppTheme) => StyleSheet.create({
  container: {flex: 1, backgroundColor: theme.card},
  header: {
    paddingTop: 16,
    paddingHorizontal: 20,
    paddingBottom: 16,
    backgroundColor: theme.bgSecondary,
    borderBottomWidth: 1,
    borderBottomColor: theme.cardBorder,
  },
  progressContainer: {
    flexDirection: 'row',
    marginBottom: 12,
    gap: 8,
  },
  progressStep: {
    flex: 1,
    height: 4,
    backgroundColor: theme.cardBorder,
    borderRadius: 2,
  },
  progressStepActive: {
    backgroundColor: theme.primary,
  },
  headerTitle: {fontSize: 18, fontWeight: '700', color: theme.text, marginBottom: 4},
  headerSubtitle: {fontSize: 13, color: theme.textSub},
  content: {padding: 20, paddingBottom: 60},
  stepContainer: {flex: 1},
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
  datePlaceholderText: {color: theme.textHint},
  timeHint: {fontSize: 12, color: theme.textSub, marginBottom: 8},
  timeRecommend: {fontSize: 12, color: theme.primaryText, marginTop: 6},
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
    marginTop: 24,
    backgroundColor: theme.info + '18',
    borderWidth: 1,
    borderColor: theme.info + '44',
    borderRadius: 14,
    padding: 14,
  },
  tipTitle: {fontSize: 14, fontWeight: '700', color: theme.info, marginBottom: 6},
  tipText: {fontSize: 12, lineHeight: 18, color: theme.info},
  actionRow: {
    flexDirection: 'row',
    marginTop: 32,
    gap: 12,
  },
  actionRowMulti: {
    flexDirection: 'row',
    marginTop: 32,
    gap: 8,
  },
  btnPrimary: {
    flex: 2,
    height: 48,
    borderRadius: 12,
    backgroundColor: theme.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  btnSecondary: {
    flex: 1.5,
    height: 48,
    borderRadius: 12,
    backgroundColor: theme.bgSecondary,
    borderWidth: 1,
    borderColor: theme.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  btnTertiary: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    backgroundColor: theme.bgSecondary,
    borderWidth: 1,
    borderColor: theme.cardBorder,
    justifyContent: 'center',
    alignItems: 'center',
  },
  btnDisabled: {opacity: 0.6},
  btnPrimaryText: {color: theme.btnPrimaryText, fontSize: 16, fontWeight: '700'},
  btnSecondaryText: {color: theme.primary, fontSize: 16, fontWeight: '600'},
  btnTertiaryText: {color: theme.textSub, fontSize: 16, fontWeight: '600'},
});
