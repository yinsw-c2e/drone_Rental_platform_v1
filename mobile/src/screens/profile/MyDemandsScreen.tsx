import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import EmptyState from '../../components/business/EmptyState';
import ObjectCard from '../../components/business/ObjectCard';
import SourceTag from '../../components/business/SourceTag';
import StatusBadge from '../../components/business/StatusBadge';
import {getObjectStatusMeta} from '../../components/business/visuals';
import {demandV2Service} from '../../services/demandV2';
import {DemandSummary} from '../../types';
import {
  formatDemandBudget,
  formatDemandSchedule,
  getDemandSceneLabel,
  resolveDemandPrimaryAddress,
} from '../../utils/demandMeta';
import {useTheme} from '../../theme/ThemeContext';
import type {AppTheme} from '../../theme/index';

const STATUS_GROUPS = [
  {key: 'all', label: '全部'},
  {key: 'draft', label: '草稿'},
  {key: 'quoting', label: '询价中'},
  {key: 'selected', label: '已选定'},
  {key: 'converted_to_order', label: '已转订单'},
  {key: 'closed', label: '已结束'},
] as const;

type StatusGroupKey = (typeof STATUS_GROUPS)[number]['key'];

const matchesStatusGroup = (status: string, group: StatusGroupKey) => {
  const normalized = String(status || '').toLowerCase();
  if (group === 'all') {
    return true;
  }
  if (group === 'quoting') {
    return normalized === 'published' || normalized === 'quoting';
  }
  if (group === 'closed') {
    return ['cancelled', 'expired', 'closed'].includes(normalized);
  }
  return normalized === group;
};

export default function MyDemandsScreen({navigation, route}: any) {
  const {theme} = useTheme();
  const styles = getStyles(theme);
  const initialGroup = (() => {
    const param = route?.params?.statusFilter;
    if (param === 'quoted' || param === 'quoting') {
      return 'quoting';
    }
    const keys = STATUS_GROUPS.map(g => g.key);
    if (param && keys.includes(param)) {
      return param as StatusGroupKey;
    }
    return 'all';
  })();
  const [demands, setDemands] = useState<DemandSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeGroup, setActiveGroup] = useState<StatusGroupKey>(initialGroup);

  const fetchData = useCallback(async () => {
    try {
      const res = await demandV2Service.listMyDemands({page: 1, page_size: 100});
      setDemands(res.data?.items || []);
    } catch (error) {
      console.warn('获取我的需求失败:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData();
  }, [fetchData]);

  const filteredDemands = useMemo(
    () => demands.filter(item => matchesStatusGroup(item.status, activeGroup)),
    [activeGroup, demands],
  );

  const renderItem = ({item}: {item: DemandSummary}) => {
    const quoteText = item.quote_count > 0 ? `${item.quote_count} 个报价` : '暂无报价';
    const candidateText = item.allows_pilot_candidate
      ? `${item.candidate_pilot_count} 位候选飞手`
      : '不开放飞手候选';

    const canEdit = ['draft', 'published', 'quoting'].includes(item.status);
    const editLabel = item.status === 'draft' ? '继续完善' : '修改';
    const canShowQuoteButton = ['published', 'quoting', 'selected'].includes(item.status) && item.quote_count > 0;

    const handleCancel = () => {
      Alert.alert('确认撤销', '撤销后需求将不可恢复，已有报价也会被拒绝。', [
        {text: '取消', style: 'cancel'},
        {text: '确认撤销', style: 'destructive', onPress: async () => {
          try {
            await demandV2Service.cancel(item.id);
            Alert.alert('已撤销', '需求已成功撤销。');
            fetchData();
          } catch (e: any) {
            Alert.alert('撤销失败', e.message || '请稍后重试');
          }
        }},
      ]);
    };

    return (
      <ObjectCard
        style={styles.card}
        onPress={() => navigation.navigate('DemandDetail', {id: item.id})}>
        <View style={styles.cardHeader}>
          <View style={styles.cardHeaderLeft}>
            <SourceTag source="demand" />
            <StatusBadge label="" meta={getObjectStatusMeta('demand', item.status)} />
          </View>
          <Text style={styles.code}>{item.demand_no}</Text>
        </View>

        <Text style={styles.title}>{item.title}</Text>
        <Text style={styles.address}>{resolveDemandPrimaryAddress(item)}</Text>

        <View style={styles.metaRow}>
          <Text style={styles.metaText}>场景：{getDemandSceneLabel(item.cargo_scene)}</Text>
          <Text style={styles.metaText}>预算：{formatDemandBudget(item.budget_min, item.budget_max)}</Text>
        </View>

        <View style={styles.metaRow}>
          <Text style={styles.metaText}>{quoteText}</Text>
          <Text style={styles.metaText}>{candidateText}</Text>
        </View>

        <Text style={styles.schedule}>{formatDemandSchedule(item.scheduled_start_at, item.scheduled_end_at)}</Text>

        <View style={styles.footer}>
          {canEdit ? (
            <>
              <TouchableOpacity
                style={styles.dangerBtn}
                onPress={handleCancel}>
                <Text style={styles.dangerBtnText}>撤销</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.secondaryBtn}
                onPress={() => navigation.navigate('EditDemand', {demandId: item.id})}>
                <Text style={styles.secondaryBtnText}>{editLabel}</Text>
              </TouchableOpacity>
            </>
          ) : null}
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() => navigation.navigate('DemandDetail', {id: item.id})}>
            <Text style={styles.primaryBtnText}>{canShowQuoteButton ? '查看报价' : '查看详情'}</Text>
          </TouchableOpacity>
        </View>
      </ObjectCard>
    );
  };

  return (
    <SafeAreaView style={[styles.container, {backgroundColor: theme.bg}]}>
      <FlatList
        data={filteredDemands}
        keyExtractor={item => String(item.id)}
        renderItem={renderItem}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[theme.refreshColor]} />
        }
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <View>
            <View style={styles.hero}>
              <Text style={styles.heroEyebrow}>我的需求</Text>
              <Text style={styles.heroTitle}>只看需求对象，不再混订单</Text>
              <Text style={styles.heroDesc}>
                这里统一查看自己发布的需求、报价进度和候选飞手情况，进入详情后再决定是否转订单。
              </Text>
            </View>

            <ObjectCard style={styles.filterCard}>
              <Text style={styles.filterTitle}>需求分组</Text>
              <View style={styles.filterRow}>
                {STATUS_GROUPS.map(group => (
                  <TouchableOpacity
                    key={group.key}
                    style={[
                      styles.filterChip,
                      activeGroup === group.key && styles.filterChipActive,
                    ]}
                    onPress={() => setActiveGroup(group.key)}>
                    <Text
                      style={[
                        styles.filterChipText,
                        activeGroup === group.key && styles.filterChipTextActive,
                      ]}>
                      {group.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ObjectCard>
          </View>
        }
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator style={styles.loading} color={theme.primary} />
          ) : (
            <ObjectCard>
              <EmptyState
                icon="📝"
                title={activeGroup === 'all' ? '还没有发布需求' : '这个分组下暂无需求'}
                description="发布后，机主会围绕需求报价，飞手也可以对开放候选的需求报名。"
                actionText="发布任务"
                onAction={() => navigation.navigate('PublishCargo')}
              />
            </ObjectCard>
          )
        }
      />
    </SafeAreaView>
  );
}

const getStyles = (theme: AppTheme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.bgSecondary,
  },
  content: {
    padding: 14,
    paddingBottom: 28,
  },
  hero: {
    backgroundColor: theme.isDark ? 'rgba(0,212,255,0.08)' : theme.primary,
    borderRadius: 24,
    padding: 20,
    marginBottom: 12,
    borderWidth: theme.isDark ? 1 : 0,
    borderColor: theme.isDark ? theme.primaryBorder : 'transparent',
  },
  heroEyebrow: {
    fontSize: 12,
    color: theme.isDark ? theme.primaryText : 'rgba(255,255,255,0.7)',
    fontWeight: '700',
  },
  heroTitle: {
    marginTop: 8,
    fontSize: 28,
    lineHeight: 34,
    color: theme.isDark ? theme.text : '#FFFFFF',
    fontWeight: '800',
  },
  heroDesc: {
    marginTop: 10,
    fontSize: 13,
    lineHeight: 20,
    color: theme.isDark ? theme.textSub : 'rgba(255,255,255,0.85)',
  },
  filterCard: {
    marginBottom: 12,
  },
  filterTitle: {
    fontSize: 14,
    color: theme.text,
    fontWeight: '700',
    marginBottom: 12,
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.divider,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: theme.card,
  },
  filterChipActive: {
    borderColor: theme.primary,
    backgroundColor: theme.primaryBg,
  },
  filterChipText: {
    fontSize: 12,
    color: theme.textSub,
    fontWeight: '600',
  },
  filterChipTextActive: {
    color: theme.primaryText,
  },
  loading: {
    paddingVertical: 48,
  },
  card: {
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  code: {
    fontSize: 12,
    color: theme.textSub,
    fontWeight: '600',
  },
  title: {
    marginTop: 14,
    fontSize: 17,
    lineHeight: 24,
    color: theme.text,
    fontWeight: '700',
  },
  address: {
    marginTop: 8,
    fontSize: 13,
    lineHeight: 20,
    color: theme.textSub,
  },
  metaRow: {
    marginTop: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  metaText: {
    flex: 1,
    fontSize: 12,
    color: theme.textSub,
  },
  schedule: {
    marginTop: 12,
    fontSize: 12,
    color: theme.textSub,
  },
  footer: {
    marginTop: 16,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  secondaryBtn: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.divider,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  secondaryBtnText: {
    fontSize: 12,
    color: theme.textSub,
    fontWeight: '700',
  },
  primaryBtn: {
    borderRadius: 999,
    backgroundColor: theme.primary,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  primaryBtnText: {
    fontSize: 12,
    color: theme.btnPrimaryText,
    fontWeight: '700',
  },
  dangerBtn: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.danger,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  dangerBtnText: {
    fontSize: 12,
    color: theme.danger,
    fontWeight: '700',
  },
});
