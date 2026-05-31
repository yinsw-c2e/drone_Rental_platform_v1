import React, {useCallback, useMemo, useState} from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {useFocusEffect} from '@react-navigation/native';
import {launchCamera, launchImageLibrary} from 'react-native-image-picker';

import {API_ROOT_URL} from '../../constants';
import {apiV2} from '../../services/api';
import {orderV2Service} from '../../services/orderV2';
import {V2OrderDetail, V2SiteSafetyCheckSummary, V2SiteSafetyChecklistItem} from '../../types';
import {friendlyErrorMessage} from '../../utils/errorMessage';
import {useTheme} from '../../theme/ThemeContext';
import type {AppTheme} from '../../theme/index';

const DEFAULT_CHECKLIST: V2SiteSafetyChecklistItem[] = [
  {key: 'pickup_clearance', label: '起吊点安全距离已确认', checked: false},
  {key: 'dropoff_clearance', label: '落放点安全距离已确认', checked: false},
  {key: 'weather_wind', label: '天气与风速满足作业条件', checked: false},
  {key: 'airspace_area', label: '空域与禁飞区已复核', checked: false},
  {key: 'cargo_fixed', label: '货物固定与吊挂方式已确认', checked: false},
  {key: 'people_isolated', label: '现场人员隔离与警戒已完成', checked: false},
];

const normalizeResponse = <T,>(res: T | {data?: T}) => ((res as any)?.data || res) as T;

const assetUrlOf = (url: string) => {
  if (!url) return '';
  if (/^(https?:|file:|content:|blob:)/.test(url)) return url;
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

export default function SafetyCheckScreen({navigation, route}: any) {
  const {theme} = useTheme();
  const styles = getStyles(theme);
  const orderId = Number(route?.params?.orderId || route?.params?.id || 0);
  const [detail, setDetail] = useState<V2OrderDetail | null>(null);
  const [latest, setLatest] = useState<V2SiteSafetyCheckSummary | null>(null);
  const [checklist, setChecklist] = useState<V2SiteSafetyChecklistItem[]>(DEFAULT_CHECKLIST);
  const [photos, setPhotos] = useState<string[]>([]);
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [errorText, setErrorText] = useState('');

  const readonly = Boolean(latest?.id);
  const checkedCount = useMemo(() => checklist.filter(item => item.checked).length, [checklist]);

  const loadData = useCallback(async () => {
    if (!orderId) {
      setErrorText('缺少订单信息');
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
      const nextDetail = normalizeResponse<V2OrderDetail>(orderRes);
      const nextCheck = checkRes ? normalizeResponse<V2SiteSafetyCheckSummary | null>(checkRes) : null;
      setDetail(nextDetail);
      if (nextCheck?.id) {
        setLatest(nextCheck);
        setChecklist(nextCheck.checklist?.length ? nextCheck.checklist : DEFAULT_CHECKLIST.map(item => ({...item, checked: true})));
        setPhotos(nextCheck.photos || []);
        setNote(nextCheck.note || '');
      } else {
        setLatest(null);
        setChecklist(DEFAULT_CHECKLIST);
        setPhotos([]);
        setNote('');
      }
    } catch (error: any) {
      setErrorText(friendlyErrorMessage(error, '现场复核信息加载失败'));
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData]),
  );

  const goBack = useCallback(() => {
    if (navigation.canGoBack?.()) {
      navigation.goBack();
      return;
    }
    navigation.navigate('Fulfillment', orderId ? {orderId, id: orderId} : undefined);
  }, [navigation, orderId]);

  const toggleItem = useCallback((key: string) => {
    if (readonly) return;
    setChecklist(items => items.map(item => (
      item.key === key ? {...item, checked: !item.checked} : item
    )));
  }, [readonly]);

  const uploadPickedPhotos = useCallback(async (source: 'camera' | 'library') => {
    if (readonly || uploading) return;
    if (photos.length >= 6) {
      Alert.alert('提示', '最多上传6张照片');
      return;
    }
    try {
      const limit = Math.min(6 - photos.length, 3);
      const result = source === 'camera'
        ? await launchCamera({mediaType: 'photo', quality: 0.8, maxWidth: 1200, maxHeight: 1200})
        : await launchImageLibrary({mediaType: 'photo', quality: 0.8, maxWidth: 1200, maxHeight: 1200, selectionLimit: limit});
      if (result.didCancel || !result.assets?.length) return;

      setUploading(true);
      const uploaded: string[] = [];
      for (const asset of result.assets.slice(0, limit)) {
        if (!asset.uri) continue;
        const formData = new FormData();
        formData.append('files', {
          uri: asset.uri,
          type: asset.type || 'image/jpeg',
          name: asset.fileName || 'site-safety.jpg',
        } as any);
        const res: any = await apiV2.post('/drone/upload', formData, {
          headers: {'Content-Type': 'multipart/form-data'},
        });
        const urls = res.data?.urls || res.urls || [];
        if (urls?.length) uploaded.push(...urls.map((url: string) => String(url)));
      }
      if (!uploaded.length) {
        throw new Error('上传后暂时无法获取文件地址，请重试');
      }
      setPhotos(items => [...items, ...uploaded].slice(0, 6));
    } catch (error: any) {
      Alert.alert('上传失败', friendlyErrorMessage(error, '上传失败'));
    } finally {
      setUploading(false);
    }
  }, [photos.length, readonly, uploading]);

  const choosePhoto = useCallback(() => {
    if (readonly) return;
    Alert.alert('上传现场照片', undefined, [
      {text: '拍照', onPress: () => uploadPickedPhotos('camera')},
      {text: '从相册选择', onPress: () => uploadPickedPhotos('library')},
      {text: '取消', style: 'cancel'},
    ]);
  }, [readonly, uploadPickedPhotos]);

  const removePhoto = useCallback((index: number) => {
    if (readonly) return;
    setPhotos(items => items.filter((_, current) => current !== index));
  }, [readonly]);

  const submit = useCallback(async () => {
    if (readonly) {
      goBack();
      return;
    }
    const unchecked = checklist.find(item => !item.checked);
    if (unchecked) {
      Alert.alert('请先完成复核', unchecked.label);
      return;
    }
    if (!photos.length) {
      Alert.alert('请补充照片', '请至少上传一张现场照片');
      return;
    }
    setSubmitting(true);
    try {
      const result = await orderV2Service.submitSiteSafetyCheck(orderId, {
        checklist,
        photos,
        note: note.trim(),
      });
      setLatest(normalizeResponse<V2SiteSafetyCheckSummary>(result));
      Alert.alert('复核已记录', undefined, [{text: '确定', onPress: goBack}]);
    } catch (error: any) {
      Alert.alert('提交失败', friendlyErrorMessage(error, '提交失败'));
    } finally {
      setSubmitting(false);
    }
  }, [checklist, goBack, note, orderId, photos, readonly]);

  return (
    <SafeAreaView style={[styles.container, {backgroundColor: theme.bg}]}>
      {loading ? (
        <View style={styles.centerState}>
          <ActivityIndicator color={theme.primary} />
          <Text style={styles.stateText}>正在读取复核信息</Text>
        </View>
      ) : errorText ? (
        <View style={styles.centerState}>
          <Text style={styles.errorText}>{errorText}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={loadData}>
            <Text style={styles.retryText}>重试</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <ScrollView contentContainerStyle={styles.content}>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>订单信息</Text>
              <Text style={styles.orderTitle}>{detail?.title || detail?.order_no || '--'}</Text>
              <Text style={styles.orderRoute}>{detail?.service_address || '--'} {'->'} {detail?.dest_address || '--'}</Text>
              {readonly ? (
                <Text style={styles.readonlyText}>已于 {formatDateTime(latest?.checked_at)} 完成复核</Text>
              ) : null}
            </View>

            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>复核清单</Text>
                <Text style={styles.cardMeta}>{checkedCount}/{checklist.length}</Text>
              </View>
              {checklist.map(item => (
                <TouchableOpacity
                  key={item.key}
                  activeOpacity={readonly ? 1 : 0.75}
                  style={styles.checkRow}
                  onPress={() => toggleItem(item.key)}>
                  <View style={[styles.checkBox, item.checked && styles.checkBoxActive]}>
                    {item.checked ? <Text style={styles.checkBoxText}>OK</Text> : null}
                  </View>
                  <Text style={styles.checkLabel}>{item.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>现场照片</Text>
                <Text style={styles.cardMeta}>{photos.length}/6</Text>
              </View>
              <View style={styles.photoGrid}>
                {photos.map((photo, index) => (
                  <View key={`${photo}-${index}`} style={styles.photoCell}>
                    <Image source={{uri: assetUrlOf(photo)}} style={styles.photo} resizeMode="cover" />
                    {!readonly ? (
                      <TouchableOpacity style={styles.removePhotoBtn} onPress={() => removePhoto(index)}>
                        <Text style={styles.removePhotoText}>删除</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                ))}
                {!readonly && photos.length < 6 ? (
                  <TouchableOpacity style={styles.addPhotoBtn} onPress={choosePhoto} disabled={uploading}>
                    {uploading ? (
                      <ActivityIndicator color={theme.primary} />
                    ) : (
                      <>
                        <Text style={styles.addPhotoPlus}>+</Text>
                        <Text style={styles.addPhotoText}>上传照片</Text>
                      </>
                    )}
                  </TouchableOpacity>
                ) : null}
              </View>
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>复核备注</Text>
              <TextInput
                style={styles.noteInput}
                editable={!readonly}
                multiline
                maxLength={200}
                value={note}
                placeholder="记录现场限制、客户确认或需后续跟进事项"
                placeholderTextColor={theme.inputPlaceholder}
                onChangeText={setNote}
              />
            </View>
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity
              style={[styles.submitBtn, (submitting || uploading) && styles.submitBtnDisabled]}
              disabled={submitting || uploading}
              onPress={submit}>
              {submitting ? (
                <ActivityIndicator color={theme.btnPrimaryText} />
              ) : (
                <Text style={styles.submitText}>{readonly ? '返回履约安排' : '提交复核'}</Text>
              )}
            </TouchableOpacity>
          </View>
        </>
      )}
    </SafeAreaView>
  );
}

const getStyles = (theme: AppTheme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.bgSecondary,
  },
  centerState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 12,
  },
  stateText: {
    color: theme.textSub,
    fontSize: 14,
  },
  errorText: {
    color: theme.text,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
  retryBtn: {
    borderRadius: 18,
    backgroundColor: theme.primaryBg,
    borderColor: theme.primaryBorder,
    borderWidth: 1,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  retryText: {
    color: theme.primaryText,
    fontWeight: '800',
  },
  content: {
    padding: 16,
    paddingBottom: 108,
    gap: 14,
  },
  card: {
    backgroundColor: theme.card,
    borderColor: theme.cardBorder,
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  cardTitle: {
    color: theme.text,
    fontSize: 16,
    fontWeight: '800',
  },
  cardMeta: {
    color: theme.primaryText,
    fontSize: 13,
    fontWeight: '800',
  },
  orderTitle: {
    marginTop: 12,
    color: theme.text,
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '900',
  },
  orderRoute: {
    marginTop: 8,
    color: theme.textSub,
    fontSize: 13,
    lineHeight: 20,
  },
  readonlyText: {
    marginTop: 10,
    color: theme.success,
    fontSize: 13,
    fontWeight: '700',
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.divider,
  },
  checkBox: {
    width: 26,
    height: 26,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.inputBorder,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.inputBg,
  },
  checkBoxActive: {
    borderColor: theme.primary,
    backgroundColor: theme.primary,
  },
  checkBoxText: {
    color: theme.btnPrimaryText,
    fontSize: 10,
    fontWeight: '900',
  },
  checkLabel: {
    flex: 1,
    color: theme.text,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
  },
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 14,
  },
  photoCell: {
    width: 96,
    height: 96,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: theme.bgTertiary,
  },
  photo: {
    width: 96,
    height: 96,
  },
  removePhotoBtn: {
    position: 'absolute',
    right: 6,
    top: 6,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  removePhotoText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  addPhotoBtn: {
    width: 96,
    height: 96,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: theme.primaryBorder,
    backgroundColor: theme.primaryBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addPhotoPlus: {
    color: theme.primaryText,
    fontSize: 26,
    lineHeight: 30,
    fontWeight: '300',
  },
  addPhotoText: {
    marginTop: 4,
    color: theme.primaryText,
    fontSize: 12,
    fontWeight: '800',
  },
  noteInput: {
    marginTop: 12,
    minHeight: 108,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.inputBorder,
    backgroundColor: theme.inputBg,
    color: theme.inputText,
    paddingHorizontal: 12,
    paddingVertical: 10,
    textAlignVertical: 'top',
    fontSize: 14,
    lineHeight: 20,
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: 16,
    paddingBottom: 28,
    backgroundColor: theme.card,
    borderTopWidth: 1,
    borderTopColor: theme.cardBorder,
  },
  submitBtn: {
    height: 48,
    borderRadius: 14,
    backgroundColor: theme.btnPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitBtnDisabled: {
    opacity: 0.65,
  },
  submitText: {
    color: theme.btnPrimaryText,
    fontSize: 16,
    fontWeight: '900',
  },
});
