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
import ObjectCard from '../../components/business/ObjectCard';
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
      deriveDraftTitle({
        title,
        sceneKey: cargoScene,
        serviceAddress,
        departureAddress,
        destinationAddress,
      }),
    [cargoScene, departureAddress, destinationAddress, serviceAddress, title],
  );

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
      <ScrollView contentContainerStyle={styles.content}>
        <ObjectCard style={styles.heroCard}>
          <Text style={styles.heroEyebrow}>{isDraft ? '继续完善草稿' : '修改任务'}</Text>
          <Text style={styles.pageTitle}>{isDraft ? '草稿可以边改边存，不用一次改完' : '继续补充任务信息'}</Text>
          <Text style={styles.heroDesc}>
            {isDraft
              ? '草稿模式下，系统会自动帮你保存修改。你可以先把核心信息梳理清楚，再慢慢补预算和说明。'
              : '已发布或询价中的任务也支持继续完善信息，但会按保存动作生效。'}
          </Text>
        </ObjectCard>

        <ObjectCard>
          <Text style={styles.sectionTitle}>编辑进度</Text>
          <View style={styles.stepRow}>
            <TouchableOpacity
              style={[styles.stepCard, currentStep === 1 && styles.stepCardActive]}
              onPress={() => setCurrentStep(1)}>
              <Text style={[styles.stepIndex, currentStep === 1 && styles.stepIndexActive]}>1</Text>
              <Text style={[styles.stepTitle, currentStep === 1 && styles.stepTitleActive]}>核心信息</Text>
              <Text style={styles.stepDesc}>地址、时间、重量</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.stepCard, currentStep === 2 && styles.stepCardActive]}
              onPress={() => setCurrentStep(2)}>
              <Text style={[styles.stepIndex, currentStep === 2 && styles.stepIndexActive]}>2</Text>
              <Text style={[styles.stepTitle, currentStep === 2 && styles.stepTitleActive]}>专业细节</Text>
              <Text style={styles.stepDesc}>预算、说明、货物属性</Text>
            </TouchableOpacity>
          </View>
        </ObjectCard>

        <ObjectCard highlightColor={draftSaveState === 'error' ? theme.danger + '66' : theme.primaryBorder}>
          <Text style={styles.sectionTitle}>保存状态</Text>
          <Text style={styles.draftStatusText}>{draftStatusText}</Text>
        </ObjectCard>

        {currentStep === 1 ? (
          <ObjectCard>
            <Text style={styles.sectionTitle}>第 1 步：核心信息</Text>

            <Text style={styles.label}>任务标题</Text>
            <TextInput
              style={styles.input}
              placeholder="例如：山区电网建设塔材吊运"
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

            {hasRoute ? (
              <>
                <Text style={styles.label}>起点地址 *</Text>
                <AddressInputField
                  value={departureAddress}
                  placeholder="点击选择起点地址"
                  onSelect={setDepartureAddress}
                />

                <Text style={styles.label}>终点地址 *</Text>
                <AddressInputField
                  value={destinationAddress}
                  placeholder="点击选择终点地址"
                  onSelect={setDestinationAddress}
                />
              </>
            ) : (
              <>
                <Text style={styles.label}>主要作业地址 *</Text>
                <AddressInputField
                  value={serviceAddress}
                  placeholder="点击选择主要作业地址"
                  onSelect={setServiceAddress}
                />
              </>
            )}

            <Text style={styles.label}>货物重量 (kg) *</Text>
            <TextInput
              style={styles.input}
              keyboardType="numeric"
              placeholder="例如：80"
              placeholderTextColor={theme.textHint}
              value={cargoWeight}
              onChangeText={setCargoWeight}
            />

            <Text style={styles.label}>预约开始时间 *</Text>
            <Text style={styles.helperText}>修改时间后，请重新确认，避免误用系统建议时间。</Text>
            <TouchableOpacity style={styles.dateInput} onPress={() => setShowStartPicker(true)}>
              <Text style={[styles.dateText, !startConfirmed && styles.datePlaceholderText]}>
                {startConfirmed ? formatDemandDateTime(startDate) : '请重新确认开始时间'}
              </Text>
            </TouchableOpacity>
            {!startConfirmed ? <Text style={styles.timeRecommend}>建议参考：{formatDemandDateTime(startDate)}</Text> : null}
            {showStartPicker ? (
              <DateTimePicker
                value={startDate}
                mode="datetime"
                display="default"
                onChange={onStartDateChange}
                minimumDate={new Date()}
              />
            ) : null}

            <Text style={styles.label}>预约结束时间 *</Text>
            <TouchableOpacity style={styles.dateInput} onPress={() => setShowEndPicker(true)}>
              <Text style={[styles.dateText, !endConfirmed && styles.datePlaceholderText]}>
                {endConfirmed ? formatDemandDateTime(endDate) : '请重新确认结束时间'}
              </Text>
            </TouchableOpacity>
            {!endConfirmed ? <Text style={styles.timeRecommend}>建议参考：{formatDemandDateTime(endDate)}</Text> : null}
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
                {hasRoute ? (
                  <>
                    {summarizeAddress(departureAddress)}
                    {' -> '}
                    {summarizeAddress(destinationAddress)}
                  </>
                ) : (
                  summarizeAddress(serviceAddress)
                )}
              </Text>
              <Text style={styles.summaryText}>
                {getSceneLabel(cargoScene)} / {cargoWeight || '--'}kg
              </Text>
            </View>
          </ObjectCard>
        ) : (
          <ObjectCard>
            <Text style={styles.sectionTitle}>第 2 步：专业细节</Text>
            <Text style={styles.helperText}>
              这里继续补预算、货物属性和说明。草稿状态下会自动保存，你不需要一次性把所有字段都填完。
            </Text>

            <View style={styles.summaryBox}>
              <Text style={styles.summaryTitle}>已保存的核心信息</Text>
              <Text style={styles.summaryText}>
                {hasRoute ? (
                  <>
                    {summarizeAddress(departureAddress)}
                    {' -> '}
                    {summarizeAddress(destinationAddress)}
                  </>
                ) : (
                  summarizeAddress(serviceAddress)
                )}
              </Text>
              <Text style={styles.summaryText}>
                {getSceneLabel(cargoScene)} / {cargoWeight || '--'}kg / {formatDemandDateTime(startDate)}
              </Text>
            </View>

            <Text style={styles.label}>货物类型</Text>
            <TextInput
              style={styles.input}
              placeholder="例如：塔材、设备箱、给养物资"
              placeholderTextColor={theme.textHint}
              value={cargoType}
              onChangeText={setCargoType}
            />

            <Text style={styles.label}>货物体积 (m³，可选)</Text>
            <TextInput
              style={styles.input}
              keyboardType="numeric"
              placeholder="例如：2.5"
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

            <Text style={styles.label}>预算范围 (元)</Text>
            <View style={styles.budgetRow}>
              <TextInput
                style={[styles.input, styles.flexInput]}
                keyboardType="numeric"
                placeholder="最低预算"
                placeholderTextColor={theme.textHint}
                value={budgetMin}
                onChangeText={setBudgetMin}
              />
              <Text style={styles.split}>-</Text>
              <TextInput
                style={[styles.input, styles.flexInput]}
                keyboardType="numeric"
                placeholder="最高预算"
                placeholderTextColor={theme.textHint}
                value={budgetMax}
                onChangeText={setBudgetMax}
              />
            </View>

            <Text style={styles.label}>特殊要求</Text>
            <TextInput
              style={[styles.input, styles.textarea]}
              placeholder="例如：限时交付、吊点受限、需要防震包装等"
              placeholderTextColor={theme.textHint}
              value={specialRequirements}
              onChangeText={setSpecialRequirements}
              multiline
              textAlignVertical="top"
            />

            <Text style={styles.label}>任务说明</Text>
            <TextInput
              style={[styles.input, styles.textarea]}
              placeholder="补充现场条件、运输背景、注意事项等"
              placeholderTextColor={theme.textHint}
              value={description}
              onChangeText={setDescription}
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
                style={[styles.secondaryBtn, saving && styles.disabledBtn]}
                onPress={() => persistChanges({showSuccess: true})}
                disabled={saving}>
                <Text style={styles.secondaryBtnText}>{saving ? '保存中...' : '手动保存'}</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <TouchableOpacity style={styles.ghostBtn} onPress={() => setCurrentStep(1)}>
                <Text style={styles.ghostBtnText}>返回修改核心信息</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.secondaryBtn, saving && styles.disabledBtn]}
                onPress={() => persistChanges({showSuccess: true})}
                disabled={saving}>
                <Text style={styles.secondaryBtnText}>{saving ? '保存中...' : '保存修改'}</Text>
              </TouchableOpacity>
              {isDraft ? (
                <TouchableOpacity
                  style={[styles.primaryBtn, publishing && styles.disabledBtn]}
                  onPress={handlePublish}
                  disabled={publishing}>
                  <Text style={styles.primaryBtnText}>{publishing ? '发布中...' : '发布草稿任务'}</Text>
                </TouchableOpacity>
              ) : null}
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
    loader: {marginTop: 120},
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
    pageTitle: {
      marginTop: 8,
      fontSize: 26,
      lineHeight: 32,
      fontWeight: '800',
      color: theme.isDark ? theme.text : '#FFFFFF',
    },
    heroDesc: {
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
    stepCardActive: {backgroundColor: theme.primaryBg, borderColor: theme.primaryBorder},
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
    stepIndexActive: {color: theme.primaryText, backgroundColor: theme.card},
    stepTitle: {marginTop: 10, fontSize: 14, fontWeight: '800', color: theme.text},
    stepTitleActive: {color: theme.primaryText},
    stepDesc: {marginTop: 4, fontSize: 12, lineHeight: 18, color: theme.textSub},
    draftStatusText: {fontSize: 13, lineHeight: 20, color: theme.text},
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
    optionBtnActive: {borderColor: theme.primary, backgroundColor: theme.primaryBg},
    optionText: {fontSize: 13, color: theme.textSub},
    optionTextActive: {color: theme.primaryText, fontWeight: '700'},
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
    timeRecommend: {fontSize: 12, color: theme.primaryText, marginTop: 6},
    budgetRow: {flexDirection: 'row', alignItems: 'center'},
    flexInput: {flex: 1},
    split: {marginHorizontal: 10, color: theme.textHint},
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
      backgroundColor: theme.primary,
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
