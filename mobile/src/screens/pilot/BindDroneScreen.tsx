import React, {useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Alert,
  TextInput,
  FlatList,
} from 'react-native';
import {
  bindDrone,
  BindDroneRequest,
} from '../../services/pilot';
import {droneService} from '../../services/drone';
import {Drone} from '../../types';
import {useTheme} from '../../theme/ThemeContext';
import type {AppTheme} from '../../theme/index';

const BINDING_TYPES = [
  {label: '自有无人机', value: 'owner'},
  {label: '授权使用', value: 'authorized'},
  {label: '租赁使用', value: 'rented'},
  {label: '临时绑定', value: 'temporary'},
];

export default function BindDroneScreen({navigation}: any) {
  const {theme} = useTheme();
  const styles = getStyles(theme);
  const [searchText, setSearchText] = useState('');
  const [searchResults, setSearchResults] = useState<Drone[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedDrone, setSelectedDrone] = useState<Drone | null>(null);
  const [bindingType, setBindingType] = useState('authorized');
  const [effectiveFrom, setEffectiveFrom] = useState('');
  const [effectiveTo, setEffectiveTo] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSearch = async () => {
    if (!searchText.trim()) {
      Alert.alert('提示', '请输入无人机编号或型号');
      return;
    }

    setSearching(true);
    try {
      const res = await droneService.list({page: 1, page_size: 20});
      const allDrones = res.data?.list || [];
      // 按编号或型号过滤
      const query = searchText.trim().toLowerCase();
      const filtered = allDrones.filter(
        d =>
          d.serial_number?.toLowerCase().includes(query) ||
          d.model?.toLowerCase().includes(query) ||
          d.brand?.toLowerCase().includes(query),
      );
      setSearchResults(filtered);
      if (filtered.length === 0) {
        Alert.alert('提示', '未找到匹配的无人机');
      }
    } catch (e: any) {
      Alert.alert('搜索失败', e.message);
    } finally {
      setSearching(false);
    }
  };

  const validateDate = (dateStr: string): boolean => {
    const regex = /^\d{4}-\d{2}-\d{2}$/;
    return regex.test(dateStr);
  };

  const handleSubmit = async () => {
    if (!selectedDrone) {
      Alert.alert('提示', '请选择要绑定的无人机');
      return;
    }
    if (!effectiveFrom || !validateDate(effectiveFrom)) {
      Alert.alert('提示', '请输入正确的生效日期 (格式: YYYY-MM-DD)');
      return;
    }
    if (effectiveTo && !validateDate(effectiveTo)) {
      Alert.alert('提示', '到期日期格式不正确 (格式: YYYY-MM-DD)');
      return;
    }

    const data: BindDroneRequest = {
      drone_id: selectedDrone.id,
      binding_type: bindingType,
      effective_from: effectiveFrom,
      effective_to: effectiveTo || undefined,
    };

    setSubmitting(true);
    try {
      await bindDrone(data);
      Alert.alert('成功', '无人机绑定申请已提交', [
        {text: '确定', onPress: () => navigation.goBack()},
      ]);
    } catch (e: any) {
      Alert.alert('绑定失败', e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const renderDroneItem = ({item}: {item: Drone}) => {
    const isSelected = selectedDrone?.id === item.id;
    return (
      <TouchableOpacity
        style={[styles.droneCard, isSelected && styles.droneCardSelected]}
        onPress={() => setSelectedDrone(item)}>
        <View style={styles.droneHeader}>
          <View style={styles.droneIcon}>
            <Text style={styles.droneIconText}>
              {item.brand?.charAt(0)?.toUpperCase() || 'D'}
            </Text>
          </View>
          <View style={styles.droneInfo}>
            <Text style={styles.droneName}>{item.brand} {item.model}</Text>
            <Text style={styles.droneSerial}>编号: {item.serial_number}</Text>
          </View>
          {isSelected && (
            <View style={styles.checkMark}>
              <Text style={styles.checkMarkText}>✓</Text>
            </View>
          )}
        </View>
        <View style={styles.droneSpecs}>
          <View style={styles.specItem}>
            <Text style={styles.specValue}>{item.max_load}kg</Text>
            <Text style={styles.specLabel}>载重</Text>
          </View>
          <View style={styles.specItem}>
            <Text style={styles.specValue}>{item.max_flight_time}min</Text>
            <Text style={styles.specLabel}>航时</Text>
          </View>
          <View style={styles.specItem}>
            <Text style={styles.specValue}>{item.max_distance}km</Text>
            <Text style={styles.specLabel}>航程</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={[styles.container, {backgroundColor: theme.bg}]}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* 搜索区域 */}
        <Text style={styles.sectionTitle}>搜索无人机</Text>
        <View style={styles.searchBar}>
          <TextInput
            style={styles.searchInput}
            placeholder="输入无人机编号、型号或品牌"
            value={searchText}
            onChangeText={setSearchText}
            onSubmitEditing={handleSearch}
            returnKeyType="search"
          />
          <TouchableOpacity
            style={styles.searchBtn}
            onPress={handleSearch}
            disabled={searching}>
            <Text style={styles.searchBtnText}>
              {searching ? '搜索中...' : '搜索'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* 搜索结果 */}
        {searchResults.length > 0 && (
          <View>
            <Text style={styles.sectionTitle}>
              搜索结果 ({searchResults.length})
            </Text>
            {searchResults.map(drone => (
              <View key={drone.id}>
                {renderDroneItem({item: drone})}
              </View>
            ))}
          </View>
        )}

        {/* 绑定信息 */}
        {selectedDrone && (
          <View style={styles.bindingForm}>
            <Text style={styles.sectionTitle}>绑定信息</Text>

            <Text style={styles.selectedInfo}>
              已选择: {selectedDrone.brand} {selectedDrone.model} ({selectedDrone.serial_number})
            </Text>

            {/* 绑定类型 */}
            <Text style={styles.label}>绑定类型</Text>
            <View style={styles.typeContainer}>
              {BINDING_TYPES.map(type => (
                <TouchableOpacity
                  key={type.value}
                  style={[
                    styles.typeOption,
                    bindingType === type.value && styles.typeOptionActive,
                  ]}
                  onPress={() => setBindingType(type.value)}>
                  <Text
                    style={[
                      styles.typeOptionText,
                      bindingType === type.value && styles.typeOptionTextActive,
                    ]}>
                    {type.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* 生效日期 */}
            <Text style={styles.label}>生效日期 *</Text>
            <TextInput
              style={styles.input}
              placeholder="YYYY-MM-DD"
              value={effectiveFrom}
              onChangeText={setEffectiveFrom}
            />

            {/* 到期日期 */}
            <Text style={styles.label}>到期日期 (选填，不填为长期)</Text>
            <TextInput
              style={styles.input}
              placeholder="YYYY-MM-DD"
              value={effectiveTo}
              onChangeText={setEffectiveTo}
            />

            {/* 提交 */}
            <TouchableOpacity
              style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
              onPress={handleSubmit}
              disabled={submitting}>
              <Text style={styles.submitBtnText}>
                {submitting ? '提交中...' : '确认绑定'}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const getStyles = (theme: AppTheme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.bgSecondary,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.text,
    marginTop: 16,
    marginBottom: 12,
  },
  searchBar: {
    flexDirection: 'row',
    gap: 10,
  },
  searchInput: {
    flex: 1,
    height: 48,
    borderWidth: 1,
    borderColor: theme.divider,
    borderRadius: 8,
    paddingHorizontal: 16,
    fontSize: 16,
    backgroundColor: theme.card,
  },
  searchBtn: {
    height: 48,
    paddingHorizontal: 20,
    backgroundColor: theme.primary,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchBtnText: {
    color: theme.btnPrimaryText,
    fontSize: 16,
    fontWeight: '600',
  },
  droneCard: {
    backgroundColor: theme.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  droneCardSelected: {
    borderColor: theme.primary,
  },
  droneHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  droneIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.primaryBg,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  droneIconText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.primaryText,
  },
  droneInfo: {
    flex: 1,
  },
  droneName: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.text,
  },
  droneSerial: {
    fontSize: 13,
    color: theme.textSub,
    marginTop: 2,
  },
  checkMark: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: theme.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkMarkText: {
    color: theme.btnPrimaryText,
    fontSize: 16,
    fontWeight: 'bold',
  },
  droneSpecs: {
    flexDirection: 'row',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: theme.divider,
  },
  specItem: {
    flex: 1,
    alignItems: 'center',
  },
  specValue: {
    fontSize: 15,
    fontWeight: 'bold',
    color: theme.primaryText,
  },
  specLabel: {
    fontSize: 12,
    color: theme.textSub,
    marginTop: 4,
  },
  bindingForm: {
    marginTop: 8,
  },
  selectedInfo: {
    fontSize: 14,
    color: theme.primaryText,
    backgroundColor: theme.primaryBg,
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
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
    backgroundColor: theme.card,
  },
  typeContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  typeOption: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: theme.divider,
    borderRadius: 20,
    marginRight: 8,
    marginBottom: 8,
  },
  typeOptionActive: {
    backgroundColor: theme.primary,
    borderColor: theme.primary,
  },
  typeOptionText: {
    fontSize: 14,
    color: theme.textSub,
  },
  typeOptionTextActive: {
    color: theme.btnPrimaryText,
  },
  submitBtn: {
    height: 50,
    backgroundColor: theme.primary,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 24,
  },
  submitBtnDisabled: {
    backgroundColor: theme.cardBorder,
  },
  submitBtnText: {
    color: theme.btnPrimaryText,
    fontSize: 18,
    fontWeight: 'bold',
  },
});
