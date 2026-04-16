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
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={[styles.heroCard, {backgroundColor: theme.isDark ? 'rgba(0,212,255,0.08)' : theme.primary}]}>
          <View style={styles.heroTop}>
            <View style={styles.heroBadgeRow}>
              <SourceTag source="demand" />
              <StatusBadge meta={getObjectStatusMeta('demand', demand.status)} label="" />
            </View>
            <Text style={styles.heroNo}>{demand.demand_no}</Text>
          </View>
          <Text style={styles.heroTitle}>{demand.title}</Text>
          <View style={styles.heroBudgetBox}>
            <Text style={styles.heroBudgetLabel}>预算上限</Text>
            <Text style={styles.heroBudgetValue}>{formatDemandBudget(demand.budget_min, demand.budget_max)}</Text>
          </View>
        </View>

        {progressFocus ? (
          <View style={styles.focusCard}>
            <View style={styles.focusHeader}>
              <Text style={styles.focusEyebrow}>{progressFocus.eyebrow}</Text>
              <View style={styles.focusEtaPill}>
                <Text style={styles.focusEtaText}>{progressFocus.eta}</Text>
              </View>
            </View>
            <Text style={styles.focusTitle}>{progressFocus.title}</Text>
            <Text style={styles.focusDesc}>{progressFocus.desc}</Text>

            {canEditOrCancel && (
              <View style={styles.focusActions}>
                <TouchableOpacity
                  style={styles.focusEditBtn}
                  onPress={() => navigation.navigate('EditDemand', {demandId: demand.id})}>
                  <Text style={styles.focusEditBtnText}>{demand.status === 'draft' ? '去发布' : '修改任务'}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.focusCancelBtn}
                  onPress={handleCancel}
                  disabled={cancelling}>
                  <Text style={styles.focusCancelBtnText}>撤销</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        ) : null}

        <View style={styles.infoGroup}>
          <Text style={styles.groupTitle}>任务概况</Text>
          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>作业场景</Text>
              <Text style={styles.infoValue}>{getDemandSceneLabel(demand.cargo_scene)}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>预计架次</Text>
              <Text style={styles.infoValue}>{formatTripCount(demand.estimated_trip_count)}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>预约时间</Text>
              <Text style={styles.infoValue}>{formatDemandSchedule(demand.scheduled_start_at, demand.scheduled_end_at)}</Text>
            </View>
          </View>
        </View>

        <View style={styles.infoGroup}>
          <Text style={styles.groupTitle}>运输路径</Text>
          <View style={styles.infoCard}>
            {demand.departure_address?.text || demand.destination_address?.text ? (
              <View style={styles.routeContainer}>
                <View style={styles.routePoint}>
                  <View style={[styles.routeDot, {backgroundColor: theme.success}]} />
                  <Text style={styles.routeText}>{demand.departure_address?.text || '未填写起点'}</Text>
                </View>
                <View style={styles.routeLine} />
                <View style={styles.routePoint}>
                  <View style={[styles.routeDot, {backgroundColor: theme.danger}]} />
                  <Text style={styles.routeText}>{demand.destination_address?.text || '未填写终点'}</Text>
                </View>
              </View>
            ) : (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>作业地址</Text>
                <Text style={styles.infoValue}>{demand.service_address?.text || resolveDemandPrimaryAddress(demand)}</Text>
              </View>
            )}
          </View>
        </View>

        <View style={styles.infoGroup}>
          <Text style={styles.groupTitle}>货物与要求</Text>
          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>预估重量</Text>
              <Text style={styles.infoValue}>{demand.cargo_weight_kg || 0} kg</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>货物类型</Text>
              <Text style={styles.infoValue}>{summarizeFlexibleValue(demand.cargo_type, '未填写')}</Text>
            </View>
            <View style={styles.descriptionBox}>
              <Text style={styles.description}>{demand.description || '暂无详细说明。'}</Text>
            </View>
            {demand.cargo_special_requirements ? (
              <View style={styles.noteBox}>
                <Text style={styles.noteLabel}>特殊要求</Text>
                <Text style={styles.noteText}>{demand.cargo_special_requirements}</Text>
              </View>
            ) : null}
          </View>
        </View>

        <View style={styles.infoGroup}>
          <View style={styles.groupHeader}>
            <Text style={styles.groupTitle}>报价与响应</Text>
            <Text style={styles.groupSubtitle}>{demand.quote_count} 个方案</Text>
          </View>
          <View style={styles.statsCard}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{demand.quote_count || 0}</Text>
              <Text style={styles.statLabel}>已收到报价</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{demand.candidate_pilot_count || 0}</Text>
              <Text style={styles.statLabel}>候选飞手</Text>
            </View>
          </View>

          {canViewAndSelectQuotes && (
            <TouchableOpacity
              style={[styles.quotesBtn, quotesVisible && styles.quotesBtnActive]}
              onPress={toggleQuotes}
            >
              <Text style={[styles.quotesBtnText, quotesVisible && styles.quotesBtnTextActive]}>
                {quotesVisible ? '收起方案' : '展开查看详细方案'}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {canViewAndSelectQuotes && quotesVisible && (
          <View style={styles.quotesSection}>
            {quotesLoading ? (
              <ActivityIndicator style={{marginVertical: 20}} color={theme.primary} />
            ) : quotes.length === 0 ? (
              <Text style={styles.emptyQuotesText}>暂时还没有机主提交报价</Text>
            ) : (
              <View style={styles.quotesList}>
                {quotes.map(item => (
                  <View key={item.id} style={styles.quoteCard}>
                    <View style={styles.quoteTop}>
                      <Text style={styles.quoteOwner}>{item.owner?.nickname || '机主'}</Text>
                      <Text style={styles.quotePrice}>{formatAmountYuan(item.price_amount)}</Text>
                    </View>
                    <Text style={styles.quoteMeta}>设备：{item.drone?.brand} {item.drone?.model} | 吊重 {item.drone?.max_payload_kg}kg</Text>
                    <Text style={styles.quotePlan} numberOfLines={3}>{item.execution_plan || '暂无执行方案说明'}</Text>
                    <TouchableOpacity
                      style={[styles.selectQuoteBtn, selectingQuoteId === item.id && styles.disabledBtn]}
                      onPress={() => handleSelectQuote(item)}
                      disabled={selectingQuoteId === item.id}>
                      <Text style={styles.selectQuoteBtnText}>{selectingQuoteId === item.id ? '正在处理...' : '选定此方案'}</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        {(canQuoteAsOwner || canOperateCandidate) && (
          <View style={styles.operatorActions}>
            <Text style={styles.operatorTitle}>作为承接方，您可以：</Text>
            <View style={styles.operatorRow}>
              {canQuoteAsOwner && (
                <TouchableOpacity
                  style={[styles.opBtn, styles.opQuoteBtn]}
                  onPress={() =>
                    navigation.navigate('DemandQuoteCompose', {
                      demandId: demand.id,
                      demandTitle: demand.title,
                      existingQuote: demand.my_quote || null,
                    })
                  }>
                  <Text style={styles.opBtnText}>{hasOwnQuote ? '更新报价' : '提交报价'}</Text>
                </TouchableOpacity>
              )}
              {canOperateCandidate && (
                <TouchableOpacity
                  style={[styles.opBtn, activeCandidate ? styles.opCancelBtn : styles.opPilotBtn]}
                  onPress={handleCandidateToggle}
                  disabled={candidateSubmitting}>
                  <Text style={styles.opBtnText}>{activeCandidate ? '取消候选' : '报名候选'}</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const getStyles = (theme: AppTheme) =>
  StyleSheet.create({
    container: {flex: 1, backgroundColor: theme.bg},
    content: {paddingBottom: 40},
    loader: {marginTop: 120},
    heroCard: {
      padding: 20,
      paddingTop: 24,
      borderBottomLeftRadius: 32,
      borderBottomRightRadius: 32,
    },
    heroTop: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    heroBadgeRow: {
      flexDirection: 'row',
      gap: 8,
    },
    heroNo: {
      fontSize: 11,
      color: 'rgba(255,255,255,0.6)',
      fontWeight: '700',
    },
    heroTitle: {
      fontSize: 26,
      fontWeight: '800',
      color: '#FFFFFF',
      marginTop: 16,
      lineHeight: 34,
    },
    heroBudgetBox: {
      marginTop: 20,
      backgroundColor: 'rgba(255,255,255,0.12)',
      borderRadius: 12,
      padding: 12,
      alignSelf: 'flex-start',
    },
    heroBudgetLabel: {
      fontSize: 11,
      color: 'rgba(255,255,255,0.7)',
      fontWeight: '600',
    },
    heroBudgetValue: {
      fontSize: 18,
      color: '#FFFFFF',
      fontWeight: '800',
      marginTop: 4,
    },
    focusCard: {
      margin: 16,
      marginTop: -16,
      backgroundColor: theme.card,
      borderRadius: 24,
      padding: 20,
      borderWidth: 1,
      borderColor: theme.primaryBorder,
      shadowColor: '#000',
      shadowOffset: {width: 0, height: 4},
      shadowOpacity: 0.08,
      shadowRadius: 12,
      elevation: 4,
    },
    focusHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12,
    },
    focusEyebrow: {
      fontSize: 12,
      color: theme.primaryText,
      fontWeight: '800',
      textTransform: 'uppercase',
    },
    focusEtaPill: {
      backgroundColor: theme.primaryBg,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 999,
    },
    focusEtaText: {
      fontSize: 11,
      color: theme.primaryText,
      fontWeight: '700',
    },
    focusTitle: {
      fontSize: 20,
      fontWeight: '800',
      color: theme.text,
      lineHeight: 26,
    },
    focusDesc: {
      fontSize: 13,
      color: theme.textSub,
      marginTop: 8,
      lineHeight: 20,
    },
    focusActions: {
      flexDirection: 'row',
      marginTop: 20,
      gap: 12,
    },
    focusEditBtn: {
      flex: 2,
      height: 44,
      backgroundColor: theme.primary,
      borderRadius: 12,
      justifyContent: 'center',
      alignItems: 'center',
    },
    focusEditBtnText: {
      color: '#FFFFFF',
      fontSize: 15,
      fontWeight: '800',
    },
    focusCancelBtn: {
      flex: 1,
      height: 44,
      borderWidth: 1,
      borderColor: theme.danger,
      borderRadius: 12,
      justifyContent: 'center',
      alignItems: 'center',
    },
    focusCancelBtnText: {
      color: theme.danger,
      fontSize: 14,
      fontWeight: '700',
    },
    infoGroup: {
      paddingHorizontal: 16,
      marginTop: 20,
    },
    groupHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-end',
      marginBottom: 12,
    },
    groupTitle: {
      fontSize: 16,
      fontWeight: '800',
      color: theme.text,
      marginBottom: 12,
    },
    groupSubtitle: {
      fontSize: 13,
      color: theme.textSub,
      marginBottom: 12,
    },
    infoCard: {
      backgroundColor: theme.card,
      borderRadius: 20,
      padding: 16,
      borderWidth: 1,
      borderColor: theme.divider,
    },
    infoRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      paddingVertical: 10,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.divider,
    },
    infoLabel: {
      fontSize: 13,
      color: theme.textSub,
      fontWeight: '500',
    },
    infoValue: {
      fontSize: 14,
      color: theme.text,
      fontWeight: '700',
      flex: 1,
      textAlign: 'right',
      marginLeft: 20,
    },
    routeContainer: {
      paddingVertical: 4,
    },
    routePoint: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    routeDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    routeText: {
      fontSize: 14,
      color: theme.text,
      fontWeight: '600',
      flex: 1,
    },
    routeLine: {
      width: 1,
      height: 16,
      backgroundColor: theme.divider,
      marginLeft: 3.5,
      marginVertical: 4,
    },
    descriptionBox: {
      marginTop: 12,
    },
    description: {
      fontSize: 14,
      color: theme.textSub,
      lineHeight: 22,
    },
    noteBox: {
      marginTop: 16,
      backgroundColor: theme.bgSecondary,
      borderRadius: 14,
      padding: 14,
    },
    noteLabel: {
      fontSize: 11,
      color: theme.textHint,
      fontWeight: '700',
      textTransform: 'uppercase',
      marginBottom: 4,
    },
    noteText: {
      fontSize: 13,
      color: theme.text,
      lineHeight: 20,
    },
    statsCard: {
      flexDirection: 'row',
      backgroundColor: theme.bgSecondary,
      borderRadius: 20,
      padding: 16,
    },
    statItem: {
      flex: 1,
      alignItems: 'center',
    },
    statValue: {
      fontSize: 22,
      fontWeight: '800',
      color: theme.primaryText,
    },
    statLabel: {
      fontSize: 11,
      color: theme.textSub,
      marginTop: 4,
      fontWeight: '600',
    },
    statDivider: {
      width: 1,
      height: '60%',
      backgroundColor: theme.divider,
      alignSelf: 'center',
    },
    quotesBtn: {
      marginTop: 12,
      height: 48,
      borderRadius: 12,
      backgroundColor: theme.bgSecondary,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: theme.divider,
    },
    quotesBtnActive: {
      backgroundColor: theme.primaryBg,
      borderColor: theme.primary,
    },
    quotesBtnText: {
      fontSize: 14,
      color: theme.textSub,
      fontWeight: '700',
    },
    quotesBtnTextActive: {
      color: theme.primaryText,
    },
    quotesSection: {
      paddingHorizontal: 16,
      marginTop: 12,
    },
    quotesList: {
      gap: 12,
    },
    quoteCard: {
      backgroundColor: theme.card,
      borderRadius: 18,
      padding: 16,
      borderWidth: 1,
      borderColor: theme.divider,
    },
    quoteTop: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    quoteOwner: {
      fontSize: 15,
      fontWeight: '800',
      color: theme.text,
    },
    quotePrice: {
      fontSize: 18,
      fontWeight: '800',
      color: theme.danger,
    },
    quoteMeta: {
      fontSize: 12,
      color: theme.textSub,
      marginTop: 6,
    },
    quotePlan: {
      fontSize: 13,
      color: theme.text,
      lineHeight: 20,
      marginTop: 10,
    },
    selectQuoteBtn: {
      marginTop: 16,
      height: 40,
      borderRadius: 10,
      backgroundColor: theme.primary,
      justifyContent: 'center',
      alignItems: 'center',
    },
    selectQuoteBtnText: {
      color: '#FFFFFF',
      fontSize: 14,
      fontWeight: '800',
    },
    operatorActions: {
      marginTop: 32,
      paddingHorizontal: 16,
      paddingBottom: 20,
    },
    operatorTitle: {
      fontSize: 14,
      color: theme.textSub,
      fontWeight: '700',
      marginBottom: 12,
    },
    operatorRow: {
      flexDirection: 'row',
      gap: 12,
    },
    opBtn: {
      flex: 1,
      height: 48,
      borderRadius: 14,
      justifyContent: 'center',
      alignItems: 'center',
    },
    opQuoteBtn: {
      backgroundColor: theme.primary,
    },
    opPilotBtn: {
      backgroundColor: theme.warning,
    },
    opCancelBtn: {
      backgroundColor: theme.bgSecondary,
      borderWidth: 1,
      borderColor: theme.divider,
    },
    opBtnText: {
      color: '#FFFFFF',
      fontSize: 15,
      fontWeight: '800',
    },
    disabledBtn: {opacity: 0.5},
    emptyBox: {padding: 40, alignItems: 'center'},
    emptyIcon: {fontSize: 48, marginBottom: 16},
    emptyTitle: {fontSize: 18, fontWeight: '800', color: theme.text},
    emptyDesc: {fontSize: 14, color: theme.textSub, textAlign: 'center', marginTop: 8},
    emptyQuotesText: {textAlign: 'center', color: theme.textHint, marginVertical: 20},
  });
