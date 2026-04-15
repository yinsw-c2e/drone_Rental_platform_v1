import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  ActivityIndicator,
  Linking,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { contractService, ContractDetail } from '../../services/contract';
import { useTheme } from '../../theme/ThemeContext';
import type { AppTheme } from '../../theme/index';

const decodeHtmlEntities = (value: string) =>
  value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");

const htmlToReadableText = (value?: string | null) =>
  decodeHtmlEntities(String(value || ''))
    .replace(/<style[\s\S]*?<\/style>/gi, '\n')
    .replace(/<script[\s\S]*?<\/script>/gi, '\n')
    .replace(/<\s*br\s*\/?>/gi, '\n')
    .replace(
      /<\s*\/?(p|div|section|article|header|footer|h1|h2|h3|h4|h5|h6|table|tr)\b[^>]*>/gi,
      '\n',
    )
    .replace(/<\s*li\b[^>]*>/gi, '\n• ')
    .replace(/<\s*\/li\s*>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();

const formatSignedDate = (value?: string | null) => {
  if (!value) {
    return '待签署';
  }
  return new Date(value).toLocaleDateString('zh-CN');
};

export default function ContractDocumentScreen({ route, navigation }: any) {
  const { theme } = useTheme();
  const styles = getStyles(theme);
  const orderId = Number(route.params?.orderId || 0);

  const [loading, setLoading] = useState(true);
  const [contract, setContract] = useState<ContractDetail | null>(null);
  const [downloading, setDownloading] = useState(false);

  const loadContract = useCallback(async () => {
    try {
      const res = await contractService.getByOrder(orderId);
      setContract(res.data || null);
    } catch {
      setContract(null);
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    loadContract();
  }, [loadContract]);

  const handleDownloadPDF = useCallback(async () => {
    setDownloading(true);
    try {
      const res = await contractService.getPdfDownloadInfo(orderId);
      const downloadUrl = res.data?.download_url;
      if (!downloadUrl) {
        throw new Error('未获取到合同下载链接');
      }

      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.open(downloadUrl, '_blank', 'noopener,noreferrer');
      } else {
        const supported = await Linking.canOpenURL(downloadUrl);
        if (!supported) {
          throw new Error('当前设备暂时无法打开合同下载链接');
        }
        await Linking.openURL(downloadUrl);
      }
    } catch (e: any) {
      Alert.alert('下载失败', e.message || '请稍后再试');
    } finally {
      setDownloading(false);
    }
  }, [orderId]);

  const readableContract = useMemo(
    () => htmlToReadableText(contract?.contract_html),
    [contract?.contract_html],
  );

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!contract) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
        <View style={styles.centerState}>
          <Text style={styles.emptyText}>暂无可展示的合同全文。</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
      <View style={styles.headerBar}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
        >
          <Text style={styles.backText}>˂ 返回</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>完整合同</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.heroCard}>
          <Text style={styles.contractTitle}>{contract.title}</Text>
          <Text style={styles.contractMeta}>
            合同编号：{contract.contract_no}
          </Text>
          <Text style={styles.contractHint}>
            这里展示的是适合阅读的完整合同正文，签署时间会随合同状态自动更新。
          </Text>
          <TouchableOpacity
            style={[
              styles.downloadBtn,
              downloading && styles.downloadBtnDisabled,
            ]}
            onPress={handleDownloadPDF}
            disabled={downloading}
          >
            <Text style={styles.downloadBtnText}>
              {downloading ? '正在准备 PDF...' : '下载 PDF 合同'}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.signSummaryCard}>
          <View style={styles.signSummaryItem}>
            <Text style={styles.signSummaryLabel}>委托方签署</Text>
            <Text style={styles.signSummaryValue}>
              {formatSignedDate(contract.client_signed_at)}
            </Text>
          </View>
          <View style={styles.signSummaryDivider} />
          <View style={styles.signSummaryItem}>
            <Text style={styles.signSummaryLabel}>服务方签署</Text>
            <Text style={styles.signSummaryValue}>
              {formatSignedDate(contract.provider_signed_at)}
            </Text>
          </View>
        </View>

        <View style={styles.documentCard}>
          <Text style={styles.documentText}>
            {readableContract || '当前合同正文为空。'}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
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
    centerState: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 24,
    },
    emptyText: { fontSize: 14, color: theme.textSub },
    content: { padding: 16, paddingBottom: 40 },
    heroCard: {
      backgroundColor: theme.card,
      borderRadius: 22,
      padding: 18,
      borderWidth: 1,
      borderColor: theme.divider,
      marginBottom: 14,
    },
    contractTitle: {
      fontSize: 19,
      fontWeight: '800',
      color: theme.text,
      marginBottom: 6,
    },
    contractMeta: {
      fontSize: 12,
      color: theme.textSub,
      marginBottom: 8,
    },
    contractHint: {
      fontSize: 13,
      lineHeight: 20,
      color: theme.textSub,
    },
    downloadBtn: {
      marginTop: 14,
      borderRadius: 14,
      paddingVertical: 12,
      paddingHorizontal: 14,
      backgroundColor: theme.primaryBg,
      borderWidth: 1,
      borderColor: theme.primaryBorder,
      alignItems: 'center',
    },
    downloadBtnDisabled: {
      opacity: 0.65,
    },
    downloadBtnText: {
      fontSize: 14,
      fontWeight: '700',
      color: theme.primaryText,
    },
    signSummaryCard: {
      flexDirection: 'row',
      alignItems: 'stretch',
      backgroundColor: theme.card,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: theme.divider,
      marginBottom: 14,
      overflow: 'hidden',
    },
    signSummaryItem: {
      flex: 1,
      paddingVertical: 14,
      paddingHorizontal: 16,
    },
    signSummaryDivider: {
      width: 1,
      backgroundColor: theme.divider,
    },
    signSummaryLabel: {
      fontSize: 12,
      color: theme.textSub,
      marginBottom: 6,
    },
    signSummaryValue: {
      fontSize: 15,
      fontWeight: '700',
      color: theme.text,
    },
    documentCard: {
      backgroundColor: theme.card,
      borderRadius: 22,
      padding: 18,
      borderWidth: 1,
      borderColor: theme.divider,
    },
    documentText: {
      fontSize: 14,
      lineHeight: 24,
      color: theme.text,
    },
  });
