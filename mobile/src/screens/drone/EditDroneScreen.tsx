import React, {useEffect, useState} from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  SafeAreaView, ScrollView, Alert, ActivityIndicator,
} from 'react-native';
import {droneService} from '../../services/drone';

export default function EditDroneScreen({navigation, route}: any) {
  const {id} = route.params;
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    brand: '',
    model: '',
    serial_number: '',
    mtow_kg: '',
    max_payload_kg: '',
    max_flight_time: '',
    daily_price: '',
    hourly_price: '',
    deposit: '',
    description: '',
    city: '',
  });

  useEffect(() => {
    (async () => {
      try {
        const res = await droneService.getById(id);
        const d = res.data;
        setForm({
          brand: d.brand || '',
          model: d.model || '',
          serial_number: d.serial_number || '',
          mtow_kg: d.mtow_kg ? String(d.mtow_kg) : '',
          max_payload_kg: d.max_payload_kg ? String(d.max_payload_kg) : (d.max_load ? String(d.max_load) : ''),
          max_flight_time: d.max_flight_time ? String(d.max_flight_time) : '',
          daily_price: d.daily_price ? String(d.daily_price / 100) : '',
          hourly_price: d.hourly_price ? String(d.hourly_price / 100) : '',
          deposit: d.deposit ? String(d.deposit / 100) : '',
          description: d.description || '',
          city: d.city || '',
        });
      } catch (e: any) {
        Alert.alert('加载失败', e.message || '无法获取无人机信息');
        navigation.goBack();
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const handleSubmit = async () => {
    if (!form.brand || !form.model) {
      Alert.alert('提示', '请填写品牌和型号');
      return;
    }
    setSaving(true);
    try {
      await droneService.update(id, {
        brand: form.brand,
        model: form.model,
        serial_number: form.serial_number,
        mtow_kg: parseFloat(form.mtow_kg) || 0,
        max_payload_kg: parseFloat(form.max_payload_kg) || 0,
        max_load: parseFloat(form.max_payload_kg) || 0,
        max_flight_time: parseFloat(form.max_flight_time) || 0,
        daily_price: (parseFloat(form.daily_price) || 0) * 100,
        hourly_price: (parseFloat(form.hourly_price) || 0) * 100,
        deposit: (parseFloat(form.deposit) || 0) * 100,
        description: form.description,
        city: form.city,
      });
      Alert.alert('保存成功', '', [{text: '确定', onPress: () => navigation.goBack()}]);
    } catch (e: any) {
      Alert.alert('保存失败', e.message || '请稍后重试');
    } finally {
      setSaving(false);
    }
  };

  const field = (label: string, key: keyof typeof form, placeholder: string, numeric?: boolean) => (
    <View style={styles.group}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={styles.input}
        placeholder={placeholder}
        value={form[key]}
        onChangeText={v => setForm(prev => ({...prev, [key]: v}))}
        keyboardType={numeric ? 'numeric' : 'default'}
      />
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator style={{marginTop: 80}} color="#1890ff" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scroll}>
        <View style={styles.warningBox}>
          <Text style={styles.warningText}>⚠️ 修改品牌、型号、序列号、MTOW或最大载重后，基础资质审核将重置为"待审核"，需重新通过审核后方可接单。</Text>
        </View>
        {field('品牌 *', 'brand', '如：大疆 DJI')}
        {field('型号 *', 'model', '如：FPV、FlyCart 30')}
        {field('序列号', 'serial_number', '无人机序列号')}
        {field('城市', 'city', '如：佛山')}
        {field('最大起飞重量 MTOW (kg)', 'mtow_kg', '如：200', true)}
        {field('最大载重 Payload (kg)', 'max_payload_kg', '如：80', true)}
        {field('续航时间 (分钟)', 'max_flight_time', '如：45', true)}
        {field('日租金 (元)', 'daily_price', '如：299', true)}
        {field('时租金 (元)', 'hourly_price', '如：50', true)}
        {field('押金 (元)', 'deposit', '如：500', true)}

        <View style={styles.group}>
          <Text style={styles.label}>描述</Text>
          <TextInput
            style={[styles.input, styles.textarea]}
            placeholder="无人机特点、配置说明等"
            value={form.description}
            onChangeText={v => setForm(prev => ({...prev, description: v}))}
            multiline
            textAlignVertical="top"
          />
        </View>

        <TouchableOpacity
          style={[styles.btn, saving && styles.btnDisabled]}
          onPress={handleSubmit}
          disabled={saving}>
          <Text style={styles.btnText}>{saving ? '保存中...' : '保存修改'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#f5f5f5'},
  scroll: {padding: 16},
  group: {marginBottom: 16},
  label: {fontSize: 14, color: '#333', fontWeight: '500', marginBottom: 6},
  input: {
    backgroundColor: '#fff', borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 15, borderWidth: 1, borderColor: '#e8e8e8',
  },
  textarea: {height: 100, textAlignVertical: 'top'},
  btn: {
    backgroundColor: '#1890ff', borderRadius: 8,
    paddingVertical: 14, alignItems: 'center',
    marginTop: 8, marginBottom: 40,
  },
  btnDisabled: {opacity: 0.6},
  btnText: {color: '#fff', fontSize: 16, fontWeight: '600'},
  warningBox: {backgroundColor: '#fff7e6', borderRadius: 8, padding: 12, marginBottom: 16, borderWidth: 1, borderColor: '#ffd591'},
  warningText: {fontSize: 13, color: '#d46b08', lineHeight: 20},
});
