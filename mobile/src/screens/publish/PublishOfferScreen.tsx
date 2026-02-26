import React, {useState, useEffect} from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  SafeAreaView, ScrollView, Alert, ActivityIndicator,
} from 'react-native';
import {demandService} from '../../services/demand';
import {droneService} from '../../services/drone';
import {Drone} from '../../types';

export default function PublishOfferScreen({navigation}: any) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [serviceType, setServiceType] = useState('rental');
  const [price, setPrice] = useState('');
  const [priceType, setPriceType] = useState('daily');
  const [address, setAddress] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [drones, setDrones] = useState<Drone[]>([]);
  const [selectedDrone, setSelectedDrone] = useState<Drone | null>(null);
  const [loadingDrones, setLoadingDrones] = useState(true);

  useEffect(() => {
    fetchMyDrones();
  }, []);

  const fetchMyDrones = async () => {
    setLoadingDrones(true);
    try {
      const res = await droneService.myDrones();
      const droneList = res.data?.list || [];
      setDrones(droneList);
      if (droneList.length > 0) {
        setSelectedDrone(droneList[0]);
      }
    } catch (e) {
      console.error('获取无人机列表失败:', e);
    } finally {
      setLoadingDrones(false);
    }
  };

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
    if (!selectedDrone) {
      Alert.alert('提示', '请选择一个无人机');
      return;
    }
    setSubmitting(true);
    try {
      await demandService.createOffer({
        drone_id: selectedDrone.id,
        title: title.trim(),
        description: description.trim(),
        service_type: serviceType,
        price: Number(price) * 100 || 0, // 转换为分
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
        {loadingDrones ? (
          <ActivityIndicator size="large" color="#1890ff" style={{marginTop: 40}} />
        ) : drones.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>您还没有添加无人机</Text>
            <TouchableOpacity 
              style={styles.addDroneBtn}
              onPress={() => navigation.navigate('AddDrone')}>
              <Text style={styles.addDroneBtnText}>去添加无人机</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <Text style={styles.label}>选择无人机 *</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.droneScroll}>
              {drones.map(drone => (
                <TouchableOpacity
                  key={drone.id}
                  style={[styles.droneCard, selectedDrone?.id === drone.id && styles.droneCardActive]}
                  onPress={() => setSelectedDrone(drone)}>
                  <Text style={styles.droneName}>{drone.brand} {drone.model}</Text>
                  <Text style={styles.droneSpec}>载重 {drone.max_load}kg | 续航 {drone.max_flight_time}min</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

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

            <Text style={styles.label}>价格（元）</Text>
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
          </>
        )}
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
  droneScroll: {marginBottom: 10},
  droneCard: {
    width: 160, padding: 12, borderRadius: 8, borderWidth: 2, borderColor: '#e8e8e8',
    marginRight: 10, backgroundColor: '#fafafa',
  },
  droneCardActive: {borderColor: '#1890ff', backgroundColor: '#e6f7ff'},
  droneName: {fontSize: 14, fontWeight: '600', color: '#333'},
  droneSpec: {fontSize: 12, color: '#999', marginTop: 4},
  emptyContainer: {alignItems: 'center', paddingVertical: 60},
  emptyText: {fontSize: 16, color: '#999', marginBottom: 20},
  addDroneBtn: {
    paddingHorizontal: 24, paddingVertical: 12, backgroundColor: '#1890ff', borderRadius: 8,
  },
  addDroneBtnText: {color: '#fff', fontSize: 15, fontWeight: '600'},
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
