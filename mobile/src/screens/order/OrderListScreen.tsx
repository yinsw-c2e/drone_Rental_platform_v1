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

export default function OrderListScreen({navigation}: any) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [activeTab, setActiveTab] = useState('');
  const [loading, setLoading] = useState(false);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const res = await orderService.list({status: activeTab || undefined, page: 1, page_size: 20});
      setOrders(res.data.list || []);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  useEffect(() => { fetchOrders(); }, [activeTab]);

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
