import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Platform,
} from 'react-native';
import { useSelector } from 'react-redux';
import LinearGradient from 'react-native-linear-gradient';
import { contractService, ContractDetail } from '../../services/contract';
import { RootState } from '../../store/store';
import { useTheme } from '../../theme/ThemeContext';
import type { AppTheme } from '../../theme/index';

const stripHtml = (value?: string | null) =>
  String(value || '')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

export default function ContractScreen({ route, navigation }: any) {
  const { theme } = useTheme();
  const styles = getStyles(theme);

  const orderId = Number(route.params?.orderId || 0);
  const user = useSelector((s: RootState) => s.auth.user);
  const currentUserId = user?.id || 0;

  const [loading, setLoading] = useState(true);
  const [contract, setContract] = useState<ContractDetail | null>(null);
  const [signing, setSigning] = useState(false);

  const fetchContract = useCallback(async () => {
    try {
      const res = await contractService.getByOrder(orderId);
      setContract(res.data);
    } catch (e: any) {
      Alert.alert('加载失败', e.message || '无法获取合同');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  }, [navigation, orderId]);

  useEffect(() => {
    fetchContract();
  }, [fetchContract]);

  const handleSign = async () => {
    if (!contract) return;
    setSigning(true);
    try {
      const res = await contractService.sign(orderId);
      setContract(res.data);
      Alert.alert('签署成功', '合同已生效');
    } catch (e: any) {
      Alert.alert('签署失败', e.message || '请稍后重试');
    } finally {
      setSigning(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
        <ActivityIndicator style={{ marginTop: 120 }} color={theme.primary} />
      </SafeAreaView>
    );
  }

  if (!contract) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
        <Text style={styles.emptyText}>暂无合同信息</Text>
      </SafeAreaView>
    );
  }

  const isClient = currentUserId === contract.client_user_id;
  const isProvider = currentUserId === contract.provider_user_id;
  const mySignedAt = isClient
    ? contract.client_signed_at
    : contract.provider_signed_at;
  const canSign = !mySignedAt && (isClient || isProvider);
  const plainTextContract = stripHtml(contract.contract_html);

  const statusLabel = (() => {
    switch (contract.status) {
      case 'pending':
        return '待签署';
      case 'client_signed':
        return '委托方已签署';
      case 'provider_signed':
        return '服务方已签署';
      case 'fully_signed':
        return '合同已生效';
      default:
        return contract.status;
    }
  })();

  const statusColor =
    contract.status === 'fully_signed' ? theme.success : theme.warning;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
      <View style={styles.headerBar}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
        >
          <Text style={styles.backText}>˂ 返回</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>电子服务合同</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Header Hero */}
        <View style={styles.heroCard}>
          <View style={styles.heroTop}>
            <View style={styles.contractIconWrap}>
              <Text style={styles.contractIcon}>📜</Text>
            </View>
            <View style={styles.heroMain}>
              <Text style={styles.title}>{contract.title}</Text>
              <Text style={styles.contractNo}>NO. {contract.contract_no}</Text>
            </View>
          </View>
          <View
            style={[
              styles.statusBanner,
              {
                backgroundColor: statusColor + '15',
                borderColor: statusColor + '30',
              },
            ]}
          >
            <View
              style={[styles.statusDot, { backgroundColor: statusColor }]}
            />
            <Text style={[styles.statusText, { color: statusColor }]}>
              {statusLabel}
            </Text>
          </View>
        </View>

        {/* 金额明细 */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>费用条款摘要</Text>
          <View style={styles.amountGrid}>
            <View style={styles.amountItemMain}>
              <Text style={styles.amountLabel}>合同总额 (含税)</Text>
              <Text style={styles.amountValue}>
                ¥ {(contract.contract_amount / 100).toFixed(2)}
              </Text>
            </View>
            <View style={styles.amountDivider} />
            <View style={styles.amountItemRow}>
              <View style={styles.amountSubItem}>
                <Text style={styles.amountLabelSmall}>履约保障与服务费</Text>
                <Text style={styles.amountValueSmall}>
                  ¥ {(contract.platform_commission / 100).toFixed(2)}
                </Text>
              </View>
              <View style={styles.amountSubItem}>
                <Text style={styles.amountLabelSmall}>服务方实际结算</Text>
                <Text style={styles.amountValueSmall}>
                  ¥ {(contract.provider_amount / 100).toFixed(2)}
                </Text>
              </View>
            </View>
          </View>
          <Text style={styles.amountTip}>
            * 费用拆分已根据平台规则锁定，并在签署后生效。
          </Text>
        </View>

        {/* 签署主体 */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>签署各方</Text>
          <View style={styles.signPartyRow}>
            <SignParty
              role="甲方 (委托方)"
              signedAt={contract.client_signed_at}
              theme={theme}
            />
            <View style={styles.signVersus}>
              <Text style={styles.vsText}>VS</Text>
            </View>
            <SignParty
              role="乙方 (服务方)"
              signedAt={contract.provider_signed_at}
              theme={theme}
            />
          </View>
        </View>

        {/* 法律效力保证 */}
        <View style={styles.trustBanner}>
          <Text style={styles.trustTitle}>🛡️ 平台履约合规保障</Text>
          <Text style={styles.trustBody}>
            本合同受法律保护。平台已强制要求服务方：
            {`\n`}• 确认设备操作责任归属
            {`\n`}• 保证执行飞手具备合法民航资质
            {`\n`}• 确认第三方责任险已处于有效期
          </Text>
        </View>

        {/* 合同内容预览 */}
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.cardTitle}>核心条款预览</Text>
            <Text style={styles.formalText}>正式法律文本</Text>
          </View>
          <View style={styles.contractPreviewContainer}>
            <Text style={styles.contractBody}>
              {plainTextContract || '正在加载合同详细内容...'}
            </Text>
            <LinearGradient
              colors={['transparent', theme.card]}
              style={styles.previewOverlay}
            />
          </View>
          <TouchableOpacity
            style={styles.viewFullBtn}
            onPress={() => navigation.navigate('ContractDocument', { orderId })}
          >
            <Text style={styles.viewFullText}>查看完整合同全文 ˃</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.footerNote}>
          合同创建于：
          {contract.created_at
            ? new Date(contract.created_at).toLocaleString('zh-CN')
            : '-'}
        </Text>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Fixed Footer for Action */}
      {canSign && (
        <View style={styles.footerAction}>
          <TouchableOpacity
            style={[styles.signBtn, signing && styles.signBtnDisabled]}
            onPress={handleSign}
            disabled={signing}
          >
            <Text style={styles.signBtnText}>
              {signing ? '电子签章生成中...' : '确认并签署合同'}
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

function SignParty({
  role,
  signedAt,
  theme,
}: {
  role: string;
  signedAt?: string | null;
  theme: AppTheme;
}) {
  const styles = getStyles(theme);
  return (
    <View style={styles.partyBox}>
      <Text style={styles.partyRole}>{role}</Text>
      <View
        style={[
          styles.partyStatus,
          {
            backgroundColor: signedAt
              ? theme.success + '15'
              : theme.bgSecondary,
          },
        ]}
      >
        <Text
          style={[
            styles.partyStatusText,
            { color: signedAt ? theme.success : theme.textHint },
          ]}
        >
          {signedAt ? '已电子签署' : '待签署'}
        </Text>
      </View>
      {signedAt ? (
        <Text style={styles.partyTime}>
          {new Date(signedAt).toLocaleDateString('zh-CN')}
        </Text>
      ) : null}
    </View>
  );
}

const getStyles = (theme: AppTheme) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.bgSecondary },
    headerBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 14,
      backgroundColor: theme.bg,
      borderBottomWidth: 1,
      borderBottomColor: theme.divider,
    },
    backBtn: { width: 60 },
    backText: { fontSize: 16, color: theme.primaryText, fontWeight: '600' },
    headerTitle: { fontSize: 17, fontWeight: '800', color: theme.text },
    content: { padding: 16, paddingBottom: 40 },

    heroCard: {
      backgroundColor: theme.card,
      borderRadius: 24,
      padding: 20,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: theme.divider,
    },
    heroTop: { flexDirection: 'row', alignItems: 'center', gap: 16 },
    contractIconWrap: {
      width: 54,
      height: 54,
      borderRadius: 16,
      backgroundColor: theme.primaryBg,
      alignItems: 'center',
      justifyContent: 'center',
    },
    contractIcon: { fontSize: 28 },
    heroMain: { flex: 1 },
    title: { fontSize: 18, fontWeight: '800', color: theme.text },
    contractNo: {
      fontSize: 12,
      color: theme.textSub,
      marginTop: 4,
      letterSpacing: 0.5,
    },
    statusBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 16,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 10,
      borderWidth: 1,
    },
    statusDot: { width: 6, height: 6, borderRadius: 3, marginRight: 8 },
    statusText: { fontSize: 13, fontWeight: '700' },

    card: {
      backgroundColor: theme.card,
      borderRadius: 20,
      padding: 20,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: theme.divider,
    },
    cardTitle: {
      fontSize: 15,
      fontWeight: '800',
      color: theme.text,
      marginBottom: 16,
    },
    cardHeaderRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 16,
    },
    formalText: {
      fontSize: 11,
      color: theme.textHint,
      fontWeight: '700',
      textTransform: 'uppercase',
    },

    amountGrid: {
      backgroundColor: theme.bgSecondary,
      borderRadius: 16,
      padding: 16,
    },
    amountItemMain: { alignItems: 'center', marginBottom: 14 },
    amountLabel: { fontSize: 12, color: theme.textSub, marginBottom: 6 },
    amountValue: { fontSize: 24, fontWeight: '900', color: theme.primaryText },
    amountDivider: {
      height: 1,
      backgroundColor: theme.divider,
      marginVertical: 12,
    },
    amountItemRow: { flexDirection: 'row' },
    amountSubItem: { flex: 1, alignItems: 'center' },
    amountLabelSmall: { fontSize: 11, color: theme.textHint, marginBottom: 4 },
    amountValueSmall: { fontSize: 14, fontWeight: '700', color: theme.text },
    amountTip: {
      fontSize: 11,
      color: theme.textHint,
      marginTop: 12,
      textAlign: 'center',
    },

    signPartyRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    partyBox: { flex: 1, alignItems: 'center', gap: 8 },
    partyRole: { fontSize: 13, color: theme.textSub, fontWeight: '600' },
    partyStatus: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 8,
      width: '100%',
      alignItems: 'center',
    },
    partyStatusText: { fontSize: 12, fontWeight: '800' },
    partyTime: { fontSize: 11, color: theme.textHint },
    signVersus: { width: 30, alignItems: 'center' },
    vsText: { fontSize: 12, fontWeight: '900', color: theme.divider },

    trustBanner: {
      backgroundColor: theme.success + '10',
      borderRadius: 16,
      padding: 16,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: theme.success + '20',
    },
    trustTitle: {
      fontSize: 14,
      fontWeight: '800',
      color: theme.success,
      marginBottom: 8,
    },
    trustBody: { fontSize: 12, color: theme.textSub, lineHeight: 20 },

    contractPreviewContainer: {
      maxHeight: 200,
      overflow: 'hidden',
      position: 'relative',
    },
    contractBody: { fontSize: 13, color: theme.textSub, lineHeight: 22 },
    previewOverlay: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      height: 60,
    },
    viewFullBtn: { marginTop: 12, alignSelf: 'center' },
    viewFullText: { fontSize: 13, color: theme.primaryText, fontWeight: '700' },

    footerNote: {
      fontSize: 12,
      color: theme.textHint,
      textAlign: 'center',
      marginTop: 8,
    },
    footerAction: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      backgroundColor: theme.card,
      padding: 16,
      borderTopWidth: 1,
      borderTopColor: theme.divider,
      paddingBottom: Platform.OS === 'ios' ? 32 : 16,
    },
    signBtn: {
      height: 52,
      borderRadius: 16,
      backgroundColor: theme.primary,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: theme.primary,
      shadowOpacity: 0.2,
      shadowOffset: { width: 0, height: 4 },
      shadowRadius: 8,
      elevation: 4,
    },
    signBtnDisabled: { opacity: 0.6 },
    signBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
    emptyText: {
      fontSize: 14,
      color: theme.textHint,
      textAlign: 'center',
      marginTop: 120,
    },
  });
