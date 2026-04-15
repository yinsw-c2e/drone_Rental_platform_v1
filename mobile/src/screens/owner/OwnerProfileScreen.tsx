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
  useWindowDimensions,
  View,
} from 'react-native';
import {useFocusEffect} from '@react-navigation/native';
import {useSelector} from 'react-redux';

import ObjectCard from '../../components/business/ObjectCard';
import StatusBadge from '../../components/business/StatusBadge';
import {droneService} from '../../services/drone';
import {ownerService} from '../../services/owner';
import {RootState} from '../../store/store';
import {getEffectiveRoleSummary} from '../../utils/roleSummary';
import {getResponsiveTwoColumnLayout} from '../../utils/responsiveGrid';
import {useTheme} from '../../theme/ThemeContext';
import type {AppTheme} from '../../theme/index';

const formatAmount = (value?: number | null) => `¥${(((value || 0) as number) / 100).toFixed(2)}`;

export default function OwnerProfileScreen({navigation}: any) {
  const {theme} = useTheme();
  const styles = getStyles(theme);
  const {width: viewportWidth} = useWindowDimensions();
  const user = useSelector((state: RootState) => state.auth.user);
  const roleSummary = useSelector((state: RootState) => state.auth.roleSummary);
  const effectiveRoleSummary = getEffectiveRoleSummary(roleSummary, user);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [_profile, setProfile] = useState<any>(null);
  const [draft, setDraft] = useState({service_city: '', contact_phone: '', intro: ''});
  const [stats, setStats] = useState({drones: 0, activeSupplies: 0, quotes: 0, bindings: 0});
  const [workbench, setWorkbench] = useState<any>(null);

  const loadData = useCallback(async () => {
    try {
      const [profileRes, dronesRes, suppliesRes, quotesRes, bindingsRes, workbenchRes] = await Promise.all([
        ownerService.getProfile().catch(() => null),
        droneService.myDrones({page: 1, page_size: 100}).catch(() => null),
        ownerService.listMySupplies({page: 1, page_size: 100}).catch(() => null),
        ownerService.listMyQuotes({page: 1, page_size: 100}).catch(() => null),
        ownerService.listPilotBindings({status: 'active', page: 1, page_size: 100}).catch(() => null),
        ownerService.getWorkbench().catch(() => null),
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
  }, [user?.phone]);

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
      Alert.alert('保存成功', '机主档案已更新。');
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
        enabled: effectiveRoleSummary.can_publish_supply,
        desc: effectiveRoleSummary.can_publish_supply ? '无人机与关键资质已满足主市场准入。' : '先完善无人机与关键资质，才能把供给上架到主市场。',
      },
      {
        label: '可自执行',
        enabled: effectiveRoleSummary.can_self_execute,
        desc: effectiveRoleSummary.can_self_execute ? '你已同时具备机主与飞手能力，可直接选择自执行。' : '如果要机主自执行，还需要同步具备飞手能力。',
      },
    ],
    [effectiveRoleSummary.can_publish_supply, effectiveRoleSummary.can_self_execute],
  );
  const summaryLayout = useMemo(
    () =>
      getResponsiveTwoColumnLayout({
        viewportWidth,
        totalHorizontalPadding: 68,
        gap: 10,
        minItemWidth: 118,
      }),
    [viewportWidth],
  );
  const quickCardLayout = useMemo(
    () =>
      getResponsiveTwoColumnLayout({
        viewportWidth,
        totalHorizontalPadding: 68,
        gap: 12,
        minItemWidth: 118,
      }),
    [viewportWidth],
  );
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
          <Text style={styles.loadingText}>机主档案加载中...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, {backgroundColor: theme.bg}]}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
        <ObjectCard style={styles.heroCard}>
          <Text style={styles.heroEyebrow}>机主档案</Text>
          <Text style={styles.heroTitle}>设备、供给、资质从这里统一管理</Text>
          <Text style={styles.heroDesc}>
            机主可以先建立服务草稿、后补齐无人机与飞手资质，所有资质达标后即可正式上架服务。
          </Text>

          <View style={styles.heroMetaRow}>
            <StatusBadge label={effectiveRoleSummary.has_owner_role ? '机主身份已持有' : '机主档案待建立'} tone={effectiveRoleSummary.has_owner_role ? 'green' : 'orange'} />
            <StatusBadge label={effectiveRoleSummary.can_publish_supply ? '可上架供给' : '供给待就绪'} tone={effectiveRoleSummary.can_publish_supply ? 'blue' : 'gray'} />
          </View>

          <View style={styles.summaryRow}>
            <View style={[styles.summaryItem, {width: summaryLayout.itemWidth}]}>
              <Text style={styles.summaryValue}>{stats.drones}</Text>
              <Text style={styles.summaryLabel}>无人机</Text>
            </View>
            <View style={[styles.summaryItem, {width: summaryLayout.itemWidth}]}>
              <Text style={styles.summaryValue}>{stats.activeSupplies}</Text>
              <Text style={styles.summaryLabel}>生效供给</Text>
            </View>
            <View style={[styles.summaryItem, {width: summaryLayout.itemWidth}]}>
              <Text style={styles.summaryValue}>{stats.quotes}</Text>
              <Text style={styles.summaryLabel}>我的报价</Text>
            </View>
            <View style={[styles.summaryItem, {width: summaryLayout.itemWidth}]}>
              <Text style={styles.summaryValue}>{stats.bindings}</Text>
              <Text style={styles.summaryLabel}>绑定飞手</Text>
            </View>
          </View>
        </ObjectCard>

        <ObjectCard style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>机主待处理</Text>
          <Text style={styles.sectionSubText}>把新需求、待确认订单、待安排执行和服务草稿收在一个工作台里，不再到处找线索。</Text>
          <View style={styles.workbenchSummaryRow}>
            <View style={styles.workbenchSummaryItem}>
              <Text style={styles.workbenchSummaryValue}>{workbench?.summary?.recommended_demand_count || 0}</Text>
              <Text style={styles.workbenchSummaryLabel}>新需求</Text>
            </View>
            <View style={styles.workbenchSummaryItem}>
              <Text style={styles.workbenchSummaryValue}>{workbench?.summary?.pending_provider_confirmation_order_count || 0}</Text>
              <Text style={styles.workbenchSummaryLabel}>待确认</Text>
            </View>
            <View style={styles.workbenchSummaryItem}>
              <Text style={styles.workbenchSummaryValue}>{workbench?.summary?.pending_dispatch_order_count || 0}</Text>
              <Text style={styles.workbenchSummaryLabel}>待指派</Text>
            </View>
            <View style={styles.workbenchSummaryItem}>
              <Text style={styles.workbenchSummaryValue}>{workbench?.summary?.draft_supply_count || 0}</Text>
              <Text style={styles.workbenchSummaryLabel}>草稿</Text>
            </View>
          </View>
          {workbenchPreviewItems.length > 0 ? (
            <View style={styles.workbenchList}>
              {workbenchPreviewItems.map((item: any) => (
                <TouchableOpacity key={item.key} style={styles.workbenchItem} onPress={item.onPress}>
                  <View style={styles.workbenchItemTextWrap}>
                    <Text style={styles.workbenchItemEyebrow}>{item.eyebrow}</Text>
                    <Text style={styles.workbenchItemTitle}>{item.title}</Text>
                    <Text style={styles.workbenchItemDesc}>{item.desc}</Text>
                  </View>
                  <Text style={styles.workbenchItemAction}>{item.actionText}</Text>
                </TouchableOpacity>
              ))}
            </View>
          ) : (
            <View style={styles.workbenchEmpty}>
              <Text style={styles.workbenchEmptyTitle}>当前没有待处理线索</Text>
              <Text style={styles.workbenchEmptyDesc}>可以先去建立服务草稿、补设备资质，或进入任务列表看看今天的新需求。</Text>
            </View>
          )}
        </ObjectCard>

        <ObjectCard style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>档案信息</Text>
          <Text style={styles.inputLabel}>主要服务城市</Text>
          <TextInput
            style={styles.input}
            placeholder="例如：佛山 / 广州 / 珠海"
            value={draft.service_city}
            onChangeText={text => setDraft(prev => ({...prev, service_city: text}))}
          />

          <Text style={styles.inputLabel}>联系电话</Text>
          <TextInput
            style={styles.input}
            placeholder="用于客户与平台联系"
            keyboardType="phone-pad"
            value={draft.contact_phone}
            onChangeText={text => setDraft(prev => ({...prev, contact_phone: text}))}
          />

          <Text style={styles.inputLabel}>机主简介</Text>
          <TextInput
            style={[styles.input, styles.multilineInput]}
            placeholder="说明你的设备能力、擅长场景、保障能力和服务边界"
            multiline
            textAlignVertical="top"
            value={draft.intro}
            onChangeText={text => setDraft(prev => ({...prev, intro: text}))}
          />
        </ObjectCard>

        <ObjectCard style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>能力状态</Text>
          {capabilityItems.map(item => (
            <View key={item.label} style={styles.capabilityRow}>
              <View style={styles.capabilityTextWrap}>
                <Text style={styles.capabilityTitle}>{item.label}</Text>
                <Text style={styles.capabilityDesc}>{item.desc}</Text>
              </View>
              <StatusBadge label={item.enabled ? '已就绪' : '未就绪'} tone={item.enabled ? 'green' : 'gray'} />
            </View>
          ))}
        </ObjectCard>

        <ObjectCard style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>机主快捷入口</Text>
          <View style={styles.quickGrid}>
            <TouchableOpacity style={[styles.quickCard, {width: quickCardLayout.itemWidth}]} onPress={() => navigation.navigate('MyDrones')}>
              <Text style={styles.quickIcon}>🛩️</Text>
              <Text style={styles.quickTitle}>我的无人机</Text>
              <Text style={styles.quickDesc}>管理设备、状态和资质</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.quickCard, {width: quickCardLayout.itemWidth}]} onPress={() => navigation.navigate('MyOffers')}>
              <Text style={styles.quickIcon}>📦</Text>
              <Text style={styles.quickTitle}>我的供给</Text>
              <Text style={styles.quickDesc}>查看草稿、上架与暂停中的供给</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.quickCard, {width: quickCardLayout.itemWidth}]} onPress={() => navigation.navigate('PublishOffer')}>
              <Text style={styles.quickIcon}>🧾</Text>
              <Text style={styles.quickTitle}>发布供给</Text>
              <Text style={styles.quickDesc}>创建新的重载吊运供给方案</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.quickCard, {width: quickCardLayout.itemWidth}]} onPress={() => navigation.navigate('MyQuotes')}>
              <Text style={styles.quickIcon}>💬</Text>
              <Text style={styles.quickTitle}>我的报价</Text>
              <Text style={styles.quickDesc}>跟进需求报价与承接节奏</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.quickCard, {width: quickCardLayout.itemWidth}]} onPress={() => navigation.navigate('OwnerPilotBindings')}>
              <Text style={styles.quickIcon}>🤝</Text>
              <Text style={styles.quickTitle}>绑定飞手</Text>
              <Text style={styles.quickDesc}>邀请、确认和管理长期合作飞手</Text>
            </TouchableOpacity>
          </View>
        </ObjectCard>

        <TouchableOpacity style={[styles.saveButton, saving && styles.saveButtonDisabled]} onPress={handleSave} disabled={saving}>
          <Text style={styles.saveButtonText}>{saving ? '保存中...' : '保存机主档案'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const getStyles = (theme: AppTheme) => StyleSheet.create({
  container: {flex: 1, backgroundColor: theme.bgSecondary},
  content: {padding: 16, paddingBottom: 32, gap: 14},
  loadingWrap: {flex: 1, alignItems: 'center', justifyContent: 'center'},
  loadingText: {fontSize: 15, color: theme.textSub},
  heroCard: {backgroundColor: theme.isDark ? 'rgba(0,212,255,0.08)' : theme.primary, borderWidth: theme.isDark ? 1 : 0, borderColor: theme.isDark ? theme.primaryBorder : 'transparent'},
  heroEyebrow: {fontSize: 12, fontWeight: '700', color: theme.isDark ? theme.primaryText : 'rgba(255,255,255,0.7)'},
  heroTitle: {marginTop: 8, fontSize: 28, lineHeight: 34, fontWeight: '800', color: theme.isDark ? theme.text : '#FFFFFF'},
  heroDesc: {marginTop: 10, fontSize: 13, lineHeight: 20, color: theme.isDark ? theme.textSub : 'rgba(255,255,255,0.85)'},
  heroMetaRow: {flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 16},
  summaryRow: {flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 18},
  summaryItem: {
    backgroundColor: theme.isDark ? theme.primaryBg : 'rgba(255,255,255,0.12)',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  summaryValue: {fontSize: 18, fontWeight: '800', color: theme.isDark ? theme.primary : '#FFFFFF'},
  summaryLabel: {marginTop: 4, fontSize: 12, textAlign: 'center', color: theme.isDark ? theme.textSub : 'rgba(255,255,255,0.8)'},
  sectionCard: {gap: 12},
  sectionTitle: {fontSize: 20, fontWeight: '800', color: theme.text},
  sectionSubText: {fontSize: 13, lineHeight: 19, color: theme.textSub},
  inputLabel: {fontSize: 13, fontWeight: '700', color: theme.text},
  input: {
    borderWidth: 1,
    borderColor: theme.cardBorder,
    borderRadius: 12,
    backgroundColor: theme.bgSecondary,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: theme.text,
  },
  multilineInput: {minHeight: 108},
  capabilityRow: {flexDirection: 'row', justifyContent: 'space-between', gap: 12, alignItems: 'center'},
  capabilityTextWrap: {flex: 1},
  capabilityTitle: {fontSize: 15, fontWeight: '700', color: theme.text},
  capabilityDesc: {marginTop: 4, fontSize: 13, lineHeight: 19, color: theme.textSub},
  workbenchSummaryRow: {flexDirection: 'row', flexWrap: 'wrap', gap: 10},
  workbenchSummaryItem: {
    flex: 1,
    minWidth: 74,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 10,
    backgroundColor: theme.bgSecondary,
    alignItems: 'center',
  },
  workbenchSummaryValue: {fontSize: 18, fontWeight: '800', color: theme.primaryText},
  workbenchSummaryLabel: {marginTop: 4, fontSize: 12, color: theme.textSub},
  workbenchList: {gap: 10},
  workbenchItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 14,
    padding: 14,
    backgroundColor: theme.bgSecondary,
    borderWidth: 1,
    borderColor: theme.cardBorder,
  },
  workbenchItemTextWrap: {flex: 1},
  workbenchItemEyebrow: {fontSize: 12, fontWeight: '700', color: theme.primaryText},
  workbenchItemTitle: {marginTop: 4, fontSize: 15, fontWeight: '700', color: theme.text},
  workbenchItemDesc: {marginTop: 4, fontSize: 12, lineHeight: 18, color: theme.textSub},
  workbenchItemAction: {fontSize: 13, fontWeight: '700', color: theme.primaryText},
  workbenchEmpty: {
    borderRadius: 14,
    padding: 14,
    backgroundColor: theme.bgSecondary,
    borderWidth: 1,
    borderColor: theme.cardBorder,
  },
  workbenchEmptyTitle: {fontSize: 15, fontWeight: '700', color: theme.text},
  workbenchEmptyDesc: {marginTop: 6, fontSize: 12, lineHeight: 18, color: theme.textSub},
  quickGrid: {flexDirection: 'row', flexWrap: 'wrap', gap: 12},
  quickCard: {
    borderRadius: 18,
    padding: 16,
    backgroundColor: theme.bgSecondary,
    borderWidth: 1,
    borderColor: theme.primaryBorder,
  },
  quickIcon: {fontSize: 24},
  quickTitle: {marginTop: 10, fontSize: 15, fontWeight: '700', color: theme.text},
  quickDesc: {marginTop: 6, fontSize: 12, lineHeight: 18, color: theme.textSub},
  todoList: {gap: 10},
  todoItem: {flexDirection: 'row', alignItems: 'center', backgroundColor: theme.bgSecondary, padding: 14, borderRadius: 14, borderWidth: 1, borderColor: theme.cardBorder},
  todoIcon: {fontSize: 24, marginRight: 14},
  todoTextWrap: {flex: 1},
  todoItemTitle: {fontSize: 15, fontWeight: '700', color: theme.text},
  todoItemDesc: {fontSize: 12, color: theme.textSub, marginTop: 4},
  todoAction: {fontSize: 13, fontWeight: '700', color: theme.primary},
  saveButton: {
    borderRadius: 14,
    backgroundColor: theme.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
  },
  saveButtonDisabled: {opacity: 0.6},
  saveButtonText: {fontSize: 15, fontWeight: '800', color: theme.btnPrimaryText},
});
