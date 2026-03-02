import React, {useState, useCallback} from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Alert,
  RefreshControl,
} from 'react-native';
import {useFocusEffect} from '@react-navigation/native';
import {
  getClientProfile,
  requestCreditCheck,
  Client,
} from '../../services/client';

const STATUS_MAP: Record<string, {label: string; color: string}> = {
  pending: {label: '待审核', color: '#faad14'},
  verified: {label: '已认证', color: '#52c41a'},
  rejected: {label: '已拒绝', color: '#ff4d4f'},
  approved: {label: '已通过', color: '#52c41a'},
};

const CLIENT_TYPE_MAP: Record<string, string> = {
  individual: '个人客户',
  enterprise: '企业客户',
};

export default function ClientProfileScreen({navigation}: any) {
  const [client, setClient] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = async () => {
    try {
      const data = await getClientProfile();
      setClient(data);
    } catch (e: any) {
      // 未注册的情况
      setClient(null);
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

  const handleCreditCheck = async () => {
    Alert.alert('征信查询', '确定要发起征信查询吗？查询结果将影响您的下单资格。', [
      {text: '取消', style: 'cancel'},
      {
        text: '确认查询',
        onPress: async () => {
          try {
            await requestCreditCheck();
            Alert.alert('提示', '征信查询请求已提交，结果将在1-3个工作日内更新');
            loadData();
          } catch (e: any) {
            Alert.alert('查询失败', e.message);
          }
        },
      },
    ]);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>加载中...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!client) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>您还不是注册客户</Text>
          <Text style={styles.emptySubText}>注册后可发布货运需求和下单</Text>
          <TouchableOpacity
            style={styles.registerBtn}
            onPress={() => navigation.navigate('ClientRegister')}>
            <Text style={styles.registerBtnText}>立即注册</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const verificationStatus = STATUS_MAP[client.verification_status] || STATUS_MAP.pending;
  const creditStatus = STATUS_MAP[client.credit_check_status] || {label: '未查询', color: '#999'};

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }>
        {/* 头部 */}
        <View style={styles.header}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarText}>
              {client.client_type === 'enterprise'
                ? client.company_name?.charAt(0) || 'E'
                : 'P'}
            </Text>
          </View>
          <Text style={styles.clientName}>
            {client.client_type === 'enterprise'
              ? client.company_name
              : '个人客户'}
          </Text>
          <Text style={styles.clientType}>
            {CLIENT_TYPE_MAP[client.client_type] || '客户'}
          </Text>
          <View style={styles.statusBadge}>
            <View style={[styles.statusDot, {backgroundColor: verificationStatus.color}]} />
            <Text style={[styles.statusText, {color: verificationStatus.color}]}>
              {verificationStatus.label}
            </Text>
          </View>
        </View>

        {/* 统计数据 */}
        <View style={styles.statsCard}>
          <View style={styles.statsRow}>
            <View style={styles.statsItem}>
              <Text style={styles.statsValue}>{client.total_orders}</Text>
              <Text style={styles.statsLabel}>总订单</Text>
            </View>
            <View style={styles.statsItem}>
              <Text style={styles.statsValue}>{client.completed_orders}</Text>
              <Text style={styles.statsLabel}>已完成</Text>
            </View>
            <View style={styles.statsItem}>
              <Text style={styles.statsValue}>
                {client.total_spending > 0 ? `¥${(client.total_spending / 100).toFixed(0)}` : '0'}
              </Text>
              <Text style={styles.statsLabel}>总消费</Text>
            </View>
            <View style={styles.statsItem}>
              <Text style={styles.statsValue}>{client.average_rating?.toFixed(1) || '5.0'}</Text>
              <Text style={styles.statsLabel}>评分</Text>
            </View>
          </View>
        </View>

        {/* 征信信息 */}
        <View style={styles.infoCard}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>征信信息</Text>
            <TouchableOpacity onPress={handleCreditCheck}>
              <Text style={styles.cardAction}>发起查询</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>平台信用分</Text>
            <Text style={styles.infoValue}>{client.platform_credit_score || 600}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>外部征信分</Text>
            <Text style={styles.infoValue}>{client.credit_score || '-'}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>征信状态</Text>
            <Text style={[styles.infoValue, {color: creditStatus.color}]}>
              {creditStatus.label}
            </Text>
          </View>
        </View>

        {/* 企业信息 */}
        {client.client_type === 'enterprise' && (
          <View style={styles.infoCard}>
            <Text style={styles.cardTitle}>企业信息</Text>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>企业名称</Text>
              <Text style={styles.infoValue}>{client.company_name || '-'}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>信用代码</Text>
              <Text style={styles.infoValue}>{client.business_license_no || '-'}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>法定代表人</Text>
              <Text style={styles.infoValue}>{client.legal_representative || '-'}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>联系人</Text>
              <Text style={styles.infoValue}>{client.contact_person || '-'}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>联系电话</Text>
              <Text style={styles.infoValue}>{client.contact_phone || '-'}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>企业认证</Text>
              <Text
                style={[
                  styles.infoValue,
                  {color: (STATUS_MAP[client.enterprise_verified] || {color: '#999'}).color},
                ]}>
                {(STATUS_MAP[client.enterprise_verified] || {label: '未认证'}).label}
              </Text>
            </View>
          </View>
        )}

        {/* 服务偏好 */}
        <View style={styles.infoCard}>
          <Text style={styles.cardTitle}>服务偏好</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>默认取货地</Text>
            <Text style={styles.infoValue} numberOfLines={1}>
              {client.default_pickup_address || '未设置'}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>默认送达地</Text>
            <Text style={styles.infoValue} numberOfLines={1}>
              {client.default_delivery_address || '未设置'}
            </Text>
          </View>
        </View>

        {/* 功能入口 */}
        <View style={styles.actionCard}>
          <TouchableOpacity
            style={styles.actionItem}
            onPress={() => navigation.navigate('CargoDeclaration')}>
            <Text style={styles.actionText}>货物申报</Text>
            <Text style={styles.actionArrow}>›</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionItem}
            onPress={() => navigation.navigate('MyOrders')}>
            <Text style={styles.actionText}>我的订单</Text>
            <Text style={styles.actionArrow}>›</Text>
          </TouchableOpacity>
        </View>

        <View style={{height: 24}} />
      </ScrollView>
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
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    marginBottom: 8,
  },
  emptySubText: {
    fontSize: 14,
    color: '#999',
    marginBottom: 20,
  },
  registerBtn: {
    paddingHorizontal: 32,
    paddingVertical: 14,
    backgroundColor: '#1890ff',
    borderRadius: 8,
  },
  registerBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  header: {
    backgroundColor: '#1890ff',
    paddingVertical: 30,
    alignItems: 'center',
  },
  avatarCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#1890ff',
  },
  clientName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 12,
  },
  clientType: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 4,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    marginTop: 8,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '500',
  },
  statsCard: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: -20,
    borderRadius: 12,
    padding: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  statsRow: {
    flexDirection: 'row',
  },
  statsItem: {
    flex: 1,
    alignItems: 'center',
  },
  statsValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1890ff',
  },
  statsLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  infoCard: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    padding: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  cardAction: {
    fontSize: 14,
    color: '#1890ff',
    fontWeight: '500',
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  infoLabel: {
    fontSize: 14,
    color: '#666',
  },
  infoValue: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
    maxWidth: '60%',
    textAlign: 'right',
  },
  actionCard: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    overflow: 'hidden',
  },
  actionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  actionText: {
    fontSize: 16,
    color: '#333',
  },
  actionArrow: {
    fontSize: 20,
    color: '#ccc',
  },
});
