import React, {useState} from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  SafeAreaView, ScrollView, Alert,
} from 'react-native';
import {demandService} from '../../services/demand';
import {AddressData} from '../../types';
import AddressInputField from '../../components/AddressInputField';

export default function PublishDemandScreen({navigation}: any) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [demandType, setDemandType] = useState('rental');
  const [budgetMin, setBudgetMin] = useState('');
  const [budgetMax, setBudgetMax] = useState('');
  const [city, setCity] = useState('');
  const [address, setAddress] = useState<AddressData | null>(null);
  const [urgency, setUrgency] = useState('normal');
  const [submitting, setSubmitting] = useState(false);

  const demandTypes = [
    {key: 'rental', label: '整机租赁'},
    {key: 'aerial_photo', label: '航拍服务'},
    {key: 'agriculture', label: '农业植保'},
  ];

  const handleSubmit = async () => {
    if (!title.trim()) {
      Alert.alert('提示', '请输入需求标题');
      return;
    }
    setSubmitting(true);
    try {
      await demandService.createDemand({
        title: title.trim(),
        description: description.trim(),
        demand_type: demandType,
        budget_min: Number(budgetMin) * 100 || 0, // 转换为分
        budget_max: Number(budgetMax) * 100 || 0, // 转换为分
        city: address?.city || city,
        address: address?.address || '',
        latitude: address?.latitude || 0,
        longitude: address?.longitude || 0,
        urgency,
        status: 'active',
      });
      Alert.alert('成功', '需求发布成功', [
        {text: '确定', onPress: () => navigation.goBack()},
      ]);
    } catch (e: any) {
      Alert.alert('发布失败', e.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.label}>需求标题 *</Text>
        <TextInput style={styles.input} placeholder="例如：需要航拍无人机进行婚礼拍摄" value={title} onChangeText={setTitle} />

        <Text style={styles.label}>需求类型</Text>
        <View style={styles.typeRow}>
          {demandTypes.map(dt => (
            <TouchableOpacity
              key={dt.key}
              style={[styles.typeBtn, demandType === dt.key && styles.typeBtnActive]}
              onPress={() => setDemandType(dt.key)}>
              <Text style={[styles.typeBtnText, demandType === dt.key && styles.typeBtnTextActive]}>{dt.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>需求描述</Text>
        <TextInput style={[styles.input, {height: 80}]} placeholder="详细描述您的需求..." value={description}
          onChangeText={setDescription} multiline textAlignVertical="top" />

        <Text style={styles.label}>预算范围 (元)</Text>
        <View style={{flexDirection: 'row', alignItems: 'center'}}>
          <TextInput style={[styles.input, {flex: 1}]} placeholder="最低" keyboardType="numeric" value={budgetMin} onChangeText={setBudgetMin} />
          <Text style={{marginHorizontal: 10, color: '#999'}}>-</Text>
          <TextInput style={[styles.input, {flex: 1}]} placeholder="最高" keyboardType="numeric" value={budgetMax} onChangeText={setBudgetMax} />
        </View>

        <Text style={styles.label}>所在城市</Text>
        <TextInput style={styles.input} placeholder="例如：北京市" value={city} onChangeText={setCity} />

        <Text style={styles.label}>详细地址（可选）</Text>
        <AddressInputField
          value={address}
          placeholder="点击选择详细地址"
          onSelect={(addr) => {
            setAddress(addr);
            if (addr.city) {
              setCity(addr.city);
            }
          }}
        />

        <Text style={styles.label}>紧急程度</Text>
        <View style={styles.typeRow}>
          {[{key: 'normal', label: '普通'}, {key: 'urgent', label: '紧急'}].map(u => (
            <TouchableOpacity
              key={u.key}
              style={[styles.typeBtn, urgency === u.key && styles.typeBtnActive, u.key === 'urgent' && urgency === u.key && {backgroundColor: '#fff1f0', borderColor: '#ff4d4f'}]}
              onPress={() => setUrgency(u.key)}>
              <Text style={[styles.typeBtnText, urgency === u.key && styles.typeBtnTextActive, u.key === 'urgent' && urgency === u.key && {color: '#ff4d4f'}]}>{u.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity style={[styles.submitBtn, submitting && {opacity: 0.6}]} onPress={handleSubmit} disabled={submitting}>
          <Text style={styles.submitBtnText}>{submitting ? '发布中...' : '发布需求'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#fff'},
  content: {padding: 20, paddingBottom: 40},
  label: {fontSize: 15, fontWeight: '600', color: '#333', marginBottom: 8, marginTop: 16},
  input: {
    borderWidth: 1, borderColor: '#ddd', borderRadius: 8, paddingHorizontal: 14,
    paddingVertical: 10, fontSize: 15, backgroundColor: '#fafafa',
  },
  typeRow: {flexDirection: 'row', flexWrap: 'wrap'},
  typeBtn: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 16,
    borderWidth: 1, borderColor: '#ddd', marginRight: 8, marginBottom: 8,
  },
  typeBtnActive: {borderColor: '#1890ff', backgroundColor: '#e6f7ff'},
  typeBtnText: {fontSize: 13, color: '#666'},
  typeBtnTextActive: {color: '#1890ff'},
  submitBtn: {
    marginTop: 30, height: 48, backgroundColor: '#52c41a', borderRadius: 8,
    justifyContent: 'center', alignItems: 'center',
  },
  submitBtnText: {color: '#fff', fontSize: 17, fontWeight: 'bold'},
});
