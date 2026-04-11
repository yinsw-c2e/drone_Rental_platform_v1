import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {
  FlatList,
  RefreshControl,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {useSelector} from 'react-redux';
import EmptyState from '../../components/business/EmptyState';
import ObjectCard from '../../components/business/ObjectCard';
import SourceTag from '../../components/business/SourceTag';
import StatusBadge from '../../components/business/StatusBadge';
import {getObjectStatusMeta, getTonePalette} from '../../components/business/visuals';
import {demandV2Service} from '../../services/demandV2';
import {homeService} from '../../services/home';
import {RootState} from '../../store/store';
import {DemandSummary} from '../../types';
import {getDemandSceneLabel, formatDemandBudget, formatDemandSchedule, resolveDemandPrimaryAddress} from '../../utils/demandMeta';
import {EMPTY_ROLE_SUMMARY, getEffectiveRoleSummary} from '../../utils/roleSummary';
import {useTheme} from '../../theme/ThemeContext';
import type {AppTheme} from '../../theme/index';

type MarketDemandMode = 'public' | 'owner' | 'pilot';

const PAGE_SIZE = 20;

const MODE_META: Record<MarketDemandMode, {label: string; desc: string; tone: ReturnType<typeof getTonePalette>; actionLabel: string}> = {
  public: {
    label: '公开任务',
    desc: '查看当前公开的重载吊运任务，市场页只展示任务对象。',
    tone: getTonePalette('blue'),
    actionLabel: '查看详情',
  },
  owner: {
    label: '机主视角',
    desc: '这里展示可报价任务，报价后仍停留在撮合阶段，不会直接生成订单。',
    tone: getTonePalette('green'),
    actionLabel: '去报价',
  },
  pilot: {
    label: '飞手视角',
    desc: '这里只展示可报名候选的公开任务，报名后进入候选池，不等于直接接单。',
    tone: getTonePalette('orange'),
    actionLabel: '去候选',
  },
};

export default function DemandListScreen({navigation, route}: any) {
  const {theme} = useTheme();
  const styles = getStyles(theme);
  const authUser = useSelector((state: RootState) => state.auth.user);
  const authRoleSummary = useSelector((state: RootState) => state.auth.roleSummary);
  const roleSummary = useMemo(
    () => getEffectiveRoleSummary(authRoleSummary, authUser) || EMPTY_ROLE_SUMMARY,
    [authRoleSummary, authUser],
  );

  const availableModes = useMemo<MarketDemandMode[]>(() => {
    const modes: MarketDemandMode[] = ['public'];
    if (roleSummary.has_owner_role) {
      modes.push('owner');
    }
    if (roleSummary.has_pilot_role) {
      modes.push('pilot');
    }
    return modes;
  }, [roleSummary.has_owner_role, roleSummary.has_pilot_role]);

  const [mode, setMode] = useState<MarketDemandMode>(() => {
    const requestedMode = route?.params?.mode as MarketDemandMode | undefined;
    if (requestedMode && ['public', 'owner', 'pilot'].includes(requestedMode)) {
      return requestedMode;
    }
    return availableModes[0] || 'public';
  });
  const [demands, setDemands] = useState<DemandSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  const fetchPublicDemands = useCallback(async (): Promise<DemandSummary[]> => {
    const dashboard = await homeService.getDashboard();
    const demandIds = Array.from(
      new Set(
        (dashboard.data?.market_feed || [])
          .filter(item => item.object_type === 'demand')
          .map(item => item.object_id),
      ),
    );

    if (demandIds.length === 0) {
      return [];
    }

    const details = await Promise.all(
      demandIds.slice(0, PAGE_SIZE).map(async demandId => {
        try {
          const res = await demandV2Service.getById(demandId);
          return res.data;
        } catch {
          return null;
        }
      }),
    );

    return details.filter(Boolean) as DemandSummary[];
  }, []);

  useEffect(() => {
    if (!availableModes.includes(mode)) {
      setMode(availableModes[0] || 'public');
    }
  }, [availableModes, mode]);

  useEffect(() => {
    const requestedMode = route?.params?.mode as MarketDemandMode | undefined;
    if (!requestedMode || !availableModes.includes(requestedMode)) {
      return;
    }
    setMode(prev => (prev === requestedMode ? prev : requestedMode));
  }, [availableModes, route?.params?.mode]);

  const fetchDemands = useCallback(async (nextPage = 1, isRefresh = false) => {
    try {
      let items: DemandSummary[] = [];
      let total = 0;

      if (mode === 'public') {
        items = await fetchPublicDemands();
        total = items.length;
      } else {
        const params = {page: nextPage, page_size: PAGE_SIZE};
        const res = mode === 'pilot'
          ? await demandV2Service.listPilotCandidateDemands(params)
          : await demandV2Service.listMarketplaceDemands(params);
        items = res.data?.items || [];
        total = Number(res.meta?.total || 0);
      }

      if (isRefresh || nextPage === 1) {
        setDemands(items);
      } else {
        setDemands(prev => [...prev, ...items]);
      }
      setHasMore(mode !== 'public' && nextPage * PAGE_SIZE < total);
    } catch (error) {
      console.warn('获取需求市场失败:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [fetchPublicDemands, mode]);

  useEffect(() => {
    setLoading(true);
    setPage(1);
    fetchDemands(1, true);
  }, [fetchDemands]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setPage(1);
    fetchDemands(1, true);
  }, [fetchDemands]);

  const onLoadMore = useCallback(() => {
    if (loading || refreshing || !hasMore) {
      return;
    }
    const nextPage = page + 1;
    setPage(nextPage);
    fetchDemands(nextPage);
  }, [fetchDemands, hasMore, loading, page, refreshing]);

  const renderModeTabs = () => {
    if (availableModes.length <= 1) {
      return null;
    }
    return (
      <View style={styles.modeTabs}>
        {availableModes.map(item => {
          const selected = item === mode;
          return (
            <TouchableOpacity
              key={item}
              style={[styles.modeTab, selected && styles.modeTabActive]}
              onPress={() => setMode(item)}
              activeOpacity={0.88}>
              <Text style={[styles.modeTabText, selected && styles.modeTabTextActive]}>
                {MODE_META[item].label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    );
  };

  const renderItem = ({item}: {item: DemandSummary}) => {
    const modeMeta = MODE_META[mode];
    return (
      <ObjectCard
        onPress={() => navigation.navigate('DemandDetail', {id: item.id, marketMode: mode})}
        highlightColor={modeMeta.tone.border}>
        <View style={styles.cardHeader}>
          <View style={styles.cardHeaderMain}>
            <Text style={styles.title} numberOfLines={2}>{item.title}</Text>
            <View style={styles.tagRow}>
              <SourceTag source="demand" />
              <StatusBadge meta={getObjectStatusMeta('demand', item.status)} label="" />
            </View>
          </View>
        </View>

        <Text style={styles.budget}>{formatDemandBudget(item.budget_min, item.budget_max)}</Text>

        <View style={styles.metaBlock}>
          <Text style={styles.metaText}>场景：{getDemandSceneLabel(item.cargo_scene)}</Text>
          <Text style={styles.metaText}>区域：{resolveDemandPrimaryAddress(item)}</Text>
          <Text style={styles.metaText}>时间：{formatDemandSchedule(item.scheduled_start_at, item.scheduled_end_at)}</Text>
        </View>

        <View style={styles.footerRow}>
          <View style={styles.counterGroup}>
            <Text style={styles.counterText}>报价 {item.quote_count}</Text>
            <Text style={styles.counterDot}>·</Text>
            <Text style={styles.counterText}>候选飞手 {item.candidate_pilot_count}</Text>
          </View>
          <Text style={[styles.actionHint, {color: modeMeta.tone.text}]}>
            {mode === 'pilot' && !item.allows_pilot_candidate ? '仅供查看' : modeMeta.actionLabel}
          </Text>
        </View>
      </ObjectCard>
    );
  };

  const modeMeta = MODE_META[mode];

  return (
    <SafeAreaView style={[styles.container, {backgroundColor: theme.bg}]}>
      <View style={[styles.hero, {backgroundColor: modeMeta.tone.bg, borderColor: modeMeta.tone.border}]}>
        <Text style={[styles.heroTitle, {color: modeMeta.tone.text}]}>{modeMeta.label}</Text>
        <Text style={styles.heroDesc}>{modeMeta.desc}</Text>
      </View>

      {renderModeTabs()}

      <FlatList
        data={demands}
        keyExtractor={item => String(item.id)}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[theme.refreshColor]} />}
        onEndReached={onLoadMore}
        onEndReachedThreshold={0.4}
        ListEmptyComponent={
          <EmptyState
            icon="📋"
            title={loading ? '任务加载中…' : '当前没有可展示的任务'}
            description={
              !loading && mode === 'owner' && availableModes.includes('public')
                ? '当前没有匹配到你的机主推荐任务，可以切换到“公开任务”继续浏览市场全量入口。'
                : modeMeta.desc
            }
          />
        }
      />
    </SafeAreaView>
  );
}

const getStyles = (theme: AppTheme) => StyleSheet.create({
  container: {flex: 1, backgroundColor: theme.bg},
  hero: {
    margin: 16,
    marginBottom: 10,
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
  },
  heroTitle: {fontSize: 18, fontWeight: '700', marginBottom: 6},
  heroDesc: {fontSize: 13, lineHeight: 20, color: theme.textSub},
  modeTabs: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 10,
    backgroundColor: theme.card,
    borderRadius: 16,
    padding: 6,
    gap: 8,
  },
  modeTab: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
  },
  modeTabActive: {backgroundColor: theme.primaryBg},
  modeTabText: {fontSize: 13, color: theme.textSub, fontWeight: '600'},
  modeTabTextActive: {color: theme.primaryText},
  listContent: {paddingHorizontal: 16, paddingBottom: 24},
  cardHeader: {marginBottom: 10},
  cardHeaderMain: {flex: 1},
  title: {fontSize: 17, lineHeight: 24, color: theme.text, fontWeight: '700'},
  tagRow: {flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10},
  budget: {fontSize: 18, color: theme.danger, fontWeight: '700', marginBottom: 10},
  metaBlock: {gap: 6},
  metaText: {fontSize: 13, lineHeight: 19, color: theme.textSub},
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 14,
  },
  counterGroup: {flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap'},
  counterText: {fontSize: 12, color: theme.textSub},
  counterDot: {marginHorizontal: 6, color: theme.textHint},
  actionHint: {fontSize: 12, fontWeight: '700'},
});