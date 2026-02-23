import React, {useEffect, useState} from 'react';
import {View, Text, FlatList, StyleSheet, TouchableOpacity, SafeAreaView} from 'react-native';
import {orderService} from '../../services/order';
import {Order} from '../../types';
import {ORDER_STATUS} from '../../constants';

const TABS = [
  {key: '', label: '全部'},
  {key: 'created', label: '待接单'},
  {key: 'paid', label: '已支付'},
  {key: 'in_progress', label: '进行中'},
  {key: 'completed', label: '已完成'},
];

const ROLE_TABS = [
  {key: 'all', label: '全部'},
  {key: 'renter', label: '我租的'},
  {key: 'owner', label: '我出租的'},
];

export default function OrderListScreen({navigation}: any) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [activeTab, setActiveTab] = useState('');
  const [activeRole, setActiveRole] = useState('all');
  const [loading, setLoading] = useState(false);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      if (activeRole === 'all') {
        // 查询作为租客和机主的所有订单
        const [renterRes, ownerRes] = await Promise.all([
          orderService.list({role: 'renter', status: activeTab || undefined, page: 1, page_size: 50}),
          orderService.list({role: 'owner', status: activeTab || undefined, page: 1, page_size: 50}),
        ]);
        const allOrders = [
          ...(renterRes.data.list || []),
          ...(ownerRes.data.list || []),
        ];
        // 按创建时间排序
        allOrders.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        setOrders(allOrders);
      } else {
        // 按角色查询
        const res = await orderService.list({role: activeRole, status: activeTab || undefined, page: 1, page_size: 50});
        setOrders(res.data.list || []);
      }
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  useEffect(() => { fetchOrders(); }, [activeTab, activeRole]);

  const renderOrder = ({item}: {item: Order}) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => navigation.navigate('OrderDetail', {id: item.id})}>
      <View style={styles.cardHeader}>
        <Text style={styles.orderNo}>{item.order_no}</Text>
        <Text style={[styles.status, {color: item.status === 'completed' ? '#52c41a' : '#1890ff'}]}>
          {ORDER_STATUS[item.status as keyof typeof ORDER_STATUS] || item.status}
        </Text>
      </View>
      <Text style={styles.title}>{item.title}</Text>
      <View style={styles.cardFooter}>
        <Text style={styles.amount}>{(item.total_amount / 100).toFixed(2)} 元</Text>
        <Text style={styles.time}>{item.created_at?.slice(0, 10)}</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.roleTabs}>
        {ROLE_TABS.map(tab => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.roleTab, activeRole === tab.key && styles.roleTabActive]}
            onPress={() => setActiveRole(tab.key)}>
            <Text style={[styles.roleTabText, activeRole === tab.key && styles.roleTabTextActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      <View style={styles.tabs}>
        {TABS.map(tab => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tab, activeTab === tab.key && styles.tabActive]}
            onPress={() => setActiveTab(tab.key)}>
            <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      <FlatList
        data={orders}
        keyExtractor={item => String(item.id)}
        renderItem={renderOrder}
        refreshing={loading}
        onRefresh={fetchOrders}
        contentContainerStyle={{padding: 12}}
        ListEmptyComponent={<Text style={styles.empty}>暂无订单</Text>}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#f5f5f5'},
  roleTabs: {
    flexDirection: 'row', backgroundColor: '#fff', paddingHorizontal: 8,
    borderBottomWidth: 1, borderBottomColor: '#f0f0f0',
  },
  roleTab: {flex: 1, paddingVertical: 10, alignItems: 'center'},
  roleTabActive: {borderBottomWidth: 2, borderBottomColor: '#52c41a'},
  roleTabText: {fontSize: 13, color: '#666'},
  roleTabTextActive: {color: '#52c41a', fontWeight: 'bold'},
  tabs: {flexDirection: 'row', backgroundColor: '#fff', paddingHorizontal: 8},
  tab: {flex: 1, paddingVertical: 12, alignItems: 'center'},
  tabActive: {borderBottomWidth: 2, borderBottomColor: '#1890ff'},
  tabText: {fontSize: 14, color: '#666'},
  tabTextActive: {color: '#1890ff', fontWeight: 'bold'},
  card: {
    backgroundColor: '#fff', borderRadius: 8, padding: 16, marginBottom: 12,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  cardHeader: {flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8},
  orderNo: {fontSize: 12, color: '#999'},
  status: {fontSize: 14, fontWeight: 'bold'},
  title: {fontSize: 16, color: '#333', marginBottom: 8},
  cardFooter: {flexDirection: 'row', justifyContent: 'space-between'},
  amount: {fontSize: 16, color: '#f5222d', fontWeight: 'bold'},
  time: {fontSize: 12, color: '#999'},
  empty: {textAlign: 'center', color: '#999', marginTop: 60, fontSize: 16},
});
