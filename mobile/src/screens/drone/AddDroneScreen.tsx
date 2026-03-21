import React, {useState} from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  SafeAreaView, ScrollView, Alert, Image, ActivityIndicator,
} from 'react-native';
import {launchImageLibrary} from 'react-native-image-picker';
import {droneService} from '../../services/drone';
import api from '../../services/api';
import {API_BASE_URL} from '../../constants';
import {useTheme} from '../../theme/ThemeContext';
import type {AppTheme} from '../../theme/index';

// 图片访问基础地址（去掉 /api/v1 后缀）
const IMAGE_BASE_URL = API_BASE_URL.replace(/\/api\/v1$/, '');

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
      <ScrollView style={styles.scroll}>
        {renderInput('品牌 *', 'brand', '如：DJI、大疆')}
        {renderInput('型号 *', 'model', '如：Mavic 3 Pro')}
        {renderInput('序列号', 'serial_number', '无人机序列号')}
        {renderInput('最大载重(kg)', 'max_load', '如：2.5', {keyboardType: 'numeric'})}
        {renderInput('续航时间(分钟)', 'max_flight_time', '如：45', {keyboardType: 'numeric'})}
        {renderInput('日租金(元)', 'daily_price', '如：299', {keyboardType: 'numeric'})}
        {renderInput('时租金(元)', 'hourly_price', '如：50', {keyboardType: 'numeric'})}
        {renderInput('押金(元)', 'deposit', '如：500', {keyboardType: 'numeric'})}

        {/* 无人机照片上传 */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>无人机照片（最多5张）</Text>
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
                    <Text style={styles.addImageText}>添加照片</Text>
                  </>
                )}
              </TouchableOpacity>
            )}
          </View>
        </View>
        
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
          style={[styles.submitBtn, (loading || uploading) && styles.submitBtnDisabled]} 
          onPress={handleSubmit}
          disabled={loading || uploading}>
          <Text style={styles.submitBtnText}>{loading ? '提交中...' : '添加无人机'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const getStyles = (theme: AppTheme) => StyleSheet.create({
  container: {flex: 1, backgroundColor: theme.bgSecondary},
  scroll: {padding: 16},
  inputGroup: {marginBottom: 16},
  label: {fontSize: 14, color: theme.text, marginBottom: 8, fontWeight: '500'},
  input: {
    backgroundColor: theme.card, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 15, borderWidth: 1, borderColor: theme.divider,
  },
  textArea: {height: 100, textAlignVertical: 'top'},
  submitBtn: {
    backgroundColor: theme.primary, borderRadius: 8, paddingVertical: 14,
    alignItems: 'center', marginTop: 8, marginBottom: 32,
  },
  submitBtnDisabled: {opacity: 0.6},
  submitBtnText: {color: theme.btnPrimaryText, fontSize: 16, fontWeight: '600'},
  // 照片相关
  imageRow: {flexDirection: 'row', flexWrap: 'wrap'},
  imageWrapper: {
    width: 88, height: 88, marginRight: 10, marginBottom: 10, position: 'relative',
  },
  thumbnail: {
    width: 88, height: 88, borderRadius: 8, backgroundColor: theme.divider,
  },
  removeBtn: {
    position: 'absolute', top: -6, right: -6,
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: theme.danger, justifyContent: 'center', alignItems: 'center',
  },
  removeBtnText: {color: theme.btnPrimaryText, fontSize: 14, fontWeight: 'bold', lineHeight: 20},
  addImageBtn: {
    width: 88, height: 88, borderRadius: 8, borderWidth: 1.5,
    borderColor: theme.divider, borderStyle: 'dashed',
    backgroundColor: theme.bgSecondary, justifyContent: 'center', alignItems: 'center',
    marginRight: 10, marginBottom: 10,
  },
  addImageIcon: {fontSize: 24, color: theme.textHint},
  addImageText: {fontSize: 12, color: theme.textSub, marginTop: 2},
});
