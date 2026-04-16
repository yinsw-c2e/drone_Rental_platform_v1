import React, {useState} from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  SafeAreaView, ScrollView, Alert, Image, ActivityIndicator,
} from 'react-native';
import {launchImageLibrary} from 'react-native-image-picker';
import {droneService} from '../../services/drone';
import api from '../../services/api';
import {API_ROOT_URL} from '../../constants';
import {useTheme} from '../../theme/ThemeContext';
import type {AppTheme} from '../../theme/index';

const IMAGE_BASE_URL = API_ROOT_URL;

export default function AddDroneScreen({navigation}: any) {
  const {theme} = useTheme();
  const styles = getStyles(theme);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [images, setImages] = useState<string[]>([]);
  const [form, setForm] = useState({
    brand: '',
    model: '',
    serial_number: '',
    max_load: '',
    max_flight_time: '',
    daily_price: '',
    hourly_price: '',
    deposit: '',
    description: '',
  });

  const handlePickImage = async () => {
    try {
      const result = await launchImageLibrary({
        mediaType: 'photo',
        quality: 0.8,
        maxWidth: 1200,
        maxHeight: 1200,
        selectionLimit: 5 - images.length, // 最多5张
      });
      if (result.didCancel || !result.assets?.length) return;

      setUploading(true);
      try {
        const uploadedUrls: string[] = [];
        for (const asset of result.assets) {
          const formData = new FormData();
          formData.append('files', {
            uri: asset.uri,
            type: asset.type || 'image/jpeg',
            name: asset.fileName || 'drone.jpg',
          } as any);
          const res: any = await api.post('/drone/upload', formData, {
            headers: {'Content-Type': 'multipart/form-data'},
          });
          const urls = res.data?.urls;
          if (urls?.length) {
            // 将相对路径拼接为完整 URL
            const fullUrls = urls.map((u: string) =>
              u.startsWith('http') ? u : `${IMAGE_BASE_URL}${u}`);
            uploadedUrls.push(...fullUrls);
          }
        }
        setImages(prev => [...prev, ...uploadedUrls]);
      } finally {
        setUploading(false);
      }
    } catch (e: any) {
      setUploading(false);
      Alert.alert('上传失败', e.message || '图片上传失败，请重试');
    }
  };

  const handleRemoveImage = (index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index));
  };

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
        daily_price: (parseFloat(form.daily_price) || 0) * 100,
        hourly_price: (parseFloat(form.hourly_price) || 0) * 100,
        deposit: (parseFloat(form.deposit) || 0) * 100,
        description: form.description,
        images,
      });
      Alert.alert('成功', '无人机添加成功，接下来您可以进行认证管理', [
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
    <SafeAreaView style={[styles.container, {backgroundColor: theme.bg}]}>
      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.formSection}>
          <Text style={styles.sectionTitle}>1. 基础规格信息</Text>
          <View style={styles.card}>
            {renderInput('品牌 *', 'brand', '如：大疆 (DJI)')}
            {renderInput('型号 *', 'model', '如：Mavic 3 Pro')}
            {renderInput('设备识别码 (SN)', 'serial_number', '请输入机身序列号')}
            <View style={styles.rowInputs}>
              <View style={{flex: 1}}>{renderInput('最大载重(kg)', 'max_load', '0.0', {keyboardType: 'numeric'})}</View>
              <View style={{flex: 1}}>{renderInput('续航时间(min)', 'max_flight_time', '0', {keyboardType: 'numeric'})}</View>
            </View>
          </View>
        </View>

        <View style={styles.formSection}>
          <Text style={styles.sectionTitle}>2. 经营价格与描述</Text>
          <View style={styles.card}>
            <View style={styles.rowInputs}>
              <View style={{flex: 1}}>{renderInput('日租金(元)', 'daily_price', '0', {keyboardType: 'numeric'})}</View>
              <View style={{flex: 1}}>{renderInput('时租金(元)', 'hourly_price', '0', {keyboardType: 'numeric'})}</View>
            </View>
            {renderInput('押金金额(元)', 'deposit', '0', {keyboardType: 'numeric'})}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>资产描述</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="描述无人机的配置、电池循环数、成色等..."
                placeholderTextColor={theme.textHint}
                value={form.description}
                onChangeText={(text) => setForm({...form, description: text})}
                multiline
                numberOfLines={4}
              />
            </View>
          </View>
        </View>

        <View style={styles.formSection}>
          <Text style={styles.sectionTitle}>3. 资产实拍图</Text>
          <View style={[styles.card, {paddingBottom: 20}]}>
            <Text style={styles.tipText}>清晰的照片有助于提升租用率（最多5张）</Text>
            <View style={styles.imageRow}>
              {images.map((uri, index) => (
                <View key={index} style={styles.imageWrapper}>
                  <Image source={{uri}} style={styles.thumbnail} />
                  <TouchableOpacity
                    style={styles.removeBtn}
                    onPress={() => handleRemoveImage(index)}>
                    <Text style={styles.removeBtnText}>×</Text>
                  </TouchableOpacity>
                </View>
              ))}
              {images.length < 5 && (
                <TouchableOpacity
                  style={styles.addImageBtn}
                  onPress={handlePickImage}
                  disabled={uploading}>
                  {uploading ? (
                    <ActivityIndicator color={theme.primary} />
                  ) : (
                    <>
                      <Text style={styles.addImageIcon}>+</Text>
                      <Text style={styles.addImageText}>上传图片</Text>
                    </>
                  )}
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.submitBtn, (loading || uploading) && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={loading || uploading}>
          <Text style={styles.submitBtnText}>{loading ? '正在同步云端...' : '确认添加资产'}</Text>
        </TouchableOpacity>
        <View style={{height: 40}} />
      </ScrollView>
    </SafeAreaView>
  );
}

const getStyles = (theme: AppTheme) => StyleSheet.create({
  container: {flex: 1, backgroundColor: theme.bgSecondary},
  scroll: {padding: 16},
  formSection: {marginBottom: 20},
  sectionTitle: {fontSize: 15, fontWeight: '800', color: theme.text, marginBottom: 12, marginLeft: 4},
  card: {backgroundColor: theme.card, borderRadius: 20, padding: 16, borderWidth: 1, borderColor: theme.divider},
  inputGroup: {marginBottom: 16},
  rowInputs: {flexDirection: 'row', gap: 12},
  label: {fontSize: 13, color: theme.textSub, marginBottom: 8, fontWeight: '700'},
  input: {
    backgroundColor: theme.bgSecondary, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 15, color: theme.text, borderWidth: 1, borderColor: theme.divider,
  },
  textArea: {height: 96, textAlignVertical: 'top'},
  submitBtn: {
    backgroundColor: theme.primary, borderRadius: 16, height: 54,
    alignItems: 'center', justifyContent: 'center', marginTop: 8,
    shadowColor: theme.primary, shadowOffset: {width: 0, height: 4}, shadowOpacity: 0.2, shadowRadius: 8, elevation: 4,
  },
  submitBtnDisabled: {opacity: 0.6},
  submitBtnText: {color: '#FFFFFF', fontSize: 16, fontWeight: '800'},
  tipText: {fontSize: 12, color: theme.textHint, marginBottom: 16},
  // 照片相关
  imageRow: {flexDirection: 'row', flexWrap: 'wrap'},
  imageWrapper: {
    width: 80, height: 80, marginRight: 12, marginBottom: 12, position: 'relative',
  },
  thumbnail: {
    width: 80, height: 80, borderRadius: 12, backgroundColor: theme.divider,
  },
  removeBtn: {
    position: 'absolute', top: -6, right: -6,
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: theme.danger, justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: '#fff',
  },
  removeBtnText: {color: '#FFFFFF', fontSize: 14, fontWeight: 'bold', lineHeight: 18},
  addImageBtn: {
    width: 80, height: 80, borderRadius: 12, borderWidth: 1.5,
    borderColor: theme.divider, borderStyle: 'dashed',
    backgroundColor: theme.bgSecondary, justifyContent: 'center', alignItems: 'center',
    marginRight: 12, marginBottom: 12,
  },
  addImageIcon: {fontSize: 28, color: theme.textHint, fontWeight: '300'},
  addImageText: {fontSize: 11, color: theme.textSub, marginTop: 2, fontWeight: '600'},
});
