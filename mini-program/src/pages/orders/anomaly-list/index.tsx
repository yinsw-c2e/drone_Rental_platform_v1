import Taro, { useDidShow } from '@tarojs/taro';
import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, ScrollView } from '@tarojs/components';
import { orderAnomalyV2Service } from '../../../services/orderAnomalyV2';
import { V2OrderAnomaly, V2OrderAnomalySummary } from '../../../types';
import { getObjectStatusMeta } from '../../../utils';
import './index.scss';

type RoleFilter = 'client' | 'owner' | 'pilot' | 'all';
type SeverityFilter = 'all' | 'critical' | 'warning';

const severityTabs: { key: SeverityFilter; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'critical', label: '严重' },
  { key: 'warning', label: '提醒' },
];

const emptySummary: V2OrderAnomalySummary = {
  total: 0,
  critical_count: 0,
  warning_count: 0,
  by_anomaly_type: [],
  by_order_status: [],
};

const roleLabels: Record<RoleFilter, string> = {
  all: '综合视角',
  client: '客户视角',
  owner: '服务商视角',
  pilot: '服务商履约视角',
};

const anomalyTypeLabels: Record<string, string> = {
  payment_overdue: '支付逾期',
  provider_confirmation_overdue: '服务商确认超时',
  dispatch_overdue: '履约开始超时',
  dispatch_response_overdue: '履约响应超时',
  execution_stalled: '履约停滞',
  airspace_blocked: '空域受阻',
  compliance_risk: '合规风险',
  refund_requested: '退款申请',
  dispute_open: '售后争议',
  abnormal_track: '轨迹异常',
};

const normalizeRole = (value?: string): RoleFilter => {
  if (value === 'client' || value === 'owner' || value === 'pilot') return value;
  return 'all';
};

const normalizeItems = (res: any): V2OrderAnomaly[] => {
  if (Array.isArray(res?.items)) return res.items;
  if (Array.isArray(res?.data?.items)) return res.data.items;
  return [];
};

const normalizeSummary = (res: any): V2OrderAnomalySummary => {
  if (typeof res?.total === 'number') return res;
  if (typeof res?.data?.total === 'number') return res.data;
  return emptySummary;
};

const getSeverityLabel = (severity?: string) => {
  if (severity === 'critical') return '严重';
  if (severity === 'warning') return '提醒';
  return '提示';
};

const getSeverityClassName = (severity?: string) => {
  if (severity === 'critical') return 'severity-badge severity-badge-critical';
  if (severity === 'warning') return 'severity-badge severity-badge-warning';
  return 'severity-badge severity-badge-info';
};

const getAnomalyTypeLabel = (type?: string) => {
  if (!type) return '异常';
  return anomalyTypeLabels[type] || type.replace(/_/g, ' ');
};

const getStatusClassName = (tone?: string) => `status-badge status-badge-${tone || 'gray'}`;

const formatTime = (value?: string) => {
  if (!value) return '时间未知';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const getTabCount = (tab: SeverityFilter, summary: V2OrderAnomalySummary) => {
  if (tab === 'critical') return summary.critical_count || 0;
  if (tab === 'warning') return summary.warning_count || 0;
  return summary.total || 0;
};

export default function OrderAnomalyListPage() {
  const roleFilter = useMemo(
    () => normalizeRole(Taro.getCurrentInstance().router?.params?.role as string | undefined),
    [],
  );
  const [items, setItems] = useState<V2OrderAnomaly[]>([]);
  const [summary, setSummary] = useState<V2OrderAnomalySummary>(emptySummary);
  const [severity, setSeverity] = useState<SeverityFilter>('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async (nextSeverity?: SeverityFilter) => {
    const activeSeverity = nextSeverity || severity;
    const params = {
      role: roleFilter === 'all' ? undefined : roleFilter,
      severity: activeSeverity === 'all' ? undefined : activeSeverity,
      page: 1,
      page_size: 50,
    };

    try {
      const [listRes, summaryRes] = await Promise.all([
        orderAnomalyV2Service.list(params),
        orderAnomalyV2Service.summary({
          role: params.role,
          severity: params.severity,
        }),
      ]);
      setItems(normalizeItems(listRes));
      setSummary(normalizeSummary(summaryRes));
    } catch (error) {
      console.warn('加载异常订单失败:', error);
      setItems([]);
      setSummary(emptySummary);
      Taro.showToast({ title: '加载异常订单失败', icon: 'none' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [roleFilter, severity]);

  useDidShow(() => {
    setLoading(true);
    loadData();
  });

  const handleRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const handleSelectSeverity = (nextSeverity: SeverityFilter) => {
    if (nextSeverity === severity) return;
    setSeverity(nextSeverity);
    setLoading(true);
    loadData(nextSeverity);
  };

  const openAnomaly = (item: V2OrderAnomaly) => {
    if (item.order_id) {
      Taro.navigateTo({ url: `/pages/orders/detail/index?orderId=${item.order_id}` });
      return;
    }
    Taro.showToast({ title: '缺少订单信息', icon: 'none' });
  };

  return (
    <ScrollView
      scrollY
      className="page-wrap"
      refresherEnabled
      refresherTriggered={refreshing}
      onRefresherRefresh={handleRefresh}
    >
      <View className="hero">
        <Text className="hero-kicker">{roleLabels[roleFilter]}</Text>
        <Text className="hero-title">异常订单中心</Text>
        <Text className="hero-desc">
          共 {summary.total || 0} 条异常，严重 {summary.critical_count || 0} 条，提醒 {summary.warning_count || 0} 条。
        </Text>
      </View>

      <View className="summary-grid">
        <View className="summary-card">
          <Text className="summary-value">{summary.total || 0}</Text>
          <Text className="summary-label">全部异常</Text>
        </View>
        <View className="summary-card summary-card-critical">
          <Text className="summary-value">{summary.critical_count || 0}</Text>
          <Text className="summary-label">严重</Text>
        </View>
        <View className="summary-card summary-card-warning">
          <Text className="summary-value">{summary.warning_count || 0}</Text>
          <Text className="summary-label">提醒</Text>
        </View>
      </View>

      <View className="filter-row">
        {severityTabs.map(tab => (
          <View
            key={tab.key}
            className={`filter-chip ${severity === tab.key ? 'filter-chip-active' : ''}`}
            onClick={() => handleSelectSeverity(tab.key)}
          >
            <Text className={`filter-chip-text ${severity === tab.key ? 'filter-chip-text-active' : ''}`}>
              {tab.label} {getTabCount(tab.key, summary)}
            </Text>
          </View>
        ))}
      </View>

      <View className="list-content">
        {loading ? (
          <View className="state-box">
            <Text className="state-text">加载中...</Text>
          </View>
        ) : items.length === 0 ? (
          <View className="state-box">
            <Text className="state-title">当前没有异常订单</Text>
            <Text className="state-text">这里会集中展示异常原因、影响阶段和建议动作。</Text>
          </View>
        ) : (
          items.map(item => {
            const statusMeta = getObjectStatusMeta('order', item.status);
            return (
              <View
                key={`${item.order_id}-${item.anomaly_type}-${item.updated_at || ''}`}
                className="anomaly-card"
                onClick={() => openAnomaly(item)}
              >
                <View className="card-header">
                  <View className="card-header-left">
                    <Text className={getSeverityClassName(item.severity)}>{getSeverityLabel(item.severity)}</Text>
                    <Text className="order-no">{item.order_no || `订单 #${item.order_id}`}</Text>
                  </View>
                  <Text className={getStatusClassName(statusMeta.tone)}>{statusMeta.label}</Text>
                </View>

                <Text className="card-title">{item.title || getAnomalyTypeLabel(item.anomaly_type)}</Text>
                <View className="meta-row">
                  <Text className="meta-chip">{getAnomalyTypeLabel(item.anomaly_type)}</Text>
                  <Text className="meta-chip">{item.stage_label || item.status || '阶段未知'}</Text>
                </View>
                <Text className="message-text">{item.message || '暂无异常说明'}</Text>
                {item.stalled_text ? <Text className="stalled-text">{item.stalled_text}</Text> : null}
                {item.recommended_action ? (
                  <View className="action-box">
                    <Text className="action-label">建议动作</Text>
                    <Text className="action-text">{item.recommended_action}</Text>
                  </View>
                ) : null}
                <View className="card-footer">
                  <Text className="footer-time">更新于 {formatTime(item.updated_at)}</Text>
                  <Text className="footer-link">查看订单</Text>
                </View>
              </View>
            );
          })
        )}
      </View>
    </ScrollView>
  );
}
