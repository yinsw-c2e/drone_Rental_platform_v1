import React, {useEffect, useState, useCallback} from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  SafeAreaView, RefreshControl, ActivityIndicator,
} from 'react-native';
import {demandService} from '../../services/demand';
import {CargoDemand} from '../../types';
import {useTheme} from '../../theme/ThemeContext';
import type {AppTheme} from '../../theme/index';

export default function CargoListScreen({navigation}: any) {
  const {theme} = useTheme();
  const styles = getStyles(theme);
  const [cargos, setCargos] = useState<CargoDemand[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  const fetchCargos = useCallback(async (pageNum = 1, isRefresh = false) => {
    try {
      const res = await demandService.listCargos({page: pageNum, page_size: 10});
      const list = res.data?.list || [];
      if (isRefresh || pageNum === 1) {
        setCargos(list);
      } else {
        setCargos(prev => [...prev, ...list]);
      }
      setHasMore(list.length === 10);
    } catch (e) {
      console.warn('获取货运需求列表失败:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchCargos(1, true);
  }, [fetchCargos]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setPage(1);
    fetchCargos(1, true);
  }, [fetchCargos]);

  const onLoadMore = useCallback(() => {
    if (!loading && hasMore) {
      const nextPage = page + 1;
      setPage(nextPage);
      fetchCargos(nextPage);
    }
  }, [loading, hasMore, page, fetchCargos]);

  const getCargoTypeLabel = (type: string) => {
    const typeMap: Record<string, string> = {
      package: '包裹快递',
      equipment: '设备器材',
      material: '物资材料',
      other: '其他货物',
    };
    return typeMap[type] || type;
  };

  const renderItem = ({item}: {item: CargoDemand}) => (
    <TouchableOpacity
      style={styles.item}
      onPress={() => navigation.navigate('CargoDetail', {id: item.id})}>
      <View style={styles.content}>
        <View style={styles.header}>
          <View style={styles.typeBadge}>
            <Text style={styles.typeText}>{getCargoTypeLabel(item.cargo_type)}</Text>
          </View>
          <Text style={styles.weight}>{item.cargo_weight}kg</Text>
        </View>
        <Text style={styles.description} numberOfLines={2}>
          {item.cargo_description || '暂无描述'}
        </Text>
        <View style={styles.addressRow}>
          <Text style={styles.addressLabel}>取货：</Text>
          <Text style={styles.address} numberOfLines={1}>{item.pickup_address}</Text>
        </View>
        <View style={styles.addressRow}>
          <Text style={styles.addressLabel}>送达：</Text>
          <Text style={styles.address} numberOfLines={1}>{item.delivery_address}</Text>
        </View>
        <View style={styles.footer}>
          <Text style={styles.price}>出价：¥{(item.offered_price / 100).toFixed(2)}</Text>
          <Text style={styles.distance}>{item.distance > 0 ? `${item.distance.toFixed(1)}km` : '距离未知'}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  if (loading && cargos.length === 0) {
    return (
      <SafeAreaView style={[styles.container, {backgroundColor: theme.bg}]}>
        <ActivityIndicator style={{marginTop: 100}} color={theme.warning} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, {backgroundColor: theme.bg}]}>
      <FlatList
        data={cargos}
        keyExtractor={item => String(item.id)}
        renderItem={renderItem}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[theme.refreshColor]} />}
        onEndReached={onLoadMore}
        onEndReachedThreshold={0.3}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>📦</Text>
            <Text style={styles.emptyText}>暂无货运需求</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const getStyles = (theme: AppTheme) => StyleSheet.create({
  container: {flex: 1, backgroundColor: theme.bgSecondary},
  item: {
    backgroundColor: theme.card, marginHorizontal: 12, marginVertical: 6,
    borderRadius: 12, padding: 16, borderWidth: 1, borderColor: theme.warning + '44',
  },
  content: {flex: 1},
  header: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8},
  typeBadge: {
    backgroundColor: theme.warning + '22', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 4,
    borderWidth: 1, borderColor: theme.warning + '44',
  },
  typeText: {fontSize: 12, color: theme.warning, fontWeight: '600'},
  weight: {fontSize: 14, color: theme.textSub, fontWeight: '600'},
  description: {fontSize: 14, color: theme.text, marginBottom: 8, lineHeight: 20},
  addressRow: {flexDirection: 'row', alignItems: 'center', marginBottom: 4},
  addressLabel: {fontSize: 12, color: theme.textSub, width: 40},
  address: {flex: 1, fontSize: 12, color: theme.textSub},
  footer: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: theme.divider},
  price: {fontSize: 16, color: theme.warning, fontWeight: 'bold'},
  distance: {fontSize: 12, color: theme.textSub},
  empty: {alignItems: 'center', paddingTop: 100},
  emptyIcon: {fontSize: 64, marginBottom: 16},
  emptyText: {fontSize: 16, color: theme.textSub},
});
