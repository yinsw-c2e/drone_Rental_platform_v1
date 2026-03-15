import React, {useMemo, useState} from 'react';
import {
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
import {AddressData} from '../../types';

const sceneOptions = [
  {key: 'power_grid', label: '电网建设'},
  {key: 'mountain_agriculture', label: '山区农副产品'},
  {key: 'plateau_supply', label: '高原给养'},
  {key: 'island_supply', label: '海岛补给'},
  {key: 'emergency', label: '应急救援'},
];

const toIsoRange = () => {
  const start = new Date();
  start.setDate(start.getDate() + 1);
  start.setHours(9, 0, 0, 0);
  const end = new Date(start);
  end.setHours(17, 0, 0, 0);
  const expires = new Date();
  expires.setDate(expires.getDate() + 7);
  expires.setHours(23, 59, 59, 0);
  return {
    start: start.toISOString(),
    end: end.toISOString(),
    expires: expires.toISOString(),
  };
};

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

export default function PublishDemandScreen({navigation}: any) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [cargoScene, setCargoScene] = useState(sceneOptions[0].key);
  const [cargoWeight, setCargoWeight] = useState('');
  const [tripCount, setTripCount] = useState('1');
  const [budgetMin, setBudgetMin] = useState('');
  const [budgetMax, setBudgetMax] = useState('');
  const [serviceAddress, setServiceAddress] = useState<AddressData | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const defaults = useMemo(() => toIsoRange(), []);

  const handleSubmit = async () => {
    if (!title.trim()) {
      Alert.alert('提示', '请输入需求标题');
      return;
    }
    if (!serviceAddress) {
      Alert.alert('提示', '请补充服务地址');
      return;
    }
    if (!(Number(cargoWeight) > 0)) {
      Alert.alert('提示', '请填写有效的货物重量');
      return;
    }

    setSubmitting(true);
    try {
      const created = await demandV2Service.create({
        title: title.trim(),
        service_type: 'heavy_cargo_lift_transport',
        cargo_scene: cargoScene,
        description: description.trim() || undefined,
        service_address: toAddressSnapshot(serviceAddress),
        scheduled_start_at: defaults.start,
        scheduled_end_at: defaults.end,
        cargo_weight_kg: Number(cargoWeight),
        estimated_trip_count: Math.max(Number(tripCount) || 1, 1),
        budget_min: budgetMin ? Math.round(Number(budgetMin) * 100) : undefined,
        budget_max: budgetMax ? Math.round(Number(budgetMax) * 100) : undefined,
        allows_pilot_candidate: true,
        expires_at: defaults.expires,
      });
      await demandV2Service.publish(created.data.id);
      Alert.alert('发布成功', '需求已进入公开需求市场。', [
        {text: '查看需求', onPress: () => navigation.replace('DemandDetail', {id: created.data.id})},
      ]);
    } catch (error: any) {
      Alert.alert('发布失败', error.message || '请稍后重试');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>发布重载吊运需求</Text>
        <Text style={styles.subtitle}>创建的是 v2 需求对象，发布后会进入公开需求市场，供机主报价、飞手候选。</Text>

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
        <AddressInputField value={serviceAddress} placeholder="点击选择主要作业地址" onSelect={setServiceAddress} />

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

        <View style={styles.tipCard}>
          <Text style={styles.tipTitle}>默认规则</Text>
          <Text style={styles.tipText}>系统会自动补一组默认预约时间和 7 天有效期，发布后你仍可在“我的需求”里继续跟进报价。</Text>
        </View>

        <TouchableOpacity style={[styles.submitBtn, submitting && styles.submitBtnDisabled]} onPress={handleSubmit} disabled={submitting}>
          <Text style={styles.submitBtnText}>{submitting ? '发布中...' : '发布需求'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#fff'},
  content: {padding: 20, paddingBottom: 40},
  title: {fontSize: 24, fontWeight: '700', color: '#102a43'},
  subtitle: {fontSize: 13, lineHeight: 20, color: '#6b7280', marginTop: 8},
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
  optionBtnActive: {
    borderColor: '#1677ff',
    backgroundColor: '#e6f4ff',
  },
  optionText: {fontSize: 13, color: '#475569'},
  optionTextActive: {color: '#1677ff', fontWeight: '600'},
  budgetRow: {flexDirection: 'row', alignItems: 'center'},
  flexInput: {flex: 1},
  split: {marginHorizontal: 10, color: '#94a3b8'},
  tipCard: {
    marginTop: 18,
    backgroundColor: '#f0f9ff',
    borderWidth: 1,
    borderColor: '#bae6fd',
    borderRadius: 14,
    padding: 14,
  },
  tipTitle: {fontSize: 14, fontWeight: '700', color: '#075985', marginBottom: 6},
  tipText: {fontSize: 12, lineHeight: 18, color: '#0f766e'},
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
