import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  SafeAreaView,
  ScrollView,
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
import {formatAmountYuan} from '../../utils/supplyMeta';
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
    const isDraft = item.status === 'draft';
    const canEdit = ['draft', 'published', 'quoting'].includes(item.status);
    const editLabel = isDraft ? '继续完善' : '修改';
    const hasQuotes = item.quote_count > 0;

    return (
      <TouchableOpacity
        activeOpacity={0.8}
        style={[styles.demandCard, {backgroundColor: theme.card, borderColor: theme.cardBorder}]}
        onPress={() => navigation.navigate('DemandDetail', {id: item.id})}>
        <View style={styles.cardTop}>
          <StatusBadge label="" meta={getObjectStatusMeta('demand', item.status)} />
          <Text style={styles.demandNo}>{item.demand_no}</Text>
        </View>

        <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>

        <View style={styles.cardMeta}>
          <View style={styles.metaBadge}>
            <Text style={styles.metaBadgeText}>{getDemandSceneLabel(item.cargo_scene)}</Text>
          </View>
          <Text style={styles.cardAddress} numberOfLines={1}>📍 {resolveDemandPrimaryAddress(item)}</Text>
        </View>

        <View style={styles.cardStats}>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, hasQuotes && {color: theme.primaryText}]}>{item.quote_count}</Text>
            <Text style={styles.statLabel}>收到报价</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{item.candidate_pilot_count}</Text>
            <Text style={styles.statLabel}>候选飞手</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>¥{formatAmountYuan(item.budget_max)}</Text>
            <Text style={styles.statLabel}>预算上限</Text>
          </View>
        </View>

        <View style={styles.cardFooter}>
          <Text style={styles.timeLabel}>预约时间：{formatDemandSchedule(item.scheduled_start_at, item.scheduled_end_at).split(' ')[0]}</Text>
          <View style={styles.actionButtons}>
            {canEdit && (
              <TouchableOpacity
                style={styles.inlineEditBtn}
                onPress={() => navigation.navigate('EditDemand', {demandId: item.id})}
              >
                <Text style={styles.inlineEditBtnText}>{editLabel}</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[styles.inlineMainBtn, isDraft && {backgroundColor: theme.primary}]}
              onPress={() => navigation.navigate('DemandDetail', {id: item.id})}
            >
              <Text style={[styles.inlineMainBtnText, isDraft && {color: '#FFF'}]}>
                {isDraft ? '去发布' : hasQuotes ? '看报价' : '看详情'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={[styles.container, {backgroundColor: theme.bg}]}>
      <View style={styles.filterBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
          {STATUS_GROUPS.map(group => (
            <TouchableOpacity
              key={group.key}
              style={[styles.tabChip, activeGroup === group.key && styles.tabChipActive]}
              onPress={() => setActiveGroup(group.key)}>
              <Text style={[styles.tabChipText, activeGroup === group.key && styles.tabChipTextActive]}>
                {group.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <FlatList
        data={filteredDemands}
        keyExtractor={item => String(item.id)}
        renderItem={renderItem}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[theme.refreshColor]} />
        }
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator style={styles.loading} color={theme.primary} />
          ) : (
            <View style={styles.emptyWrap}>
              <EmptyState
                icon="📝"
                title={activeGroup === 'all' ? '还没有发布需求' : '暂无相关状态的任务'}
                description="发布任务后，专业机组会为您提供精准报价方案。"
                actionText="立即发布"
                onAction={() => navigation.navigate('PublishCargo')}
              />
            </View>
          )
        }
      />
    </SafeAreaView>
  );
}

const getStyles = (theme: AppTheme) =>
  StyleSheet.create({
    container: {flex: 1, backgroundColor: theme.bg},
    filterBar: {
      backgroundColor: theme.bg,
      borderBottomWidth: 1,
      borderBottomColor: theme.divider,
    },
    filterScroll: {
      paddingHorizontal: 16,
      paddingVertical: 12,
      gap: 10,
    },
    tabChip: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 20,
      backgroundColor: theme.bgSecondary,
    },
    tabChipActive: {
      backgroundColor: theme.primary,
    },
    tabChipText: {
      fontSize: 13,
      color: theme.textSub,
      fontWeight: '600',
    },
    tabChipTextActive: {
      color: '#FFFFFF',
    },
    listContent: {
      padding: 16,
      paddingBottom: 40,
    },
    demandCard: {
      borderRadius: 20,
      borderWidth: 1,
      padding: 16,
      marginBottom: 16,
      shadowColor: '#000',
      shadowOffset: {width: 0, height: 2},
      shadowOpacity: 0.04,
      shadowRadius: 8,
      elevation: 2,
    },
    cardTop: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12,
    },
    demandNo: {
      fontSize: 11,
      color: theme.textHint,
      fontWeight: '700',
    },
    cardTitle: {
      fontSize: 17,
      fontWeight: '800',
      color: theme.text,
      lineHeight: 24,
    },
    cardMeta: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 10,
      gap: 10,
    },
    metaBadge: {
      backgroundColor: theme.bgSecondary,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 6,
    },
    metaBadgeText: {
      fontSize: 11,
      color: theme.textSub,
      fontWeight: '600',
    },
    cardAddress: {
      flex: 1,
      fontSize: 12,
      color: theme.textSub,
    },
    cardStats: {
      flexDirection: 'row',
      backgroundColor: theme.bgSecondary,
      borderRadius: 14,
      paddingVertical: 12,
      marginTop: 16,
    },
    statItem: {
      flex: 1,
      alignItems: 'center',
    },
    statValue: {
      fontSize: 15,
      fontWeight: '800',
      color: theme.text,
    },
    statLabel: {
      fontSize: 10,
      color: theme.textHint,
      marginTop: 2,
      fontWeight: '600',
    },
    statDivider: {
      width: 1,
      height: '60%',
      backgroundColor: theme.divider,
      alignSelf: 'center',
    },
    cardFooter: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: 16,
      paddingTop: 14,
      borderTopWidth: 1,
      borderTopColor: theme.divider,
    },
    timeLabel: {
      fontSize: 11,
      color: theme.textHint,
      fontWeight: '500',
    },
    actionButtons: {
      flexDirection: 'row',
      gap: 8,
    },
    inlineEditBtn: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.divider,
    },
    inlineEditBtnText: {
      fontSize: 12,
      color: theme.textSub,
      fontWeight: '700',
    },
    inlineMainBtn: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 8,
      backgroundColor: theme.bgSecondary,
    },
    inlineMainBtnText: {
      fontSize: 12,
      color: theme.primaryText,
      fontWeight: '800',
    },
    loading: {
      paddingVertical: 40,
    },
    emptyWrap: {
      marginTop: 40,
    },
  });
