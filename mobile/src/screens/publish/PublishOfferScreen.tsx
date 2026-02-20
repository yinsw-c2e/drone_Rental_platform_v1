import React, {useState} from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  SafeAreaView, ScrollView, Alert,
} from 'react-native';
import {demandService} from '../../services/demand';

export default function PublishOfferScreen({navigation}: any) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [serviceType, setServiceType] = useState('rental');
  const [price, setPrice] = useState('');
  const [priceType, setPriceType] = useState('daily');
  const [address, setAddress] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const serviceTypes = [
    {key: 'rental', label: '整机租赁'},
    {key: 'aerial_photo', label: '航拍服务'},
    {key: 'logistics', label: '物流运输'},
    {key: 'agriculture', label: '农业植保'},
  ];

  const handleSubmit = async () => {
    if (!title.trim()) {
      Alert.alert('提示', '请输入标题');
      return;
    }
    setSubmitting(true);
    try {
      await demandService.createOffer({
        title: title.trim(),
        description: description.trim(),
        service_type: serviceType,
        price: Number(price) || 0,
        price_type: priceType,
        address,
        status: 'active',
      });
      Alert.alert('成功', '供给发布成功', [
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
        <Text style={styles.label}>标题 *</Text>
        <TextInput style={styles.input} placeholder="例如：DJI Mavic 3 航拍服务" value={title} onChangeText={setTitle} />

        <Text style={styles.label}>服务类型</Text>
        <View style={styles.typeRow}>
          {serviceTypes.map(st => (
            <TouchableOpacity
              key={st.key}
              style={[styles.typeBtn, serviceType === st.key && styles.typeBtnActive]}
              onPress={() => setServiceType(st.key)}>
              <Text style={[styles.typeBtnText, serviceType === st.key && styles.typeBtnTextActive]}>{st.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>描述</Text>
        <TextInput style={[styles.input, {height: 80}]} placeholder="详细描述您的无人机服务..." value={description}
          onChangeText={setDescription} multiline textAlignVertical="top" />

        <Text style={styles.label}>价格</Text>
        <View style={{flexDirection: 'row', alignItems: 'center'}}>
          <TextInput style={[styles.input, {flex: 1, marginRight: 10}]} placeholder="0" keyboardType="numeric" value={price} onChangeText={setPrice} />
          <TouchableOpacity style={styles.priceToggle} onPress={() => setPriceType(priceType === 'daily' ? 'hourly' : 'daily')}>
            <Text style={styles.priceToggleText}>{priceType === 'daily' ? '元/天' : '元/小时'}</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.label}>服务地址</Text>
        <TextInput style={styles.input} placeholder="服务所在城市或地址" value={address} onChangeText={setAddress} />

        <TouchableOpacity style={[styles.submitBtn, submitting && {opacity: 0.6}]} onPress={handleSubmit} disabled={submitting}>
          <Text style={styles.submitBtnText}>{submitting ? '发布中...' : '发布供给'}</Text>
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
  priceToggle: {
    paddingHorizontal: 14, paddingVertical: 10, backgroundColor: '#f0f0f0', borderRadius: 8,
  },
  priceToggleText: {fontSize: 14, color: '#666'},
  submitBtn: {
    marginTop: 30, height: 48, backgroundColor: '#1890ff', borderRadius: 8,
    justifyContent: 'center', alignItems: 'center',
  },
  submitBtnText: {color: '#fff', fontSize: 17, fontWeight: 'bold'},
});
