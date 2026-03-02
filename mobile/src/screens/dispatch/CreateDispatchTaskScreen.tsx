import React, {useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Alert,
  TextInput,
} from 'react-native';
import {
  createDispatchTask,
  CreateDispatchTaskRequest,
} from '../../services/dispatch';

const TASK_TYPES = [
  {label: '货物运输', value: 'cargo_delivery'},
  {label: '农业植保', value: 'agriculture'},
  {label: '航拍测绘', value: 'mapping'},
  {label: '巡检监测', value: 'inspection'},
  {label: '应急救援', value: 'emergency'},
  {label: '其他', value: 'other'},
];

const PRIORITY_OPTIONS = [
  {label: '普通', value: 'normal'},
  {label: '加急', value: 'urgent'},
  {label: '紧急', value: 'critical'},
];

export default function CreateDispatchTaskScreen({navigation, route}: any) {
  const [taskType, setTaskType] = useState('cargo_delivery');
  const [priority, setPriority] = useState('normal');
  const [pickupAddress, setPickupAddress] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [cargoWeight, setCargoWeight] = useState('');
  const [cargoDescription, setCargoDescription] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');
  const [maxBudget, setMaxBudget] = useState('');
  const [loading, setLoading] = useState(false);

  const validateDate = (dateStr: string): boolean => {
    return /^\d{4}-\d{2}-\d{2}( \d{2}:\d{2})?$/.test(dateStr);
  };

  const handleSubmit = async () => {
    if (!pickupAddress.trim()) {
      Alert.alert('提示', '请输入取货地址');
      return;
    }
    if (!deliveryAddress.trim()) {
      Alert.alert('提示', '请输入送达地址');
      return;
    }
    if (scheduledTime && !validateDate(scheduledTime)) {
      Alert.alert('提示', '预约时间格式不正确 (YYYY-MM-DD HH:MM)');
      return;
    }

    const data: CreateDispatchTaskRequest = {
      task_type: taskType,
      priority,
      pickup_address: pickupAddress.trim(),
      pickup_latitude: 0, // 实际应通过地图选点获取
      pickup_longitude: 0,
      delivery_address: deliveryAddress.trim(),
      delivery_latitude: 0,
      delivery_longitude: 0,
      cargo_weight: cargoWeight ? parseFloat(cargoWeight) : undefined,
      cargo_description: cargoDescription.trim() || undefined,
      scheduled_time: scheduledTime || undefined,
      max_budget: maxBudget ? Math.round(parseFloat(maxBudget) * 100) : undefined,
    };

    setLoading(true);
    try {
      await createDispatchTask(data);
      Alert.alert('成功', '派单任务已创建，系统正在为您匹配飞手', [
        {text: '确定', onPress: () => navigation.goBack()},
      ]);
    } catch (e: any) {
      Alert.alert('创建失败', e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>创建派单任务</Text>
        <Text style={styles.subtitle}>系统将自动匹配最优飞手</Text>

        {/* 任务类型 */}
        <Text style={styles.label}>任务类型</Text>
        <View style={styles.optionsWrap}>
          {TASK_TYPES.map(type => (
            <TouchableOpacity
              key={type.value}
              style={[styles.option, taskType === type.value && styles.optionActive]}
              onPress={() => setTaskType(type.value)}>
              <Text style={[styles.optionText, taskType === type.value && styles.optionTextActive]}>
                {type.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* 优先级 */}
        <Text style={styles.label}>优先级</Text>
        <View style={styles.optionsRow}>
          {PRIORITY_OPTIONS.map(p => (
            <TouchableOpacity
              key={p.value}
              style={[styles.priorityOption, priority === p.value && styles.priorityOptionActive]}
              onPress={() => setPriority(p.value)}>
              <Text style={[styles.priorityText, priority === p.value && styles.priorityTextActive]}>
                {p.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* 取货地址 */}
        <Text style={styles.label}>取货地址 *</Text>
        <TextInput
          style={styles.input}
          placeholder="请输入取货地址"
          value={pickupAddress}
          onChangeText={setPickupAddress}
        />

        {/* 送达地址 */}
        <Text style={styles.label}>送达地址 *</Text>
        <TextInput
          style={styles.input}
          placeholder="请输入送达地址"
          value={deliveryAddress}
          onChangeText={setDeliveryAddress}
        />

        {/* 货物重量 */}
        <Text style={styles.label}>货物重量 (kg)</Text>
        <TextInput
          style={styles.input}
          placeholder="选填，如: 5.5"
          value={cargoWeight}
          onChangeText={setCargoWeight}
          keyboardType="numeric"
        />

        {/* 货物描述 */}
        <Text style={styles.label}>货物描述</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="选填，描述货物类型和特殊要求"
          value={cargoDescription}
          onChangeText={setCargoDescription}
          multiline
          numberOfLines={3}
        />

        {/* 预约时间 */}
        <Text style={styles.label}>预约时间</Text>
        <TextInput
          style={styles.input}
          placeholder="YYYY-MM-DD HH:MM (选填，不填为立即派单)"
          value={scheduledTime}
          onChangeText={setScheduledTime}
        />

        {/* 预算上限 */}
        <Text style={styles.label}>预算上限 (元)</Text>
        <TextInput
          style={styles.input}
          placeholder="选填，不填则由系统定价"
          value={maxBudget}
          onChangeText={setMaxBudget}
          keyboardType="numeric"
        />

        <TouchableOpacity
          style={[styles.submitBtn, loading && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={loading}>
          <Text style={styles.submitBtnText}>
            {loading ? '提交中...' : '创建派单任务'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { padding: 20, paddingBottom: 40 },
  title: { fontSize: 22, fontWeight: 'bold', color: '#333', textAlign: 'center', marginBottom: 6 },
  subtitle: { fontSize: 14, color: '#666', textAlign: 'center', marginBottom: 20 },
  label: { fontSize: 14, fontWeight: '600', color: '#333', marginBottom: 8, marginTop: 16 },
  input: {
    height: 48, borderWidth: 1, borderColor: '#ddd', borderRadius: 8,
    paddingHorizontal: 16, fontSize: 16, backgroundColor: '#fafafa',
  },
  textArea: { height: 80, textAlignVertical: 'top', paddingTop: 12 },
  optionsWrap: { flexDirection: 'row', flexWrap: 'wrap' },
  option: {
    paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1,
    borderColor: '#ddd', borderRadius: 16, marginRight: 8, marginBottom: 8,
  },
  optionActive: { backgroundColor: '#1890ff', borderColor: '#1890ff' },
  optionText: { fontSize: 13, color: '#666' },
  optionTextActive: { color: '#fff' },
  optionsRow: { flexDirection: 'row', gap: 10 },
  priorityOption: {
    flex: 1, paddingVertical: 10, borderWidth: 1, borderColor: '#ddd',
    borderRadius: 8, alignItems: 'center',
  },
  priorityOptionActive: { backgroundColor: '#1890ff', borderColor: '#1890ff' },
  priorityText: { fontSize: 14, color: '#666' },
  priorityTextActive: { color: '#fff', fontWeight: '600' },
  submitBtn: {
    height: 50, backgroundColor: '#1890ff', borderRadius: 8,
    justifyContent: 'center', alignItems: 'center', marginTop: 32,
  },
  submitBtnDisabled: { backgroundColor: '#ccc' },
  submitBtnText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
});
