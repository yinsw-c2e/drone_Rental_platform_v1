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
import {getPilotProfile} from '../../services/pilot';
import AddressInputField from '../../components/AddressInputField';
import {AddressData} from '../../types';

const STATUS_MAP: Record<string, {label: string; color: string}> = {
  draft: {label: '草稿', color: '#999'},
  pending_review: {label: '待审核', color: '#faad14'},
  approved: {label: '已批准', color: '#52c41a'},
  rejected: {label: '已拒绝', color: '#ff4d4f'},
  submitted_to_uom: {label: '已提交UOM', color: '#1890ff'},
  cancelled: {label: '已取消', color: '#999'},
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
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [routeDesc, setRouteDesc] = useState('');

  const droneId = route?.params?.droneId || 0;
  const orderId = route?.params?.orderId || 0;

  useEffect(() => {
    loadPilotInfo();
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (pilotId > 0) {
        loadApplications();
      }
    }, [pilotId]),
  );

  const loadPilotInfo = async () => {
    try {
      const profile = await getPilotProfile();
      setPilotId(profile.id);
    } catch {
      Alert.alert('提示', '请先完成飞手认证');
    }
  };

  const loadApplications = async () => {
    try {
      const result = await listMyApplications(pilotId);
      setApplications(result.data || []);
    } catch (err: any) {
      console.log('加载申请列表失败:', err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleCreate = async () => {
    if (!planName.trim()) return Alert.alert('提示', '请输入飞行计划名称');
    if (!departureAddr) return Alert.alert('提示', '请选择起飞地址');
    if (!arrivalAddr) return Alert.alert('提示', '请选择降落地址');
    if (!startTime.trim()) return Alert.alert('提示', '请输入计划起飞时间');
    if (!endTime.trim()) return Alert.alert('提示', '请输入计划结束时间');

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
        planned_start_time: startTime,
        planned_end_time: endTime,
        route_description: routeDesc,
      };
      await createApplication(req);
      Alert.alert('成功', '空域申请已创建');
      setMode('list');
      resetForm();
      loadApplications();
    } catch (err: any) {
      Alert.alert('创建失败', err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitReview = async (id: number) => {
    Alert.alert('提交审核', '确定要提交此空域申请进行审核吗？提交前会自动执行合规性检查。', [
      {text: '取消', style: 'cancel'},
      {
        text: '确认提交',
        onPress: async () => {
          try {
            await submitForReview(id, pilotId);
            Alert.alert('成功', '已提交审核');
            loadApplications();
          } catch (err: any) {
            Alert.alert('提交失败', err.message);
          }
        },
      },
    ]);
  };

  const handleCancel = async (id: number) => {
    Alert.alert('取消申请', '确定要取消此空域申请吗？', [
      {text: '保留', style: 'cancel'},
      {
        text: '确认取消',
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
    setStartTime('');
    setEndTime('');
    setRouteDesc('');
  };

  const renderApplicationItem = ({item}: {item: AirspaceApplication}) => {
    const statusInfo = STATUS_MAP[item.status] || {label: item.status, color: '#999'};
    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => navigation.navigate('ComplianceCheck', {applicationId: item.id, pilotId, droneId: item.drone_id})}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle} numberOfLines={1}>{item.flight_plan_name || '未命名飞行计划'}</Text>
          <View style={[styles.statusBadge, {backgroundColor: statusInfo.color + '20'}]}>
            <Text style={[styles.statusText, {color: statusInfo.color}]}>{statusInfo.label}</Text>
          </View>
        </View>

        <View style={styles.cardBody}>
          <Text style={styles.cardInfo}>用途: {PURPOSE_OPTIONS.find(p => p.value === item.flight_purpose)?.label || item.flight_purpose}</Text>
          <Text style={styles.cardInfo}>起飞: {item.departure_address || '未设置'}</Text>
          <Text style={styles.cardInfo}>降落: {item.arrival_address || '未设置'}</Text>
          <Text style={styles.cardInfo}>高度: {item.max_altitude}m</Text>
          {item.uom_application_no ? (
            <Text style={styles.cardInfo}>UOM编号: {item.uom_application_no}</Text>
          ) : null}
        </View>

        <View style={styles.cardFooter}>
          <Text style={styles.timeText}>
            {item.created_at ? new Date(item.created_at).toLocaleDateString() : ''}
          </Text>
          <View style={styles.actionButtons}>
            {item.status === 'draft' && (
              <>
                <TouchableOpacity
                  style={[styles.actionBtn, styles.submitBtn]}
                  onPress={() => handleSubmitReview(item.id)}>
                  <Text style={styles.submitBtnText}>提交审核</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionBtn, styles.cancelBtn]}
                  onPress={() => handleCancel(item.id)}>
                  <Text style={styles.cancelBtnText}>取消</Text>
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
      <SafeAreaView style={styles.container}>
        <ScrollView style={styles.form} showsVerticalScrollIndicator={false}>
          <Text style={styles.sectionTitle}>飞行计划信息</Text>

          <Text style={styles.label}>计划名称 *</Text>
          <TextInput style={styles.input} placeholder="例: 成都XX区货运飞行" value={planName} onChangeText={setPlanName} />

          <Text style={styles.label}>飞行用途 *</Text>
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

          <Text style={styles.sectionTitle}>起飞点</Text>
          <Text style={styles.label}>地址 *</Text>
          <AddressInputField
            value={departureAddr}
            placeholder="点击选择起飞地址"
            onSelect={setDepartureAddr}
            style={styles.addrField}
          />

          <Text style={styles.sectionTitle}>降落点</Text>
          <Text style={styles.label}>地址 *</Text>
          <AddressInputField
            value={arrivalAddr}
            placeholder="点击选择降落地址"
            onSelect={setArrivalAddr}
            style={styles.addrField}
          />

          <Text style={styles.sectionTitle}>飞行参数</Text>
          <Text style={styles.label}>最大飞行高度(米)</Text>
          <TextInput style={styles.input} placeholder="120" keyboardType="number-pad" value={maxAltitudeStr} onChangeText={setMaxAltitudeStr} />

          <Text style={styles.label}>计划起飞时间 * (YYYY-MM-DD HH:MM)</Text>
          <TextInput style={styles.input} placeholder="2026-03-05 09:00" value={startTime} onChangeText={setStartTime} />

          <Text style={styles.label}>计划结束时间 * (YYYY-MM-DD HH:MM)</Text>
          <TextInput style={styles.input} placeholder="2026-03-05 11:00" value={endTime} onChangeText={setEndTime} />

          <Text style={styles.label}>航线描述</Text>
          <TextInput style={[styles.input, styles.textArea]} placeholder="描述计划飞行航线" value={routeDesc} onChangeText={setRouteDesc} multiline numberOfLines={3} />

          <View style={styles.formButtons}>
            <TouchableOpacity style={[styles.formBtn, styles.formBtnCancel]} onPress={() => {setMode('list'); resetForm();}}>
              <Text style={styles.formBtnCancelText}>取消</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.formBtn, styles.formBtnSubmit]} onPress={handleCreate} disabled={submitting}>
              <Text style={styles.formBtnSubmitText}>{submitting ? '提交中...' : '创建申请'}</Text>
            </TouchableOpacity>
          </View>

          <View style={{height: 40}} />
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>空域申请管理</Text>
        <TouchableOpacity style={styles.createBtn} onPress={() => setMode('create')}>
          <Text style={styles.createBtnText}>+ 新建申请</Text>
        </TouchableOpacity>
      </View>

      {applications.length === 0 && !loading ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>暂无空域申请记录</Text>
          <Text style={styles.emptySubText}>点击右上角"新建申请"开始</Text>
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

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#f5f5f5'},
  header: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#fff', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#e8e8e8'},
  headerTitle: {fontSize: 18, fontWeight: '600', color: '#333'},
  createBtn: {backgroundColor: '#1890ff', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6},
  createBtnText: {color: '#fff', fontSize: 14, fontWeight: '500'},
  listContent: {padding: 16},
  card: {backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 12, shadowColor: '#000', shadowOffset: {width: 0, height: 1}, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2},
  cardHeader: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10},
  cardTitle: {fontSize: 16, fontWeight: '600', color: '#333', flex: 1, marginRight: 8},
  statusBadge: {paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4},
  statusText: {fontSize: 12, fontWeight: '500'},
  cardBody: {marginBottom: 10},
  cardInfo: {fontSize: 13, color: '#666', marginBottom: 4},
  cardFooter: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#f0f0f0', paddingTop: 10},
  timeText: {fontSize: 12, color: '#999'},
  actionButtons: {flexDirection: 'row', gap: 8},
  actionBtn: {paddingHorizontal: 12, paddingVertical: 5, borderRadius: 4},
  submitBtn: {backgroundColor: '#1890ff'},
  submitBtnText: {color: '#fff', fontSize: 12, fontWeight: '500'},
  cancelBtn: {backgroundColor: '#f5f5f5', borderWidth: 1, borderColor: '#d9d9d9'},
  cancelBtnText: {color: '#666', fontSize: 12},
  empty: {flex: 1, justifyContent: 'center', alignItems: 'center'},
  emptyText: {fontSize: 16, color: '#999', marginBottom: 8},
  emptySubText: {fontSize: 13, color: '#ccc'},

  // Form styles
  form: {flex: 1, padding: 16},
  sectionTitle: {fontSize: 16, fontWeight: '600', color: '#333', marginTop: 16, marginBottom: 8},
  label: {fontSize: 13, color: '#666', marginBottom: 4, marginTop: 8},
  input: {backgroundColor: '#fff', borderWidth: 1, borderColor: '#d9d9d9', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: '#333'},
  textArea: {minHeight: 80, textAlignVertical: 'top'},
  optionRow: {flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4},
  optionChip: {paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, backgroundColor: '#f5f5f5', borderWidth: 1, borderColor: '#d9d9d9'},
  optionChipActive: {backgroundColor: '#e6f7ff', borderColor: '#1890ff'},
  optionChipText: {fontSize: 13, color: '#666'},
  optionChipTextActive: {color: '#1890ff'},
  addrField: {
    borderWidth: 1, borderColor: '#d9d9d9', borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 14, backgroundColor: '#fff',
    justifyContent: 'center', minHeight: 46,
  },
  coordRow: {flexDirection: 'row', gap: 12},
  coordInput: {flex: 1},
  formButtons: {flexDirection: 'row', gap: 12, marginTop: 24},
  formBtn: {flex: 1, paddingVertical: 12, borderRadius: 8, alignItems: 'center'},
  formBtnCancel: {backgroundColor: '#f5f5f5', borderWidth: 1, borderColor: '#d9d9d9'},
  formBtnCancelText: {color: '#666', fontSize: 15, fontWeight: '500'},
  formBtnSubmit: {backgroundColor: '#1890ff'},
  formBtnSubmitText: {color: '#fff', fontSize: 15, fontWeight: '500'},
});
