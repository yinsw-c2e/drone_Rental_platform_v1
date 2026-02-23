import React, {useEffect, useState, useCallback} from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  SafeAreaView, ActivityIndicator, RefreshControl,
} from 'react-native';
import {demandService} from '../../services/demand';
import {CargoDemand} from '../../types';

export default function MyCargoScreen({navigation}: any) {
  const [cargos, setCargos] = useState<CargoDemand[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const res = await demandService.myCargos({page: 1, page_size: 100});
      setCargos(res.data?.list || []);
    } catch (e) {
      console.warn('获取我的货运失败:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData();
  }, [fetchData]);

  const getCargoTypeLabel = (type: string) => {
    const typeMap: Record<string, string> = {
      package: '包裹快递',
      equipment: '设备器材',
      material: '物资材料',
      other: '其他货物',
    };
    return typeMap[type] || type;
  };

  const getStatusText = (status: string) => {
    const statusMap: Record<string, string> = {
      active: '待接单',
      matched: '已匹配',
      in_progress: '运输中',
      completed: '已完成',
      cancelled: '已取消',
    };
    return statusMap[status] || status;
  };

  const getStatusColor = (status: string) => {
    const colorMap: Record<string, string> = {
      active: '#52c41a',
      matched: '#1890ff',
      in_progress: '#fa8c16',
      completed: '#999',
      cancelled: '#999',
    };
    return colorMap[status] || '#999';
  };

  const renderItem = ({item}: {item: CargoDemand}) => (
    <TouchableOpacity
      style={styles.item}
      onPress={() => navigation.navigate('CargoDetail', {id: item.id})}>
      <View style={styles.header}>
        <View style={styles.typeBadge}>
          <Text style={styles.typeText}>{getCargoTypeLabel(item.cargo_type)}</Text>
        </View>
        <View style={[styles.statusBadge, {backgroundColor: getStatusColor(item.status) + '20'}]}>
          <Text style={[styles.statusText, {color: getStatusColor(item.status)}]}>
            {getStatusText(item.status)}
          </Text>
        </View>
      </View>
      <Text style={styles.description} numberOfLines={2}>
        {item.cargo_description || '暂无描述'}
      </Text>
      <View style={styles.addressRow}>
        <Text style={styles.addressIcon}>🔵</Text>
        <Text style={styles.address} numberOfLines={1}>{item.pickup_address}</Text>
      </View>
      <View style={styles.addressRow}>
        <Text style={styles.addressIcon}>🔴</Text>
        <Text style={styles.address} numberOfLines={1}>{item.delivery_address}</Text>
      </View>
      <View style={styles.footer}>
        <Text style={styles.weight}>{item.cargo_weight}kg</Text>
        <Text style={styles.price}>¥{(item.offered_price / 100).toFixed(2)}</Text>
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator style={{marginTop: 100}} color="#fa8c16" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        data={cargos}
        keyExtractor={item => String(item.id)}
        renderItem={renderItem}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#fa8c16']} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>📦</Text>
            <Text style={styles.emptyText}>暂无货运需求</Text>
            <TouchableOpacity
              style={styles.publishBtn}
              onPress={() => navigation.navigate('PublishCargo')}>
              <Text style={styles.publishBtnText}>发布货运需求</Text>
            </TouchableOpacity>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#f5f5f5'},
  item: {
    backgroundColor: '#fff', marginHorizontal: 16, marginVertical: 8,
    borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#ffe7d3',
  },
  header: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8},
  typeBadge: {
    backgroundColor: '#fff7e6', paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 4, borderWidth: 1, borderColor: '#ffd591',
  },
  typeText: {fontSize: 12, color: '#fa8c16', fontWeight: '600'},
  statusBadge: {paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12},
  statusText: {fontSize: 12, fontWeight: '600'},
  description: {fontSize: 14, color: '#333', marginBottom: 8, lineHeight: 20},
  addressRow: {flexDirection: 'row', alignItems: 'center', marginBottom: 4},
  addressIcon: {fontSize: 14, marginRight: 6},
  address: {flex: 1, fontSize: 13, color: '#666'},
  footer: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#f0f0f0',
  },
  weight: {fontSize: 14, color: '#666', fontWeight: '600'},
  price: {fontSize: 16, color: '#fa8c16', fontWeight: 'bold'},
  empty: {alignItems: 'center', paddingTop: 100},
  emptyIcon: {fontSize: 64, marginBottom: 16},
  emptyText: {fontSize: 16, color: '#999', marginBottom: 24},
  publishBtn: {
    paddingHorizontal: 32, paddingVertical: 12, backgroundColor: '#fa8c16',
    borderRadius: 24,
  },
  publishBtnText: {color: '#fff', fontSize: 15, fontWeight: '600'},
});
