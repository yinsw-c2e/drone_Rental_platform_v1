import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';

import EmptyState from '../../components/business/EmptyState';
import StatusBadge from '../../components/business/StatusBadge';
import {getObjectStatusMeta} from '../../components/business/visuals';
import {demandV2Service} from '../../services/demandV2';
import {DemandSummary} from '../../types';
import {
  formatDemandSchedule,
  getDemandSceneLabel,
  resolveDemandPrimaryAddress,
} from '../../utils/demandMeta';
import {formatAmountYuan} from '../../utils/supplyMeta';
import {useTheme} from '../../theme/ThemeContext';
import type {AppTheme} from '../../theme/index';
import {myDemandsAssets} from '../../assets/miniProgramAssets';

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
      const res = await demandV2Service.listMyDemands({page: 1, page_size: 50});
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

  const handleBack = () => {
    if (navigation.canGoBack?.()) {
      navigation.goBack();
      return;
    }
    navigation.navigate('MainTabs', {screen: 'Profile'});
  };

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
          <Text style={styles.demandNo}>{item.demand_no}</Text>
          <StatusBadge label="" meta={getObjectStatusMeta('demand', item.status)} />
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
            <Text style={[styles.statValue, styles.statValueBlue, hasQuotes && {color: theme.primaryText}]}>{item.quote_count}</Text>
            <Text style={styles.statLabel}>报价</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, styles.statValueOrange]}>{item.candidate_pilot_count}</Text>
            <Text style={styles.statLabel}>候选飞手</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, styles.statValueRed]}>{formatAmountYuan(item.budget_max)}</Text>
            <Text style={styles.statLabel}>预算</Text>
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
    <SafeAreaView style={styles.container}>
      <LinearGradient
        colors={['#F3F8FF', '#FFFFFF', '#F5F7FB']}
        locations={[0, 0.42, 1]}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.navBar}>
        <View style={styles.navSide}>
          <TouchableOpacity style={styles.navBack} onPress={handleBack} activeOpacity={0.82}>
            <Image source={myDemandsAssets.back} style={styles.navBackIcon} resizeMode="contain" />
          </TouchableOpacity>
        </View>
        <Text style={styles.navTitle}>我的需求</Text>
        <View style={[styles.navSide, styles.navSideRight]} />
      </View>
      <View style={styles.hero}>
        <View style={styles.heroCopy}>
          <View style={styles.heroTitleRow}>
            <Text style={styles.heroTitle}>我的需求</Text>
            <View style={styles.heroTitleDot} />
          </View>
          <Text style={styles.heroSub}>管理我的全部需求订单，实时掌握进度与状态</Text>
        </View>
        <Image source={myDemandsAssets.hero} style={styles.heroImage} resizeMode="contain" />
      </View>
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
                title={activeGroup === 'all' ? '还没有发布需求' : '暂无相关状态的需求'}
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
    container: {flex: 1, backgroundColor: '#F5F7FB'},
    navBar: {
      minHeight: 56,
      paddingHorizontal: 10,
      paddingTop: 0,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: 'rgba(255,255,255,0.38)',
    },
    navSide: {
      width: 92,
      flexDirection: 'row',
      alignItems: 'center',
    },
    navSideRight: {
      justifyContent: 'flex-end',
    },
    navBack: {
      width: 42,
      height: 42,
      alignItems: 'center',
      justifyContent: 'center',
    },
    navBackIcon: {
      width: 18,
      height: 18,
    },
    navTitle: {
      flex: 1,
      color: '#111827',
      fontSize: 18,
      lineHeight: 24,
      fontWeight: '700',
      textAlign: 'center',
    },
    hero: {
      marginBottom: 0,
      minHeight: 150,
      borderRadius: 0,
      flexDirection: 'row',
      alignItems: 'center',
      overflow: 'hidden',
      paddingHorizontal: 14,
      paddingTop: 12,
      paddingBottom: 18,
    },
    heroCopy: {
      flex: 1,
      minWidth: 0,
      paddingVertical: 16,
      paddingRight: 8,
    },
    heroTitleRow: {flexDirection: 'row', alignItems: 'flex-start'},
    heroTitle: {
      fontSize: 28,
      lineHeight: 34,
      color: theme.text,
      fontWeight: '900',
    },
    heroTitleDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      marginLeft: 4,
      marginTop: 3,
      backgroundColor: '#2B76FF',
    },
    heroSub: {
      marginTop: 9,
      fontSize: 12,
      lineHeight: 18,
      color: theme.textSub,
      fontWeight: '500',
    },
    heroImage: {
      width: 112,
      height: 98,
      marginRight: 4,
    },
    filterBar: {
      backgroundColor: 'transparent',
    },
    filterScroll: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      gap: 8,
    },
    tabChip: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 20,
      backgroundColor: '#E8EDF2',
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
      padding: 12,
      paddingBottom: 40,
    },
    demandCard: {
      borderRadius: 16,
      borderWidth: 1,
      padding: 14,
      marginBottom: 10,
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
      gap: 10,
      marginBottom: 12,
    },
    demandNo: {
      flex: 1,
      minWidth: 0,
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
      backgroundColor: '#F8FBFF',
      borderRadius: 10,
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
    statValueBlue: {color: '#1F6DFF'},
    statValueOrange: {color: '#FF8A00'},
    statValueRed: {color: '#F5222D'},
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
