import React, {useState} from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  SafeAreaView, ScrollView, Alert,
} from 'react-native';
import {demandService} from '../../services/demand';
import {AddressData} from '../../types';
import AddressInputField from '../../components/AddressInputField';

export default function PublishCargoScreen({navigation}: any) {
  const [cargoType, setCargoType] = useState('package');
  const [cargoWeight, setCargoWeight] = useState('');
  const [cargoDescription, setCargoDescription] = useState('');
  const [pickupAddress, setPickupAddress] = useState<AddressData | null>(null);
  const [deliveryAddress, setDeliveryAddress] = useState<AddressData | null>(null);
  const [offeredPrice, setOfferedPrice] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const cargoTypes = [
    {key: 'package', label: '包裹快递'},
    {key: 'equipment', label: '设备器材'},
    {key: 'material', label: '物资材料'},
    {key: 'other', label: '其他货物'},
  ];

  const handleSubmit = async () => {
    if (!pickupAddress || !deliveryAddress) {
      Alert.alert('提示', '请填写取货和送达地址');
      return;
    }
    setSubmitting(true);
    try {
      await demandService.createCargo({
        cargo_type: cargoType,
        cargo_weight: Number(cargoWeight) || 0,
        cargo_description: cargoDescription.trim(),
        pickup_address: pickupAddress.address,
        delivery_address: deliveryAddress.address,
        offered_price: Number(offeredPrice) * 100 || 0, // 转换为分
        status: 'active',
      });
      Alert.alert('成功', '货运需求发布成功', [
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
        <Text style={styles.label}>货物类型</Text>
        <View style={styles.typeRow}>
          {cargoTypes.map(ct => (
            <TouchableOpacity
              key={ct.key}
              style={[styles.typeBtn, cargoType === ct.key && styles.typeBtnActive]}
              onPress={() => setCargoType(ct.key)}>
              <Text style={[styles.typeBtnText, cargoType === ct.key && styles.typeBtnTextActive]}>{ct.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>货物重量 (kg)</Text>
        <TextInput style={styles.input} placeholder="0" keyboardType="numeric" value={cargoWeight} onChangeText={setCargoWeight} />

        <Text style={styles.label}>货物描述</Text>
        <TextInput style={[styles.input, {height: 70}]} placeholder="描述货物信息..." value={cargoDescription}
          onChangeText={setCargoDescription} multiline textAlignVertical="top" />

        <Text style={styles.label}>取货地址 *</Text>
        <AddressInputField
          value={pickupAddress}
          placeholder="点击选择取货地址"
          onSelect={setPickupAddress}
        />

        <Text style={styles.label}>送达地址 *</Text>
        <AddressInputField
          value={deliveryAddress}
          placeholder="点击选择送达地址"
          onSelect={setDeliveryAddress}
        />

        <Text style={styles.label}>出价 (元)</Text>
        <TextInput style={styles.input} placeholder="您愿意支付的运费" keyboardType="numeric" value={offeredPrice} onChangeText={setOfferedPrice} />

        <TouchableOpacity style={[styles.submitBtn, submitting && {opacity: 0.6}]} onPress={handleSubmit} disabled={submitting}>
          <Text style={styles.submitBtnText}>{submitting ? '发布中...' : '发布货运需求'}</Text>
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
    marginTop: 30, height: 48, backgroundColor: '#fa8c16', borderRadius: 8,
    justifyContent: 'center', alignItems: 'center',
  },
  submitBtnText: {color: '#fff', fontSize: 17, fontWeight: 'bold'},
});
