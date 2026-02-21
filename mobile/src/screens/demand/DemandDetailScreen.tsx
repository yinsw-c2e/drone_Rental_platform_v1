import React, {useEffect, useState} from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  SafeAreaView, ActivityIndicator, Alert,
} from 'react-native';
import {demandService} from '../../services/demand';
import {RentalDemand} from '../../types';

export default function DemandDetailScreen({route, navigation}: any) {
  const {id} = route.params;
  const [demand, setDemand] = useState<RentalDemand | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDemand();
  }, [id]);

  const fetchDemand = async () => {
    try {
      const res = await demandService.getDemand(id);
      setDemand(res.data);
    } catch (e) {
      Alert.alert('错误', '获取需求详情失败');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator style={{marginTop: 100}} color="#1890ff" />
      </SafeAreaView>
    );
  }

  if (!demand) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>📋</Text>
          <Text style={styles.emptyText}>需求信息不存在</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scroll}>
        <View style={styles.header}>
          <Text style={styles.title}>{demand.title}</Text>
          {demand.urgency === 'urgent' && (
            <View style={styles.urgentBadge}>
              <Text style={styles.urgentText}>紧急需求</Text>
            </View>
          )}
          <Text style={styles.budget}>
            预算：¥{demand.budget_min || 0} - ¥{demand.budget_max || 0}
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>需求信息</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>需求类型</Text>
            <Text style={styles.infoValue}>{demand.demand_type || '租赁'}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>详细地址</Text>
            <Text style={styles.infoValue}>{demand.address || '未设置'}</Text>
          </View>

        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>需求描述</Text>
          <Text style={styles.description}>{demand.description || '暂无描述'}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>租客信息</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>昵称</Text>
            <Text style={styles.infoValue}>{demand.renter?.nickname || '未知'}</Text>
          </View>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.contactBtn} onPress={() => {
          if (demand.renter?.id) {
            navigation.navigate('Messages', {
              screen: 'Chat',
              params: {peerId: demand.renter.id, peerName: demand.renter.nickname},
            });
          }
        }}>
          <Text style={styles.contactBtnText}>联系租客</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#f5f5f5'},
  scroll: {flex: 1},
  header: {
    backgroundColor: '#fff', padding: 24, alignItems: 'center',
    borderBottomWidth: 1, borderBottomColor: '#f0f0f0',
  },
  title: {fontSize: 18, fontWeight: 'bold', color: '#333', textAlign: 'center'},
  urgentBadge: {backgroundColor: '#ff4d4f', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 4, marginTop: 8},
  urgentText: {color: '#fff', fontSize: 12, fontWeight: 'bold'},
  budget: {fontSize: 20, color: '#f5222d', fontWeight: 'bold', marginTop: 12},
  section: {
    backgroundColor: '#fff', marginTop: 10, padding: 16,
    borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#f0f0f0',
  },
  sectionTitle: {fontSize: 16, fontWeight: 'bold', color: '#333', marginBottom: 12},
  infoRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f5f5f5',
  },
  infoLabel: {fontSize: 14, color: '#666'},
  infoValue: {fontSize: 14, color: '#333', fontWeight: '500'},
  description: {fontSize: 14, color: '#666', lineHeight: 22},
  footer: {
    backgroundColor: '#fff', padding: 12, borderTopWidth: 1, borderTopColor: '#f0f0f0',
  },
  contactBtn: {
    backgroundColor: '#1890ff', borderRadius: 8, paddingVertical: 14, alignItems: 'center',
  },
  contactBtnText: {color: '#fff', fontSize: 16, fontWeight: '600'},
  empty: {alignItems: 'center', paddingTop: 100},
  emptyIcon: {fontSize: 48, marginBottom: 12},
  emptyText: {fontSize: 16, color: '#999'},
});
