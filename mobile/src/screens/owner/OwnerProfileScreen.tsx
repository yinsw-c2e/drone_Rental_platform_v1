import React, {useCallback, useMemo, useState} from 'react';
import {
  Alert,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {useFocusEffect} from '@react-navigation/native';
import {useSelector} from 'react-redux';

import ObjectCard from '../../components/business/ObjectCard';
import StatusBadge from '../../components/business/StatusBadge';
import {droneService} from '../../services/drone';
import {ownerService} from '../../services/owner';
import {RootState} from '../../store/store';
import {getEffectiveRoleSummary, resolveProviderCapabilities} from '../../utils/roleSummary';
import {useTheme} from '../../theme/ThemeContext';
import type {AppTheme} from '../../theme/index';

const formatAmount = (value?: number | null) => `¥${(((value || 0) as number) / 100).toFixed(2)}`;

export default function OwnerProfileScreen({navigation}: any) {
  const {theme} = useTheme();
  const styles = getStyles(theme);
  const user = useSelector((state: RootState) => state.auth.user);
  const roleSummary = useSelector((state: RootState) => state.auth.roleSummary);
  const effectiveRoleSummary = getEffectiveRoleSummary(roleSummary, user);
  const providerCapabilities = useMemo(
    () => resolveProviderCapabilities(effectiveRoleSummary),
    [effectiveRoleSummary],
  );
  const canUseWorkbench = providerCapabilities.canUseWorkbench;

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [_profile, setProfile] = useState<any>(null);
  const [draft, setDraft] = useState({service_city: '', contact_phone: '', intro: ''});
  const [stats, setStats] = useState({drones: 0, activeSupplies: 0, quotes: 0, bindings: 0});
  const [workbench, setWorkbench] = useState<any>(null);

  const loadData = useCallback(async () => {
    const shouldLoadProviderBusiness =
      providerCapabilities.canUseWorkbench &&
      (providerCapabilities.canPublishSupply ||
        providerCapabilities.canArrangeDispatch ||
        providerCapabilities.hasAssetProviderRole);
    try {
      const [profileRes, dronesRes, suppliesRes, quotesRes, bindingsRes, workbenchRes] = await Promise.all([
        ownerService.getProfile().catch(() => null),
        droneService.myDrones({page: 1, page_size: 50}).catch(() => null),
        shouldLoadProviderBusiness
          ? ownerService.listMySupplies({page: 1, page_size: 50}).catch(() => null)
          : Promise.resolve(null),
        shouldLoadProviderBusiness
          ? ownerService.listMyQuotes({page: 1, page_size: 50}).catch(() => null)
          : Promise.resolve(null),
        shouldLoadProviderBusiness
          ? ownerService.listPilotBindings({status: 'active', page: 1, page_size: 50}).catch(() => null)
          : Promise.resolve(null),
        providerCapabilities.canUseWorkbench
          ? ownerService.getWorkbench().catch(() => null)
          : Promise.resolve(null),
      ]);

      const nextProfile = profileRes?.data || null;
      setProfile(nextProfile);
      setDraft({
        service_city: nextProfile?.service_city || '',
        contact_phone: nextProfile?.contact_phone || user?.phone || '',
        intro: nextProfile?.intro || '',
      });

      const supplyItems = suppliesRes?.data?.items || [];
      setWorkbench(workbenchRes?.data || null);
      setStats({
        drones: Number(dronesRes?.data?.list?.length || 0),
        activeSupplies: supplyItems.filter((item: any) => item.status === 'active').length,
        quotes: Number(quotesRes?.meta?.total || 0),
        bindings: Number(bindingsRes?.meta?.total || 0),
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [
    providerCapabilities.canArrangeDispatch,
    providerCapabilities.canPublishSupply,
    providerCapabilities.canUseWorkbench,
    providerCapabilities.hasAssetProviderRole,
    user?.phone,
  ]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData]),
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
  }, [loadData]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const res = await ownerService.updateProfile({
        service_city: draft.service_city.trim(),
        contact_phone: draft.contact_phone.trim(),
        intro: draft.intro.trim(),
      });
      setProfile(res.data);
      Alert.alert('保存成功', '服务商资料已更新。');
    } catch (e: any) {
      Alert.alert('保存失败', e?.message || '请稍后重试');
    } finally {
      setSaving(false);
    }
  }, [draft]);

  const capabilityItems = useMemo(
    () => [
      {
        label: '可发布供给',
        enabled: providerCapabilities.canPublishSupply,
        desc: providerCapabilities.canPublishSupply ? '无人机与关键资质已满足主市场准入。' : '先完善无人机与关键资质，才能把供给上架到主市场。',
      },
      {
        label: '可自执行',
        enabled: providerCapabilities.canSelfExecute,
        desc: providerCapabilities.canSelfExecute ? '你已同时具备服务商与执行人员能力，可直接选择自执行。' : '如需自执行，还需要同步具备执行人员能力。',
      },
    ],
    [providerCapabilities.canPublishSupply, providerCapabilities.canSelfExecute],
  );
  const providerStatusMeta = useMemo(() => {
    if (providerCapabilities.canUseWorkbench) return {label: '已开通', tone: 'green' as const};
    if (providerCapabilities.providerStatus === 'pending_review') return {label: '审核中', tone: 'orange' as const};
    if (providerCapabilities.providerStatus === 'rejected') return {label: '需补充', tone: 'red' as const};
    if (providerCapabilities.providerStatus === 'suspended') return {label: '已暂停', tone: 'red' as const};
    return {label: '未入驻', tone: 'gray' as const};
  }, [providerCapabilities.canUseWorkbench, providerCapabilities.providerStatus]);
  const assetStatusMeta = useMemo(() => {
    if (providerCapabilities.assetStatus === 'approved') return {label: '已通过', tone: 'green' as const};
    if (providerCapabilities.assetStatus === 'pending_review') return {label: '审核中', tone: 'orange' as const};
    if (providerCapabilities.assetStatus === 'rejected') return {label: '需补充', tone: 'red' as const};
    if (providerCapabilities.assetStatus === 'suspended') return {label: '已暂停', tone: 'red' as const};
    return {label: '未提交', tone: 'gray' as const};
  }, [providerCapabilities.assetStatus]);
  const executorStatusMeta = useMemo(() => {
    if (providerCapabilities.executorStatus === 'approved') return {label: '已认证', tone: 'green' as const};
    if (providerCapabilities.executorStatus === 'pending_review') return {label: '审核中', tone: 'orange' as const};
    if (providerCapabilities.executorStatus === 'rejected') return {label: '需补充', tone: 'red' as const};
    if (providerCapabilities.executorStatus === 'suspended') return {label: '已暂停', tone: 'red' as const};
    return {label: '未认证', tone: 'gray' as const};
  }, [providerCapabilities.executorStatus]);
  const workbenchPreviewItems = useMemo(
    () => [
      ...(workbench?.recommended_demands || []).slice(0, 2).map((item: any) => ({
        key: `demand-${item.id}`,
        eyebrow: '新需求',
        title: item.title || '待报价任务',
        desc: `${item.service_address_text || '待补地址'} · 预算 ${formatAmount(item.budget_min)}-${formatAmount(item.budget_max)}`,
        actionText: '查看任务',
        onPress: () => navigation.navigate('DemandDetail', {id: item.id}),
      })),
      ...(workbench?.pending_provider_confirmation_orders || []).slice(0, 1).map((item: any) => ({
        key: `confirm-${item.id}`,
        eyebrow: '待确认直达单',
        title: item.title || item.order_no,
        desc: `${item.service_address || '待补地址'} · 订单金额 ${formatAmount(item.total_amount)}`,
        actionText: '查看订单',
        onPress: () => navigation.navigate('OrderDetail', {id: item.id, orderId: item.id}),
      })),
      ...(workbench?.pending_dispatch_orders || []).slice(0, 1).map((item: any) => ({
        key: `dispatch-${item.id}`,
        eyebrow: '待安排执行',
        title: item.title || item.order_no,
        desc: `${item.service_address || '待补地址'} · 成交后待指派执行方`,
        actionText: '查看订单',
        onPress: () => navigation.navigate('OrderDetail', {id: item.id, orderId: item.id}),
      })),
      ...(workbench?.draft_supplies || []).slice(0, 1).map((item: any) => ({
        key: `supply-${item.id}`,
        eyebrow: '服务草稿',
        title: item.title || item.supply_no,
        desc: `${item.drone_brand || '无人机'} ${item.drone_model || ''} · 先补资质再上架`,
        actionText: '继续完善',
        onPress: () => navigation.navigate('PublishOffer', {supplyId: item.id}),
      })),
    ],
    [navigation, workbench],
  );

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, {backgroundColor: theme.bg}]}>
        <View style={styles.loadingWrap}>
          <Text style={styles.loadingText}>服务商资料加载中...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, {backgroundColor: theme.bg}]}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>

        <View style={styles.headerHero}>
          <View style={styles.headerTop}>
            <View>
              <Text style={styles.headerGreeting}>{canUseWorkbench ? '服务商工作台' : '服务商入驻'}</Text>
              <Text style={styles.headerSubtitle}>
                {canUseWorkbench ? '管理设备、服务与履约进度' : '补齐资料和资质后，审核通过才能正式接单'}
              </Text>
            </View>
            <View style={styles.headerStatusRow}>
              <StatusBadge label={providerStatusMeta.label} tone={providerStatusMeta.tone} />
            </View>
          </View>

          {canUseWorkbench ? (
            <View style={styles.statsGrid}>
              <View style={styles.statsCard}>
                <Text style={styles.statsValue}>{stats.drones}</Text>
                <Text style={styles.statsLabel}>无人机资产</Text>
              </View>
              <View style={styles.statsCard}>
                <Text style={styles.statsValue}>{stats.activeSupplies}</Text>
                <Text style={styles.statsLabel}>在线服务</Text>
              </View>
              <View style={styles.statsCard}>
                <Text style={[styles.statsValue, {color: theme.primaryText}]}>{stats.quotes}</Text>
                <Text style={styles.statsLabel}>方案报价</Text>
              </View>
              <View style={styles.statsCard}>
                <Text style={styles.statsValue}>{stats.bindings}</Text>
                <Text style={styles.statsLabel}>协作执行人员</Text>
              </View>
            </View>
          ) : (
            <View style={styles.onboardingNotice}>
              <Text style={styles.onboardingNoticeTitle}>当前不能进入正式工作台</Text>
              <Text style={styles.onboardingNoticeText}>
                未审核账号只能查看入驻资料、设备资质、执行人员认证和审核状态，不展示报价、收入或正式经营待办。
              </Text>
            </View>
          )}
        </View>

        {canUseWorkbench ? (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>经营待办</Text>
              <TouchableOpacity onPress={() => navigation.navigate('MyDemands', {role: 'owner'})}>
                <Text style={styles.sectionLink}>查看全部</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.workbenchSummaryGrid}>
              <TouchableOpacity style={styles.wbSummaryCard} onPress={() => navigation.navigate('ServiceHub')}>
                <Text style={[styles.wbSummaryValue, {color: theme.primaryText}]}>{workbench?.summary?.recommended_demand_count || 0}</Text>
                <Text style={styles.wbSummaryLabel}>新机会</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.wbSummaryCard} onPress={() => navigation.navigate('MyOrders', {roleFilter: 'owner', statusFilter: 'pending'})}>
                <Text style={[styles.wbSummaryValue, {color: theme.warning}]}>{workbench?.summary?.pending_provider_confirmation_order_count || 0}</Text>
                <Text style={styles.wbSummaryLabel}>待确认单</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.wbSummaryCard} onPress={() => navigation.navigate('MyOrders', {roleFilter: 'owner', statusFilter: 'in_progress'})}>
                <Text style={[styles.wbSummaryValue, {color: theme.success}]}>{workbench?.summary?.pending_dispatch_order_count || 0}</Text>
                <Text style={styles.wbSummaryLabel}>待派人</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.wbSummaryCard} onPress={() => navigation.navigate('MyOffers', {activeGroup: 'draft'})}>
                <Text style={styles.wbSummaryValue}>{workbench?.summary?.draft_supply_count || 0}</Text>
                <Text style={styles.wbSummaryLabel}>草稿服务</Text>
              </TouchableOpacity>
            </View>

            {workbenchPreviewItems.length > 0 ? (
              <View style={styles.wbPreviewList}>
                {workbenchPreviewItems.map((item: any) => (
                  <TouchableOpacity key={item.key} style={styles.wbPreviewItem} onPress={item.onPress}>
                    <View style={styles.wbItemLeft}>
                      <View style={styles.wbItemEyebrowRow}>
                        <Text style={styles.wbItemEyebrow}>{item.eyebrow}</Text>
                      </View>
                      <Text style={styles.wbItemTitle} numberOfLines={1}>{item.title}</Text>
                      <Text style={styles.wbItemDesc} numberOfLines={1}>{item.desc}</Text>
                    </View>
                    <View style={styles.wbItemRight}>
                      <Text style={styles.wbItemAction}>{item.actionText} ˃</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            ) : (
              <View style={styles.emptyWb}>
                <Text style={styles.emptyWbText}>暂无紧急经营事项</Text>
              </View>
            )}
          </View>
        ) : (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>入驻进度</Text>
            <View style={styles.onboardingStepList}>
              <View style={styles.onboardingStep}>
                <View style={styles.capabilityInfo}>
                  <Text style={styles.capabilityLabel}>服务商资料</Text>
                  <Text style={styles.capabilityDesc}>维护服务城市、联系电话和经营简介。</Text>
                </View>
                <StatusBadge label={providerStatusMeta.label} tone={providerStatusMeta.tone} />
              </View>
              <TouchableOpacity style={styles.onboardingStep} onPress={() => navigation.navigate('MyDrones')}>
                <View style={styles.capabilityInfo}>
                  <Text style={styles.capabilityLabel}>设备与资质</Text>
                  <Text style={styles.capabilityDesc}>补充无人机、证照、保险和主市场准入材料。</Text>
                </View>
                <StatusBadge label={assetStatusMeta.label} tone={assetStatusMeta.tone} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.onboardingStep} onPress={() => navigation.navigate('PilotRegister')}>
                <View style={styles.capabilityInfo}>
                  <Text style={styles.capabilityLabel}>执行人员认证</Text>
                  <Text style={styles.capabilityDesc}>需要接派单或自执行时，补充执行人员资质。</Text>
                </View>
                <StatusBadge label={executorStatusMeta.label} tone={executorStatusMeta.tone} />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {canUseWorkbench ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>快捷管理</Text>
            <View style={styles.quickActionGrid}>
              <TouchableOpacity style={styles.quickActionCard} onPress={() => navigation.navigate('MyDrones')}>
                <View style={[styles.quickIconBg, {backgroundColor: '#e6f4ff'}]}>
                  <Text style={styles.quickIconText}>🚁</Text>
                </View>
                <Text style={styles.quickActionTitle}>我的无人机</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.quickActionCard} onPress={() => navigation.navigate('MyOffers')}>
                <View style={[styles.quickIconBg, {backgroundColor: '#f6ffed'}]}>
                  <Text style={styles.quickIconText}>📦</Text>
                </View>
                <Text style={styles.quickActionTitle}>我的服务</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.quickActionCard} onPress={() => navigation.navigate('PublishOffer')}>
                <View style={[styles.quickIconBg, {backgroundColor: '#fff7e6'}]}>
                  <Text style={styles.quickIconText}>🧾</Text>
                </View>
                <Text style={styles.quickActionTitle}>发布服务</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.quickActionCard} onPress={() => navigation.navigate('OwnerPilotBindings')}>
                <View style={[styles.quickIconBg, {backgroundColor: '#f9f0ff'}]}>
                  <Text style={styles.quickIconText}>🤝</Text>
                </View>
                <Text style={styles.quickActionTitle}>协作执行人员</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : null}

        <ObjectCard style={styles.profileEditCard}>
          <Text style={styles.sectionTitle}>档案设置</Text>
          <View style={styles.inputGroup}>
            <Text style={styles.fieldLabel}>服务城市</Text>
            <TextInput
              style={styles.fieldInput}
              placeholder="例如：佛山 / 广州 / 珠海"
              value={draft.service_city}
              onChangeText={text => setDraft(prev => ({...prev, service_city: text}))}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.fieldLabel}>联系电话</Text>
            <TextInput
              style={styles.fieldInput}
              placeholder="用于客户与平台联系"
              keyboardType="phone-pad"
              value={draft.contact_phone}
              onChangeText={text => setDraft(prev => ({...prev, contact_phone: text}))}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.fieldLabel}>经营简介</Text>
            <TextInput
              style={[styles.fieldInput, styles.areaInput]}
              placeholder="说明你的设备能力、擅长场景与服务边界"
              multiline
              textAlignVertical="top"
              value={draft.intro}
              onChangeText={text => setDraft(prev => ({...prev, intro: text}))}
            />
          </View>

          <TouchableOpacity
            style={[styles.submitBtn, saving && styles.submitBtnDisabled]}
            onPress={handleSave}
            disabled={saving}
          >
            <Text style={styles.submitBtnText}>{saving ? '正在保存...' : '更新服务商资料'}</Text>
          </TouchableOpacity>
        </ObjectCard>

        <View style={styles.capabilitySection}>
          <Text style={styles.capabilityTitle}>经营准入状态</Text>
          {capabilityItems.map(item => (
            <View key={item.label} style={styles.capabilityItem}>
              <View style={styles.capabilityInfo}>
                <Text style={styles.capabilityLabel}>{item.label}</Text>
                <Text style={styles.capabilityDesc}>{item.desc}</Text>
              </View>
              <StatusBadge label={item.enabled ? '就绪' : '待补'} tone={item.enabled ? 'green' : 'gray'} />
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const getStyles = (theme: AppTheme) => StyleSheet.create({
  container: {flex: 1, backgroundColor: theme.bg},
  content: {paddingBottom: 40},
  loadingWrap: {flex: 1, alignItems: 'center', justifyContent: 'center'},
  loadingText: {fontSize: 15, color: theme.textSub},

  headerHero: {
    backgroundColor: '#0F766E',
    borderRadius: 24,
    padding: 18,
    margin: 12,
    marginBottom: 12,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  headerGreeting: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  headerSubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 6,
  },
  headerStatusRow: {
    marginTop: 2,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 16,
    gap: 10,
  },
  statsCard: {
    width: '48%',
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 16,
    padding: 12,
    alignItems: 'center',
  },
  statsValue: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  statsLabel: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 4,
    fontWeight: '600',
  },
  onboardingNotice: {
    marginTop: 16,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 16,
    padding: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.22)',
  },
  onboardingNoticeTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  onboardingNoticeText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
    lineHeight: 18,
    marginTop: 6,
  },

  section: {
    backgroundColor: theme.card,
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 12,
    marginBottom: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.text,
  },
  sectionLink: {
    fontSize: 13,
    color: theme.primary,
    fontWeight: '600',
  },
  sectionSubText: {
    fontSize: 13,
    color: theme.textSub,
    marginBottom: 12,
  },
  onboardingStepList: {
    marginTop: 12,
    gap: 10,
  },
  onboardingStep: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.inputBg,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: theme.cardBorder,
  },

  workbenchSummaryGrid: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  wbSummaryCard: {
    flex: 1,
    backgroundColor: theme.inputBg,
    borderRadius: 16,
    paddingVertical: 12,
    alignItems: 'center',
  },
  wbSummaryValue: {
    fontSize: 18,
    fontWeight: '800',
    color: theme.text,
  },
  wbSummaryLabel: {
    fontSize: 11,
    color: theme.textSub,
    marginTop: 4,
    fontWeight: '600',
  },

  wbPreviewList: {
    gap: 10,
  },
  wbPreviewItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.inputBg,
    borderRadius: 16,
    padding: 14,
  },
  wbItemLeft: {
    flex: 1,
  },
  wbItemEyebrowRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  wbItemEyebrow: {
    fontSize: 10,
    fontWeight: '800',
    color: theme.primaryText,
    backgroundColor: theme.primaryBg,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    textTransform: 'uppercase',
  },
  wbItemTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.text,
  },
  wbItemDesc: {
    fontSize: 12,
    color: theme.textSub,
    marginTop: 4,
  },
  wbItemRight: {
    marginLeft: 12,
  },
  wbItemAction: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.primaryText,
  },
  emptyWb: {
    padding: 24,
    alignItems: 'center',
    backgroundColor: theme.inputBg,
    borderRadius: 16,
    borderStyle: 'dashed',
    borderWidth: 1,
    borderColor: theme.cardBorder,
  },
  emptyWbText: {
    fontSize: 13,
    color: theme.textHint,
  },

  quickActionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  quickActionCard: {
    width: '48%',
    backgroundColor: theme.inputBg,
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
  },
  quickIconBg: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  quickIconText: {
    fontSize: 24,
  },
  quickActionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.text,
  },

  profileEditCard: {
    margin: 16,
    padding: 20,
    gap: 16,
  },
  inputGroup: {
    gap: 8,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.textSub,
  },
  fieldInput: {
    backgroundColor: theme.bgSecondary,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: theme.text,
    borderWidth: 1,
    borderColor: theme.divider,
  },
  areaInput: {
    minHeight: 80,
  },
  submitBtn: {
    backgroundColor: theme.primary,
    borderRadius: 14,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  submitBtnDisabled: {
    opacity: 0.6,
  },
  submitBtnText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
  },

  capabilitySection: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  capabilityTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.textSub,
    marginBottom: 12,
  },
  capabilityItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.divider,
  },
  capabilityInfo: {
    flex: 1,
    paddingRight: 16,
  },
  capabilityLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.text,
  },
  capabilityDesc: {
    fontSize: 12,
    color: theme.textSub,
    marginTop: 4,
    lineHeight: 18,
  },
});
