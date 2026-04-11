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
import ImagePickerGroup from '../../components/ImagePickerGroup';
import {demandV2Service} from '../../services/demandV2';
import {AddressData} from '../../types';
import {useTheme} from '../../theme/ThemeContext';
import type {AppTheme} from '../../theme/index';

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

const buildDefaultTimes = () => {
  const start = new Date();
  start.setDate(start.getDate() + 1);
  start.setHours(8, 0, 0, 0);
  const end = new Date(start);
  end.setHours(18, 0, 0, 0);
  const expires = new Date();
  expires.setDate(expires.getDate() + 5);
  expires.setHours(23, 59, 59, 0);
  return {
    start: start.toISOString(),
    end: end.toISOString(),
    expires: expires.toISOString(),
  };
};

export default function PublishCargoScreen({navigation}: any) {
  const {theme} = useTheme();
  const styles = getStyles(theme);
  const [cargoScene, setCargoScene] = useState(sceneOptions[0].key);
  const [cargoType, setCargoType] = useState('material');
  const [cargoWeight, setCargoWeight] = useState('');
  const [cargoDescription, setCargoDescription] = useState('');
  const [pickupAddress, setPickupAddress] = useState<AddressData | null>(null);
  const [deliveryAddress, setDeliveryAddress] = useState<AddressData | null>(null);
  const [offeredPrice, setOfferedPrice] = useState('');
  const [tripCount, setTripCount] = useState('1');
  const [cargoImages, setCargoImages] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const defaults = useMemo(() => buildDefaultTimes(), []);

  const handleSubmit = async () => {
    if (!pickupAddress || !deliveryAddress) {
      Alert.alert('提示', '请填写起点和终点地址');
      return;
    }
    if (!(Number(cargoWeight) > 0)) {
      Alert.alert('提示', '请填写有效的货物重量');
      return;
    }

    setSubmitting(true);
    try {
      const title = `${sceneOptions.find(item => item.key === cargoScene)?.label || '重载吊运'}：${pickupAddress.city || '起点'} -> ${deliveryAddress.city || '终点'}`;
      const created = await demandV2Service.create({
        title,
        service_type: 'heavy_cargo_lift_transport',
        cargo_scene: cargoScene,
        description: cargoDescription.trim() || undefined,
        departure_address: toAddressSnapshot(pickupAddress),
        destination_address: toAddressSnapshot(deliveryAddress),
        scheduled_start_at: defaults.start,
        scheduled_end_at: defaults.end,
        cargo_weight_kg: Number(cargoWeight),
        cargo_type: cargoType,
        cargo_special_requirements: cargoImages.length ? `附带货物照片 ${cargoImages.length} 张` : undefined,
        estimated_trip_count: Math.max(Number(tripCount) || 1, 1),
        budget_max: offeredPrice ? Math.round(Number(offeredPrice) * 100) : undefined,
        allows_pilot_candidate: true,
        expires_at: defaults.expires,
      });
      await demandV2Service.publish(created.data.id);
      Alert.alert('发布成功', '运输任务已进入公开任务列表。', [
        {text: '查看任务', onPress: () => navigation.replace('DemandDetail', {id: created.data.id})},
      ]);
    } catch (error: any) {
      Alert.alert('发布失败', error.message || '请稍后重试');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, {backgroundColor: theme.bg}]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>发布运输需求</Text>
        <Text style={styles.subtitle}>这里创建的是 v2 公开需求，不再直接生成旧货运订单。</Text>

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

        <Text style={styles.label}>货物类型</Text>
        <TextInput style={styles.input} placeholder="例如：塔材、设备器材、给养物资" value={cargoType} onChangeText={setCargoType} />

        <Text style={styles.label}>货物重量 (kg) *</Text>
        <TextInput style={styles.input} keyboardType="numeric" placeholder="例如：120" value={cargoWeight} onChangeText={setCargoWeight} />

        <Text style={styles.label}>预计架次</Text>
        <TextInput style={styles.input} keyboardType="numeric" placeholder="默认 1 架次" value={tripCount} onChangeText={setTripCount} />

        <Text style={styles.label}>起点地址 *</Text>
        <AddressInputField value={pickupAddress} placeholder="点击选择起点地址" onSelect={setPickupAddress} />

        <Text style={styles.label}>终点地址 *</Text>
        <AddressInputField value={deliveryAddress} placeholder="点击选择终点地址" onSelect={setDeliveryAddress} />

        <Text style={styles.label}>预算上限 (元)</Text>
        <TextInput style={styles.input} keyboardType="numeric" placeholder="可选，留空表示待沟通" value={offeredPrice} onChangeText={setOfferedPrice} />

        <Text style={styles.label}>货物说明</Text>
        <TextInput
          style={[styles.input, styles.textarea]}
          placeholder="补充货物属性、装卸条件、现场风险等"
          value={cargoDescription}
          onChangeText={setCargoDescription}
          multiline
          textAlignVertical="top"
        />

        <ImagePickerGroup
          label="货物照片（可选）"
          hint="图片只作为需求补充说明，不再走旧货物订单链路。"
          images={cargoImages}
          onImagesChange={setCargoImages}
          maxCount={4}
        />

        <TouchableOpacity style={[styles.submitBtn, submitting && styles.submitBtnDisabled]} onPress={handleSubmit} disabled={submitting}>
          <Text style={styles.submitBtnText}>{submitting ? '发布中...' : '发布运输需求'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const getStyles = (theme: AppTheme) => StyleSheet.create({
  container: {flex: 1, backgroundColor: theme.card},
  content: {padding: 20, paddingBottom: 40},
  title: {fontSize: 24, fontWeight: '700', color: theme.text},
  subtitle: {fontSize: 13, lineHeight: 20, color: theme.textSub, marginTop: 8},
  label: {fontSize: 15, fontWeight: '600', color: theme.text, marginBottom: 8, marginTop: 18},
  input: {
    borderWidth: 1,
    borderColor: theme.cardBorder,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    backgroundColor: theme.bgSecondary,
  },
  textarea: {height: 96},
  optionRow: {flexDirection: 'row', flexWrap: 'wrap'},
  optionBtn: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: theme.cardBorder,
    marginRight: 8,
    marginBottom: 8,
    backgroundColor: theme.card,
  },
  optionBtnActive: {
    borderColor: theme.warning,
    backgroundColor: theme.warning + '22',
  },
  optionText: {fontSize: 13, color: theme.textSub},
  optionTextActive: {color: theme.warning, fontWeight: '600'},
  submitBtn: {
    marginTop: 28,
    height: 48,
    borderRadius: 12,
    backgroundColor: theme.warning,
    justifyContent: 'center',
    alignItems: 'center',
  },
  submitBtnDisabled: {opacity: 0.6},
  submitBtnText: {color: theme.btnPrimaryText, fontSize: 17, fontWeight: '700'},
});
