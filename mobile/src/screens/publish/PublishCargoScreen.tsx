import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
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
import {getClientEligibility} from '../../services/client';
import {demandV2Service, type DemandUpsertPayload} from '../../services/demandV2';
import {AddressData, QuickOrderDraft} from '../../types';
import {
  DEMAND_SCENE_OPTIONS,
  buildDefaultDemandEnd,
  buildDefaultDemandExpiry,
  buildDefaultDemandStart,
  deriveDraftTitle,
  formatDemandDateTime,
  formatSavedAt,
  getSceneLabel,
  parseDemandDate,
  summarizeAddress,
  toAddressSnapshot,
} from './demandComposerShared';
import {useTheme} from '../../theme/ThemeContext';
import type {AppTheme} from '../../theme/index';

type DemandStep = 1 | 2;
type DraftSaveState = 'idle' | 'saving' | 'saved' | 'error';

export default function PublishCargoScreen({route, navigation}: any) {
  const {theme} = useTheme();
  const styles = getStyles(theme);
  const quickOrderDraft = route.params?.quickOrderDraft as QuickOrderDraft | undefined;

  const defaultStartDate = useMemo(
    () => parseDemandDate(quickOrderDraft?.scheduled_start_at, buildDefaultDemandStart()),
    [quickOrderDraft?.scheduled_start_at],
  );
  const defaultEndDate = useMemo(
    () => parseDemandDate(quickOrderDraft?.scheduled_end_at, buildDefaultDemandEnd(defaultStartDate)),
    [defaultStartDate, quickOrderDraft?.scheduled_end_at],
  );

  const [currentStep, setCurrentStep] = useState<DemandStep>(quickOrderDraft ? 2 : 1);
  const [title, setTitle] = useState(() =>
    deriveDraftTitle({
      title: '',
      sceneKey: quickOrderDraft?.cargo_scene || DEMAND_SCENE_OPTIONS[0].key,
      departureAddress: quickOrderDraft?.departure_address || null,
      destinationAddress: quickOrderDraft?.destination_address || null,
    }),
  );
  const [cargoScene, setCargoScene] = useState(quickOrderDraft?.cargo_scene || DEMAND_SCENE_OPTIONS[0].key);
  const [cargoType, setCargoType] = useState(quickOrderDraft?.cargo_type || '');
  const [cargoWeight, setCargoWeight] = useState(
    quickOrderDraft?.cargo_weight_kg ? String(quickOrderDraft.cargo_weight_kg) : '',
  );
  const [cargoVolume, setCargoVolume] = useState(
    quickOrderDraft?.cargo_volume_m3 ? String(quickOrderDraft.cargo_volume_m3) : '',
  );
  const [cargoDescription, setCargoDescription] = useState(quickOrderDraft?.description || '');
  const [specialRequirements, setSpecialRequirements] = useState(
    quickOrderDraft?.special_requirements || '',
  );
  const [pickupAddress, setPickupAddress] = useState<AddressData | null>(
    quickOrderDraft?.departure_address || null,
  );
  const [deliveryAddress, setDeliveryAddress] = useState<AddressData | null>(
    quickOrderDraft?.destination_address || null,
  );
  const [budgetMax, setBudgetMax] = useState('');
  const [tripCount, setTripCount] = useState('1');
  const [startDate, setStartDate] = useState<Date>(defaultStartDate);
  const [endDate, setEndDate] = useState<Date>(defaultEndDate);
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [draftId, setDraftId] = useState<number | null>(null);
  const [draftSaveState, setDraftSaveState] = useState<DraftSaveState>('idle');
  const [draftSavedAt, setDraftSavedAt] = useState<string | null>(null);
  const [draftSaveError, setDraftSaveError] = useState<string | null>(null);
  const [savingDraft, setSavingDraft] = useState(false);
  const [publishing, setPublishing] = useState(false);

  const lastSavedSnapshotRef = useRef('');
  const autoSaveEnabledRef = useRef(false);

  const expiresAt = useMemo(() => buildDefaultDemandExpiry(), []);
  const suggestedTitle = useMemo(
    () =>
      deriveDraftTitle({
        title,
        sceneKey: cargoScene,
        departureAddress: pickupAddress,
        destinationAddress: deliveryAddress,
      }),
    [cargoScene, deliveryAddress, pickupAddress, title],
  );

  const buildPayload = useCallback(
    (mode: 'draft' | 'publish'): DemandUpsertPayload => {
      const weight = Number(cargoWeight);
      const volume = Number(cargoVolume);
      const trip = Math.max(Number(tripCount) || 1, 1);
      return {
        title: mode === 'publish' ? suggestedTitle : suggestedTitle,
        service_type: 'heavy_cargo_lift_transport',
        cargo_scene: cargoScene,
        description: cargoDescription.trim() || undefined,
        departure_address: toAddressSnapshot(pickupAddress),
        destination_address: toAddressSnapshot(deliveryAddress),
        scheduled_start_at: startDate.toISOString(),
        scheduled_end_at: endDate.toISOString(),
        cargo_weight_kg: weight > 0 ? weight : undefined,
        cargo_volume_m3: volume > 0 ? volume : undefined,
        cargo_type: cargoType.trim() || undefined,
        cargo_special_requirements: specialRequirements.trim() || undefined,
        estimated_trip_count: trip,
        budget_max: budgetMax ? Math.round(Number(budgetMax) * 100) : undefined,
        allows_pilot_candidate: true,
        expires_at: expiresAt,
      };
    },
    [
      budgetMax,
      cargoDescription,
      cargoScene,
      cargoType,
      cargoVolume,
      cargoWeight,
      deliveryAddress,
      expiresAt,
      pickupAddress,
      specialRequirements,
      startDate,
      suggestedTitle,
      endDate,
      tripCount,
    ],
  );

  const serializedDraftPayload = useMemo(
    () => JSON.stringify(buildPayload('draft')),
    [buildPayload],
  );

  const validateCoreStep = useCallback(
    (showAlert = true) => {
      if (!pickupAddress || !deliveryAddress) {
        if (showAlert) {
          Alert.alert('提示', '请先填写起点和终点地址。');
        }
        return false;
      }
      if (!(Number(cargoWeight) > 0)) {
        if (showAlert) {
          Alert.alert('提示', '请填写有效的货物重量。');
        }
        return false;
      }
      if (endDate <= startDate) {
        if (showAlert) {
          Alert.alert('提示', '结束时间需要晚于开始时间。');
        }
        return false;
      }
      return true;
    },
    [cargoWeight, deliveryAddress, endDate, pickupAddress, startDate],
  );

  const persistDraft = useCallback(
    async (options?: {showSuccess?: boolean}) => {
      const payload = buildPayload('draft');
      const payloadSnapshot = JSON.stringify(payload);

      setSavingDraft(true);
      setDraftSaveState('saving');
      setDraftSaveError(null);

      try {
        const response = draftId
          ? await demandV2Service.update(draftId, payload)
          : await demandV2Service.create(payload);
        const nextDraftId = response.data.id;
        const savedAt = new Date().toISOString();
        setDraftId(nextDraftId);
        setDraftSavedAt(savedAt);
        setDraftSaveState('saved');
        setDraftSaveError(null);
        lastSavedSnapshotRef.current = payloadSnapshot;
        autoSaveEnabledRef.current = true;
        if (options?.showSuccess) {
          Alert.alert('草稿已保存', '可以稍后在“我的任务 > 草稿”里继续完善。');
        }
        return nextDraftId;
      } catch (error: any) {
        setDraftSaveState('error');
        setDraftSaveError(error?.message || '草稿保存失败');
        if (options?.showSuccess) {
          Alert.alert('保存失败', error?.message || '请稍后重试');
        }
        return null;
      } finally {
        setSavingDraft(false);
      }
    },
    [buildPayload, draftId],
  );

  useEffect(() => {
    if (!draftId || !autoSaveEnabledRef.current || publishing || savingDraft) {
      return;
    }
    if (serializedDraftPayload === lastSavedSnapshotRef.current) {
      return;
    }

    const timer = setTimeout(async () => {
      setDraftSaveState('saving');
      setDraftSaveError(null);
      try {
        await demandV2Service.update(draftId, buildPayload('draft'));
        lastSavedSnapshotRef.current = serializedDraftPayload;
        setDraftSavedAt(new Date().toISOString());
        setDraftSaveState('saved');
      } catch (error: any) {
        setDraftSaveState('error');
        setDraftSaveError(error?.message || '自动保存失败');
      }
    }, 1200);

    return () => clearTimeout(timer);
  }, [buildPayload, draftId, publishing, savingDraft, serializedDraftPayload]);

  const handleSaveDraft = async () => {
    await persistDraft({showSuccess: true});
  };

  const handleContinue = async () => {
    if (!validateCoreStep(true)) {
      return;
    }
    const nextDraftId = await persistDraft();
    if (nextDraftId) {
      setCurrentStep(2);
    }
  };

  const handlePublish = async () => {
    if (!validateCoreStep(true)) {
      return;
    }

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
        return;
      }
    } catch (error: any) {
      Alert.alert('资格检查失败', error?.message || '请稍后重试');
      return;
    }

    setPublishing(true);
    try {
      const nextDraftId = draftId || (await persistDraft());
      if (!nextDraftId) {
        setPublishing(false);
        return;
      }
      await demandV2Service.update(nextDraftId, buildPayload('publish'));
      await demandV2Service.publish(nextDraftId);
      Alert.alert('发布成功', '任务已进入公开任务列表，后续可以在“我的任务”里继续跟进报价。', [
        {text: '查看任务', onPress: () => navigation.replace('DemandDetail', {id: nextDraftId})},
      ]);
    } catch (error: any) {
      Alert.alert('发布失败', error?.message || '请稍后重试');
    } finally {
      setPublishing(false);
    }
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
      setEndDate(buildDefaultDemandEnd(selectedDate));
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

  const draftStatusText = useMemo(() => {
    if (!draftId) {
      return quickOrderDraft ? '已带入快速下单信息，进入下一步后会自动保存为草稿。' : '暂未保存草稿。';
    }
    if (draftSaveState === 'saving') {
      return '正在自动保存草稿...';
    }
    if (draftSaveState === 'error') {
      return draftSaveError || '草稿保存失败，请手动重试。';
    }
    return `草稿已保存${draftSavedAt ? `，最近保存于 ${formatSavedAt(draftSavedAt)}` : ''}`;
  }, [draftId, draftSaveError, draftSaveState, draftSavedAt, quickOrderDraft]);

  return (
    <SafeAreaView style={[styles.container, {backgroundColor: theme.bg}]}>
      <ScrollView contentContainerStyle={styles.content}>
        <ObjectCard style={styles.heroCard}>
          <Text style={styles.heroEyebrow}>发布任务</Text>
          <Text style={styles.title}>先发起，再补充，不用一次填完</Text>
          <Text style={styles.subtitle}>
            复杂、非标或需要比价的任务统一走这里。第一步先把能成单的核心信息说清楚，第二步再慢慢补预算、说明和运输细节。
          </Text>
        </ObjectCard>

        <ObjectCard>
          <Text style={styles.sectionTitle}>发布进度</Text>
          <View style={styles.stepRow}>
            <TouchableOpacity
              style={[styles.stepCard, currentStep === 1 && styles.stepCardActive]}
              onPress={() => setCurrentStep(1)}>
              <Text style={[styles.stepIndex, currentStep === 1 && styles.stepIndexActive]}>1</Text>
              <Text style={[styles.stepTitle, currentStep === 1 && styles.stepTitleActive]}>先填核心信息</Text>
              <Text style={styles.stepDesc}>地址、场景、重量、时间</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.stepCard, currentStep === 2 && styles.stepCardActive]}
              onPress={() => {
                if (draftId || quickOrderDraft) {
                  setCurrentStep(2);
                }
              }}>
              <Text style={[styles.stepIndex, currentStep === 2 && styles.stepIndexActive]}>2</Text>
              <Text style={[styles.stepTitle, currentStep === 2 && styles.stepTitleActive]}>再补专业细节</Text>
              <Text style={styles.stepDesc}>预算、架次、说明、声明</Text>
            </TouchableOpacity>
          </View>
        </ObjectCard>

        <ObjectCard highlightColor={draftSaveState === 'error' ? theme.danger + '66' : theme.primaryBorder}>
          <Text style={styles.sectionTitle}>草稿状态</Text>
          <Text style={styles.draftStatusText}>{draftStatusText}</Text>
          {quickOrderDraft ? (
            <Text style={styles.draftHint}>
              这是从快速下单无匹配场景降级过来的任务，起终点和货物核心信息已经自动带过来了。
            </Text>
          ) : null}
        </ObjectCard>

        {currentStep === 1 ? (
          <ObjectCard>
            <Text style={styles.sectionTitle}>第 1 步：最小成单信息</Text>

            <Text style={styles.label}>任务标题</Text>
            <TextInput
              style={styles.input}
              placeholder="例如：海岛物资补给、山区设备吊运"
              placeholderTextColor={theme.textHint}
              value={title}
              onChangeText={setTitle}
            />
            <Text style={styles.helperText}>可先用系统建议标题：{suggestedTitle}</Text>

            <Text style={styles.label}>作业场景 *</Text>
            <View style={styles.optionRow}>
              {DEMAND_SCENE_OPTIONS.map(option => (
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

            <Text style={styles.label}>起点地址 *</Text>
            <AddressInputField
              value={pickupAddress}
              placeholder="点击选择起点地址"
              onSelect={setPickupAddress}
            />

            <Text style={styles.label}>终点地址 *</Text>
            <AddressInputField
              value={deliveryAddress}
              placeholder="点击选择终点地址"
              onSelect={setDeliveryAddress}
            />

            <Text style={styles.label}>货物重量 (kg) *</Text>
            <TextInput
              style={styles.input}
              keyboardType="numeric"
              placeholder="例如：120"
              placeholderTextColor={theme.textHint}
              value={cargoWeight}
              onChangeText={setCargoWeight}
            />

            <Text style={styles.label}>期望开始时间 *</Text>
            <TouchableOpacity style={styles.dateInput} onPress={() => setShowStartPicker(true)}>
              <Text style={styles.dateText}>{formatDemandDateTime(startDate)}</Text>
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
            <TouchableOpacity style={styles.dateInput} onPress={() => setShowEndPicker(true)}>
              <Text style={styles.dateText}>{formatDemandDateTime(endDate)}</Text>
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

            <View style={styles.summaryBox}>
              <Text style={styles.summaryTitle}>当前摘要</Text>
              <Text style={styles.summaryText}>
                {summarizeAddress(pickupAddress)}
                {' -> '}
                {summarizeAddress(deliveryAddress)}
              </Text>
              <Text style={styles.summaryText}>
                {getSceneLabel(cargoScene)} / {cargoWeight || '--'}kg
              </Text>
            </View>
          </ObjectCard>
        ) : (
          <ObjectCard>
            <Text style={styles.sectionTitle}>第 2 步：专业细节与发布设置</Text>
            <Text style={styles.helperText}>
              这一步不再拦你成单，只是把预算、货物属性和现场说明补完整，方便机主更快给出方案。
            </Text>

            <View style={styles.summaryBox}>
              <Text style={styles.summaryTitle}>已提交的核心信息</Text>
              <Text style={styles.summaryText}>
                {summarizeAddress(pickupAddress)}
                {' -> '}
                {summarizeAddress(deliveryAddress)}
              </Text>
              <Text style={styles.summaryText}>
                {getSceneLabel(cargoScene)} / {cargoWeight || '--'}kg / {formatDemandDateTime(startDate)}
              </Text>
            </View>

            <Text style={styles.label}>货物类型</Text>
            <TextInput
              style={styles.input}
              placeholder="例如：塔材、设备器材、给养物资"
              placeholderTextColor={theme.textHint}
              value={cargoType}
              onChangeText={setCargoType}
            />

            <Text style={styles.label}>货物体积 (m³，可选)</Text>
            <TextInput
              style={styles.input}
              keyboardType="numeric"
              placeholder="例如：3.5"
              placeholderTextColor={theme.textHint}
              value={cargoVolume}
              onChangeText={setCargoVolume}
            />

            <Text style={styles.label}>预计架次</Text>
            <TextInput
              style={styles.input}
              keyboardType="numeric"
              placeholder="默认 1 架次"
              placeholderTextColor={theme.textHint}
              value={tripCount}
              onChangeText={setTripCount}
            />

            <Text style={styles.label}>预算上限 (元)</Text>
            <TextInput
              style={styles.input}
              keyboardType="numeric"
              placeholder="可选，留空表示待沟通"
              placeholderTextColor={theme.textHint}
              value={budgetMax}
              onChangeText={setBudgetMax}
            />

            <Text style={styles.label}>特殊要求</Text>
            <TextInput
              style={[styles.input, styles.textarea]}
              placeholder="例如：限时送达、防水、防震、夜间禁飞等"
              placeholderTextColor={theme.textHint}
              value={specialRequirements}
              onChangeText={setSpecialRequirements}
              multiline
              textAlignVertical="top"
            />

            <Text style={styles.label}>任务说明</Text>
            <TextInput
              style={[styles.input, styles.textarea]}
              placeholder="补充现场环境、装卸条件、收货限制、联系人约定等"
              placeholderTextColor={theme.textHint}
              value={cargoDescription}
              onChangeText={setCargoDescription}
              multiline
              textAlignVertical="top"
            />
          </ObjectCard>
        )}

        <View style={styles.actionStack}>
          {currentStep === 1 ? (
            <>
              <TouchableOpacity style={styles.primaryBtn} onPress={handleContinue}>
                <Text style={styles.primaryBtnText}>继续补充细节</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.secondaryBtn, savingDraft && styles.disabledBtn]}
                onPress={handleSaveDraft}
                disabled={savingDraft}>
                <Text style={styles.secondaryBtnText}>{savingDraft ? '保存中...' : '先保存草稿'}</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <TouchableOpacity style={styles.ghostBtn} onPress={() => setCurrentStep(1)}>
                <Text style={styles.ghostBtnText}>返回修改核心信息</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.secondaryBtn, savingDraft && styles.disabledBtn]}
                onPress={handleSaveDraft}
                disabled={savingDraft}>
                <Text style={styles.secondaryBtnText}>{savingDraft ? '保存中...' : '保存草稿，稍后继续'}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.primaryBtn, publishing && styles.disabledBtn]}
                onPress={handlePublish}
                disabled={publishing}>
                <Text style={styles.primaryBtnText}>{publishing ? '发布中...' : '发布任务'}</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
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
      color: theme.isDark ? theme.textSub : 'rgba(255,255,255,0.86)',
    },
    sectionTitle: {fontSize: 17, fontWeight: '800', color: theme.text, marginBottom: 6},
    stepRow: {flexDirection: 'row', gap: 10, marginTop: 8},
    stepCard: {
      flex: 1,
      borderRadius: 16,
      padding: 14,
      backgroundColor: theme.bgSecondary,
      borderWidth: 1,
      borderColor: theme.cardBorder,
    },
    stepCardActive: {
      backgroundColor: theme.primaryBg,
      borderColor: theme.primaryBorder,
    },
    stepIndex: {
      width: 26,
      height: 26,
      borderRadius: 13,
      textAlign: 'center',
      lineHeight: 26,
      fontSize: 13,
      fontWeight: '800',
      color: theme.textSub,
      backgroundColor: theme.card,
      overflow: 'hidden',
    },
    stepIndexActive: {
      color: theme.primaryText,
      backgroundColor: theme.card,
    },
    stepTitle: {marginTop: 10, fontSize: 14, fontWeight: '800', color: theme.text},
    stepTitleActive: {color: theme.primaryText},
    stepDesc: {marginTop: 4, fontSize: 12, lineHeight: 18, color: theme.textSub},
    draftStatusText: {fontSize: 13, lineHeight: 20, color: theme.text},
    draftHint: {marginTop: 8, fontSize: 12, lineHeight: 18, color: theme.textSub},
    label: {fontSize: 14, fontWeight: '700', color: theme.text, marginBottom: 8, marginTop: 16},
    input: {
      borderWidth: 1,
      borderColor: theme.cardBorder,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontSize: 15,
      backgroundColor: theme.bgSecondary,
      color: theme.text,
    },
    helperText: {marginTop: 8, fontSize: 12, lineHeight: 18, color: theme.textSub},
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
      borderColor: theme.warning,
      backgroundColor: theme.warning + '22',
    },
    optionText: {fontSize: 13, color: theme.textSub},
    optionTextActive: {color: theme.warning, fontWeight: '700'},
    dateInput: {
      borderWidth: 1,
      borderColor: theme.cardBorder,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 14,
      backgroundColor: theme.bgSecondary,
    },
    dateText: {fontSize: 15, color: theme.text},
    summaryBox: {
      marginTop: 18,
      borderRadius: 14,
      padding: 14,
      backgroundColor: theme.bgSecondary,
      borderWidth: 1,
      borderColor: theme.cardBorder,
      gap: 6,
    },
    summaryTitle: {fontSize: 13, fontWeight: '800', color: theme.text},
    summaryText: {fontSize: 13, lineHeight: 20, color: theme.text},
    textarea: {minHeight: 96, textAlignVertical: 'top'},
    actionStack: {gap: 10},
    primaryBtn: {
      height: 48,
      borderRadius: 14,
      backgroundColor: theme.warning,
      justifyContent: 'center',
      alignItems: 'center',
    },
    primaryBtnText: {color: theme.btnPrimaryText, fontSize: 16, fontWeight: '800'},
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
    ghostBtn: {
      height: 44,
      justifyContent: 'center',
      alignItems: 'center',
    },
    ghostBtnText: {color: theme.textSub, fontSize: 14, fontWeight: '600'},
    disabledBtn: {opacity: 0.6},
  });
