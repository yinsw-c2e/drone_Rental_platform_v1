import React, {useState, useCallback} from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  FlatList,
  TouchableOpacity,
  Alert,
  RefreshControl,
  TextInput,
  Modal,
  ScrollView,
} from 'react-native';
import {useFocusEffect} from '@react-navigation/native';
import api from '../../services/api';

interface MaintenanceLog {
  id: number;
  drone_id: number;
  maintenance_type: string;
  description: string;
  cost: number;
  performed_by: string;
  performed_at: string;
  next_maintenance_date: string;
  created_at: string;
}

const MAINTENANCE_TYPES = [
  {label: '定期保养', value: 'regular'},
  {label: '故障维修', value: 'repair'},
  {label: '部件更换', value: 'replacement'},
  {label: '固件升级', value: 'firmware'},
  {label: '飞行前检查', value: 'pre_flight'},
  {label: '其他', value: 'other'},
];

export default function DroneMaintenanceLogScreen({route, navigation}: any) {
  const droneId = route.params?.id;
  const [logs, setLogs] = useState<MaintenanceLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // 表单字段
  const [maintenanceType, setMaintenanceType] = useState('regular');
  const [description, setDescription] = useState('');
  const [cost, setCost] = useState('');
  const [performedBy, setPerformedBy] = useState('');
  const [performedAt, setPerformedAt] = useState('');
  const [nextDate, setNextDate] = useState('');

  const loadData = async () => {
    try {
      const res: any = await api.get(`/drone/${droneId}/maintenance`, {
        params: {page: 1, page_size: 50},
      });
      setLogs(res.data?.list || []);
    } catch (e: any) {
      Alert.alert('错误', e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      if (droneId) {
        loadData();
      }
    }, [droneId]),
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const resetForm = () => {
    setMaintenanceType('regular');
    setDescription('');
    setCost('');
    setPerformedBy('');
    setPerformedAt('');
    setNextDate('');
  };

  const validateDate = (dateStr: string): boolean => {
    return /^\d{4}-\d{2}-\d{2}$/.test(dateStr);
  };

  const getTypeLabel = (value: string): string => {
    const found = MAINTENANCE_TYPES.find(t => t.value === value);
    return found?.label || value;
  };

  const handleSubmit = async () => {
    if (!description.trim()) {
      Alert.alert('提示', '请输入维护描述');
      return;
    }
    if (!performedAt || !validateDate(performedAt)) {
      Alert.alert('提示', '请输入正确的维护日期 (YYYY-MM-DD)');
      return;
    }

    setSubmitting(true);
    try {
      await api.post(`/drone/${droneId}/maintenance`, {
        maintenance_type: maintenanceType,
        description: description.trim(),
        cost: cost ? Math.round(parseFloat(cost) * 100) : 0,
        performed_by: performedBy.trim(),
        performed_at: performedAt,
        next_maintenance_date: nextDate || undefined,
      });
      Alert.alert('成功', '维护记录已添加');
      setShowModal(false);
      resetForm();
      loadData();
    } catch (e: any) {
      Alert.alert('添加失败', e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const renderItem = ({item}: {item: MaintenanceLog}) => (
    <View style={styles.logCard}>
      <View style={styles.logHeader}>
        <Text style={styles.logDate}>{item.performed_at?.substring(0, 10)}</Text>
        <View style={styles.typeBadge}>
          <Text style={styles.typeText}>{getTypeLabel(item.maintenance_type)}</Text>
        </View>
      </View>
      <Text style={styles.logDescription}>{item.description}</Text>
      <View style={styles.logFooter}>
        {item.performed_by && (
          <Text style={styles.logMeta}>执行人: {item.performed_by}</Text>
        )}
        {item.cost > 0 && (
          <Text style={styles.logCost}>费用: ¥{(item.cost / 100).toFixed(2)}</Text>
        )}
      </View>
      {item.next_maintenance_date && (
        <Text style={styles.nextDate}>
          下次维护: {item.next_maintenance_date.substring(0, 10)}
        </Text>
      )}
    </View>
  );

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyText}>暂无维护记录</Text>
      <Text style={styles.emptySubText}>定期维护保养可以延长无人机使用寿命</Text>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>加载中...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        data={logs}
        renderItem={renderItem}
        keyExtractor={item => item.id?.toString() || Math.random().toString()}
        ListHeaderComponent={
          <TouchableOpacity
            style={styles.addBtn}
            onPress={() => {
              resetForm();
              setShowModal(true);
            }}>
            <Text style={styles.addBtnIcon}>+</Text>
            <Text style={styles.addBtnText}>添加维护记录</Text>
          </TouchableOpacity>
        }
        ListEmptyComponent={renderEmpty}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        contentContainerStyle={styles.listContent}
      />

      {/* 添加维护记录弹窗 */}
      <Modal
        visible={showModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>添加维护记录</Text>
              <TouchableOpacity onPress={() => setShowModal(false)}>
                <Text style={styles.modalClose}>×</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              {/* 维护类型 */}
              <Text style={styles.label}>维护类型</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.typeContainer}>
                  {MAINTENANCE_TYPES.map(type => (
                    <TouchableOpacity
                      key={type.value}
                      style={[
                        styles.typeOption,
                        maintenanceType === type.value && styles.typeOptionActive,
                      ]}
                      onPress={() => setMaintenanceType(type.value)}>
                      <Text
                        style={[
                          styles.typeOptionText,
                          maintenanceType === type.value && styles.typeOptionTextActive,
                        ]}>
                        {type.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>

              {/* 维护描述 */}
              <Text style={styles.label}>维护描述 *</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="请描述维护内容"
                value={description}
                onChangeText={setDescription}
                multiline
                numberOfLines={3}
              />

              {/* 维护日期 */}
              <Text style={styles.label}>维护日期 *</Text>
              <TextInput
                style={styles.input}
                placeholder="YYYY-MM-DD"
                value={performedAt}
                onChangeText={setPerformedAt}
              />

              {/* 执行人 */}
              <Text style={styles.label}>执行人</Text>
              <TextInput
                style={styles.input}
                placeholder="选填"
                value={performedBy}
                onChangeText={setPerformedBy}
              />

              {/* 费用 */}
              <Text style={styles.label}>费用 (元)</Text>
              <TextInput
                style={styles.input}
                placeholder="选填"
                value={cost}
                onChangeText={setCost}
                keyboardType="numeric"
              />

              {/* 下次维护日期 */}
              <Text style={styles.label}>下次维护日期</Text>
              <TextInput
                style={styles.input}
                placeholder="YYYY-MM-DD (选填)"
                value={nextDate}
                onChangeText={setNextDate}
              />

              {/* 提交 */}
              <TouchableOpacity
                style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
                onPress={handleSubmit}
                disabled={submitting}>
                <Text style={styles.submitBtnText}>
                  {submitting ? '提交中...' : '保存记录'}
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
  },
  listContent: {
    paddingBottom: 24,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1890ff',
    marginHorizontal: 16,
    marginTop: 16,
    paddingVertical: 14,
    borderRadius: 8,
  },
  addBtnIcon: {
    fontSize: 20,
    color: '#fff',
    marginRight: 8,
  },
  addBtnText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
  },
  emptyContainer: {
    paddingTop: 60,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    marginBottom: 8,
  },
  emptySubText: {
    fontSize: 14,
    color: '#999',
  },
  logCard: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 12,
    padding: 16,
  },
  logHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  logDate: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
  },
  typeBadge: {
    backgroundColor: '#e6f7ff',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  typeText: {
    fontSize: 12,
    color: '#1890ff',
    fontWeight: '500',
  },
  logDescription: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
  },
  logFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  logMeta: {
    fontSize: 12,
    color: '#999',
  },
  logCost: {
    fontSize: 13,
    color: '#f5222d',
    fontWeight: '500',
  },
  nextDate: {
    fontSize: 12,
    color: '#1890ff',
    marginTop: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  modalClose: {
    fontSize: 28,
    color: '#999',
  },
  modalBody: {
    padding: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
    marginTop: 14,
  },
  input: {
    height: 48,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 16,
    fontSize: 16,
    backgroundColor: '#fafafa',
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
    paddingTop: 12,
  },
  typeContainer: {
    flexDirection: 'row',
    paddingVertical: 4,
  },
  typeOption: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 16,
    marginRight: 8,
  },
  typeOptionActive: {
    backgroundColor: '#1890ff',
    borderColor: '#1890ff',
  },
  typeOptionText: {
    fontSize: 13,
    color: '#666',
  },
  typeOptionTextActive: {
    color: '#fff',
  },
  submitBtn: {
    height: 50,
    backgroundColor: '#1890ff',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 40,
  },
  submitBtnDisabled: {
    backgroundColor: '#ccc',
  },
  submitBtnText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
});
