import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  SafeAreaView,
} from 'react-native';
import { orderService } from '../../services/order';
import { Order } from '../../types';

const ORDER_STATUS: Record<string, string> = {
  created: '待接单',
  accepted: '已接单',
  paid: '已支付',
  in_progress: '进行中',
  completed: '已完成',
  cancelled: '已取消',
};

export default function OrderDetailScreen({ route, navigation }: any) {
  const { id } = route.params;
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchOrder();
  }, [id]);

  const fetchOrder = async () => {
    setLoading(true);
    try {
      const res = await orderService.getById(id);
      setOrder(res.data);
    } catch (e) {
      console.error('获取订单详情失败:', e);
    }
    setLoading(false);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Text style={styles.backText}>← 返回</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>订单详情</Text>
          <View style={{ width: 60 }} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#1890ff" />
        </View>
      </SafeAreaView>
    );
  }

  if (!order) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Text style={styles.backText}>← 返回</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>订单详情</Text>
          <View style={{ width: 60 }} />
        </View>
        <View style={styles.loadingContainer}>
          <Text style={styles.errorText}>订单不存在</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>← 返回</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>订单详情</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView style={styles.content}>
        {/* 状态卡片 */}
        <View style={styles.statusCard}>
          <Text style={styles.statusLabel}>订单状态</Text>
          <Text style={styles.statusValue}>
            {ORDER_STATUS[order.status] || order.status}
          </Text>
        </View>

        {/* 订单信息 */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>订单信息</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>订单号</Text>
            <Text style={styles.infoValue}>{order.order_no}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>服务标题</Text>
            <Text style={styles.infoValue}>{order.title}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>服务类型</Text>
            <Text style={styles.infoValue}>
              {order.service_type === 'rental' ? '租赁' : 
               order.service_type === 'aerial_photo' ? '航拍' : 
               order.service_type === 'cargo' ? '货运' : order.service_type}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>服务地址</Text>
            <Text style={styles.infoValue}>{(order as any).address || '-'}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>开始时间</Text>
            <Text style={styles.infoValue}>{order.start_time?.slice(0, 16) || '-'}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>结束时间</Text>
            <Text style={styles.infoValue}>{order.end_time?.slice(0, 16) || '-'}</Text>
          </View>
        </View>

        {/* 费用信息 */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>费用信息</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>订单总额</Text>
            <Text style={styles.infoValueHighlight}>
              ¥{(order.total_amount / 100).toFixed(2)}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>平台佣金</Text>
            <Text style={styles.infoValue}>
              ¥{(order.platform_commission / 100).toFixed(2)}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>机主收入</Text>
            <Text style={styles.infoValue}>
              ¥{(order.owner_amount / 100).toFixed(2)}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>押金</Text>
            <Text style={styles.infoValue}>
              ¥{(order.deposit_amount / 100).toFixed(2)}
            </Text>
          </View>
        </View>

        {/* 用户信息 */}
        {(order.owner || order.renter) && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>参与方</Text>
            {order.owner && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>出租方</Text>
                <Text style={styles.infoValue}>{order.owner.nickname}</Text>
              </View>
            )}
            {order.renter && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>承租方</Text>
                <Text style={styles.infoValue}>{order.renter.nickname}</Text>
              </View>
            )}
          </View>
        )}

        <View style={{ height: 20 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e8e8e8',
  },
  backBtn: {
    width: 60,
  },
  backText: {
    fontSize: 16,
    color: '#1890ff',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: 16,
    color: '#999',
  },
  content: {
    flex: 1,
  },
  statusCard: {
    backgroundColor: '#fff',
    padding: 20,
    marginBottom: 12,
    alignItems: 'center',
  },
  statusLabel: {
    fontSize: 14,
    color: '#999',
    marginBottom: 8,
  },
  statusValue: {
    fontSize: 24,
    fontWeight: '600',
    color: '#1890ff',
  },
  card: {
    backgroundColor: '#fff',
    padding: 16,
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f5',
  },
  infoLabel: {
    fontSize: 14,
    color: '#666',
  },
  infoValue: {
    fontSize: 14,
    color: '#333',
    flex: 1,
    textAlign: 'right',
  },
  infoValueHighlight: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ff4d4f',
  },
});
