import React, {useCallback, useEffect, useMemo, useState} from 'react';
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

import SourceTag from '../../components/business/SourceTag';
import StatusBadge from '../../components/business/StatusBadge';
import {getObjectStatusMeta} from '../../components/business/visuals';
import {demandV2Service} from '../../services/demandV2';
import {RootState} from '../../store/store';
import {DemandDetail, DemandQuoteSummary} from '../../types';
import {
  formatDemandBudget,
  formatDemandSchedule,
  formatTripCount,
  getDemandSceneLabel,
  resolveDemandPrimaryAddress,
} from '../../utils/demandMeta';
import {getEffectiveRoleSummary} from '../../utils/roleSummary';
import {formatAmountYuan, summarizeFlexibleValue} from '../../utils/supplyMeta';
import {useTheme} from '../../theme/ThemeContext';
import type {AppTheme} from '../../theme/index';

const getDemandProgressFocus = (demand: DemandDetail, isOwnDemand: boolean) => {
  switch (String(demand.status || '').toLowerCase()) {
    case 'draft':
      return {
        eyebrow: '下一步是发布',
        title: '这还是一份任务草稿',
        desc: '先把最小成单信息补齐并发布，后续运输细节、附件和说明都还可以继续补充。',
        eta: '准备好后立即发布',
      };
    case 'published':
    case 'quoting':
      return isOwnDemand
        ? {
            eyebrow: '当前在等机主',
            title: '正在等待机主提交报价方案',
            desc: '你只需要关注报价数量和预计响应时间。没有合适方案时，也可以继续补充任务说明。',
            eta: '通常 24 小时内会有首批响应',
          }
        : {
            eyebrow: '当前可响应',
            title: '这是一条待报价任务',
            desc: '如果你能承接，直接提交报价方案即可，后续不会再跳回旧的订单入口。',
            eta: '建议尽快提交报价',
          };
    case 'selected':
      return {
        eyebrow: '方案已选定',
        title: '客户已经选定了承接方案',
        desc: '系统会继续把任务推进成订单，后续合同、支付和执行都会收口到订单详情页。',
        eta: '订单生成后会自动通知',
      };
    case 'converted_to_order':
      return {
        eyebrow: '任务已成交',
        title: '这条任务已经转为订单',
        desc: '后续不要再继续围绕任务对象跟进，直接进入订单详情查看支付、执行和签收进度。',
        eta: '后续进度全部在订单页查看',
      };
    case 'cancelled':
      return {
        eyebrow: '任务已撤销',
        title: '这条任务已经结束',
        desc: '已有报价会同步失效，不会再继续推进撮合和转单。',
        eta: '无需额外操作',
      };
    default:
      return {
        eyebrow: '任务进度',
        title: '这条任务正在推进中',
        desc: '后续报价、选定和转单都会在当前任务里持续更新。',
        eta: '请留意新的报价或状态变化',
      };
  }
};

export default function DemandDetailScreen({route, navigation}: any) {
  const {theme} = useTheme();
  const styles = getStyles(theme);
  const demandId = Number(route.params?.id || route.params?.demandId || 0);
  const currentUser = useSelector((state: RootState) => state.auth.user);
  const roleSummary = useSelector((state: RootState) => state.auth.roleSummary);
  const effectiveRoleSummary = useMemo(
    () => getEffectiveRoleSummary(roleSummary, currentUser),
    [currentUser, roleSummary],
  );

  const [demand, setDemand] = useState<DemandDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [candidateSubmitting, setCandidateSubmitting] = useState(false);
  const [quotesVisible, setQuotesVisible] = useState(false);
  const [quotesLoading, setQuotesLoading] = useState(false);
  const [quotes, setQuotes] = useState<DemandQuoteSummary[]>([]);
  const [selectingQuoteId, setSelectingQuoteId] = useState<number | null>(null);
  const [cancelling, setCancelling] = useState(false);

  const isOwnDemand = demand?.client_user_id === currentUser?.id;
  const canEditOrCancel = isOwnDemand && ['draft', 'published', 'quoting'].includes(demand?.status || '');
  const canViewAndSelectQuotes = isOwnDemand && ['published', 'quoting', 'selected'].includes(demand?.status || '');
  const isConvertedToOrder = isOwnDemand && demand?.status === 'converted_to_order';
  const canQuoteAsOwner = !isOwnDemand && effectiveRoleSummary.has_owner_role;
  const canOperateCandidate = !isOwnDemand && effectiveRoleSummary.has_pilot_role && !!demand?.allows_pilot_candidate;
  const activeCandidate = demand?.my_candidate?.status === 'active';
  const hasOwnQuote = Boolean(demand?.my_quote);
  const progressFocus = demand ? getDemandProgressFocus(demand, isOwnDemand) : null;
  const quoteComparisonItems = useMemo(
    () => [...quotes].sort((left, right) => Number(left.price_amount || 0) - Number(right.price_amount || 0)).slice(0, 3),
    [quotes],
  );

  const fetchDemand = useCallback(async () => {
    setLoading(true);
    try {
      const res = await demandV2Service.getById(demandId);
      setDemand(res.data);
    } catch (error: any) {
      Alert.alert('错误', error.message || '获取任务详情失败');
      setDemand(null);
    } finally {
      setLoading(false);
    }
  }, [demandId]);

  useEffect(() => {
    fetchDemand();
  }, [fetchDemand, route.params?.refreshAt]);

  const loadQuotes = useCallback(async () => {
    if (!demandId) {
      return;
    }
    setQuotesLoading(true);
    try {
      const res = await demandV2Service.listQuotes(demandId);
      setQuotes(res.data?.items || []);
    } catch (error: any) {
      Alert.alert('加载失败', error.message || '获取报价失败');
    } finally {
      setQuotesLoading(false);
    }
  }, [demandId]);

  const toggleQuotes = async () => {
    const nextVisible = !quotesVisible;
    setQuotesVisible(nextVisible);
    if (nextVisible && quotes.length === 0) {
      await loadQuotes();
    }
  };

  const handleCandidateToggle = async () => {
    if (!demand) {
      return;
    }
    setCandidateSubmitting(true);
    try {
      if (activeCandidate) {
        const res = await demandV2Service.withdrawCandidate(demand.id);
        setDemand(prev => (prev ? {...prev, my_candidate: res.data, candidate_pilot_count: Math.max((prev.candidate_pilot_count || 1) - 1, 0)} : prev));
      } else {
        const res = await demandV2Service.applyCandidate(demand.id);
        setDemand(prev => (prev ? {...prev, my_candidate: res.data, candidate_pilot_count: (prev.candidate_pilot_count || 0) + 1} : prev));
      }
    } catch (error: any) {
      Alert.alert(activeCandidate ? '取消失败' : '报名失败', error.message || '请稍后再试');
    } finally {
      setCandidateSubmitting(false);
    }
  };

  const handleSelectQuote = async (quote: DemandQuoteSummary) => {
    if (!demand) {
      return;
    }
    setSelectingQuoteId(quote.id);
    try {
      const res = await demandV2Service.selectProvider(demand.id, quote.id);
      Alert.alert('已生成订单', '任务已转为订单，请查看并签署合同。', [
        {text: '签署合同', onPress: () => navigation.navigate('Contract', {orderId: res.data.order_id})},
        {text: '查看订单', onPress: () => navigation.navigate('OrderDetail', {id: res.data.order_id})},
      ]);
    } catch (error: any) {
      Alert.alert('选择失败', error.message || '暂时无法选定该方案');
    } finally {
      setSelectingQuoteId(null);
    }
  };

  const handleCancel = () => {
    Alert.alert('确认撤销', '撤销后需求将不可恢复，已有报价也会被拒绝。确定要撤销吗？', [
      {text: '取消', style: 'cancel'},
      {
        text: '确认撤销', style: 'destructive', onPress: async () => {
          setCancelling(true);
          try {
            await demandV2Service.cancel(demandId);
            Alert.alert('已撤销', '需求已成功撤销。');
            fetchDemand();
          } catch (e: any) {
            Alert.alert('撤销失败', e.message || '请稍后重试');
          } finally {
            setCancelling(false);
          }
        },
      },
    ]);
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, {backgroundColor: theme.bg}]}>
        <ActivityIndicator style={styles.loader} color={theme.primary} />
      </SafeAreaView>
    );
  }

  if (!demand) {
    return (
      <SafeAreaView style={[styles.container, {backgroundColor: theme.bg}]}>
        <View style={styles.emptyBox}>
          <Text style={styles.emptyIcon}>📋</Text>
          <Text style={styles.emptyTitle}>任务不存在</Text>
          <Text style={styles.emptyDesc}>这条任务可能已关闭，或者当前账号无权查看。</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, {backgroundColor: theme.bg}]}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <View style={styles.heroHeader}>
            <View style={styles.heroTitleWrap}>
              <Text style={styles.demandNo}>{demand.demand_no}</Text>
              <Text style={styles.title}>{demand.title}</Text>
            </View>
            <StatusBadge meta={getObjectStatusMeta('demand', demand.status)} label="" />
          </View>

          <View style={styles.tagRow}>
            <SourceTag source="demand" />
          </View>

          <Text style={styles.budget}>{formatDemandBudget(demand.budget_min, demand.budget_max)}</Text>
          <Text style={styles.heroDesc}>
            {getDemandSceneLabel(demand.cargo_scene)} · {formatTripCount(demand.estimated_trip_count)} · {resolveDemandPrimaryAddress(demand)}
          </Text>
        </View>

        {progressFocus ? (
          <View style={styles.progressCard}>
            <Text style={styles.progressEyebrow}>{progressFocus.eyebrow}</Text>
            <Text style={styles.progressTitle}>{progressFocus.title}</Text>
            <Text style={styles.progressDesc}>{progressFocus.desc}</Text>
            <View style={styles.progressEtaPill}>
              <Text style={styles.progressEtaText}>{progressFocus.eta}</Text>
            </View>
          </View>
        ) : null}

        {canEditOrCancel ? (
          <View style={styles.ownerActions}>
            <TouchableOpacity
              style={styles.editBtn}
              onPress={() => navigation.navigate('EditDemand', {demandId: demand.id})}>
              <Text style={styles.editBtnText}>{demand.status === 'draft' ? '继续完善' : '修改任务'}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={handleCancel}
              disabled={cancelling}>
              <Text style={styles.cancelBtnText}>{cancelling ? '撤销中...' : '撤销任务'}</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {canQuoteAsOwner || canOperateCandidate ? (
          <View style={styles.actionPanel}>
            <Text style={styles.sectionTitle}>你在这里可以做什么</Text>
            {canQuoteAsOwner ? (
              <TouchableOpacity
                style={[styles.primaryBtn, styles.ownerBtn]}
                onPress={() =>
                  navigation.navigate('DemandQuoteCompose', {
                    demandId: demand.id,
                    demandTitle: demand.title,
                    existingQuote: demand.my_quote || null,
                  })
                }
                activeOpacity={0.9}>
                <Text style={styles.primaryBtnText}>{hasOwnQuote ? '更新报价方案' : '提交报价方案'}</Text>
              </TouchableOpacity>
            ) : null}
            {canOperateCandidate ? (
              <TouchableOpacity
                style={[styles.primaryBtn, activeCandidate ? styles.ghostBtn : styles.pilotBtn]}
                onPress={handleCandidateToggle}
                activeOpacity={0.9}
                disabled={candidateSubmitting}>
                <Text style={[styles.primaryBtnText, activeCandidate && styles.ghostBtnText]}>
                  {candidateSubmitting ? '处理中...' : activeCandidate ? '取消候选报名' : '报名候选'}
                </Text>
              </TouchableOpacity>
            ) : null}
            <Text style={styles.helperText}>机主报价和飞手候选现在都只围绕新版任务对象运转，不再混入旧订单入口。</Text>
          </View>
        ) : null}

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>任务详情</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>服务类型</Text>
            <Text style={styles.infoValue}>重载吊运</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>作业场景</Text>
            <Text style={styles.infoValue}>{getDemandSceneLabel(demand.cargo_scene)}</Text>
          </View>
          {demand.departure_address?.text || demand.destination_address?.text ? (
            <>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>起点地址</Text>
                <Text style={styles.infoValue}>{demand.departure_address?.text || '未填写'}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>终点地址</Text>
                <Text style={styles.infoValue}>{demand.destination_address?.text || '未填写'}</Text>
              </View>
            </>
          ) : (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>服务地址</Text>
              <Text style={styles.infoValue}>{demand.service_address?.text || resolveDemandPrimaryAddress(demand)}</Text>
            </View>
          )}
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>预约时间</Text>
            <Text style={styles.infoValue}>{formatDemandSchedule(demand.scheduled_start_at, demand.scheduled_end_at)}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>货物重量</Text>
            <Text style={styles.infoValue}>{demand.cargo_weight_kg || 0} kg</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>货物类型</Text>
            <Text style={styles.infoValue}>{summarizeFlexibleValue(demand.cargo_type, '未填写')}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>预计架次</Text>
            <Text style={styles.infoValue}>{formatTripCount(demand.estimated_trip_count)}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>飞手候选</Text>
            <Text style={styles.infoValue}>{demand.allows_pilot_candidate ? '开放' : '关闭'}</Text>
          </View>
          <Text style={styles.description}>{demand.description || '客户暂未补充更多任务说明。'}</Text>
          {demand.cargo_special_requirements ? (
            <View style={styles.noteBox}>
              <Text style={styles.noteLabel}>特殊要求</Text>
              <Text style={styles.noteText}>{demand.cargo_special_requirements}</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>撮合进度</Text>
          <View style={styles.metricRow}>
            <View style={styles.metricCard}>
              <Text style={styles.metricValue}>{demand.quote_count || 0}</Text>
              <Text style={styles.metricLabel}>报价方案</Text>
            </View>
            <View style={styles.metricCard}>
              <Text style={styles.metricValue}>{demand.candidate_pilot_count || 0}</Text>
              <Text style={styles.metricLabel}>候选飞手</Text>
            </View>
          </View>
          {canViewAndSelectQuotes ? (
            <TouchableOpacity style={styles.quoteTrigger} onPress={toggleQuotes}>
              <Text style={styles.quoteTriggerText}>{quotesVisible ? '收起报价方案' : '查看报价方案'}</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {isConvertedToOrder ? (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>该任务已转为订单</Text>
          </View>
        ) : null}

        {canViewAndSelectQuotes && quotesVisible ? (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>报价方案</Text>
            {quotesLoading ? (
              <ActivityIndicator color={theme.primary} />
            ) : quotes.length === 0 ? (
              <Text style={styles.emptyText}>还没有机主提交报价。</Text>
            ) : (
              <>
                {quoteComparisonItems.length > 1 ? (
                  <View style={styles.comparePanel}>
                    <Text style={styles.compareTitle}>方案对比</Text>
                    <Text style={styles.compareDesc}>先横向看价格、机型、吊重和响应速度，再决定是否选定。</Text>
                    {quoteComparisonItems.map((item, index) => (
                      <View key={`compare-${item.id}`} style={styles.compareItem}>
                        <View style={styles.compareHeader}>
                          <Text style={styles.compareOwner}>{item.owner?.nickname || `机主 #${item.owner_user_id}`}</Text>
                          {index === 0 ? <Text style={styles.compareBadge}>当前最低价</Text> : null}
                        </View>
                        <View style={styles.compareRow}>
                          <Text style={styles.compareLabel}>报价</Text>
                          <Text style={styles.compareValueStrong}>{formatAmountYuan(item.price_amount)}</Text>
                        </View>
                        <View style={styles.compareRow}>
                          <Text style={styles.compareLabel}>机型</Text>
                          <Text style={styles.compareValue}>{item.drone?.brand || '-'} {item.drone?.model || ''}</Text>
                        </View>
                        <View style={styles.compareRow}>
                          <Text style={styles.compareLabel}>最大吊重</Text>
                          <Text style={styles.compareValue}>{item.drone?.max_payload_kg ? `${item.drone.max_payload_kg}kg` : '未填写'}</Text>
                        </View>
                        <View style={styles.compareRow}>
                          <Text style={styles.compareLabel}>响应时间</Text>
                          <Text style={styles.compareValue}>{item.created_at ? item.created_at.slice(5, 16).replace('T', ' ') : '刚刚提交'}</Text>
                        </View>
                        <Text style={styles.comparePlan}>{item.execution_plan || '机主未补充更多执行说明。'}</Text>
                      </View>
                    ))}
                  </View>
                ) : null}
                {quotes.map(item => (
                  <View key={item.id} style={styles.quoteCard}>
                    <View style={styles.quoteHeader}>
                      <Text style={styles.quoteOwner}>{item.owner?.nickname || `机主 #${item.owner_user_id}`}</Text>
                      <StatusBadge meta={getObjectStatusMeta('quote', item.status)} label="" />
                    </View>
                    <Text style={styles.quotePrice}>{formatAmountYuan(item.price_amount)}</Text>
                    <Text style={styles.quoteDesc}>{item.execution_plan || '机主未补充更多报价说明。'}</Text>
                    <Text style={styles.quoteMeta}>设备：{item.drone?.brand || '-'} {item.drone?.model || ''}</Text>
                    <TouchableOpacity
                      style={[styles.selectBtn, selectingQuoteId === item.id && styles.disabledBtn]}
                      onPress={() => handleSelectQuote(item)}
                      disabled={selectingQuoteId === item.id}>
                      <Text style={styles.selectBtnText}>{selectingQuoteId === item.id ? '处理中...' : '选定此方案'}</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </>
            )}
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const getStyles = (theme: AppTheme) => StyleSheet.create({
  container: {flex: 1, backgroundColor: theme.bg},
  content: {padding: 16, paddingBottom: 28},
  loader: {marginTop: 120},
  emptyBox: {margin: 18, marginTop: 48, padding: 28, backgroundColor: theme.card, borderRadius: 20, alignItems: 'center'},
  emptyIcon: {fontSize: 36},
  emptyTitle: {fontSize: 18, fontWeight: '700', color: theme.text, marginTop: 12},
  emptyDesc: {fontSize: 13, color: theme.textSub, marginTop: 8, textAlign: 'center', lineHeight: 20},
  hero: {backgroundColor: theme.isDark ? 'rgba(0,212,255,0.08)' : theme.primary, borderRadius: 24, padding: 18, marginBottom: 14, borderWidth: theme.isDark ? 1 : 0, borderColor: theme.isDark ? theme.primaryBorder : 'transparent'},
  heroHeader: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12},
  heroTitleWrap: {flex: 1},
  demandNo: {fontSize: 12, color: theme.isDark ? theme.primaryText : 'rgba(255,255,255,0.7)', fontWeight: '700'},
  title: {fontSize: 24, lineHeight: 30, color: theme.isDark ? theme.text : '#FFFFFF', fontWeight: '800', marginTop: 8},
  tagRow: {flexDirection: 'row', gap: 8, marginTop: 14},
  budget: {fontSize: 18, color: theme.isDark ? '#FFE4C4' : '#fff7e6', fontWeight: '800', marginTop: 14},
  heroDesc: {fontSize: 13, lineHeight: 20, color: theme.isDark ? theme.textSub : 'rgba(255,255,255,0.85)', marginTop: 8},
  progressCard: {
    backgroundColor: theme.card,
    borderRadius: 20,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: theme.primaryBorder,
  },
  progressEyebrow: {fontSize: 12, color: theme.primaryText, fontWeight: '700', marginBottom: 8},
  progressTitle: {fontSize: 20, lineHeight: 26, color: theme.text, fontWeight: '800'},
  progressDesc: {fontSize: 13, lineHeight: 20, color: theme.textSub, marginTop: 8},
  progressEtaPill: {
    alignSelf: 'flex-start',
    marginTop: 12,
    borderRadius: 999,
    backgroundColor: theme.primaryBg,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  progressEtaText: {fontSize: 12, color: theme.primaryText, fontWeight: '700'},
  card: {backgroundColor: theme.card, borderRadius: 20, padding: 16, marginBottom: 14},
  sectionTitle: {fontSize: 18, fontWeight: '700', color: theme.text},
  actionPanel: {backgroundColor: theme.card, borderRadius: 20, padding: 16, marginBottom: 14},
  primaryBtn: {height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginTop: 12},
  ownerBtn: {backgroundColor: theme.primary},
  pilotBtn: {backgroundColor: theme.warning},
  ghostBtn: {backgroundColor: theme.warning + '22', borderWidth: 1, borderColor: theme.warning + '55'},
  primaryBtnText: {color: theme.btnPrimaryText, fontSize: 15, fontWeight: '700'},
  ghostBtnText: {color: theme.warning},
  helperText: {fontSize: 12, lineHeight: 18, color: theme.textSub, marginTop: 10},
  infoRow: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 14, marginTop: 12},
  infoLabel: {fontSize: 13, color: theme.textSub},
  infoValue: {flex: 1, textAlign: 'right', fontSize: 14, color: theme.text, fontWeight: '600'},
  description: {fontSize: 13, lineHeight: 21, color: theme.text, marginTop: 14},
  noteBox: {backgroundColor: theme.bgSecondary, borderRadius: 14, padding: 12, marginTop: 12},
  noteLabel: {fontSize: 12, color: theme.textSub, marginBottom: 4},
  noteText: {fontSize: 13, lineHeight: 20, color: theme.text},
  metricRow: {flexDirection: 'row', gap: 12, marginTop: 14},
  metricCard: {flex: 1, backgroundColor: theme.bgSecondary, borderRadius: 16, padding: 14, alignItems: 'center'},
  metricValue: {fontSize: 24, fontWeight: '800', color: theme.primaryText},
  metricLabel: {fontSize: 12, color: theme.textSub, marginTop: 6},
  quoteTrigger: {marginTop: 14, alignSelf: 'flex-start'},
  quoteTriggerText: {fontSize: 14, color: theme.primaryText, fontWeight: '700'},
  emptyText: {fontSize: 13, color: theme.textSub, marginTop: 14},
  comparePanel: {
    marginTop: 12,
    marginBottom: 4,
    borderRadius: 16,
    padding: 14,
    backgroundColor: theme.bgSecondary,
    gap: 10,
  },
  compareTitle: {fontSize: 15, fontWeight: '800', color: theme.text},
  compareDesc: {fontSize: 12, lineHeight: 18, color: theme.textSub},
  compareItem: {
    borderRadius: 14,
    padding: 12,
    backgroundColor: theme.card,
    borderWidth: 1,
    borderColor: theme.cardBorder,
    gap: 6,
  },
  compareHeader: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8},
  compareOwner: {fontSize: 14, fontWeight: '700', color: theme.text},
  compareBadge: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.success,
    backgroundColor: theme.success + '18',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  compareRow: {flexDirection: 'row', justifyContent: 'space-between', gap: 12},
  compareLabel: {fontSize: 12, color: theme.textSub},
  compareValue: {flex: 1, textAlign: 'right', fontSize: 12, color: theme.text},
  compareValueStrong: {fontSize: 14, fontWeight: '800', color: theme.danger},
  comparePlan: {fontSize: 12, lineHeight: 18, color: theme.textSub, marginTop: 2},
  quoteCard: {borderWidth: 1, borderColor: theme.divider, borderRadius: 16, padding: 14, marginTop: 12},
  quoteHeader: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8},
  quoteOwner: {fontSize: 15, fontWeight: '700', color: theme.text},
  quotePrice: {fontSize: 18, fontWeight: '800', color: theme.danger, marginTop: 10},
  quoteDesc: {fontSize: 13, color: theme.textSub, lineHeight: 20, marginTop: 8},
  quoteMeta: {fontSize: 12, color: theme.textSub, marginTop: 8},
  selectBtn: {
    marginTop: 12,
    height: 40,
    borderRadius: 10,
    backgroundColor: theme.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectBtnText: {fontSize: 14, color: theme.btnPrimaryText, fontWeight: '700'},
  disabledBtn: {opacity: 0.6},
  ownerActions: {flexDirection: 'row', gap: 10, marginBottom: 14},
  editBtn: {flex: 1, height: 44, borderRadius: 12, backgroundColor: theme.primary, justifyContent: 'center', alignItems: 'center'},
  editBtnText: {color: theme.btnPrimaryText, fontSize: 15, fontWeight: '700'},
  cancelBtn: {flex: 1, height: 44, borderRadius: 12, backgroundColor: theme.card, borderWidth: 1, borderColor: theme.danger, justifyContent: 'center', alignItems: 'center'},
  cancelBtnText: {color: theme.danger, fontSize: 15, fontWeight: '700'},
});
