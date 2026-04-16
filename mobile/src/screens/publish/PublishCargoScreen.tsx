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
  generateSuggestedTitle,
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
      generateSuggestedTitle({
        sceneKey: cargoScene,
        departureAddress: pickupAddress,
        destinationAddress: deliveryAddress,
      }),
    [cargoScene, deliveryAddress, pickupAddress],
  );

  const handleMagicTitle = () => {
    setTitle(suggestedTitle);
  };

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
      <View style={styles.header}>
        <View style={styles.progressHeader}>
          <View style={styles.progressTrack}>
            <View style={[styles.progressPin, styles.progressPinActive]} />
            <View style={[styles.progressLine, currentStep === 2 && styles.progressLineActive]} />
            <View style={[styles.progressPin, currentStep === 2 && styles.progressPinActive]} />
          </View>
          <View style={styles.progressLabels}>
            <Text style={[styles.progressLabelText, styles.progressLabelTextActive]}>核心需求</Text>
            <Text style={[styles.progressLabelText, currentStep === 2 && styles.progressLabelTextActive]}>更多细节</Text>
          </View>
        </View>

        <View style={styles.draftStatusRow}>
          <View style={[styles.draftDot, draftSaveState === 'saving' ? styles.draftDotSaving : draftSaveState === 'error' ? styles.draftDotError : styles.draftDotSaved]} />
          <Text style={styles.draftStatusSmallText}>{draftStatusText}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {currentStep === 1 ? (
          <View style={styles.formSection}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>1. 核心需求信息</Text>
              <Text style={styles.sectionSubtitle}>必填项，用于发布后匹配合适的机组</Text>
            </View>

            <View style={styles.inputCard}>
              <Text style={styles.label}>任务标题</Text>
              <View style={styles.titleInputRow}>
                <TextInput
                  style={[styles.input, {flex: 1}]}
                  placeholder="例如：山区设备吊运"
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
                {DEMAND_SCENE_OPTIONS.map(option => (
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

              <View style={styles.addressSection}>
                <Text style={styles.label}>起运地</Text>
                <AddressInputField
                  value={pickupAddress}
                  placeholder="点击选择起点"
                  onSelect={setPickupAddress}
                  style={styles.formAddressInput}
                />
                <View style={styles.addressSpacer} />
                <Text style={styles.label}>目的地</Text>
                <AddressInputField
                  value={deliveryAddress}
                  placeholder="点击选择终点"
                  onSelect={setDeliveryAddress}
                  style={styles.formAddressInput}
                />
              </View>

              <Text style={styles.label}>货物重量 (kg)</Text>
              <TextInput
                style={styles.input}
                keyboardType="numeric"
                placeholder="例如：120"
                placeholderTextColor={theme.textHint}
                value={cargoWeight}
                onChangeText={setCargoWeight}
              />

              <View style={styles.timeSection}>
                <View style={styles.timeCol}>
                  <Text style={styles.label}>期望开始</Text>
                  <TouchableOpacity style={styles.timeBtn} onPress={() => setShowStartPicker(true)}>
                    <Text style={styles.timeBtnText}>{formatDemandDateTime(startDate).split(' ')[0]}</Text>
                    <Text style={styles.timeBtnValue}>{formatDemandDateTime(startDate).split(' ')[1]}</Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.timeCol}>
                  <Text style={styles.label}>期望结束</Text>
                  <TouchableOpacity style={styles.timeBtn} onPress={() => setShowEndPicker(true)}>
                    <Text style={styles.timeBtnText}>{formatDemandDateTime(endDate).split(' ')[0]}</Text>
                    <Text style={styles.timeBtnValue}>{formatDemandDateTime(endDate).split(' ')[1]}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </View>
        ) : (
          <View style={styles.formSection}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>2. 更多细节 (选填)</Text>
              <Text style={styles.sectionSubtitle}>详细的要求能帮您获得更精准的报价方案</Text>
            </View>

            <View style={styles.inputCard}>
              <View style={styles.rowInputs}>
                <View style={{flex: 1}}>
                  <Text style={styles.label}>货物类型</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="如：塔材"
                    placeholderTextColor={theme.textHint}
                    value={cargoType}
                    onChangeText={setCargoType}
                  />
                </View>
                <View style={{flex: 1}}>
                  <Text style={styles.label}>体积 (m³)</Text>
                  <TextInput
                    style={styles.input}
                    keyboardType="numeric"
                    placeholder="可选"
                    placeholderTextColor={theme.textHint}
                    value={cargoVolume}
                    onChangeText={setCargoVolume}
                  />
                </View>
              </View>

              <View style={styles.rowInputs}>
                <View style={{flex: 1}}>
                  <Text style={styles.label}>预计架次</Text>
                  <TextInput
                    style={styles.input}
                    keyboardType="numeric"
                    placeholder="默认 1"
                    placeholderTextColor={theme.textHint}
                    value={tripCount}
                    onChangeText={setTripCount}
                  />
                </View>
                <View style={{flex: 1}}>
                  <Text style={styles.label}>预算上限 (元)</Text>
                  <TextInput
                    style={styles.input}
                    keyboardType="numeric"
                    placeholder="待议"
                    placeholderTextColor={theme.textHint}
                    value={budgetMax}
                    onChangeText={setBudgetMax}
                  />
                </View>
              </View>

              <Text style={styles.label}>特殊要求</Text>
              <TextInput
                style={[styles.input, styles.textarea]}
                placeholder="例如：需要防水、防震包装..."
                placeholderTextColor={theme.textHint}
                value={specialRequirements}
                onChangeText={setSpecialRequirements}
                multiline
                textAlignVertical="top"
              />

              <Text style={styles.label}>任务说明</Text>
              <TextInput
                style={[styles.input, styles.textarea]}
                placeholder="补充现场环境、装卸条件等信息..."
                placeholderTextColor={theme.textHint}
                value={cargoDescription}
                onChangeText={setCargoDescription}
                multiline
                textAlignVertical="top"
              />
            </View>
          </View>
        )}

        <View style={styles.footerActions}>
          {currentStep === 1 ? (
            <TouchableOpacity style={styles.mainActionBtn} onPress={handleContinue}>
              <Text style={styles.mainActionBtnText}>进入下一步</Text>
              <Text style={styles.mainActionBtnSub}>下一步可完善预算和详细说明</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.publishRow}>
              <TouchableOpacity style={styles.backBtn} onPress={() => setCurrentStep(1)}>
                <Text style={styles.backBtnText}>修改核心信息</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.publishBtn, publishing && styles.btnDisabled]}
                onPress={handlePublish}
                disabled={publishing}
              >
                <Text style={styles.publishBtnText}>{publishing ? '正在发布...' : '立即发布任务'}</Text>
              </TouchableOpacity>
            </View>
          )}

          <TouchableOpacity
            style={[styles.saveDraftLink, savingDraft && styles.btnDisabled]}
            onPress={handleSaveDraft}
            disabled={savingDraft}
          >
            <Text style={styles.saveDraftLinkText}>{savingDraft ? '正在保存...' : '手动保存草稿'}</Text>
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
      marginBottom: 12,
    },
    progressTrack: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 40,
    },
    progressPin: {
      width: 12,
      height: 12,
      borderRadius: 6,
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
    draftStatusRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
    },
    draftDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      marginRight: 6,
    },
    draftDotSaved: {backgroundColor: theme.success},
    draftDotSaving: {backgroundColor: theme.warning},
    draftDotError: {backgroundColor: theme.danger},
    draftStatusSmallText: {
      fontSize: 10,
      color: theme.textSub,
      fontWeight: '500',
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
    suggestedTitleLink: {
      fontSize: 12,
      color: theme.primary,
      marginTop: 8,
      textDecorationLine: 'underline',
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
    addressSection: {
      marginTop: 8,
    },
    formAddressInput: {
      backgroundColor: theme.bgSecondary,
      borderRadius: 12,
    },
    addressSpacer: {
      height: 2,
    },
    timeSection: {
      flexDirection: 'row',
      gap: 12,
    },
    timeCol: {
      flex: 1,
    },
    timeBtn: {
      backgroundColor: theme.bgSecondary,
      borderRadius: 12,
      padding: 12,
      alignItems: 'center',
    },
    timeBtnText: {
      fontSize: 11,
      color: theme.textSub,
      marginBottom: 2,
    },
    timeBtnValue: {
      fontSize: 16,
      fontWeight: '800',
      color: theme.text,
    },
    rowInputs: {
      flexDirection: 'row',
      gap: 12,
    },
    textarea: {
      minHeight: 100,
      textAlignVertical: 'top',
    },
    footerActions: {
      padding: 16,
      gap: 16,
    },
    mainActionBtn: {
      backgroundColor: theme.primary,
      borderRadius: 18,
      height: 64,
      justifyContent: 'center',
      alignItems: 'center',
      shadowColor: theme.primary,
      shadowOffset: {width: 0, height: 4},
      shadowOpacity: 0.2,
      shadowRadius: 8,
      elevation: 4,
    },
    mainActionBtnText: {
      color: '#FFFFFF',
      fontSize: 17,
      fontWeight: '800',
    },
    mainActionBtnSub: {
      color: 'rgba(255,255,255,0.7)',
      fontSize: 11,
      marginTop: 2,
    },
    publishRow: {
      flexDirection: 'row',
      gap: 12,
    },
    backBtn: {
      flex: 1,
      height: 54,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.divider,
      justifyContent: 'center',
      alignItems: 'center',
    },
    backBtnText: {
      fontSize: 15,
      color: theme.textSub,
      fontWeight: '600',
    },
    publishBtn: {
      flex: 2,
      height: 54,
      borderRadius: 16,
      backgroundColor: theme.success,
      justifyContent: 'center',
      alignItems: 'center',
    },
    publishBtnText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '800',
    },
    saveDraftLink: {
      alignItems: 'center',
      paddingVertical: 8,
    },
    saveDraftLinkText: {
      color: theme.textSub,
      fontSize: 14,
      fontWeight: '600',
      textDecorationLine: 'underline',
    },
    btnDisabled: {opacity: 0.6},
  });
