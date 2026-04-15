import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
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

import AddressInputField from '../../components/AddressInputField';
import {demandV2Service, type DemandUpsertPayload} from '../../services/demandV2';
import {AddressData, DemandDetail} from '../../types';
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
  snapshotToAddressData,
  summarizeAddress,
  toAddressSnapshot,
} from './demandComposerShared';
import {useTheme} from '../../theme/ThemeContext';
import type {AppTheme} from '../../theme/index';

type DemandStep = 1 | 2;
type DraftSaveState = 'idle' | 'saving' | 'saved' | 'error';

export default function EditDemandScreen({navigation, route}: any) {
  const {theme} = useTheme();
  const styles = getStyles(theme);
  const demandId = Number(route.params?.demandId || 0);

  const [loading, setLoading] = useState(true);
  const [currentStep, setCurrentStep] = useState<DemandStep>(1);
  const [demandStatus, setDemandStatus] = useState('draft');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [cargoScene, setCargoScene] = useState(DEMAND_SCENE_OPTIONS[0].key);
  const [cargoWeight, setCargoWeight] = useState('');
  const [cargoVolume, setCargoVolume] = useState('');
  const [cargoType, setCargoType] = useState('');
  const [specialRequirements, setSpecialRequirements] = useState('');
  const [tripCount, setTripCount] = useState('1');
  const [budgetMin, setBudgetMin] = useState('');
  const [budgetMax, setBudgetMax] = useState('');
  const [allowsPilotCandidate, setAllowsPilotCandidate] = useState(true);
  const [expiresAt, setExpiresAt] = useState(buildDefaultDemandExpiry());
  const [serviceAddress, setServiceAddress] = useState<AddressData | null>(null);
  const [departureAddress, setDepartureAddress] = useState<AddressData | null>(null);
  const [destinationAddress, setDestinationAddress] = useState<AddressData | null>(null);
  const [hasRoute, setHasRoute] = useState(false);
  const [startDate, setStartDate] = useState<Date>(buildDefaultDemandStart());
  const [endDate, setEndDate] = useState<Date>(buildDefaultDemandEnd(buildDefaultDemandStart()));
  const [startConfirmed, setStartConfirmed] = useState(true);
  const [endConfirmed, setEndConfirmed] = useState(true);
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [draftSaveState, setDraftSaveState] = useState<DraftSaveState>('idle');
  const [draftSavedAt, setDraftSavedAt] = useState<string | null>(null);
  const [draftSaveError, setDraftSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);

  const hydratedRef = useRef(false);
  const autoSaveEnabledRef = useRef(false);
  const lastSavedSnapshotRef = useRef('');

  const suggestedTitle = useMemo(
    () =>
      generateSuggestedTitle({
        sceneKey: cargoScene,
        serviceAddress,
        departureAddress,
        destinationAddress,
      }),
    [cargoScene, departureAddress, destinationAddress, serviceAddress],
  );

  const handleMagicTitle = () => {
    setTitle(suggestedTitle);
  };

  const buildPayload = useCallback(
    (): DemandUpsertPayload => {
      const weight = Number(cargoWeight);
      const volume = Number(cargoVolume);
      return {
        title: suggestedTitle,
        service_type: 'heavy_cargo_lift_transport',
        cargo_scene: cargoScene,
        description: description.trim() || undefined,
        ...(hasRoute
          ? {
              departure_address: toAddressSnapshot(departureAddress),
              destination_address: toAddressSnapshot(destinationAddress),
            }
          : {
              service_address: toAddressSnapshot(serviceAddress),
            }),
        scheduled_start_at: startDate.toISOString(),
        scheduled_end_at: endDate.toISOString(),
        cargo_weight_kg: weight > 0 ? weight : undefined,
        cargo_volume_m3: volume > 0 ? volume : undefined,
        cargo_type: cargoType.trim() || undefined,
        cargo_special_requirements: specialRequirements.trim() || undefined,
        estimated_trip_count: Math.max(Number(tripCount) || 1, 1),
        budget_min: budgetMin ? Math.round(Number(budgetMin) * 100) : undefined,
        budget_max: budgetMax ? Math.round(Number(budgetMax) * 100) : undefined,
        allows_pilot_candidate: allowsPilotCandidate,
        expires_at: expiresAt,
      };
    },
    [
      allowsPilotCandidate,
      budgetMax,
      budgetMin,
      cargoScene,
      cargoType,
      cargoVolume,
      cargoWeight,
      departureAddress,
      description,
      destinationAddress,
      endDate,
      hasRoute,
      expiresAt,
      serviceAddress,
      specialRequirements,
      startDate,
      suggestedTitle,
      tripCount,
    ],
  );

  const serializedDraftPayload = useMemo(() => JSON.stringify(buildPayload()), [buildPayload]);
  const isDraft = demandStatus === 'draft';

  const hydrateForm = useCallback((demand: DemandDetail) => {
    const fallbackStart = buildDefaultDemandStart();
    const start = parseDemandDate(demand.scheduled_start_at, fallbackStart);
    const end = parseDemandDate(demand.scheduled_end_at, buildDefaultDemandEnd(start));
    const departure = snapshotToAddressData(demand.departure_address);
    const destination = snapshotToAddressData(demand.destination_address);
    const service = snapshotToAddressData(demand.service_address);
    const routeMode = Boolean(departure || destination);
    const nextExpiry = demand.expires_at || buildDefaultDemandExpiry();

    setDemandStatus(demand.status || 'draft');
    setTitle(demand.title || '');
    setDescription(demand.description || '');
    setCargoScene(demand.cargo_scene || DEMAND_SCENE_OPTIONS[0].key);
    setCargoWeight(demand.cargo_weight_kg ? String(demand.cargo_weight_kg) : '');
    setCargoVolume(demand.cargo_volume_m3 ? String(demand.cargo_volume_m3) : '');
    setCargoType(demand.cargo_type || '');
    setSpecialRequirements(demand.cargo_special_requirements || '');
    setTripCount(demand.estimated_trip_count ? String(demand.estimated_trip_count) : '1');
    setBudgetMin(demand.budget_min ? String(demand.budget_min / 100) : '');
    setBudgetMax(demand.budget_max ? String(demand.budget_max / 100) : '');
    setHasRoute(routeMode);
    setAllowsPilotCandidate(Boolean(demand.allows_pilot_candidate));
    setExpiresAt(nextExpiry);
    setDepartureAddress(departure);
    setDestinationAddress(destination);
    setServiceAddress(routeMode ? null : service);
    setStartDate(start);
    setEndDate(end);
    setStartConfirmed(true);
    setEndConfirmed(true);
    setDraftSavedAt(demand.updated_at || null);
    setDraftSaveState('idle');
    setDraftSaveError(null);
    setCurrentStep(1);

    const nextPayload = {
      title: deriveDraftTitle({
        title: demand.title || '',
        sceneKey: demand.cargo_scene || DEMAND_SCENE_OPTIONS[0].key,
        serviceAddress: routeMode ? null : service,
        departureAddress: departure,
        destinationAddress: destination,
      }),
      service_type: 'heavy_cargo_lift_transport',
      cargo_scene: demand.cargo_scene || DEMAND_SCENE_OPTIONS[0].key,
      description: demand.description || undefined,
      ...(routeMode
        ? {
            departure_address: toAddressSnapshot(departure),
            destination_address: toAddressSnapshot(destination),
          }
        : {
            service_address: toAddressSnapshot(service),
          }),
      scheduled_start_at: start.toISOString(),
      scheduled_end_at: end.toISOString(),
      cargo_weight_kg: demand.cargo_weight_kg || undefined,
      cargo_volume_m3: demand.cargo_volume_m3 || undefined,
      cargo_type: demand.cargo_type || undefined,
      cargo_special_requirements: demand.cargo_special_requirements || undefined,
      estimated_trip_count: demand.estimated_trip_count || 1,
      budget_min: demand.budget_min || undefined,
      budget_max: demand.budget_max || undefined,
      allows_pilot_candidate: Boolean(demand.allows_pilot_candidate),
      expires_at: nextExpiry,
    };
    lastSavedSnapshotRef.current = JSON.stringify(nextPayload);
    autoSaveEnabledRef.current = demand.status === 'draft';
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const response = await demandV2Service.getById(demandId);
        if (!active) {
          return;
        }
        hydrateForm(response.data);
        hydratedRef.current = true;
      } catch (error: any) {
        Alert.alert('加载失败', error?.message || '无法获取任务详情');
        navigation.goBack();
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [demandId, hydrateForm, navigation]);

  useEffect(() => {
    if (!hydratedRef.current || !isDraft || !autoSaveEnabledRef.current || saving || publishing) {
      return;
    }
    if (serializedDraftPayload === lastSavedSnapshotRef.current) {
      return;
    }

    const timer = setTimeout(async () => {
      setDraftSaveState('saving');
      setDraftSaveError(null);
      try {
        await demandV2Service.update(demandId, buildPayload());
        lastSavedSnapshotRef.current = serializedDraftPayload;
        setDraftSavedAt(new Date().toISOString());
        setDraftSaveState('saved');
      } catch (error: any) {
        setDraftSaveState('error');
        setDraftSaveError(error?.message || '自动保存失败');
      }
    }, 1200);

    return () => clearTimeout(timer);
  }, [buildPayload, demandId, isDraft, publishing, saving, serializedDraftPayload]);

  const validateCoreStep = useCallback(
    (showAlert = true) => {
      if (hasRoute) {
        if (!departureAddress || !destinationAddress) {
          if (showAlert) {
            Alert.alert('提示', '请补齐起点和终点地址。');
          }
          return false;
        }
      } else if (!serviceAddress) {
        if (showAlert) {
          Alert.alert('提示', '请补充主要作业地址。');
        }
        return false;
      }

      if (!(Number(cargoWeight) > 0)) {
        if (showAlert) {
          Alert.alert('提示', '请填写有效的货物重量。');
        }
        return false;
      }
      if (!startConfirmed || !endConfirmed) {
        if (showAlert) {
          Alert.alert('提示', '请主动确认开始和结束时间，避免沿用默认时间。');
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
    [cargoWeight, departureAddress, destinationAddress, endConfirmed, endDate, hasRoute, serviceAddress, startConfirmed, startDate],
  );

  const persistChanges = useCallback(
    async (options?: {showSuccess?: boolean}) => {
      setSaving(true);
      setDraftSaveState('saving');
      setDraftSaveError(null);

      try {
        await demandV2Service.update(demandId, buildPayload());
        const savedAt = new Date().toISOString();
        lastSavedSnapshotRef.current = serializedDraftPayload;
        setDraftSavedAt(savedAt);
        setDraftSaveState('saved');
        if (options?.showSuccess) {
          Alert.alert('已保存', isDraft ? '草稿已更新。' : '任务已更新。');
        }
        return true;
      } catch (error: any) {
        setDraftSaveState('error');
        setDraftSaveError(error?.message || '保存失败');
        if (options?.showSuccess) {
          Alert.alert('保存失败', error?.message || '请稍后重试');
        }
        return false;
      } finally {
        setSaving(false);
      }
    },
    [buildPayload, demandId, isDraft, serializedDraftPayload],
  );

  const handleContinue = async () => {
    if (!validateCoreStep(true)) {
      return;
    }
    const ok = await persistChanges();
    if (ok) {
      setCurrentStep(2);
    }
  };

  const handlePublish = async () => {
    if (!validateCoreStep(true)) {
      return;
    }
    setPublishing(true);
    try {
      await demandV2Service.update(demandId, buildPayload());
      await demandV2Service.publish(demandId);
      Alert.alert('已发布', '草稿任务已进入公开任务列表。', [
        {
          text: '查看任务',
          onPress: () => navigation.navigate('DemandDetail', {id: demandId, refreshAt: Date.now()}),
        },
      ]);
    } catch (error: any) {
      Alert.alert('发布失败', error?.message || '请稍后重试');
    } finally {
      setPublishing(false);
    }
  };

  const onStartDateChange = (_event: any, selectedDate?: Date) => {
    setShowStartPicker(Platform.OS === 'ios');
    if (!selectedDate) {
      return;
    }
    setStartDate(selectedDate);
    setStartConfirmed(true);
    if (selectedDate >= endDate) {
      setEndDate(buildDefaultDemandEnd(selectedDate));
      setEndConfirmed(false);
    }
  };

  const onEndDateChange = (_event: any, selectedDate?: Date) => {
    setShowEndPicker(Platform.OS === 'ios');
    if (selectedDate) {
      setEndDate(selectedDate);
      setEndConfirmed(true);
    }
  };

  const draftStatusText = useMemo(() => {
    if (draftSaveState === 'saving') {
      return isDraft ? '草稿正在自动保存...' : '正在保存修改...';
    }
    if (draftSaveState === 'error') {
      return draftSaveError || '保存失败，请手动重试。';
    }
    return draftSavedAt
      ? `${isDraft ? '草稿' : '任务'}最近保存于 ${formatSavedAt(draftSavedAt)}`
      : isDraft
      ? '草稿修改会自动保存，也可以手动点保存。'
      : '当前任务支持继续补充和保存修改。';
  }, [draftSaveError, draftSaveState, draftSavedAt, isDraft]);

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, {backgroundColor: theme.bg}]}>
        <ActivityIndicator style={styles.loader} color={theme.primary} />
      </SafeAreaView>
    );
  }

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
                {hasRoute ? (
                  <>
                    <Text style={styles.label}>起运地</Text>
                    <AddressInputField
                      value={departureAddress}
                      placeholder="点击选择起点"
                      onSelect={setDepartureAddress}
                      style={styles.formAddressInput}
                    />
                    <View style={styles.addressSpacer} />
                    <Text style={styles.label}>目的地</Text>
                    <AddressInputField
                      value={destinationAddress}
                      placeholder="点击选择终点"
                      onSelect={setDestinationAddress}
                      style={styles.formAddressInput}
                    />
                  </>
                ) : (
                  <>
                    <Text style={styles.label}>作业地址</Text>
                    <AddressInputField
                      value={serviceAddress}
                      placeholder="点击选择作业地点"
                      onSelect={setServiceAddress}
                      style={styles.formAddressInput}
                    />
                  </>
                )}
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
                    {startConfirmed ? formatDemandDateTime(startDate).split(' ')[1] : '点击设置'}
                  </Text>
                  <Text style={styles.timePickerDate}>
                    {formatDemandDateTime(startDate).split(' ')[0]}
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
                    {endConfirmed ? formatDemandDateTime(endDate).split(' ')[1] : '点击设置'}
                  </Text>
                  <Text style={styles.timePickerDate}>
                    {formatDemandDateTime(endDate).split(' ')[0]}
                  </Text>
                </TouchableOpacity>
              </View>

              {!startConfirmed && !endConfirmed && (
                <View style={styles.timeHintBox}>
                  <Text style={styles.timeHintText}>💡 建议：预留至少 2 小时作业时间</Text>
                </View>
              )}
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
                value={description}
                onChangeText={setDescription}
                multiline
                textAlignVertical="top"
              />
            </View>
          </View>
        )}

        <View style={styles.footerActions}>
          {currentStep === 1 ? (
            <TouchableOpacity style={styles.mainActionBtn} onPress={handleContinue}>
              <Text style={styles.mainActionBtnText}>保存并继续</Text>
              <Text style={styles.mainActionBtnSub}>下一步可完善预算和详细说明</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.publishRow}>
              <TouchableOpacity style={styles.backBtn} onPress={() => setCurrentStep(1)}>
                <Text style={styles.backBtnText}>修改核心信息</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.publishBtn, publishing && styles.btnDisabled]}
                onPress={isDraft ? handlePublish : () => persistChanges({showSuccess: true})}
                disabled={publishing}
              >
                <Text style={styles.publishBtnText}>
                  {publishing ? '正在处理...' : isDraft ? '发布任务' : '保存修改'}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          <TouchableOpacity
            style={[styles.saveDraftLink, saving && styles.btnDisabled]}
            onPress={() => persistChanges({showSuccess: true})}
            disabled={saving}
          >
            <Text style={styles.saveDraftLinkText}>{saving ? '正在保存...' : '手动保存修改'}</Text>
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
    loader: {marginTop: 120},
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
