import React, {useState} from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  SafeAreaView, ScrollView, Alert, Platform,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import {orderService} from '../../services/order';
import {Drone} from '../../types';

export default function CreateOrderScreen({route, navigation}: any) {
  const {drone} = route.params;
  const [loading, setLoading] = useState(false);
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [remark, setRemark] = useState('');

  const formatDate = (date: Date | null) => {
    if (!date) return '';
    return date.toISOString().split('T')[0];
  };

  const calculateDays = () => {
    if (!startDate || !endDate) return 0;
    const diff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    return diff > 0 ? diff : 0;
  };

  const calculateTotal = () => {
    const days = calculateDays();
    return days * (drone.daily_price || 0);
  };

  const handleSubmit = async () => {
    if (!startDate || !endDate) {
      Alert.alert('提示', '请选择租赁开始和结束日期');
      return;
    }

    const days = calculateDays();
    if (days <= 0) {
      Alert.alert('提示', '结束日期必须晚于开始日期');
      return;
    }

    setLoading(true);
    try {
      const total = calculateTotal();
      const res = await orderService.create({
        order_type: 'rental',
        drone_id: drone.id,
        title: `租赁 ${drone.brand} ${drone.model}`,
        service_type: 'drone_rental',
        start_time: startDate.toISOString(),
        end_time: endDate.toISOString(),
        total_amount: total,
      });
      Alert.alert('成功', '订单创建成功', [
        {text: '查看订单', onPress: () => navigation.navigate('OrderDetail', {id: res.data.id})},
        {text: '返回', onPress: () => navigation.goBack()},
      ]);
    } catch (e: any) {
      Alert.alert('错误', e.message || '创建订单失败');
    } finally {
      setLoading(false);
    }
  };

  const onStartDateChange = (event: any, selectedDate?: Date) => {
    setShowStartPicker(Platform.OS === 'ios');
    if (selectedDate) {
      setStartDate(selectedDate);
    }
  };

  const onEndDateChange = (event: any, selectedDate?: Date) => {
    setShowEndPicker(Platform.OS === 'ios');
    if (selectedDate) {
      setEndDate(selectedDate);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scroll}>
        {/* Drone Info */}
        <View style={styles.droneCard}>
          <Text style={styles.droneName}>{drone.brand} {drone.model}</Text>
          <Text style={styles.dronePrice}>¥{(drone.daily_price / 100).toFixed(0)}/天</Text>
        </View>

        {/* Date Selection */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>租赁时间</Text>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>开始日期</Text>
            <TouchableOpacity style={styles.dateInput} onPress={() => setShowStartPicker(true)}>
              <Text style={startDate ? styles.dateText : styles.datePlaceholder}>
                {startDate ? formatDate(startDate) : '选择开始日期'}
              </Text>
            </TouchableOpacity>
            {showStartPicker && (
              <DateTimePicker
                value={startDate || new Date()}
                mode="date"
                display="default"
                onChange={onStartDateChange}
                minimumDate={new Date()}
              />
            )}
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>结束日期</Text>
            <TouchableOpacity style={styles.dateInput} onPress={() => setShowEndPicker(true)}>
              <Text style={endDate ? styles.dateText : styles.datePlaceholder}>
                {endDate ? formatDate(endDate) : '选择结束日期'}
              </Text>
            </TouchableOpacity>
            {showEndPicker && (
              <DateTimePicker
                value={endDate || new Date()}
                mode="date"
                display="default"
                onChange={onEndDateChange}
                minimumDate={startDate || new Date()}
              />
            )}
          </View>
          {calculateDays() > 0 && (
            <Text style={styles.daysText}>共 {calculateDays()} 天</Text>
          )}
        </View>

        {/* Remark */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>备注</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="填写备注信息（可选）"
            value={remark}
            onChangeText={setRemark}
            multiline
            numberOfLines={3}
          />
        </View>

        {/* Price Summary */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>费用明细</Text>
          <View style={styles.priceRow}>
            <Text style={styles.priceLabel}>租金 ({calculateDays()}天)</Text>
            <Text style={styles.priceValue}>¥{(calculateTotal() / 100).toFixed(2)}</Text>
          </View>
          <View style={styles.priceRow}>
            <Text style={styles.priceLabel}>压金</Text>
            <Text style={styles.priceValue}>¥{((drone.deposit || 0) / 100).toFixed(2)}</Text>
          </View>
          <View style={[styles.priceRow, styles.totalRow]}>
            <Text style={styles.totalLabel}>合计</Text>
            <Text style={styles.totalValue}>¥{((calculateTotal() + (drone.deposit || 0)) / 100).toFixed(2)}</Text>
          </View>
        </View>
      </ScrollView>

      {/* Submit Button */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.submitBtn, loading && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={loading}>
          <Text style={styles.submitBtnText}>
            {loading ? '创建中...' : '确认租赁'}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#f5f5f5'},
  scroll: {flex: 1},
  droneCard: {
    backgroundColor: '#fff', padding: 16, marginBottom: 10,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  droneName: {fontSize: 16, fontWeight: 'bold', color: '#333'},
  dronePrice: {fontSize: 16, color: '#f5222d', fontWeight: '600'},
  section: {
    backgroundColor: '#fff', marginBottom: 10, padding: 16,
  },
  sectionTitle: {fontSize: 16, fontWeight: 'bold', color: '#333', marginBottom: 12},
  inputGroup: {marginBottom: 12},
  label: {fontSize: 14, color: '#666', marginBottom: 6},
  input: {
    borderWidth: 1, borderColor: '#e8e8e8', borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 15,
  },
  dateInput: {
    borderWidth: 1, borderColor: '#e8e8e8', borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 14, fontSize: 15,
    backgroundColor: '#fff',
  },
  dateText: {fontSize: 15, color: '#333'},
  datePlaceholder: {fontSize: 15, color: '#999'},
  textArea: {height: 80, textAlignVertical: 'top'},
  daysText: {fontSize: 14, color: '#1890ff', marginTop: 8},
  priceRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f5f5f5',
  },
  priceLabel: {fontSize: 14, color: '#666'},
  priceValue: {fontSize: 14, color: '#333'},
  totalRow: {borderBottomWidth: 0, marginTop: 8, paddingTop: 8},
  totalLabel: {fontSize: 16, fontWeight: 'bold', color: '#333'},
  totalValue: {fontSize: 18, fontWeight: 'bold', color: '#f5222d'},
  footer: {
    backgroundColor: '#fff', padding: 12, borderTopWidth: 1, borderTopColor: '#e8e8e8',
  },
  submitBtn: {
    backgroundColor: '#1890ff', borderRadius: 8, paddingVertical: 14, alignItems: 'center',
  },
  submitBtnDisabled: {opacity: 0.6},
  submitBtnText: {color: '#fff', fontSize: 16, fontWeight: '600'},
});
