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
} from 'react-native';
import {useFocusEffect} from '@react-navigation/native';
import {
  getBoundDrones,
  unbindDrone,
  PilotDroneBinding,
} from '../../services/pilot';

const BINDING_STATUS_MAP: Record<string, {label: string; color: string}> = {
  active: {label: '生效中', color: '#52c41a'},
  pending: {label: '待确认', color: '#faad14'},
  expired: {label: '已过期', color: '#999'},
  cancelled: {label: '已取消', color: '#ff4d4f'},
};

const BINDING_TYPE_MAP: Record<string, string> = {
  owner: '自有无人机',
  authorized: '授权使用',
  rented: '租赁使用',
  temporary: '临时绑定',
};

export default function BoundDronesScreen({navigation}: any) {
  const [bindings, setBindings] = useState<PilotDroneBinding[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = async () => {
    try {
      const data = await getBoundDrones();
      setBindings(data || []);
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

  const handleUnbind = (binding: PilotDroneBinding) => {
    Alert.alert(
      '确认解绑',
      `确定要解除与无人机 ${binding.drone?.model || '#' + binding.drone_id} 的绑定关系吗？`,
      [
        {text: '取消', style: 'cancel'},
        {
          text: '确定解绑',
          style: 'destructive',
          onPress: async () => {
            try {
              await unbindDrone(binding.id);
              Alert.alert('成功', '已解除绑定');
              loadData();
            } catch (e: any) {
              Alert.alert('解绑失败', e.message);
            }
          },
        },
      ],
    );
  };

  const renderItem = ({item}: {item: PilotDroneBinding}) => {
    const status = BINDING_STATUS_MAP[item.status] || BINDING_STATUS_MAP.pending;
    const bindingType = BINDING_TYPE_MAP[item.binding_type] || item.binding_type;

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.droneInfo}>
            <View style={styles.droneIcon}>
              <Text style={styles.droneIconText}>D</Text>
            </View>
            <View style={styles.droneDetail}>
              <Text style={styles.droneName}>
                {item.drone?.model || `无人机 #${item.drone_id}`}
              </Text>
              <Text style={styles.droneSerial}>
                {item.drone?.serial_number || `ID: ${item.drone_id}`}
              </Text>
            </View>
          </View>
          <View style={[styles.statusBadge, {backgroundColor: status.color + '20'}]}>
            <Text style={[styles.statusText, {color: status.color}]}>{status.label}</Text>
          </View>
        </View>

        <View style={styles.cardBody}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>绑定类型</Text>
            <Text style={styles.infoValue}>{bindingType}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>生效时间</Text>
            <Text style={styles.infoValue}>
              {item.effective_from?.substring(0, 10) || '-'}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>到期时间</Text>
            <Text style={styles.infoValue}>
              {item.effective_to?.substring(0, 10) || '长期'}
            </Text>
          </View>
          {item.drone?.max_load && (
            <View style={styles.specRow}>
              <View style={styles.specItem}>
                <Text style={styles.specValue}>{item.drone.max_load}kg</Text>
                <Text style={styles.specLabel}>最大载重</Text>
              </View>
              <View style={styles.specItem}>
                <Text style={styles.specValue}>{item.drone.max_flight_time}min</Text>
                <Text style={styles.specLabel}>最大航时</Text>
              </View>
              <View style={styles.specItem}>
                <Text style={styles.specValue}>{item.drone.max_distance}km</Text>
                <Text style={styles.specLabel}>最大航程</Text>
              </View>
            </View>
          )}
        </View>

        {item.status === 'active' && (
          <View style={styles.cardActions}>
            <TouchableOpacity
              style={styles.unbindBtn}
              onPress={() => handleUnbind(item)}>
              <Text style={styles.unbindBtnText}>解除绑定</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyText}>暂无绑定的无人机</Text>
      <Text style={styles.emptySubText}>绑定无人机后即可接受飞行任务</Text>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>加载中...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        data={bindings}
        renderItem={renderItem}
        keyExtractor={item => item.id.toString()}
        ListHeaderComponent={
          <TouchableOpacity
            style={styles.addBtn}
            onPress={() => navigation.navigate('BindDrone')}>
            <Text style={styles.addBtnIcon}>+</Text>
            <Text style={styles.addBtnText}>绑定新无人机</Text>
          </TouchableOpacity>
        }
        ListEmptyComponent={renderEmpty}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        contentContainerStyle={styles.listContent}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
  },
  listContent: {
    paddingBottom: 24,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1890ff',
    marginHorizontal: 16,
    marginTop: 16,
    paddingVertical: 14,
    borderRadius: 8,
  },
  addBtnIcon: {
    fontSize: 20,
    color: '#fff',
    marginRight: 8,
  },
  addBtnText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
  },
  emptyContainer: {
    paddingTop: 60,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    marginBottom: 8,
  },
  emptySubText: {
    fontSize: 14,
    color: '#999',
  },
  card: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  droneInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  droneIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#e6f7ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  droneIconText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1890ff',
  },
  droneDetail: {
    flex: 1,
  },
  droneName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  droneSerial: {
    fontSize: 12,
    color: '#999',
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
    padding: 16,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  infoLabel: {
    fontSize: 14,
    color: '#666',
  },
  infoValue: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  specRow: {
    flexDirection: 'row',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  specItem: {
    flex: 1,
    alignItems: 'center',
  },
  specValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1890ff',
  },
  specLabel: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
  cardActions: {
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    padding: 12,
    alignItems: 'flex-end',
  },
  unbindBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#ff4d4f',
  },
  unbindBtnText: {
    fontSize: 14,
    color: '#ff4d4f',
  },
});
