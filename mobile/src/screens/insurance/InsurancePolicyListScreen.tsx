import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import {
  getMyPolicies,
  InsurancePolicy,
  getPolicyTypeText,
  getPolicyStatusText,
  getPolicyStatusColor,
  formatAmount,
} from '../../services/insurance';
import {useTheme} from '../../theme/ThemeContext';
import type {AppTheme} from '../../theme/index';

interface Props {
  navigation: any;
}

const InsurancePolicyListScreen: React.FC<Props> = ({ navigation }) => {
  const {theme} = useTheme();
  const styles = getStyles(theme);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [policies, setPolicies] = useState<InsurancePolicy[]>([]);

  const loadData = async () => {
    try {
      const res = await getMyPolicies({ page: 1, page_size: 50 });
      setPolicies(res.data.list || []);
    } catch (error) {
      console.error('加载保单失败:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const renderPolicyItem = ({ item }: { item: InsurancePolicy }) => {
    const statusColor = getPolicyStatusColor(item.status);
    const isActive = item.status === 'active';

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => navigation.navigate('InsurancePolicyDetail', { policyId: item.id })}
      >
        <View style={styles.cardHeader}>
          <View style={styles.typeContainer}>
            <Text style={styles.policyType}>{getPolicyTypeText(item.policy_type)}</Text>
            {item.policy_category === 'mandatory' && (
              <View style={styles.mandatoryBadge}>
                <Text style={styles.mandatoryText}>强制</Text>
              </View>
            )}
          </View>
          <View style={[styles.statusBadge, { backgroundColor: statusColor }]}>
            <Text style={styles.statusText}>{getPolicyStatusText(item.status)}</Text>
          </View>
        </View>

        <View style={styles.cardBody}>
          <View style={styles.infoRow}>
            <Text style={styles.label}>保单号</Text>
            <Text style={styles.value}>{item.policy_no}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.label}>保险公司</Text>
            <Text style={styles.value}>{item.insurer_name}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.label}>保险金额</Text>
            <Text style={[styles.value, styles.amount]}>{formatAmount(item.coverage_amount)}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.label}>保费</Text>
            <Text style={styles.value}>{formatAmount(item.premium)}</Text>
          </View>
        </View>

        <View style={styles.cardFooter}>
          <Text style={styles.dateText}>
            {isActive ? '有效期至: ' : '保险期限: '}
            {new Date(item.effective_to).toLocaleDateString()}
          </Text>
          {isActive && (
            <TouchableOpacity
              style={styles.claimBtn}
              onPress={() => navigation.navigate('ReportClaim', { policyId: item.id })}
            >
              <Text style={styles.claimBtnText}>报案</Text>
            </TouchableOpacity>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={policies}
        renderItem={renderPolicyItem}
        keyExtractor={(item) => item.id.toString()}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <TouchableOpacity
            style={styles.purchaseBtn}
            onPress={() => navigation.navigate('PurchaseInsurance')}
          >
            <Text style={styles.purchaseBtnText}>+ 购买保险</Text>
          </TouchableOpacity>
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>🛡️</Text>
            <Text style={styles.emptyTitle}>暂无保险保单</Text>
            <Text style={styles.emptySubText}>购买保险，为您的飞行保驾护航</Text>
          </View>
        }
      />
    </View>
  );
};

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
  listContent: {
    padding: 16,
  },
  purchaseBtn: {
    backgroundColor: theme.primary,
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 16,
  },
  purchaseBtnText: {
    color: theme.btnPrimaryText,
    fontSize: 16,
    fontWeight: '600',
  },
  card: {
    backgroundColor: theme.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.divider,
  },
  typeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  policyType: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.text,
  },
  mandatoryBadge: {
    backgroundColor: theme.danger,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 8,
  },
  mandatoryText: {
    color: theme.btnPrimaryText,
    fontSize: 10,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    color: theme.btnPrimaryText,
    fontSize: 12,
  },
  cardBody: {
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  label: {
    fontSize: 14,
    color: theme.textSub,
  },
  value: {
    fontSize: 14,
    color: theme.text,
  },
  amount: {
    fontWeight: '600',
    color: theme.danger,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: theme.divider,
  },
  dateText: {
    fontSize: 12,
    color: theme.textSub,
  },
  claimBtn: {
    backgroundColor: theme.warning,
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 16,
  },
  claimBtnText: {
    color: theme.btnPrimaryText,
    fontSize: 12,
    fontWeight: '500',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 16,
    color: theme.text,
    marginBottom: 8,
  },
  emptySubText: {
    fontSize: 14,
    color: theme.textSub,
  },
});

export default InsurancePolicyListScreen;
