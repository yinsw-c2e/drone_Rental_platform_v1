import React, {useEffect, useMemo, useState} from 'react';
import {
  ActivityIndicator,
  Alert,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import AddressInputField from '../../components/AddressInputField';
import {demandV2Service} from '../../services/demandV2';
import {AddressData, DemandDetail} from '../../types';

const sceneOptions = [
  {key: 'power_grid', label: '电网建设'},
  {key: 'mountain_agriculture', label: '山区农副产品'},
  {key: 'plateau_supply', label: '高原给养'},
  {key: 'island_supply', label: '海岛补给'},
  {key: 'emergency', label: '应急救援'},
];

const toAddressSnapshot = (value: AddressData | null | undefined) =>
  value
    ? {
        text: value.address,
        city: value.city,
        district: value.district,
        latitude: value.latitude,
        longitude: value.longitude,
      }
    : undefined;

const snapshotToAddressData = (snap: any): AddressData | null => {
  if (!snap || !snap.text) return null;
  return {
    address: snap.text,
    city: snap.city || '',
    district: snap.district || '',
    province: snap.province || '',
    latitude: snap.latitude || 0,
    longitude: snap.longitude || 0,
  };
};

export default function EditDemandScreen({navigation, route}: any) {
  const demandId = Number(route.params?.demandId || 0);

  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [cargoScene, setCargoScene] = useState(sceneOptions[0].key);
  const [cargoWeight, setCargoWeight] = useState('');
  const [tripCount, setTripCount] = useState('1');
  const [budgetMin, setBudgetMin] = useState('');
  const [budgetMax, setBudgetMax] = useState('');
  const [serviceAddress, setServiceAddress] = useState<AddressData | null>(null);
  const [departureAddress, setDepartureAddress] = useState<AddressData | null>(null);
  const [destinationAddress, setDestinationAddress] = useState<AddressData | null>(null);
  const [hasRoute, setHasRoute] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await demandV2Service.getById(demandId);
        const d: DemandDetail = res.data;
        setTitle(d.title || '');
        setDescription(d.description || '');
        setCargoScene(d.cargo_scene || sceneOptions[0].key);
        setCargoWeight(d.cargo_weight_kg ? String(d.cargo_weight_kg) : '');
        setTripCount(d.estimated_trip_count ? String(d.estimated_trip_count) : '1');
        setBudgetMin(d.budget_min ? String(d.budget_min / 100) : '');
        setBudgetMax(d.budget_max ? String(d.budget_max / 100) : '');
        const dep = snapshotToAddressData(d.departure_address);
        const dest = snapshotToAddressData(d.destination_address);
        if (dep || dest) {
          setHasRoute(true);
          setDepartureAddress(dep);
          setDestinationAddress(dest);
        } else {
          setServiceAddress(snapshotToAddressData(d.service_address));
        }
      } catch (e: any) {
        Alert.alert('加载失败', e.message || '无法获取需求详情');
        navigation.goBack();
      } finally {
        setLoading(false);
      }
    })();
  }, [demandId]);

  const handleSubmit = async () => {
    if (!title.trim()) {
      Alert.alert('提示', '请输入需求标题');
      return;
    }
    if (hasRoute) {
      if (!departureAddress || !destinationAddress) {
        Alert.alert('提示', '请填写起点和终点地址');
        return;
      }
    } else {
      if (!serviceAddress) {
        Alert.alert('提示', '请补充服务地址');
        return;
      }
    }
    if (!(Number(cargoWeight) > 0)) {
      Alert.alert('提示', '请填写有效的货物重量');
      return;
    }

    setSubmitting(true);
    try {
      await demandV2Service.update(demandId, {
        title: title.trim(),
        service_type: 'heavy_cargo_lift_transport',
        cargo_scene: cargoScene,
        description: description.trim() || undefined,
        ...(hasRoute
          ? {
              departure_address: toAddressSnapshot(departureAddress),
              destination_address: toAddressSnapshot(destinationAddress),
            }
          : {service_address: toAddressSnapshot(serviceAddress)}),
        cargo_weight_kg: Number(cargoWeight),
        estimated_trip_count: Math.max(Number(tripCount) || 1, 1),
        budget_min: budgetMin ? Math.round(Number(budgetMin) * 100) : undefined,
        budget_max: budgetMax ? Math.round(Number(budgetMax) * 100) : undefined,
      });
      Alert.alert('修改成功', '需求已更新。', [
        {text: '返回', onPress: () => navigation.navigate('DemandDetail', {id: demandId, refreshAt: Date.now()})},
      ]);
    } catch (error: any) {
      Alert.alert('修改失败', error.message || '请稍后重试');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator style={{marginTop: 120}} color="#1677ff" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.pageTitle}>修改需求</Text>

        <Text style={styles.label}>需求标题 *</Text>
        <TextInput style={styles.input} placeholder="例如：山区电网建设塔材吊运" value={title} onChangeText={setTitle} />

        <Text style={styles.label}>作业场景 *</Text>
        <View style={styles.optionRow}>
          {sceneOptions.map(option => (
            <TouchableOpacity
              key={option.key}
              style={[styles.optionBtn, cargoScene === option.key && styles.optionBtnActive]}
              onPress={() => setCargoScene(option.key)}>
              <Text style={[styles.optionText, cargoScene === option.key && styles.optionTextActive]}>{option.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>服务地址 *</Text>
        {hasRoute ? (
          <>
            <Text style={styles.label}>起点地址 *</Text>
            <AddressInputField value={departureAddress} placeholder="点击选择起点地址" onSelect={setDepartureAddress} />
            <Text style={styles.label}>终点地址 *</Text>
            <AddressInputField value={destinationAddress} placeholder="点击选择终点地址" onSelect={setDestinationAddress} />
          </>
        ) : (
          <AddressInputField value={serviceAddress} placeholder="点击选择主要作业地址" onSelect={setServiceAddress} />
        )}

        <Text style={styles.label}>货物重量 (kg) *</Text>
        <TextInput style={styles.input} keyboardType="numeric" placeholder="例如：80" value={cargoWeight} onChangeText={setCargoWeight} />

        <Text style={styles.label}>预计架次</Text>
        <TextInput style={styles.input} keyboardType="numeric" placeholder="默认 1 架次" value={tripCount} onChangeText={setTripCount} />

        <Text style={styles.label}>预算范围 (元)</Text>
        <View style={styles.budgetRow}>
          <TextInput style={[styles.input, styles.flexInput]} keyboardType="numeric" placeholder="最低预算" value={budgetMin} onChangeText={setBudgetMin} />
          <Text style={styles.split}>-</Text>
          <TextInput style={[styles.input, styles.flexInput]} keyboardType="numeric" placeholder="最高预算" value={budgetMax} onChangeText={setBudgetMax} />
        </View>

        <Text style={styles.label}>需求说明</Text>
        <TextInput
          style={[styles.input, styles.textarea]}
          placeholder="补充货物类型、现场条件、时效要求等"
          value={description}
          onChangeText={setDescription}
          multiline
          textAlignVertical="top"
        />

        <TouchableOpacity style={[styles.submitBtn, submitting && styles.submitBtnDisabled]} onPress={handleSubmit} disabled={submitting}>
          <Text style={styles.submitBtnText}>{submitting ? '保存中...' : '保存修改'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#fff'},
  content: {padding: 20, paddingBottom: 40},
  pageTitle: {fontSize: 24, fontWeight: '700', color: '#102a43'},
  label: {fontSize: 15, fontWeight: '600', color: '#333', marginBottom: 8, marginTop: 18},
  input: {
    borderWidth: 1,
    borderColor: '#d9e2ec',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    backgroundColor: '#f8fafc',
  },
  textarea: {height: 96},
  optionRow: {flexDirection: 'row', flexWrap: 'wrap'},
  optionBtn: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#d9e2ec',
    marginRight: 8,
    marginBottom: 8,
    backgroundColor: '#fff',
  },
  optionBtnActive: {borderColor: '#1677ff', backgroundColor: '#e6f4ff'},
  optionText: {fontSize: 13, color: '#475569'},
  optionTextActive: {color: '#1677ff', fontWeight: '600'},
  budgetRow: {flexDirection: 'row', alignItems: 'center'},
  flexInput: {flex: 1},
  split: {marginHorizontal: 10, color: '#94a3b8'},
  submitBtn: {
    marginTop: 28,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#1677ff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  submitBtnDisabled: {opacity: 0.6},
  submitBtnText: {color: '#fff', fontSize: 17, fontWeight: '700'},
});
