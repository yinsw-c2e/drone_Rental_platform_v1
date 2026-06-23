import Taro, { useDidShow } from '@tarojs/taro';
import React, { useState } from 'react';
import { View, Text, Input, ScrollView, Image } from '@tarojs/components';
import { droneService } from '../../../services/drone';
import { API_ROOT_URL, API_V2_BASE_URL } from '../../../constants';
import { friendlyErrorMessage } from '../../../utils/errorMessage';
import './index.scss';

const IMAGE_BASE_URL = API_V2_BASE_URL;
const UPLOAD_ASSET_BASE_URL = API_ROOT_URL;

export default function EditDronePage() {
  const params = Taro.getCurrentInstance().router?.params || {};
  const id = Number(params.id || 0);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
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

  useDidShow(() => {
    if (id > 0) {
      droneService.getById(id).then((res: any) => {
        const d = res.data || res;
        setForm({
          brand: d.brand || '',
          model: d.model || '',
          serial_number: d.serial_number || '',
          max_load: d.max_load ? String(d.max_load) : '',
          max_flight_time: d.max_flight_time ? String(d.max_flight_time) : '',
          daily_price: d.daily_price ? String(Number(d.daily_price) / 100) : '',
          hourly_price: d.hourly_price ? String(Number(d.hourly_price) / 100) : '',
          deposit: d.deposit ? String(Number(d.deposit) / 100) : '',
          description: d.description || '',
        });
        setImages(d.images || []);
        setLoading(false);
      }).catch(e => {
        Taro.showToast({ title: '加载失败', icon: 'none' });
        setLoading(false);
      });
    }
  });

  const handlePickImage = async () => {
    try {
      const res = await Taro.chooseImage({
        count: 5 - images.length,
        sizeType: ['compressed'],
        sourceType: ['album', 'camera'],
      });
      if (!res.tempFilePaths.length) return;

      setUploading(true);
      const uploadedUrls: string[] = [];

      for (const filePath of res.tempFilePaths) {
        try {
          const uploadRes = await Taro.uploadFile({
            url: `${IMAGE_BASE_URL}/drone/upload`,
            filePath,
            name: 'files',
            header: {
              'Authorization': `Bearer ${Taro.getStorageSync('token')}`
            },
          });
          const data = JSON.parse(uploadRes.data);
          if (data.data?.urls) {
            const urls = data.data.urls.map((u: string) => u.startsWith('http') ? u : `${UPLOAD_ASSET_BASE_URL}${u}`);
            uploadedUrls.push(...urls);
          }
        } catch (e) {
          console.error('上传失败', e);
        }
      }
      setImages(prev => [...prev, ...uploadedUrls]);
    } catch (e) {
      console.log('取消选择', e);
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveImage = (index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!form.brand || !form.model) {
      Taro.showToast({ title: '请填写品牌和型号', icon: 'none' });
      return;
    }
    setSubmitting(true);
    try {
      await droneService.update(id, {
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
      Taro.showToast({ title: '保存成功', icon: 'success' });
      setTimeout(() => Taro.navigateBack(), 1500);
    } catch (e: any) {
      Taro.showToast({ title: friendlyErrorMessage(e, '保存失败'), icon: 'none' });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <View className="add-drone-wrap"><View className="form-group"><Text style={{ padding: '20px', textAlign: 'center' }}>加载中...</Text></View></View>;
  }

  return (
    <ScrollView scrollY className="add-drone-wrap">
      <View className="form-group">
        <View className="form-item">
          <Text className="form-label">品牌 <Text className="required">*</Text></Text>
          <Input className="form-input" placeholder="例如：DJI" value={form.brand} onInput={e => setForm({ ...form, brand: e.detail.value })} />
        </View>
        <View className="form-item">
          <Text className="form-label">型号 <Text className="required">*</Text></Text>
          <Input className="form-input" placeholder="例如：Mavic 3" value={form.model} onInput={e => setForm({ ...form, model: e.detail.value })} />
        </View>
        <View className="form-item">
          <Text className="form-label">序列号 (SN)</Text>
          <Input className="form-input" placeholder="选填，建议填写以便认证" value={form.serial_number} onInput={e => setForm({ ...form, serial_number: e.detail.value })} />
        </View>
      </View>

      <View className="form-group">
        <View className="form-item">
          <Text className="form-label">最大载重 (kg)</Text>
          <Input className="form-input" type="digit" placeholder="0.0" value={form.max_load} onInput={e => setForm({ ...form, max_load: e.detail.value })} />
        </View>
        <View className="form-item">
          <Text className="form-label">最大续航 (分钟)</Text>
          <Input className="form-input" type="digit" placeholder="0" value={form.max_flight_time} onInput={e => setForm({ ...form, max_flight_time: e.detail.value })} />
        </View>
      </View>

      <View className="form-group">
        <Text className="section-title">租赁设置（选填）</Text>
        <View className="form-item">
          <Text className="form-label">日租金 (元)</Text>
          <Input className="form-input" type="digit" placeholder="0.00" value={form.daily_price} onInput={e => setForm({ ...form, daily_price: e.detail.value })} />
        </View>
        <View className="form-item">
          <Text className="form-label">时租金 (元)</Text>
          <Input className="form-input" type="digit" placeholder="0.00" value={form.hourly_price} onInput={e => setForm({ ...form, hourly_price: e.detail.value })} />
        </View>
        <View className="form-item">
          <Text className="form-label">押金 (元)</Text>
          <Input className="form-input" type="digit" placeholder="0.00" value={form.deposit} onInput={e => setForm({ ...form, deposit: e.detail.value })} />
        </View>
      </View>

      <View className="form-group">
        <Text className="section-title">设备图片 ({images.length}/5)</Text>
        <View className="image-grid">
          {images.map((url, idx) => (
            <View key={idx} className="image-item">
              <Image src={url} className="image-thumb" mode="aspectFill" />
              <View className="image-remove" onClick={() => handleRemoveImage(idx)}>
                <Text className="image-remove-text">✕</Text>
              </View>
            </View>
          ))}
          {images.length < 5 && (
            <View className="image-add-btn" onClick={handlePickImage}>
              <Text className="image-add-icon">{uploading ? '...' : '+'}</Text>
            </View>
          )}
        </View>
      </View>

      <View className="form-group" style={{ borderBottomWidth: 0 }}>
        <Text className="section-title">描述说明</Text>
        <Input className="form-textarea" placeholder="填写设备状况、配件、特殊说明等" value={form.description} onInput={e => setForm({ ...form, description: e.detail.value })} />
      </View>

      <View className="submit-wrap">
        <View className={`btn-primary ${submitting ? 'disabled' : ''}`} onClick={handleSubmit}>
          <Text className="btn-text">{submitting ? '保存中...' : '保存修改'}</Text>
        </View>
      </View>
    </ScrollView>
  );
}
