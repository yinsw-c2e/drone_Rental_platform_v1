import Taro, { useDidShow } from '@tarojs/taro';
import React, { useCallback, useMemo, useState } from 'react';
import { Image, ScrollView, Text, Textarea, View } from '@tarojs/components';

import { API_ROOT_URL } from '../../../constants';
import { orderV2Service } from '../../../services/orderV2';
import { uploadFileToEndpoint } from '../../../services/user';
import { V2OrderDetail, V2SiteSafetyCheckSummary, V2SiteSafetyChecklistItem } from '../../../types';
import './index.scss';

const DEFAULT_CHECKLIST: V2SiteSafetyChecklistItem[] = [
  { key: 'pickup_clearance', label: '起吊点安全距离已确认', checked: false },
  { key: 'dropoff_clearance', label: '落放点安全距离已确认', checked: false },
  { key: 'weather_wind', label: '天气与风速满足作业条件', checked: false },
  { key: 'airspace_area', label: '空域与禁飞区已复核', checked: false },
  { key: 'cargo_fixed', label: '货物固定与吊挂方式已确认', checked: false },
  { key: 'people_isolated', label: '现场人员隔离与警戒已完成', checked: false },
];

const normalizeResponse = <T,>(res: T | { data?: T }) => ((res as any)?.data || res) as T;

const assetUrlOf = (url: string) => {
  if (!url) return '';
  if (/^(https?:|wxfile:|blob:)/.test(url)) return url;
  return `${API_ROOT_URL}${url}`;
};

const formatDateTime = (value?: string) => {
  if (!value) return '--';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.replace('T', ' ').slice(0, 16);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const h = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${d} ${h}:${min}`;
};

export default function FulfillmentSafetyCheckPage() {
  const params = Taro.getCurrentInstance().router?.params || {};
  const orderId = Number(params.orderId || params.id || 0);

  const [detail, setDetail] = useState<V2OrderDetail | null>(null);
  const [latest, setLatest] = useState<V2SiteSafetyCheckSummary | null>(null);
  const [checklist, setChecklist] = useState<V2SiteSafetyChecklistItem[]>(DEFAULT_CHECKLIST);
  const [photos, setPhotos] = useState<string[]>([]);
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorText, setErrorText] = useState('');

  const readonly = Boolean(latest?.id);
  const checkedCount = useMemo(() => checklist.filter((item) => item.checked).length, [checklist]);

  const loadData = useCallback(async () => {
    if (!orderId) {
      setErrorText('缺少订单ID');
      setLoading(false);
      return;
    }

    setLoading(true);
    setErrorText('');
    try {
      const [orderRes, checkRes] = await Promise.all([
        orderV2Service.get(orderId),
        orderV2Service.getLatestSiteSafetyCheck(orderId).catch(() => null),
      ]);
      const nextDetail = normalizeResponse(orderRes);
      const nextCheck = checkRes ? normalizeResponse(checkRes) : null;
      setDetail(nextDetail);
      if (nextCheck?.id) {
        setLatest(nextCheck);
        setChecklist(nextCheck.checklist?.length ? nextCheck.checklist : DEFAULT_CHECKLIST.map((item) => ({ ...item, checked: true })));
        setPhotos(nextCheck.photos || []);
        setNote(nextCheck.note || '');
      } else {
        setLatest(null);
        setChecklist(DEFAULT_CHECKLIST);
        setPhotos([]);
        setNote('');
      }
    } catch (error: any) {
      setErrorText(error?.message || '现场复核信息加载失败');
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useDidShow(() => {
    loadData();
  });

  const goBack = () => {
    const pages = Taro.getCurrentPages();
    if (pages.length > 1) {
      Taro.navigateBack();
      return;
    }
    Taro.navigateTo({ url: '/pages/fulfillment/hub/index' }).catch(() => null);
  };

  const toggleItem = (key: string) => {
    if (readonly) return;
    setChecklist((items) => items.map((item) => (
      item.key === key ? { ...item, checked: !item.checked } : item
    )));
  };

  const chooseAndUpload = async () => {
    if (readonly) return;
    if (photos.length >= 6) {
      Taro.showToast({ title: '最多上传6张照片', icon: 'none' });
      return;
    }
    try {
      const picked = await Taro.chooseImage({
        count: Math.min(6 - photos.length, 3),
        sourceType: ['camera', 'album'],
      });
      if (!picked.tempFilePaths.length) return;
      Taro.showLoading({ title: '上传中' });
      const uploaded: string[] = [];
      for (const filePath of picked.tempFilePaths) {
        const result = await uploadFileToEndpoint('/drone/upload', filePath, 'files');
        const url = result?.urls?.[0];
        if (url) uploaded.push(url);
      }
      if (!uploaded.length) {
        throw new Error('未获取到上传地址');
      }
      setPhotos((items) => [...items, ...uploaded].slice(0, 6));
    } catch (error: any) {
      Taro.showToast({ title: error?.message || '上传失败', icon: 'none' });
    } finally {
      Taro.hideLoading();
    }
  };

  const removePhoto = (index: number) => {
    if (readonly) return;
    setPhotos((items) => items.filter((_, current) => current !== index));
  };

  const previewPhoto = (index: number) => {
    const urls = photos.map(assetUrlOf).filter(Boolean);
    if (!urls.length) return;
    Taro.previewImage({ urls, current: urls[index] }).catch(() => null);
  };

  const submit = async () => {
    if (readonly) {
      goBack();
      return;
    }
    const unchecked = checklist.find((item) => !item.checked);
    if (unchecked) {
      Taro.showToast({ title: unchecked.label, icon: 'none' });
      return;
    }
    if (!photos.length) {
      Taro.showToast({ title: '请至少上传一张现场照片', icon: 'none' });
      return;
    }
    setSubmitting(true);
    try {
      const result = await orderV2Service.submitSiteSafetyCheck(orderId, {
        checklist,
        photos,
        note: note.trim(),
      });
      const nextCheck = normalizeResponse(result);
      setLatest(nextCheck);
      Taro.showToast({ title: '复核已记录', icon: 'success' });
      setTimeout(() => goBack(), 700);
    } catch (error: any) {
      Taro.showToast({ title: error?.message || '提交失败', icon: 'none' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View className="safety-page">
      <View className="safety-nav">
        <View className="safety-nav-back" onClick={goBack}><Text className="safety-nav-back-text">‹</Text></View>
        <Text className="safety-nav-title">现场安全复核</Text>
      </View>

      <ScrollView scrollY className="safety-scroll" enhanced showScrollbar={false}>
        {loading ? (
          <View className="safety-state"><Text className="safety-state-text">正在读取复核信息</Text></View>
        ) : errorText ? (
          <View className="safety-state">
            <Text className="safety-state-text">{errorText}</Text>
            <View className="safety-state-btn" onClick={loadData}><Text>重试</Text></View>
          </View>
        ) : (
          <View className="safety-content">
            <View className="safety-card safety-order-card">
              <Text className="safety-card-title">订单信息</Text>
              <Text className="safety-order-title">{detail?.title || detail?.order_no || '--'}</Text>
              <Text className="safety-order-desc">{detail?.service_address || '--'} → {detail?.dest_address || '--'}</Text>
              {readonly && <Text className="safety-order-status">已于 {formatDateTime(latest?.checked_at)} 完成复核</Text>}
            </View>

            <View className="safety-card">
              <View className="safety-card-header">
                <Text className="safety-card-title">复核清单</Text>
                <Text className="safety-card-meta">{checkedCount}/{checklist.length}</Text>
              </View>
              {checklist.map((item) => (
                <View key={item.key} className="safety-check-row" onClick={() => toggleItem(item.key)}>
                  <View className={`safety-check-box ${item.checked ? 'active' : ''}`}>
                    {item.checked && <Text className="safety-check-box-text">OK</Text>}
                  </View>
                  <Text className="safety-check-label">{item.label}</Text>
                </View>
              ))}
            </View>

            <View className="safety-card">
              <View className="safety-card-header">
                <Text className="safety-card-title">现场照片</Text>
                <Text className="safety-card-meta">{photos.length}/6</Text>
              </View>
              <View className="safety-photo-grid">
                {photos.map((photo, index) => (
                  <View key={`${photo}-${index}`} className="safety-photo-cell">
                    <Image className="safety-photo" mode="aspectFill" src={assetUrlOf(photo)} onClick={() => previewPhoto(index)} />
                    {!readonly && <View className="safety-photo-remove" onClick={() => removePhoto(index)}><Text>删除</Text></View>}
                  </View>
                ))}
                {!readonly && photos.length < 6 && (
                  <View className="safety-photo-add" onClick={chooseAndUpload}>
                    <Text className="safety-photo-add-plus">+</Text>
                    <Text className="safety-photo-add-text">上传照片</Text>
                  </View>
                )}
              </View>
            </View>

            <View className="safety-card">
              <Text className="safety-card-title">复核备注</Text>
              <Textarea
                className="safety-note"
                disabled={readonly}
                maxlength={200}
                value={note}
                placeholder="记录现场限制、客户确认或需后续跟进事项"
                onInput={(event) => setNote(event.detail.value)}
              />
            </View>
          </View>
        )}
      </ScrollView>

      {!loading && !errorText && (
        <View className="safety-footer">
          <View className={`safety-submit ${submitting ? 'disabled' : ''}`} onClick={submitting ? undefined : submit}>
            <Text className="safety-submit-text">{readonly ? '返回履约安排' : submitting ? '提交中...' : '提交复核'}</Text>
          </View>
        </View>
      )}
    </View>
  );
}
