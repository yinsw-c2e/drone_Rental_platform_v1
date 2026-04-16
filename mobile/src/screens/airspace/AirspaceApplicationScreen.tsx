import React, {useState, useEffect, useCallback} from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Alert,
  TextInput,
  RefreshControl,
  FlatList,
  Platform,
} from 'react-native';
import {useFocusEffect} from '@react-navigation/native';
import {
  listMyApplications,
  createApplication,
  submitForReview,
  cancelApplication,
  AirspaceApplication,
  CreateApplicationRequest,
} from '../../services/airspace';
import {pilotV2Service} from '../../services/pilotV2';
import AddressInputField from '../../components/AddressInputField';
import {AddressData} from '../../types';
import {useTheme} from '../../theme/ThemeContext';
import type {AppTheme} from '../../theme/index';
import DateTimePicker from '@react-native-community/datetimepicker';

const STATUS_MAP: Record<string, {label: string; colorKey: 'textHint' | 'warning' | 'success' | 'danger' | 'info'}> = {
  draft: {label: '草稿', colorKey: 'textHint'},
  pending_review: {label: '待审核', colorKey: 'warning'},
  approved: {label: '已批准', colorKey: 'success'},
  rejected: {label: '已拒绝', colorKey: 'danger'},
  submitted_to_uom: {label: '已提交UOM', colorKey: 'info'},
  cancelled: {label: '已取消', colorKey: 'textHint'},
};

const PURPOSE_OPTIONS = [
  {label: '货物运输', value: 'cargo_delivery'},
  {label: '航拍测绘', value: 'aerial_mapping'},
  {label: '农业植保', value: 'agriculture'},
  {label: '巡检监测', value: 'inspection'},
  {label: '应急救援', value: 'emergency'},
  {label: '训练飞行', value: 'training'},
];

export default function AirspaceApplicationScreen({navigation, route}: any) {
  const {theme} = useTheme();
  const styles = getStyles(theme);
  const [mode, setMode] = useState<'list' | 'create'>('list');
  const [applications, setApplications] = useState<AirspaceApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pilotId, setPilotId] = useState<number>(0);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [planName, setPlanName] = useState('');
  const [purpose, setPurpose] = useState('cargo_delivery');
  const [departureAddr, setDepartureAddr] = useState<AddressData | null>(null);
  const [arrivalAddr, setArrivalAddr] = useState<AddressData | null>(null);
  const [maxAltitudeStr, setMaxAltitudeStr] = useState('120');

  const [startDate, setStartDate] = useState<Date>(new Date(Date.now() + 86400000));
  const [endDate, setEndDate] = useState<Date>(new Date(Date.now() + 86400000 + 7200000));
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);

  const [routeDesc, setRouteDesc] = useState('');

  const droneId = route?.params?.droneId || 0;
  const orderId = route?.params?.orderId || 0;

  const onStartDateChange = (_event: any, selected?: Date) => {
    setShowStartPicker(Platform.OS === 'ios');
    if (selected) {
      setStartDate(selected);
      if (selected >= endDate) {
        setEndDate(new Date(selected.getTime() + 7200000));
      }
    }
  };

  const onEndDateChange = (_event: any, selected?: Date) => {
    setShowEndPicker(Platform.OS === 'ios');
    if (selected) {
      setEndDate(selected);
    }
  };

  const formatDisplayTime = (date: Date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    const h = String(date.getHours()).padStart(2, '0');
    const mi = String(date.getMinutes()).padStart(2, '0');
    return `${y}-${m}-${d} ${h}:${mi}`;
  };

  useEffect(() => {
    loadPilotInfo();
  }, []);

  const loadPilotInfo = async () => {
    try {
      const res = await pilotV2Service.getProfile();
      setPilotId(res.data.id);
    } catch {
      Alert.alert('提示', '请先完成飞手认证');
    }
  };

  const loadApplications = useCallback(async () => {
    if (pilotId <= 0) {
      setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      const result = await listMyApplications(pilotId);
      setApplications(result.data || []);
    } catch (err: any) {
      console.log('加载申请列表失败:', err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [pilotId]);

  useFocusEffect(
    useCallback(() => {
      loadApplications();
    }, [loadApplications]),
  );

  const handleCreate = async () => {
    if (!planName.trim()) return Alert.alert('提示', '请输入报备名称');
    if (!departureAddr) return Alert.alert('提示', '请选择起运报备地址');
    if (!arrivalAddr) return Alert.alert('提示', '请选择送达报备地址');

    setSubmitting(true);
    try {
      const req: CreateApplicationRequest = {
        pilot_id: pilotId,
        drone_id: droneId,
        order_id: orderId,
        flight_plan_name: planName,
        flight_purpose: purpose,
        departure_latitude: departureAddr.latitude || 0,
        departure_longitude: departureAddr.longitude || 0,
        departure_address: departureAddr.address || departureAddr.name || '',
        arrival_latitude: arrivalAddr.latitude || 0,
        arrival_longitude: arrivalAddr.longitude || 0,
        arrival_address: arrivalAddr.address || arrivalAddr.name || '',
        max_altitude: parseInt(maxAltitudeStr, 10) || 120,
        planned_start_time: startDate.toISOString(),
        planned_end_time: endDate.toISOString(),
        route_description: routeDesc,
      };
      await createApplication(req);
      Alert.alert('成功', '空域报备已提交存证');
      setMode('list');
      resetForm();
      loadApplications();
    } catch (err: any) {
      Alert.alert('提交失败', err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitReview = async (id: number) => {
    Alert.alert('确认报备', '确定要提交此空域报备进行正式存证与审核吗？提交前将自动进行合规性校验。', [
      {text: '取消', style: 'cancel'},
      {
        text: '确认提交',
        onPress: async () => {
          try {
            await submitForReview(id, pilotId);
            Alert.alert('成功', '已提交存证');
            loadApplications();
          } catch (err: any) {
            Alert.alert('提交失败', err.message);
          }
        },
      },
    ]);
  };

  const handleCancel = async (id: number) => {
    Alert.alert('取消报备', '确定要撤销此空域报备申请吗？', [
      {text: '保留', style: 'cancel'},
      {
        text: '确认撤销',
        style: 'destructive',
        onPress: async () => {
          try {
            await cancelApplication(id, pilotId);
            Alert.alert('已取消');
            loadApplications();
          } catch (err: any) {
            Alert.alert('操作失败', err.message);
          }
        },
      },
    ]);
  };

  const resetForm = () => {
    setPlanName('');
    setPurpose('cargo_delivery');
    setDepartureAddr(null);
    setArrivalAddr(null);
    setMaxAltitudeStr('120');
    setStartDate(new Date(Date.now() + 86400000));
    setEndDate(new Date(Date.now() + 86400000 + 7200000));
    setRouteDesc('');
  };

  const renderApplicationItem = ({item}: {item: AirspaceApplication}) => {
    const statusInfo = STATUS_MAP[item.status] || {label: item.status, colorKey: 'textHint' as const};
    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => navigation.navigate('ComplianceCheck', {applicationId: item.id, pilotId, droneId: item.drone_id})}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle} numberOfLines={1}>{item.flight_plan_name || '未命名报备'}</Text>
          <View style={[styles.statusBadge, {backgroundColor: theme[statusInfo.colorKey] + '20'}]}>
            <Text style={[styles.statusText, {color: theme[statusInfo.colorKey]}]}>{statusInfo.label}</Text>
          </View>
        </View>

        <View style={styles.cardBody}>
          <Text style={styles.cardInfo}>用途: {PURPOSE_OPTIONS.find(p => p.value === item.flight_purpose)?.label || item.flight_purpose}</Text>
          <Text style={styles.cardInfo}>起飞: {item.departure_address || '未设置'}</Text>
          <Text style={styles.cardInfo}>降落: {item.arrival_address || '未设置'}</Text>
          <Text style={styles.cardInfo}>限高: {item.max_altitude}m</Text>
          {item.uom_application_no ? (
            <Text style={styles.cardInfo}>UOM存证编号: {item.uom_application_no}</Text>
          ) : null}
        </View>

        <View style={styles.cardFooter}>
          <Text style={styles.timeText}>
            创建: {item.created_at ? new Date(item.created_at).toLocaleDateString() : ''}
          </Text>
          <View style={styles.actionButtons}>
            {item.status === 'draft' && (
              <>
                <TouchableOpacity
                  style={[styles.actionBtn, styles.submitBtn]}
                  onPress={() => handleSubmitReview(item.id)}>
                  <Text style={styles.submitBtnText}>提交存证</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionBtn, styles.cancelBtn]}
                  onPress={() => handleCancel(item.id)}>
                  <Text style={styles.cancelBtnText}>撤销</Text>
                </TouchableOpacity>
              </>
            )}
            {item.status === 'pending_review' && (
              <TouchableOpacity
                style={[styles.actionBtn, styles.cancelBtn]}
                onPress={() => handleCancel(item.id)}>
                <Text style={styles.cancelBtnText}>撤回</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  if (mode === 'create') {
    return (
      <SafeAreaView style={[styles.container, {backgroundColor: theme.bg}]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setMode('list')} style={styles.backBtnHeader}>
            <Text style={styles.backText}>˂ 取消</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>新建空域报备</Text>
          <View style={{width: 60}} />
        </View>

        <ScrollView style={styles.form} showsVerticalScrollIndicator={false}>
          <View style={styles.formCard}>
            <Text style={styles.formSectionTitle}>基本信息</Text>
            <Text style={styles.label}>报备名称 *</Text>
            <TextInput style={styles.input} placeholder="例如：某项目物资运输空域报备" value={planName} onChangeText={setPlanName} />

            <Text style={styles.label}>作业用途 *</Text>
            <View style={styles.optionRow}>
              {PURPOSE_OPTIONS.map(opt => (
                <TouchableOpacity
                  key={opt.value}
                  style={[styles.optionChip, purpose === opt.value && styles.optionChipActive]}
                  onPress={() => setPurpose(opt.value)}>
                  <Text style={[styles.optionChipText, purpose === opt.value && styles.optionChipTextActive]}>{opt.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.formCard}>
            <Text style={styles.formSectionTitle}>起降点设置</Text>
            <Text style={styles.label}>起飞点地址 *</Text>
            <AddressInputField
              value={departureAddr}
              placeholder="请选择作业起始坐标"
              onSelect={setDepartureAddr}
              style={styles.addrField}
            />

            <Text style={styles.label}>降落点地址 *</Text>
            <AddressInputField
              value={arrivalAddr}
              placeholder="请选择作业结束坐标"
              onSelect={setArrivalAddr}
              style={styles.addrField}
            />
          </View>

          <View style={styles.formCard}>
            <Text style={styles.formSectionTitle}>作业时间与参数</Text>

            <View style={styles.timePickerRow}>
              <TouchableOpacity style={styles.timeBox} onPress={() => setShowStartPicker(true)}>
                <Text style={styles.timeLabel}>计划开始</Text>
                <Text style={styles.timeValue}>{formatDisplayTime(startDate)}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.timeBox} onPress={() => setShowEndPicker(true)}>
                <Text style={styles.timeLabel}>计划结束</Text>
                <Text style={styles.timeValue}>{formatDisplayTime(endDate)}</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.label}>最大飞行高度 (米) *</Text>
            <TextInput style={styles.input} placeholder="120" keyboardType="number-pad" value={maxAltitudeStr} onChangeText={setMaxAltitudeStr} />

            <Text style={styles.label}>航线描述 (选填)</Text>
            <TextInput style={[styles.input, styles.textArea]} placeholder="描述大致飞行路径、绕飞障碍物等信息" value={routeDesc} onChangeText={setRouteDesc} multiline numberOfLines={3} />
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

          <View style={styles.formButtons}>
            <TouchableOpacity style={[styles.formBtn, styles.formBtnSubmit]} onPress={handleCreate} disabled={submitting}>
              <Text style={styles.formBtnSubmitText}>{submitting ? '提交中...' : '提交空域报备'}</Text>
            </TouchableOpacity>
          </View>

          <View style={{height: 60}} />
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, {backgroundColor: theme.bg}]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>空域报备管理</Text>
        <TouchableOpacity style={styles.createBtn} onPress={() => setMode('create')}>
          <Text style={styles.createBtnText}>+ 新建报备</Text>
        </TouchableOpacity>
      </View>

      {applications.length === 0 && !loading ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>暂无空域报备记录</Text>
          <Text style={styles.emptySubText}>点击右上角“新建报备”开始</Text>
        </View>
      ) : (
        <FlatList
          data={applications}
          keyExtractor={item => String(item.id)}
          renderItem={renderApplicationItem}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => {setRefreshing(true); loadApplications();}} />}
        />
      )}
    </SafeAreaView>
  );
}

const getStyles = (theme: AppTheme) => StyleSheet.create({
  container: {flex: 1, backgroundColor: theme.bgSecondary},
  header: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: theme.card, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.divider},
  headerTitle: {fontSize: 18, fontWeight: '600', color: theme.text},
  createBtn: {backgroundColor: theme.primary, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6},
  createBtnText: {color: theme.btnPrimaryText, fontSize: 14, fontWeight: '500'},
  listContent: {padding: 16},
  card: {backgroundColor: theme.card, borderRadius: 12, padding: 16, marginBottom: 12, shadowColor: '#000', shadowOffset: {width: 0, height: 1}, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2},
  cardHeader: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10},
  cardTitle: {fontSize: 16, fontWeight: '600', color: theme.text, flex: 1, marginRight: 8},
  statusBadge: {paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4},
  statusText: {fontSize: 12, fontWeight: '500'},
  cardBody: {marginBottom: 10},
  cardInfo: {fontSize: 13, color: theme.textSub, marginBottom: 4},
  cardFooter: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.divider, paddingTop: 10},
  timeText: {fontSize: 12, color: theme.textSub},
  actionButtons: {flexDirection: 'row', gap: 8},
  actionBtn: {paddingHorizontal: 12, paddingVertical: 5, borderRadius: 4},
  submitBtn: {backgroundColor: theme.primary},
  submitBtnText: {color: theme.btnPrimaryText, fontSize: 12, fontWeight: '500'},
  cancelBtn: {backgroundColor: theme.bgSecondary, borderWidth: 1, borderColor: theme.divider},
  cancelBtnText: {color: theme.textSub, fontSize: 12},
  empty: {flex: 1, justifyContent: 'center', alignItems: 'center'},
  emptyText: {fontSize: 16, color: theme.textSub, marginBottom: 8},
  emptySubText: {fontSize: 13, color: theme.textHint},

  // Form styles
  form: {flex: 1, padding: 16},
  formCard: {backgroundColor: theme.card, borderRadius: 20, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: theme.divider},
  formSectionTitle: {fontSize: 16, fontWeight: '800', color: theme.text, marginBottom: 12},
  label: {fontSize: 13, color: theme.textSub, marginBottom: 6, marginTop: 8},
  input: {backgroundColor: theme.bgSecondary, borderWidth: 1, borderColor: theme.divider, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: theme.text},
  textArea: {minHeight: 80, textAlignVertical: 'top'},
  optionRow: {flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4},
  optionChip: {paddingHorizontal: 14, paddingVertical: 8, borderRadius: 16, backgroundColor: theme.bgSecondary, borderWidth: 1, borderColor: theme.divider},
  optionChipActive: {backgroundColor: theme.primaryBg, borderColor: theme.primary},
  optionChipText: {fontSize: 13, color: theme.textSub, fontWeight: '600'},
  optionChipTextActive: {color: theme.primaryText, fontWeight: '700'},
  addrField: {
    borderWidth: 1, borderColor: theme.divider, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 14, backgroundColor: theme.bgSecondary,
    justifyContent: 'center', minHeight: 48,
  },
  timePickerRow: {flexDirection: 'row', gap: 12, marginTop: 8, marginBottom: 16},
  timeBox: {flex: 1, backgroundColor: theme.bgSecondary, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: theme.divider},
  timeLabel: {fontSize: 10, color: theme.textSub, fontWeight: '700', textTransform: 'uppercase', marginBottom: 4},
  timeValue: {fontSize: 14, color: theme.text, fontWeight: '700'},
  formButtons: {marginTop: 12, marginBottom: 24},
  formBtn: {paddingVertical: 14, borderRadius: 16, alignItems: 'center'},
  formBtnSubmit: {backgroundColor: theme.primary},
  formBtnSubmitText: {color: theme.btnPrimaryText, fontSize: 16, fontWeight: '800'},
  backBtnHeader: {paddingVertical: 4},
  backText: {fontSize: 15, color: theme.primaryText, fontWeight: '600'},
});
