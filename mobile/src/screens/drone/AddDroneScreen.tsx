import React, {useState} from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  SafeAreaView, ScrollView, Alert,
} from 'react-native';
import {droneService} from '../../services/drone';

export default function AddDroneScreen({navigation}: any) {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    brand: '',
    model: '',
    serial_number: '',
    max_load: '',
    max_flight_time: '',
    daily_price: '',
    description: '',
  });

  const handleSubmit = async () => {
    if (!form.brand || !form.model) {
      Alert.alert('提示', '请填写品牌和型号');
      return;
    }

    setLoading(true);
    try {
      await droneService.create({
        brand: form.brand,
        model: form.model,
        serial_number: form.serial_number,
        max_load: parseFloat(form.max_load) || 0,
        max_flight_time: parseFloat(form.max_flight_time) || 0,
        daily_price: parseFloat(form.daily_price) || 0,
        description: form.description,
      });
      Alert.alert('成功', '无人机添加成功', [
        {text: '确定', onPress: () => navigation.goBack()},
      ]);
    } catch (e: any) {
      Alert.alert('错误', e.message || '添加失败');
    } finally {
      setLoading(false);
    }
  };

  const renderInput = (label: string, key: keyof typeof form, placeholder: string, props?: any) => (
    <View style={styles.inputGroup}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={styles.input}
        placeholder={placeholder}
        value={form[key]}
        onChangeText={(text) => setForm({...form, [key]: text})}
        {...props}
      />
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scroll}>
        {renderInput('品牌 *', 'brand', '如：DJI、大疆')}
        {renderInput('型号 *', 'model', '如：Mavic 3 Pro')}
        {renderInput('序列号', 'serial_number', '无人机序列号')}
        {renderInput('最大载重(kg)', 'max_load', '如：2.5', {keyboardType: 'numeric'})}
        {renderInput('续航时间(分钟)', 'max_flight_time', '如：45', {keyboardType: 'numeric'})}
        {renderInput('日租金(元)', 'daily_price', '如：299', {keyboardType: 'numeric'})}
        
        <View style={styles.inputGroup}>
          <Text style={styles.label}>描述</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="描述无人机的特点、配置等"
            value={form.description}
            onChangeText={(text) => setForm({...form, description: text})}
            multiline
            numberOfLines={4}
          />
        </View>

        <TouchableOpacity 
          style={[styles.submitBtn, loading && styles.submitBtnDisabled]} 
          onPress={handleSubmit}
          disabled={loading}>
          <Text style={styles.submitBtnText}>{loading ? '提交中...' : '添加无人机'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#f5f5f5'},
  scroll: {padding: 16},
  inputGroup: {marginBottom: 16},
  label: {fontSize: 14, color: '#333', marginBottom: 8, fontWeight: '500'},
  input: {
    backgroundColor: '#fff', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 15, borderWidth: 1, borderColor: '#e8e8e8',
  },
  textArea: {height: 100, textAlignVertical: 'top'},
  submitBtn: {
    backgroundColor: '#1890ff', borderRadius: 8, paddingVertical: 14,
    alignItems: 'center', marginTop: 8,
  },
  submitBtnDisabled: {opacity: 0.6},
  submitBtnText: {color: '#fff', fontSize: 16, fontWeight: '600'},
});
