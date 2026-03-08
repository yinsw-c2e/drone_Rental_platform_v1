import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Alert,
  TextInput,
  Modal,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import {
  createDispatchTask,
  CreateDispatchTaskRequest,
} from '../../services/dispatch';
import {listCargoDeclarations, CargoDeclaration} from '../../services/client';
import AddressInputField from '../../components/AddressInputField';
import {AddressData} from '../../types';

const CATEGORY_MAP: Record<string, string> = {
  normal: '普通货物', valuable: '贵重物品', fragile: '易碎品',
  hazardous: '危险品', perishable: '生鲜', medical: '医疗用品',
};

const TASK_TYPES = [
  {label: '货物运输', value: 'cargo_delivery'},
  {label: '农业植保', value: 'agriculture'},
  {label: '航拍测绘', value: 'mapping'},
  {label: '巡检监测', value: 'inspection'},
  {label: '应急救援', value: 'emergency'},
  {label: '其他', value: 'other'},
];

const PRIORITY_OPTIONS = [
  {label: '普通', value: 'normal', num: 5},
  {label: '加急', value: 'urgent', num: 8},
  {label: '紧急', value: 'critical', num: 10},
];

const PRIORITY_NUM: Record<string, number> = {normal: 5, urgent: 8, critical: 10};

export default function CreateDispatchTaskScreen({navigation, route}: any) {
  const [taskType, setTaskType] = useState('cargo_delivery');
  const [priority, setPriority] = useState('normal');
  const [pickupAddr, setPickupAddr] = useState<AddressData | null>(null);
  const [deliveryAddr, setDeliveryAddr] = useState<AddressData | null>(null);
  const [cargoWeight, setCargoWeight] = useState('');
  const [cargoDescription, setCargoDescription] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');
  const [maxBudget, setMaxBudget] = useState('');
  const [loading, setLoading] = useState(false);

  // 货物申报选择
  const [selectedDeclaration, setSelectedDeclaration] = useState<CargoDeclaration | null>(null);
  const [declarationModalVisible, setDeclarationModalVisible] = useState(false);
  const [declarations, setDeclarations] = useState<CargoDeclaration[]>([]);
  const [loadingDeclarations, setLoadingDeclarations] = useState(false);

  const loadDeclarations = async () => {
    setLoadingDeclarations(true);
    try {
      const res = await listCargoDeclarations({page: 1, page_size: 50});
      // 只显示已通过审核的
      setDeclarations((res.list || []).filter(d => d.compliance_status === 'approved'));
    } catch {
      setDeclarations([]);
    } finally {
      setLoadingDeclarations(false);
    }
  };

  const handleSelectDeclaration = (decl: CargoDeclaration) => {
    setSelectedDeclaration(decl);
    // 自动填充货物信息
    setCargoWeight(String(decl.total_weight || ''));
    setCargoDescription(
      [decl.cargo_name, decl.cargo_description].filter(Boolean).join('，'),
    );
    setDeclarationModalVisible(false);
  };

  const handleClearDeclaration = () => {
    setSelectedDeclaration(null);
    setCargoWeight('');
    setCargoDescription('');
  };

  const validateDate = (dateStr: string): boolean => {
    return /^\d{4}-\d{2}-\d{2}( \d{2}:\d{2})?$/.test(dateStr);
  };

  const handleSubmit = async () => {
    if (!pickupAddr) {
      Alert.alert('提示', '请选择取货地址');
      return;
    }
    if (!deliveryAddr) {
      Alert.alert('提示', '请选择送达地址');
      return;
    }
    if (scheduledTime && !validateDate(scheduledTime)) {
      Alert.alert('提示', '预约时间格式不正确 (YYYY-MM-DD HH:MM)');
      return;
    }

    const data: CreateDispatchTaskRequest = {
      task_type: taskType,
      priority: PRIORITY_NUM[priority] ?? 5,
      pickup_address: pickupAddr.address || pickupAddr.name || '',
      pickup_latitude: pickupAddr.latitude || 0,
      pickup_longitude: pickupAddr.longitude || 0,
      delivery_address: deliveryAddr.address || deliveryAddr.name || '',
      delivery_latitude: deliveryAddr.latitude || 0,
      delivery_longitude: deliveryAddr.longitude || 0,
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

        {/* 货物申报关联 */}
        <Text style={styles.label}>关联已申报货物（选填）</Text>
        {selectedDeclaration ? (
          <View style={styles.declCard}>
            <View style={{flex: 1}}>
              <Text style={styles.declName}>{selectedDeclaration.cargo_name}</Text>
              <Text style={styles.declInfo}>
                {CATEGORY_MAP[selectedDeclaration.cargo_category] || selectedDeclaration.cargo_category}
                {' · '}{selectedDeclaration.total_weight}kg
                {' · '}申报单号：{selectedDeclaration.declaration_no}
              </Text>
            </View>
            <TouchableOpacity onPress={handleClearDeclaration} style={styles.declClearBtn}>
              <Text style={styles.declClearText}>清除</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            style={styles.declSelectBtn}
            onPress={() => {
              loadDeclarations();
              setDeclarationModalVisible(true);
            }}>
            <Text style={styles.declSelectText}>📦 点击选择已申报货物，自动填充货物信息</Text>
            <Text style={styles.arrow}>&#8250;</Text>
          </TouchableOpacity>
        )}

        {/* 取货地址 */}
        <Text style={styles.label}>取货地址 *</Text>
        <AddressInputField
          value={pickupAddr}
          placeholder="点击选择取货地址"
          onSelect={setPickupAddr}
          style={styles.addrField}
        />

        {/* 送达地址 */}
        <Text style={styles.label}>送达地址 *</Text>
        <AddressInputField
          value={deliveryAddr}
          placeholder="点击选择送达地址"
          onSelect={setDeliveryAddr}
          style={styles.addrField}
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

      {/* 货物申报选择弹窗 */}
      <Modal
        visible={declarationModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setDeclarationModalVisible(false)}>
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>选择已申报货物</Text>
            <TouchableOpacity onPress={() => setDeclarationModalVisible(false)}>
              <Text style={styles.modalClose}>关闭</Text>
            </TouchableOpacity>
          </View>
          {loadingDeclarations ? (
            <ActivityIndicator size="large" color="#1890ff" style={{marginTop: 40}} />
          ) : declarations.length === 0 ? (
            <View style={styles.modalEmpty}>
              <Text style={styles.modalEmptyText}>暂无已审核通过的货物申报</Text>
              <Text style={styles.modalEmptyHint}>请先到「客户中心 - 货物申报」提交并审核通过</Text>
            </View>
          ) : (
            <FlatList
              data={declarations}
              keyExtractor={item => String(item.id)}
              contentContainerStyle={{padding: 16}}
              renderItem={({item}) => (
                <TouchableOpacity
                  style={styles.modalItem}
                  onPress={() => handleSelectDeclaration(item)}>
                  <View style={styles.modalItemLeft}>
                    <Text style={styles.modalItemName}>{item.cargo_name}</Text>
                    <Text style={styles.modalItemInfo}>
                      {CATEGORY_MAP[item.cargo_category] || item.cargo_category}
                      {' · '}{item.total_weight}kg
                    </Text>
                    <Text style={styles.modalItemNo}>申报单号：{item.declaration_no}</Text>
                  </View>
                  <Text style={styles.modalItemArrow}>&#8250;</Text>
                </TouchableOpacity>
              )}
            />
          )}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  addrField: {
    height: 56, borderWidth: 1, borderColor: '#ddd', borderRadius: 8,
    paddingHorizontal: 16, backgroundColor: '#fafafa',
    justifyContent: 'center',
  },
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

  // 货物申报选择
  declSelectBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderWidth: 1, borderColor: '#ddd', borderRadius: 8, borderStyle: 'dashed',
    paddingHorizontal: 16, paddingVertical: 14, backgroundColor: '#f9f9f9',
  },
  declSelectText: { fontSize: 14, color: '#888', flex: 1 },
  arrow: { fontSize: 20, color: '#ccc', marginLeft: 4 },
  declCard: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderColor: '#91d5ff', borderRadius: 8,
    paddingHorizontal: 14, paddingVertical: 12, backgroundColor: '#e6f7ff',
  },
  declName: { fontSize: 15, fontWeight: '600', color: '#1890ff', marginBottom: 4 },
  declInfo: { fontSize: 12, color: '#666' },
  declClearBtn: { paddingHorizontal: 10, paddingVertical: 4 },
  declClearText: { fontSize: 13, color: '#ff4d4f' },

  // 弹窗样式
  modalContainer: { flex: 1, backgroundColor: '#fff' },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: '#f0f0f0',
  },
  modalTitle: { fontSize: 17, fontWeight: '600', color: '#333' },
  modalClose: { fontSize: 15, color: '#1890ff' },
  modalEmpty: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  modalEmptyText: { fontSize: 16, color: '#999', marginBottom: 8 },
  modalEmptyHint: { fontSize: 13, color: '#ccc', textAlign: 'center' },
  modalItem: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 14, paddingHorizontal: 4,
    borderBottomWidth: 1, borderBottomColor: '#f5f5f5',
  },
  modalItemLeft: { flex: 1 },
  modalItemName: { fontSize: 15, fontWeight: '600', color: '#333', marginBottom: 4 },
  modalItemInfo: { fontSize: 13, color: '#666', marginBottom: 2 },
  modalItemNo: { fontSize: 12, color: '#999' },
  modalItemArrow: { fontSize: 20, color: '#ccc', marginLeft: 8 },
});
