import React, {useState, useCallback} from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  FlatList,
  TouchableOpacity,
  Alert,
  RefreshControl,
  TextInput,
  Modal,
  ScrollView,
  Image,
  Platform,
  PermissionsAndroid,
} from 'react-native';
import {useFocusEffect} from '@react-navigation/native';
import {
  launchCamera,
  launchImageLibrary,
  ImagePickerResponse,
} from 'react-native-image-picker';
import {
  listCargoDeclarations,
  createCargoDeclaration,
  CargoDeclaration,
  CreateCargoDeclarationRequest,
} from '../../services/client';
import {useTheme} from '../../theme/ThemeContext';
import type {AppTheme} from '../../theme/index';

let ActionSheetIOS: any;
if (Platform.OS === 'ios') {
  ActionSheetIOS = require('react-native').ActionSheetIOS;
}

const CARGO_CATEGORIES = [
  {label: '普通货物', value: 'normal'},
  {label: '贵重物品', value: 'valuable'},
  {label: '易碎品', value: 'fragile'},
  {label: '危险品', value: 'hazardous'},
  {label: '生鲜', value: 'perishable'},
  {label: '医疗用品', value: 'medical'},
];

const COMPLIANCE_MAP: Record<string, {label: string; colorKey: 'warning' | 'success' | 'danger'}> = {
  pending: {label: '待审核', colorKey: 'warning'},
  approved: {label: '已通过', colorKey: 'success'},
  rejected: {label: '已拒绝', colorKey: 'danger'},
};

export default function CargoDeclarationScreen({navigation}: any) {
  const {theme} = useTheme();
  const styles = getStyles(theme);
  const [declarations, setDeclarations] = useState<CargoDeclaration[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // 表单字段
  const [cargoCategory, setCargoCategory] = useState('normal');
  const [cargoName, setCargoName] = useState('');
  const [cargoDescription, setCargoDescription] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [totalWeight, setTotalWeight] = useState('');
  const [length, setLength] = useState('');
  const [width, setWidth] = useState('');
  const [height, setHeight] = useState('');
  const [declaredValue, setDeclaredValue] = useState('');
  const [requiresInsurance, setRequiresInsurance] = useState(false);
  const [cargoImages, setCargoImages] = useState<string[]>([]);

  const MAX_IMAGES = 4;

  const handleAddImage = () => {
    const pick = async (source: 'camera' | 'library') => {
      if (source === 'camera' && Platform.OS === 'android') {
        const granted = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.CAMERA);
        if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
          Alert.alert('权限不足', '请在设置中允许使用相机');
          return;
        }
      }
      const opts = {mediaType: 'photo' as const, maxWidth: 1280, maxHeight: 1280, quality: 0.8 as const};
      const callback = (res: ImagePickerResponse) => {
        if (res.didCancel || res.errorCode) return;
        const uri = res.assets?.[0]?.uri;
        if (uri) setCargoImages(prev => [...prev, uri]);
      };
      source === 'camera' ? launchCamera(opts, callback) : launchImageLibrary(opts, callback);
    };
    if (Platform.OS === 'ios' && ActionSheetIOS) {
      ActionSheetIOS.showActionSheetWithOptions(
        {options: ['拍照', '从相册选择', '取消'], cancelButtonIndex: 2},
        (i: number) => { if (i === 0) pick('camera'); else if (i === 1) pick('library'); },
      );
    } else {
      Alert.alert('添加图片', '选择图片来源', [
        {text: '拍照', onPress: () => pick('camera')},
        {text: '从相册选择', onPress: () => pick('library')},
        {text: '取消', style: 'cancel'},
      ]);
    }
  };

  const handleRemoveImage = (index: number) => {
    Alert.alert('删除图片', '确定要删除这张图片吗？', [
      {text: '取消', style: 'cancel'},
      {text: '删除', style: 'destructive', onPress: () => {
        setCargoImages(prev => prev.filter((_, i) => i !== index));
      }},
    ]);
  };

  const loadData = async () => {
    try {
      const res = await listCargoDeclarations({page: 1, page_size: 50});
      setDeclarations(res.list || []);
    } catch (e: any) {
      Alert.alert('错误', e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, []),
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const resetForm = () => {
    setCargoCategory('normal');
    setCargoName('');
    setCargoDescription('');
    setQuantity('1');
    setTotalWeight('');
    setLength('');
    setWidth('');
    setHeight('');
    setDeclaredValue('');
    setRequiresInsurance(false);
    setCargoImages([]);
  };

  const getCategoryLabel = (value: string): string => {
    const found = CARGO_CATEGORIES.find(c => c.value === value);
    return found?.label || value;
  };

  const handleSubmit = async () => {
    if (!cargoName.trim()) {
      Alert.alert('提示', '请输入货物名称');
      return;
    }
    if (!totalWeight || isNaN(parseFloat(totalWeight))) {
      Alert.alert('提示', '请输入货物重量');
      return;
    }
    if (!declaredValue || isNaN(parseFloat(declaredValue))) {
      Alert.alert('提示', '请输入申报价值');
      return;
    }

    const data: CreateCargoDeclarationRequest = {
      cargo_category: cargoCategory,
      cargo_name: cargoName.trim(),
      cargo_description: cargoDescription.trim() || undefined,
      quantity: parseInt(quantity, 10) || 1,
      total_weight: parseFloat(totalWeight),
      length: length ? parseFloat(length) : undefined,
      width: width ? parseFloat(width) : undefined,
      height: height ? parseFloat(height) : undefined,
      declared_value: Math.round(parseFloat(declaredValue) * 100), // 元转分
      requires_insurance: requiresInsurance,
      cargo_images: cargoImages.length > 0 ? cargoImages : undefined,
    };

    setSubmitting(true);
    try {
      await createCargoDeclaration(data);
      Alert.alert('成功', '货物申报已提交');
      setShowModal(false);
      resetForm();
      loadData();
    } catch (e: any) {
      Alert.alert('提交失败', e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const renderItem = ({item}: {item: CargoDeclaration}) => {
    const compliance = COMPLIANCE_MAP[item.compliance_status] || COMPLIANCE_MAP.pending;
    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.cardHeaderLeft}>
            <Text style={styles.cargoName}>{item.cargo_name}</Text>
            <Text style={styles.declarationNo}>{item.declaration_no}</Text>
          </View>
          <View style={[styles.statusBadge, {backgroundColor: theme[compliance.colorKey] + '20'}]}>
            <Text style={[styles.statusText, {color: theme[compliance.colorKey]}]}>
              {compliance.label}
            </Text>
          </View>
        </View>

        <View style={styles.cardBody}>
          <View style={styles.infoRow}>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>类别</Text>
              <Text style={styles.infoValue}>{getCategoryLabel(item.cargo_category)}</Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>数量</Text>
              <Text style={styles.infoValue}>{item.quantity}件</Text>
            </View>
          </View>
          <View style={styles.infoRow}>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>重量</Text>
              <Text style={styles.infoValue}>{item.total_weight}kg</Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>申报价值</Text>
              <Text style={styles.infoValue}>
                ¥{(item.declared_value / 100).toFixed(2)}
              </Text>
            </View>
          </View>
          {(item.length > 0 || item.width > 0 || item.height > 0) && (
            <View style={styles.sizeRow}>
              <Text style={styles.sizeText}>
                尺寸: {item.length || '-'} × {item.width || '-'} × {item.height || '-'} cm
              </Text>
            </View>
          )}
        </View>
        <Text style={styles.cardDate}>
          {item.created_at?.substring(0, 10)}
        </Text>
      </View>
    );
  };

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyText}>暂无货物申报</Text>
      <Text style={styles.emptySubText}>下单前需要先申报货物信息</Text>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, {backgroundColor: theme.bg}]}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>加载中...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, {backgroundColor: theme.bg}]}>
      <FlatList
        data={declarations}
        renderItem={renderItem}
        keyExtractor={item => item.id.toString()}
        ListHeaderComponent={
          <TouchableOpacity
            style={styles.addBtn}
            onPress={() => {
              resetForm();
              setShowModal(true);
            }}>
            <Text style={styles.addBtnIcon}>+</Text>
            <Text style={styles.addBtnText}>新建货物申报</Text>
          </TouchableOpacity>
        }
        ListEmptyComponent={renderEmpty}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        contentContainerStyle={styles.listContent}
      />

      {/* 新建申报弹窗 */}
      <Modal
        visible={showModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>货物申报</Text>
              <TouchableOpacity onPress={() => setShowModal(false)}>
                <Text style={styles.modalClose}>×</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              {/* 货物类别 */}
              <Text style={styles.label}>货物类别</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.categoryContainer}>
                  {CARGO_CATEGORIES.map(cat => (
                    <TouchableOpacity
                      key={cat.value}
                      style={[
                        styles.categoryOption,
                        cargoCategory === cat.value && styles.categoryOptionActive,
                      ]}
                      onPress={() => setCargoCategory(cat.value)}>
                      <Text
                        style={[
                          styles.categoryText,
                          cargoCategory === cat.value && styles.categoryTextActive,
                        ]}>
                        {cat.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>

              {/* 货物名称 */}
              <Text style={styles.label}>货物名称 *</Text>
              <TextInput
                style={styles.input}
                placeholder="请输入货物名称"
                value={cargoName}
                onChangeText={setCargoName}
              />

              {/* 货物描述 */}
              <Text style={styles.label}>货物描述</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="选填，描述货物的特殊要求"
                value={cargoDescription}
                onChangeText={setCargoDescription}
                multiline
                numberOfLines={3}
              />

              {/* 数量和重量 */}
              <View style={styles.row}>
                <View style={styles.halfInput}>
                  <Text style={styles.label}>数量 *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="1"
                    value={quantity}
                    onChangeText={setQuantity}
                    keyboardType="numeric"
                  />
                </View>
                <View style={styles.halfInput}>
                  <Text style={styles.label}>总重量 (kg) *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="如: 5.5"
                    value={totalWeight}
                    onChangeText={setTotalWeight}
                    keyboardType="numeric"
                  />
                </View>
              </View>

              {/* 尺寸 */}
              <Text style={styles.label}>尺寸 (cm)</Text>
              <View style={styles.sizeInputRow}>
                <TextInput
                  style={[styles.input, styles.sizeInput]}
                  placeholder="长"
                  value={length}
                  onChangeText={setLength}
                  keyboardType="numeric"
                />
                <Text style={styles.sizeX}>×</Text>
                <TextInput
                  style={[styles.input, styles.sizeInput]}
                  placeholder="宽"
                  value={width}
                  onChangeText={setWidth}
                  keyboardType="numeric"
                />
                <Text style={styles.sizeX}>×</Text>
                <TextInput
                  style={[styles.input, styles.sizeInput]}
                  placeholder="高"
                  value={height}
                  onChangeText={setHeight}
                  keyboardType="numeric"
                />
              </View>

              {/* 申报价值 */}
              <Text style={styles.label}>申报价值 (元) *</Text>
              <TextInput
                style={styles.input}
                placeholder="如: 1000.00"
                value={declaredValue}
                onChangeText={setDeclaredValue}
                keyboardType="numeric"
              />

              {/* 是否保价 */}
              <TouchableOpacity
                style={styles.checkboxRow}
                onPress={() => setRequiresInsurance(!requiresInsurance)}>
                <View style={[styles.checkbox, requiresInsurance && styles.checkboxActive]}>
                  {requiresInsurance && <Text style={styles.checkboxMark}>✓</Text>}
                </View>
                <Text style={styles.checkboxLabel}>需要保价运输</Text>
              </TouchableOpacity>

              {/* 货物照片 */}
              <Text style={styles.label}>货物照片（可选，最多{MAX_IMAGES}张）</Text>
              <View style={styles.imageGrid}>
                {cargoImages.map((uri, index) => (
                  <View key={index} style={styles.imageWrapper}>
                    <Image source={{uri}} style={styles.imageThumb} />
                    <TouchableOpacity
                      style={styles.imageRemoveBtn}
                      onPress={() => handleRemoveImage(index)}>
                      <Text style={styles.imageRemoveText}>×</Text>
                    </TouchableOpacity>
                  </View>
                ))}
                {cargoImages.length < MAX_IMAGES && (
                  <TouchableOpacity style={styles.imageAddBtn} onPress={handleAddImage}>
                    <Text style={styles.imageAddIcon}>+</Text>
                    <Text style={styles.imageAddText}>添加照片</Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* 提交 */}
              <TouchableOpacity
                style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
                onPress={handleSubmit}
                disabled={submitting}>
                <Text style={styles.submitBtnText}>
                  {submitting ? '提交中...' : '提交申报'}
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const getStyles = (theme: AppTheme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.bgSecondary,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: theme.textSub,
  },
  listContent: {
    paddingBottom: 24,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.primary,
    marginHorizontal: 16,
    marginTop: 16,
    paddingVertical: 14,
    borderRadius: 8,
  },
  addBtnIcon: {
    fontSize: 20,
    color: theme.btnPrimaryText,
    marginRight: 8,
  },
  addBtnText: {
    fontSize: 16,
    color: theme.btnPrimaryText,
    fontWeight: '600',
  },
  emptyContainer: {
    paddingTop: 60,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: theme.textSub,
    marginBottom: 8,
  },
  emptySubText: {
    fontSize: 14,
    color: theme.textSub,
  },
  card: {
    backgroundColor: theme.card,
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 12,
    padding: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardHeaderLeft: {
    flex: 1,
  },
  cargoName: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.text,
  },
  declarationNo: {
    fontSize: 12,
    color: theme.textSub,
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
  },
  cardBody: {
    borderTopWidth: 1,
    borderTopColor: theme.divider,
    paddingTop: 12,
  },
  infoRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  infoItem: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 12,
    color: theme.textSub,
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 14,
    color: theme.text,
    fontWeight: '500',
  },
  sizeRow: {
    marginTop: 4,
  },
  sizeText: {
    fontSize: 12,
    color: theme.textSub,
  },
  cardDate: {
    fontSize: 12,
    color: theme.textSub,
    marginTop: 8,
    textAlign: 'right',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: theme.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.divider,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.text,
  },
  modalClose: {
    fontSize: 28,
    color: theme.textSub,
  },
  modalBody: {
    padding: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.text,
    marginBottom: 8,
    marginTop: 14,
  },
  input: {
    height: 48,
    borderWidth: 1,
    borderColor: theme.divider,
    borderRadius: 8,
    paddingHorizontal: 16,
    fontSize: 16,
    backgroundColor: theme.bgSecondary,
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
    paddingTop: 12,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  halfInput: {
    flex: 1,
  },
  sizeInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sizeInput: {
    flex: 1,
  },
  sizeX: {
    fontSize: 16,
    color: theme.textSub,
    marginHorizontal: 8,
  },
  categoryContainer: {
    flexDirection: 'row',
    paddingVertical: 4,
  },
  categoryOption: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: theme.divider,
    borderRadius: 16,
    marginRight: 8,
  },
  categoryOptionActive: {
    backgroundColor: theme.primary,
    borderColor: theme.primary,
  },
  categoryText: {
    fontSize: 13,
    color: theme.textSub,
  },
  categoryTextActive: {
    color: theme.btnPrimaryText,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderWidth: 2,
    borderColor: theme.divider,
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  checkboxActive: {
    backgroundColor: theme.primary,
    borderColor: theme.primary,
  },
  checkboxMark: {
    color: theme.btnPrimaryText,
    fontSize: 14,
    fontWeight: 'bold',
  },
  checkboxLabel: {
    fontSize: 14,
    color: theme.text,
  },
  submitBtn: {
    height: 50,
    backgroundColor: theme.primary,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 40,
  },
  submitBtnDisabled: {
    backgroundColor: theme.cardBorder,
  },
  submitBtnText: {
    color: theme.btnPrimaryText,
    fontSize: 18,
    fontWeight: 'bold',
  },
  imageGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  imageWrapper: {
    position: 'relative',
  },
  imageThumb: {
    width: 80,
    height: 80,
    borderRadius: 8,
    backgroundColor: theme.divider,
  },
  imageRemoveBtn: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: theme.danger,
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageRemoveText: {
    color: theme.btnPrimaryText,
    fontSize: 13,
    fontWeight: 'bold',
    lineHeight: 18,
  },
  imageAddBtn: {
    width: 80,
    height: 80,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.divider,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.bgSecondary,
  },
  imageAddIcon: {
    fontSize: 24,
    color: theme.textSub,
  },
  imageAddText: {
    fontSize: 11,
    color: theme.textSub,
    marginTop: 2,
  },
});
