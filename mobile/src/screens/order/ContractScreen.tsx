import React, {useEffect, useState} from 'react';
import {
  ActivityIndicator,
  Alert,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {useSelector} from 'react-redux';
import {contractService, ContractDetail} from '../../services/contract';
import {RootState} from '../../store/store';
import {useTheme} from '../../theme/ThemeContext';
import type {AppTheme} from '../../theme/index';

export default function ContractScreen({route, navigation}: any) {
  const {theme} = useTheme();
  const styles = getStyles(theme);

  const orderId = Number(route.params?.orderId || 0);
  const user = useSelector((s: RootState) => s.auth.user);
  const currentUserId = user?.id || 0;

  const [loading, setLoading] = useState(true);
  const [contract, setContract] = useState<ContractDetail | null>(null);
  const [signing, setSigning] = useState(false);

  const fetchContract = async () => {
    try {
      const res = await contractService.getByOrder(orderId);
      setContract(res.data);
    } catch (e: any) {
      Alert.alert('加载失败', e.message || '无法获取合同');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchContract();
  }, [orderId]);

  const handleSign = async () => {
    if (!contract) return;
    setSigning(true);
    try {
      const res = await contractService.sign(orderId);
      setContract(res.data);
      Alert.alert('签署成功', '合同已签署');
    } catch (e: any) {
      Alert.alert('签署失败', e.message || '请稍后重试');
    } finally {
      setSigning(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, {backgroundColor: theme.bg}]}>
        <ActivityIndicator style={{marginTop: 120}} color={theme.primary} />
      </SafeAreaView>
    );
  }

  if (!contract) {
    return (
      <SafeAreaView style={[styles.container, {backgroundColor: theme.bg}]}>
        <Text style={styles.emptyText}>暂无合同</Text>
      </SafeAreaView>
    );
  }

  const isClient = currentUserId === contract.client_user_id;
  const isProvider = currentUserId === contract.provider_user_id;

  const mySignedAt = isClient ? contract.client_signed_at : contract.provider_signed_at;
  const canSign = !mySignedAt && (isClient || isProvider);

  const statusLabel = (() => {
    switch (contract.status) {
      case 'pending': return '待签署';
      case 'client_signed': return '甲方已签署';
      case 'provider_signed': return '乙方已签署';
      case 'fully_signed': return '双方已签署';
      default: return contract.status;
    }
  })();

  const statusColor = contract.status === 'fully_signed' ? theme.success : theme.warning;

  return (
    <SafeAreaView style={[styles.container, {backgroundColor: theme.bg}]}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>{contract.title}</Text>
          <Text style={styles.contractNo}>合同编号：{contract.contract_no}</Text>
          <View style={[styles.statusBadge, {backgroundColor: statusColor + '20', borderColor: statusColor}]}>
            <Text style={[styles.statusText, {color: statusColor}]}>{statusLabel}</Text>
          </View>
        </View>

        {/* 金额摘要 */}
        <View style={styles.amountCard}>
          <View style={styles.amountRow}>
            <Text style={styles.amountLabel}>合同金额</Text>
            <Text style={styles.amountValue}>¥ {(contract.contract_amount / 100).toFixed(2)}</Text>
          </View>
          <View style={styles.amountRow}>
            <Text style={styles.amountLabel}>平台服务费</Text>
            <Text style={styles.amountValueSub}>¥ {(contract.platform_commission / 100).toFixed(2)}</Text>
          </View>
          <View style={styles.amountRow}>
            <Text style={styles.amountLabel}>服务方到账</Text>
            <Text style={styles.amountValueSub}>¥ {(contract.provider_amount / 100).toFixed(2)}</Text>
          </View>
        </View>

        {/* 签署状态 */}
        <View style={styles.signStatusCard}>
          <Text style={styles.cardTitle}>签署状态</Text>
          <View style={styles.signRow}>
            <Text style={styles.signLabel}>甲方（委托方）</Text>
            <Text style={[styles.signValue, contract.client_signed_at ? {color: theme.success} : {color: theme.textHint}]}>
              {contract.client_signed_at ? '已签署' : '待签署'}
            </Text>
          </View>
          <View style={styles.signRow}>
            <Text style={styles.signLabel}>乙方（服务方）</Text>
            <Text style={[styles.signValue, contract.provider_signed_at ? {color: theme.success} : {color: theme.textHint}]}>
              {contract.provider_signed_at ? '已签署' : '待签署'}
            </Text>
          </View>
        </View>

        {/* 合同摘要信息（代替 HTML 渲染） */}
        <View style={styles.htmlCard}>
          <Text style={styles.cardTitle}>合同内容摘要</Text>
          <Text style={styles.contractBody}>
            本合同由平台根据订单信息自动生成，包含服务内容、费用条款、双方权利义务及违约责任等条款。
            点击“确认签署合同”表示您已阅读并同意合同全部内容。
          </Text>
          <Text style={styles.contractDateInfo}>
            合同创建时间：{contract.created_at ? new Date(contract.created_at).toLocaleString('zh-CN') : '-'}
          </Text>
        </View>

        {/* 签署按钮 */}
        {canSign && (
          <TouchableOpacity
            style={[styles.signBtn, signing && styles.signBtnDisabled]}
            onPress={handleSign}
            disabled={signing}>
            <Text style={styles.signBtnText}>
              {signing ? '签署中...' : '确认签署合同'}
            </Text>
          </TouchableOpacity>
        )}

        {mySignedAt && (
          <View style={styles.signedInfo}>
            <Text style={styles.signedText}>你已签署此合同</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const getStyles = (theme: AppTheme) =>
  StyleSheet.create({
    container: {flex: 1},
    content: {padding: 20, paddingBottom: 40},
    header: {marginBottom: 16},
    title: {fontSize: 20, fontWeight: '700', color: theme.text},
    contractNo: {fontSize: 12, color: theme.textSub, marginTop: 6},
    statusBadge: {
      alignSelf: 'flex-start',
      marginTop: 10,
      paddingHorizontal: 12,
      paddingVertical: 4,
      borderRadius: 12,
      borderWidth: 1,
    },
    statusText: {fontSize: 13, fontWeight: '600'},
    amountCard: {
      backgroundColor: theme.card,
      borderRadius: 14,
      padding: 16,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: theme.cardBorder,
    },
    amountRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 6,
    },
    amountLabel: {fontSize: 14, color: theme.textSub},
    amountValue: {fontSize: 18, fontWeight: '700', color: theme.primary},
    amountValueSub: {fontSize: 14, color: theme.text},
    signStatusCard: {
      backgroundColor: theme.card,
      borderRadius: 14,
      padding: 16,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: theme.cardBorder,
    },
    cardTitle: {fontSize: 16, fontWeight: '700', color: theme.text, marginBottom: 12},
    signRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 6,
    },
    signLabel: {fontSize: 14, color: theme.textSub},
    signValue: {fontSize: 14, fontWeight: '600'},
    htmlCard: {
      backgroundColor: theme.card,
      borderRadius: 14,
      padding: 16,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: theme.cardBorder,
    },
    emptyText: {fontSize: 14, color: theme.textHint, textAlign: 'center', marginTop: 40},
    contractBody: {fontSize: 14, color: theme.textSub, lineHeight: 22, marginBottom: 8},
    contractDateInfo: {fontSize: 12, color: theme.textHint, marginTop: 4},
    signBtn: {
      marginTop: 20,
      height: 48,
      borderRadius: 12,
      backgroundColor: theme.primary,
      justifyContent: 'center',
      alignItems: 'center',
    },
    signBtnDisabled: {opacity: 0.6},
    signBtnText: {color: theme.btnPrimaryText, fontSize: 17, fontWeight: '700'},
    signedInfo: {
      marginTop: 16,
      alignItems: 'center',
    },
    signedText: {fontSize: 14, color: theme.success, fontWeight: '600'},
  });
