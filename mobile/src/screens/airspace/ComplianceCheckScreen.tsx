import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import {
  runComplianceCheck,
  getComplianceCheck,
  getLatestComplianceCheck,
  ComplianceCheck,
  ComplianceCheckItem,
} from '../../services/airspace';
import {useTheme} from '../../theme/ThemeContext';
import type {AppTheme} from '../../theme/index';

const RESULT_CONFIG: Record<string, {label: string; colorKey: 'success' | 'danger' | 'warning' | 'info'; icon: string}> = {
  passed: {label: '通过', colorKey: 'success', icon: 'V'},
  failed: {label: '未通过', colorKey: 'danger', icon: 'X'},
  warning: {label: '警告', colorKey: 'warning', icon: '!'},
  pending: {label: '检查中', colorKey: 'info', icon: '?'},
};

const CATEGORY_MAP: Record<string, string> = {
  pilot: '飞手资质',
  drone: '无人机合规',
  cargo: '载荷检查',
  airspace: '空域检查',
};

const SEVERITY_MAP: Record<string, {label: string; colorKey: 'danger' | 'warning' | 'info'}> = {
  error: {label: '严重', colorKey: 'danger'},
  warning: {label: '警告', colorKey: 'warning'},
  info: {label: '提示', colorKey: 'info'},
};

export default function ComplianceCheckScreen({navigation, route}: any) {
  const {theme} = useTheme();
  const styles = getStyles(theme);
  const {pilotId, droneId, orderId, applicationId, checkId} = route?.params || {};
  const [check, setCheck] = useState<ComplianceCheck | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      if (checkId) {
        const data = await getComplianceCheck(checkId);
        setCheck(data);
      } else if (pilotId && droneId) {
        try {
          const data = await getLatestComplianceCheck(pilotId, droneId);
          setCheck(data);
        } catch {
          // No existing check, that's ok
        }
      }
    } catch (err: any) {
      console.log('加载合规检查失败:', err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRunCheck = async () => {
    if (!pilotId || !droneId) {
      Alert.alert('提示', '缺少飞手或无人机信息');
      return;
    }

    setRunning(true);
    try {
      const data = await runComplianceCheck({
        pilot_id: pilotId,
        drone_id: droneId,
        order_id: orderId || 0,
        airspace_application_id: applicationId || 0,
        trigger_type: 'manual',
      });
      setCheck(data);
      if (data.overall_result === 'failed') {
        Alert.alert('合规检查未通过', data.notes || '请查看详细检查项目');
      } else if (data.overall_result === 'warning') {
        Alert.alert('合规检查通过(有警告)', data.notes || '');
      } else {
        Alert.alert('合规检查通过', '所有检查项目均已通过');
      }
    } catch (err: any) {
      Alert.alert('检查失败', err.message);
    } finally {
      setRunning(false);
    }
  };

  const renderOverallResult = () => {
    if (!check) return null;
    const config = RESULT_CONFIG[check.overall_result] || RESULT_CONFIG.pending;

    return (
      <View style={[styles.overallCard, {backgroundColor: theme[config.colorKey] + '22', borderColor: theme[config.colorKey]}]}>
        <View style={[styles.resultIconCircle, {backgroundColor: theme[config.colorKey]}]}>
          <Text style={styles.resultIcon}>{config.icon}</Text>
        </View>
        <View style={styles.overallInfo}>
          <Text style={[styles.overallTitle, {color: theme[config.colorKey]}]}>
            合规检查{config.label}
          </Text>
          <Text style={styles.overallNotes}>{check.notes}</Text>
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={[styles.statNum, {color: theme.success}]}>{check.passed_items}</Text>
              <Text style={styles.statLabel}>通过</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statNum, {color: theme.danger}]}>{check.failed_items}</Text>
              <Text style={styles.statLabel}>失败</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statNum, {color: theme.warning}]}>{check.warning_items}</Text>
              <Text style={styles.statLabel}>警告</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statNum, {color: theme.text}]}>{check.total_items}</Text>
              <Text style={styles.statLabel}>总计</Text>
            </View>
          </View>
        </View>
      </View>
    );
  };

  const renderCategorySection = (category: string, items: ComplianceCheckItem[]) => {
    const allPassed = items.every(i => i.result === 'passed');
    const hasFailed = items.some(i => i.result === 'failed');
    const headerColor = hasFailed ? theme.danger : allPassed ? theme.success : theme.warning;

    return (
      <View key={category} style={styles.categorySection}>
        <View style={styles.categoryHeader}>
          <View style={[styles.categoryDot, {backgroundColor: headerColor}]} />
          <Text style={styles.categoryTitle}>{CATEGORY_MAP[category] || category}</Text>
          <Text style={[styles.categoryResult, {color: headerColor}]}>
            {hasFailed ? '未通过' : allPassed ? '全部通过' : '有警告'}
          </Text>
        </View>

        {items.map((item, idx) => {
          const resultCfg = RESULT_CONFIG[item.result] || RESULT_CONFIG.pending;
          const severityCfg = SEVERITY_MAP[item.severity] || SEVERITY_MAP.info;
          return (
            <View key={idx} style={[styles.checkItem, {borderLeftColor: theme[resultCfg.colorKey]}]}>
              <View style={styles.checkItemHeader}>
                <Text style={styles.checkItemName}>{item.check_name}</Text>
                <View style={[styles.checkItemBadge, {backgroundColor: theme[resultCfg.colorKey] + '22'}]}>
                  <Text style={[styles.checkItemBadgeText, {color: theme[resultCfg.colorKey]}]}>{resultCfg.label}</Text>
                </View>
              </View>
              <Text style={styles.checkItemMsg}>{item.message}</Text>
              {(item.expected_value || item.actual_value) && (
                <View style={styles.checkItemValues}>
                  {item.expected_value ? <Text style={styles.valueText}>要求: {item.expected_value}</Text> : null}
                  {item.actual_value ? <Text style={styles.valueText}>实际: {item.actual_value}</Text> : null}
                </View>
              )}
              <View style={styles.checkItemFooter}>
                {item.is_blocking && <Text style={[styles.tagText, {color: theme.danger}]}>阻断项</Text>}
                {item.is_required && <Text style={[styles.tagText, {color: theme.primaryText}]}>必检项</Text>}
                <Text style={[styles.tagText, {color: theme[severityCfg.colorKey]}]}>{severityCfg.label}</Text>
              </View>
            </View>
          );
        })}
      </View>
    );
  };

  const groupedItems = () => {
    if (!check?.items) return {};
    const groups: Record<string, ComplianceCheckItem[]> = {};
    for (const item of check.items) {
      if (!groups[item.category]) groups[item.category] = [];
      groups[item.category].push(item);
    }
    return groups;
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, {backgroundColor: theme.bg}]}>
        <ActivityIndicator size="large" color={theme.primary} style={{marginTop: 100}} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, {backgroundColor: theme.bg}]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Run / Re-run button */}
        <TouchableOpacity
          style={[styles.runBtn, running && styles.runBtnDisabled]}
          onPress={handleRunCheck}
          disabled={running}>
          <Text style={styles.runBtnText}>
            {running ? '检查中...' : check ? '重新检查' : '执行合规检查'}
          </Text>
        </TouchableOpacity>

        {check && (
          <>
            {renderOverallResult()}

            {/* Category compliance summary */}
            <View style={styles.complianceSummary}>
              {(['pilot', 'drone', 'cargo', 'airspace'] as const).map(cat => {
                const key = `${cat}_compliance` as keyof ComplianceCheck;
                const val = check[key] as string;
                if (!val) return null;
                const cfg = RESULT_CONFIG[val] || RESULT_CONFIG.pending;
                return (
                  <View key={cat} style={[styles.summaryItem, {backgroundColor: theme[cfg.colorKey] + '22'}]}>
                    <Text style={[styles.summaryLabel, {color: theme[cfg.colorKey]}]}>{CATEGORY_MAP[cat]}</Text>
                    <Text style={[styles.summaryValue, {color: theme[cfg.colorKey]}]}>{cfg.label}</Text>
                  </View>
                );
              })}
            </View>

            {/* Detailed check items grouped by category */}
            {Object.entries(groupedItems()).map(([cat, items]) =>
              renderCategorySection(cat, items),
            )}

            {/* Meta info */}
            <View style={styles.metaSection}>
              <Text style={styles.metaText}>检查时间: {check.created_at ? new Date(check.created_at).toLocaleString() : '-'}</Text>
              <Text style={styles.metaText}>有效期至: {check.expires_at ? new Date(check.expires_at).toLocaleString() : '-'}</Text>
              <Text style={styles.metaText}>触发方式: {check.trigger_type === 'manual' ? '手动检查' : check.trigger_type === 'airspace_apply' ? '空域申请' : check.trigger_type}</Text>
            </View>
          </>
        )}

        {!check && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>暂无合规检查记录</Text>
            <Text style={styles.emptyDesc}>点击上方按钮执行合规性检查，系统将对飞手资质、无人机合规性、载荷重量、空域限制进行全面检查</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const getStyles = (theme: AppTheme) => StyleSheet.create({
  container: {flex: 1, backgroundColor: theme.bgSecondary},
  content: {padding: 16},
  runBtn: {backgroundColor: theme.primary, paddingVertical: 14, borderRadius: 8, alignItems: 'center', marginBottom: 16},
  runBtnDisabled: {opacity: 0.6},
  runBtnText: {color: theme.btnPrimaryText, fontSize: 16, fontWeight: '600'},

  overallCard: {borderRadius: 12, padding: 16, marginBottom: 16, borderWidth: 1, flexDirection: 'row', alignItems: 'center'},
  resultIconCircle: {width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center', marginRight: 12},
  resultIcon: {color: theme.btnPrimaryText, fontSize: 24, fontWeight: '700'},
  overallInfo: {flex: 1},
  overallTitle: {fontSize: 18, fontWeight: '700', marginBottom: 4},
  overallNotes: {fontSize: 13, color: theme.textSub, marginBottom: 8},
  statsRow: {flexDirection: 'row', gap: 16},
  statItem: {alignItems: 'center'},
  statNum: {fontSize: 18, fontWeight: '700'},
  statLabel: {fontSize: 11, color: theme.textSub, marginTop: 2},

  complianceSummary: {flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16},
  summaryItem: {flex: 1, minWidth: '45%', paddingVertical: 10, paddingHorizontal: 12, borderRadius: 8, alignItems: 'center'},
  summaryLabel: {fontSize: 12, marginBottom: 2},
  summaryValue: {fontSize: 14, fontWeight: '600'},

  categorySection: {backgroundColor: theme.card, borderRadius: 12, padding: 16, marginBottom: 12},
  categoryHeader: {flexDirection: 'row', alignItems: 'center', marginBottom: 12},
  categoryDot: {width: 8, height: 8, borderRadius: 4, marginRight: 8},
  categoryTitle: {fontSize: 15, fontWeight: '600', color: theme.text, flex: 1},
  categoryResult: {fontSize: 13, fontWeight: '500'},

  checkItem: {backgroundColor: theme.bgSecondary, borderRadius: 8, padding: 12, marginBottom: 8, borderLeftWidth: 3},
  checkItemHeader: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6},
  checkItemName: {fontSize: 14, fontWeight: '500', color: theme.text},
  checkItemBadge: {paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4},
  checkItemBadgeText: {fontSize: 11, fontWeight: '500'},
  checkItemMsg: {fontSize: 13, color: theme.textSub, marginBottom: 4},
  checkItemValues: {flexDirection: 'row', gap: 16, marginBottom: 4},
  valueText: {fontSize: 12, color: theme.textSub},
  checkItemFooter: {flexDirection: 'row', gap: 8},
  tagText: {fontSize: 11, fontWeight: '500'},

  metaSection: {backgroundColor: theme.card, borderRadius: 12, padding: 16, marginTop: 4},
  metaText: {fontSize: 12, color: theme.textSub, marginBottom: 4},

  emptyState: {alignItems: 'center', paddingTop: 60},
  emptyTitle: {fontSize: 16, color: theme.textSub, marginBottom: 8},
  emptyDesc: {fontSize: 13, color: theme.textHint, textAlign: 'center', lineHeight: 20, paddingHorizontal: 20},
});
