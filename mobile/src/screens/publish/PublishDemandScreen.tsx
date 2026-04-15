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
import {
  DEMAND_SCENE_OPTIONS,
  generateSuggestedTitle,
} from './demandComposerShared';
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

  const suggestedTitle = useMemo(
    () =>
      generateSuggestedTitle({
        sceneKey: cargoScene,
        serviceAddress,
      }),
    [cargoScene, serviceAddress],
  );

  const handleMagicTitle = () => {
    setTitle(suggestedTitle);
  };

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
      <View style={styles.header}>
        <View style={styles.progressHeader}>
          <View style={styles.progressTrack}>
            <View style={[styles.progressPin, step >= 1 && styles.progressPinActive]} />
            <View style={[styles.progressLine, step >= 2 && styles.progressLineActive]} />
            <View style={[styles.progressPin, step >= 2 && styles.progressPinActive]} />
          </View>
          <View style={styles.progressLabels}>
            <Text style={[styles.progressLabelText, step >= 1 && styles.progressLabelTextActive]}>基础信息</Text>
            <Text style={[styles.progressLabelText, step >= 2 && styles.progressLabelTextActive]}>更多细节</Text>
          </View>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {step === 1 ? (
          <View style={styles.formSection}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>1. 基础信息</Text>
              <Text style={styles.sectionSubtitle}>填写真实核心信息，方便快速成单</Text>
            </View>

            <View style={styles.inputCard}>
              <Text style={styles.label}>需求标题</Text>
              <View style={styles.titleInputRow}>
                <TextInput
                  style={[styles.input, {flex: 1}]}
                  placeholder="例如：山区电网建设塔材吊运"
                  placeholderTextColor={theme.textHint}
                  value={title}
                  onChangeText={setTitle}
                />
                <TouchableOpacity
                  style={[styles.magicBtn, title === suggestedTitle && styles.magicBtnActive]}
                  onPress={handleMagicTitle}
                  activeOpacity={0.7}
                >
                  <Text style={styles.magicEmoji}>✨</Text>
                </TouchableOpacity>
              </View>
              {title !== suggestedTitle && (
                <TouchableOpacity onPress={handleMagicTitle} style={styles.suggestedLink}>
                  <Text style={styles.suggestedLinkText}>推荐：{suggestedTitle}</Text>
                </TouchableOpacity>
              )}

              <Text style={styles.label}>作业场景</Text>
              <View style={styles.sceneGrid}>
                {sceneOptions.map(option => (
                  <TouchableOpacity
                    key={option.key}
                    style={[styles.sceneBtn, cargoScene === option.key && styles.sceneBtnActive]}
                    onPress={() => setCargoScene(option.key)}>
                    <Text style={[styles.sceneBtnText, cargoScene === option.key && styles.sceneBtnTextActive]}>
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.label}>服务地址</Text>
              <AddressInputField
                value={serviceAddress}
                placeholder="点击选择主要作业地址"
                onSelect={setServiceAddress}
                style={styles.formAddressInput}
              />

              <Text style={styles.label}>货物重量 (kg)</Text>
              <TextInput
                style={styles.input}
                keyboardType="numeric"
                placeholder="例如：80"
                placeholderTextColor={theme.textHint}
                value={cargoWeight}
                onChangeText={setCargoWeight}
              />
            </View>
          </View>
        ) : (
          <View style={styles.formSection}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>2. 细节与说明</Text>
              <Text style={styles.sectionSubtitle}>详细要求有助于获得更精准的报价</Text>
            </View>

            <View style={styles.inputCard}>
              <View style={styles.sectionHeader}>
                <Text style={styles.label}>任务计划时间</Text>
                <Text style={styles.sectionSubtitle}>请设置预期的作业时段</Text>
              </View>

              <View style={styles.timePickerContainer}>
                <TouchableOpacity
                  style={[styles.timePickerBox, startConfirmed && styles.timePickerBoxActive]}
                  onPress={() => setShowStartPicker(true)}
                >
                  <Text style={styles.timePickerLabel}>开始时间</Text>
                  <Text style={[styles.timePickerValue, !startConfirmed && styles.timePickerValuePlaceholder]}>
                    {startConfirmed ? formatDateTime(startDate).split(' ')[1] : '点击设置'}
                  </Text>
                  <Text style={styles.timePickerDate}>
                    {formatDateTime(startDate).split(' ')[0]}
                  </Text>
                </TouchableOpacity>

                <View style={styles.timeConnector}>
                  <Text style={styles.timeConnectorText}>至</Text>
                </View>

                <TouchableOpacity
                  style={[styles.timePickerBox, endConfirmed && styles.timePickerBoxActive]}
                  onPress={() => setShowEndPicker(true)}
                >
                  <Text style={styles.timePickerLabel}>结束时间</Text>
                  <Text style={[styles.timePickerValue, !endConfirmed && styles.timePickerValuePlaceholder]}>
                    {endConfirmed ? formatDateTime(endDate).split(' ')[1] : '点击设置'}
                  </Text>
                  <Text style={styles.timePickerDate}>
                    {formatDateTime(endDate).split(' ')[0]}
                  </Text>
                </TouchableOpacity>
              </View>

              {!startConfirmed && !endConfirmed && (
                <View style={styles.timeHintBox}>
                  <Text style={styles.timeHintText}>💡 建议：预留至少 2 小时作业时间</Text>
                </View>
              )}

              <Text style={styles.label}>预计架次</Text>
              <TextInput
                style={styles.input}
                keyboardType="numeric"
                placeholder="默认 1"
                placeholderTextColor={theme.textHint}
                value={tripCount}
                onChangeText={setTripCount}
              />

              <Text style={styles.label}>预算范围 (元)</Text>
              <View style={styles.budgetRow}>
                <TextInput
                  style={[styles.input, {flex: 1}]}
                  keyboardType="numeric"
                  placeholder="最低"
                  placeholderTextColor={theme.textHint}
                  value={budgetMin}
                  onChangeText={setBudgetMin}
                />
                <Text style={styles.budgetSplit}>至</Text>
                <TextInput
                  style={[styles.input, {flex: 1}]}
                  keyboardType="numeric"
                  placeholder="最高"
                  placeholderTextColor={theme.textHint}
                  value={budgetMax}
                  onChangeText={setBudgetMax}
                />
              </View>

              <Text style={styles.label}>需求说明</Text>
              <TextInput
                style={[styles.input, styles.textarea]}
                placeholder="补充货物类型、现场条件等..."
                placeholderTextColor={theme.textHint}
                value={description}
                onChangeText={setDescription}
                multiline
                textAlignVertical="top"
              />
            </View>
          </View>
        )}

        <View style={styles.footerActions}>
          {step === 1 ? (
            <View style={styles.actionRow}>
              <TouchableOpacity
                style={[styles.btnSecondary, submitting && styles.btnDisabled]}
                onPress={handleSaveDraft}
                disabled={submitting}>
                <Text style={styles.btnSecondaryText}>保存草稿</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btnPrimary, submitting && styles.btnDisabled]}
                onPress={handleNextStep}
                disabled={submitting}>
                <Text style={styles.btnPrimaryText}>下一步</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.actionRowMulti}>
              <TouchableOpacity
                style={[styles.btnTertiary, submitting && styles.btnDisabled]}
                onPress={() => setStep(1)}
                disabled={submitting}>
                <Text style={styles.btnTertiaryText}>上一步</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btnSecondary, submitting && styles.btnDisabled]}
                onPress={handleSaveDraft}
                disabled={submitting}>
                <Text style={styles.btnSecondaryText}>存草稿</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btnPrimary, submitting && styles.btnDisabled]}
                onPress={handlePublish}
                disabled={submitting}>
                <Text style={styles.btnPrimaryText}>{submitting ? '发布中...' : '确认发布'}</Text>
              </TouchableOpacity>
            </View>
          )}
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
      </ScrollView>
    </SafeAreaView>
  );
}

const getStyles = (theme: AppTheme) =>
  StyleSheet.create({
    container: {flex: 1, backgroundColor: theme.bg},
    header: {
      paddingHorizontal: 20,
      paddingVertical: 16,
      backgroundColor: theme.bg,
      borderBottomWidth: 1,
      borderBottomColor: theme.divider,
    },
    progressHeader: {
      marginBottom: 4,
    },
    progressTrack: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 40,
    },
    progressPin: {
      width: 10,
      height: 10,
      borderRadius: 5,
      backgroundColor: theme.divider,
    },
    progressPinActive: {
      backgroundColor: theme.primary,
    },
    progressLine: {
      flex: 1,
      height: 2,
      backgroundColor: theme.divider,
      marginHorizontal: 4,
    },
    progressLineActive: {
      backgroundColor: theme.primary,
    },
    progressLabels: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: 8,
      paddingHorizontal: 20,
    },
    progressLabelText: {
      fontSize: 11,
      color: theme.textHint,
      fontWeight: '600',
    },
    progressLabelTextActive: {
      color: theme.primary,
      fontWeight: '700',
    },
    content: {paddingBottom: 40},
    formSection: {
      padding: 16,
    },
    sectionHeader: {
      marginBottom: 16,
    },
    sectionTitle: {
      fontSize: 20,
      fontWeight: '800',
      color: theme.text,
    },
    sectionSubtitle: {
      fontSize: 13,
      color: theme.textSub,
      marginTop: 4,
    },
    inputCard: {
      backgroundColor: theme.card,
      borderRadius: 20,
      padding: 16,
      shadowColor: '#000',
      shadowOffset: {width: 0, height: 2},
      shadowOpacity: 0.05,
      shadowRadius: 10,
      elevation: 2,
    },
    label: {
      fontSize: 13,
      fontWeight: '700',
      color: theme.textSub,
      marginBottom: 8,
      marginTop: 16,
    },
    input: {
      backgroundColor: theme.bgSecondary,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontSize: 15,
      color: theme.text,
    },
    titleInputRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    magicBtn: {
      width: 44,
      height: 44,
      borderRadius: 12,
      backgroundColor: theme.bgSecondary,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: theme.divider,
    },
    magicBtnActive: {
      borderColor: theme.primary,
      backgroundColor: theme.primaryBg,
    },
    magicEmoji: {
      fontSize: 18,
    },
    suggestedLink: {
      marginTop: 8,
      paddingLeft: 4,
    },
    suggestedLinkText: {
      fontSize: 12,
      color: theme.primary,
      fontWeight: '600',
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
    formAddressInput: {
      backgroundColor: theme.bgSecondary,
      borderRadius: 12,
    },
    timeBtn: {
      backgroundColor: theme.bgSecondary,
      borderRadius: 12,
      padding: 12,
      justifyContent: 'center',
    },
    timeBtnText: {
      fontSize: 14,
      color: theme.text,
      fontWeight: '600',
    },
    timePickerContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginTop: 12,
      marginBottom: 16,
    },
    timePickerBox: {
      flex: 1,
      backgroundColor: theme.bgSecondary,
      borderRadius: 16,
      padding: 14,
      borderWidth: 1,
      borderColor: theme.divider,
      alignItems: 'center',
    },
    timePickerBoxActive: {
      borderColor: theme.primary,
      backgroundColor: theme.primaryBg,
    },
    timePickerLabel: {
      fontSize: 10,
      color: theme.textSub,
      fontWeight: '700',
      textTransform: 'uppercase',
      marginBottom: 4,
    },
    timePickerValue: {
      fontSize: 18,
      fontWeight: '800',
      color: theme.text,
    },
    timePickerValuePlaceholder: {
      color: theme.textHint,
    },
    timePickerDate: {
      fontSize: 11,
      color: theme.textHint,
      marginTop: 2,
    },
    timeConnector: {
      paddingHorizontal: 4,
    },
    timeConnectorText: {
      fontSize: 12,
      color: theme.textHint,
      fontWeight: '700',
    },
    timeHintBox: {
      backgroundColor: theme.info + '10',
      padding: 10,
      borderRadius: 10,
      marginBottom: 16,
    },
    timeHintText: {
      fontSize: 12,
      color: theme.info,
      textAlign: 'center',
    },
    budgetRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    budgetSplit: {
      fontSize: 13,
      color: theme.textHint,
    },
    textarea: {
      minHeight: 100,
      textAlignVertical: 'top',
    },
    footerActions: {
      padding: 16,
    },
    actionRow: {
      flexDirection: 'row',
      gap: 12,
    },
    actionRowMulti: {
      flexDirection: 'row',
      gap: 8,
    },
    btnPrimary: {
      flex: 2,
      height: 54,
      borderRadius: 16,
      backgroundColor: theme.primary,
      justifyContent: 'center',
      alignItems: 'center',
      shadowColor: theme.primary,
      shadowOffset: {width: 0, height: 4},
      shadowOpacity: 0.2,
      shadowRadius: 8,
      elevation: 4,
    },
    btnSecondary: {
      flex: 1.2,
      height: 54,
      borderRadius: 16,
      backgroundColor: theme.bgSecondary,
      borderWidth: 1,
      borderColor: theme.divider,
      justifyContent: 'center',
      alignItems: 'center',
    },
    btnTertiary: {
      flex: 1,
      height: 54,
      borderRadius: 16,
      backgroundColor: theme.bgSecondary,
      borderWidth: 1,
      borderColor: theme.divider,
      justifyContent: 'center',
      alignItems: 'center',
    },
    btnPrimaryText: {color: '#FFFFFF', fontSize: 16, fontWeight: '800'},
    btnSecondaryText: {color: theme.textSub, fontSize: 15, fontWeight: '600'},
    btnTertiaryText: {color: theme.textSub, fontSize: 15, fontWeight: '600'},
    btnDisabled: {opacity: 0.6},
    rowInputs: {
      flexDirection: 'row',
      gap: 12,
    },
  });
