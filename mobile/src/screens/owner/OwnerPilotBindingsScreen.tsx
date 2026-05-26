import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {
  Alert,
  FlatList,
  RefreshControl,
  SafeAreaView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {useSelector} from 'react-redux';

import EmptyState from '../../components/business/EmptyState';
import ObjectCard from '../../components/business/ObjectCard';
import ProviderAccessNotice from '../../components/business/ProviderAccessNotice';
import StatusBadge from '../../components/business/StatusBadge';
import {ownerService} from '../../services/owner';
import {OwnerPilotBindingSummary} from '../../types';
import {RootState} from '../../store/store';
import {getEffectiveRoleSummary, resolveProviderCapabilities} from '../../utils/roleSummary';
import {useTheme} from '../../theme/ThemeContext';
import type {AppTheme} from '../../theme/index';

const FILTERS = [
  {key: 'all', label: '全部'},
  {key: 'pending_confirmation', label: '待确认'},
  {key: 'active', label: '合作中'},
  {key: 'paused', label: '已暂停'},
  {key: 'dissolved', label: '已解除'},
] as const;

type FilterKey = (typeof FILTERS)[number]['key'];

const statusMeta: Record<string, {label: string; tone: 'green' | 'orange' | 'gray' | 'red' | 'blue'}> = {
  pending_confirmation: {label: '待确认', tone: 'orange'},
  active: {label: '合作中', tone: 'green'},
  paused: {label: '已暂停', tone: 'gray'},
  rejected: {label: '已拒绝', tone: 'red'},
  expired: {label: '已过期', tone: 'gray'},
  dissolved: {label: '已解除', tone: 'gray'},
};

export default function OwnerPilotBindingsScreen({navigation}: any) {
  const {theme} = useTheme();
  const styles = getStyles(theme);
  const isAuthenticated = useSelector((state: RootState) => state.auth.isAuthenticated);
  const roleSummary = useSelector((state: RootState) => state.auth.roleSummary);
  const providerCapabilities = useMemo(
    () => resolveProviderCapabilities(getEffectiveRoleSummary(roleSummary)),
    [roleSummary],
  );
  const canManageBindings = Boolean(isAuthenticated && providerCapabilities.canUseWorkbench && providerCapabilities.canArrangeDispatch);
  const [bindings, setBindings] = useState<OwnerPilotBindingSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [activeFilter, setActiveFilter] = useState<FilterKey>('all');
  const [pilotUserId, setPilotUserId] = useState('');
  const [note, setNote] = useState('');
  const [isPriority, setIsPriority] = useState(true);

  const loadData = useCallback(async () => {
    if (!canManageBindings) {
      setBindings([]);
      setLoading(false);
      setRefreshing(false);
      return;
    }
    try {
      const res = await ownerService.listPilotBindings({page: 1, page_size: 50, status: activeFilter === 'all' ? undefined : activeFilter});
      setBindings(res.data?.items || []);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeFilter, canManageBindings]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
  }, [loadData]);

  const handleInvite = useCallback(async () => {
    if (!canManageBindings) {
      Alert.alert('无法邀请', isAuthenticated ? '服务商派单能力审核通过后才能绑定执行人员。' : '请先登录服务商账号。');
      return;
    }
    if (!pilotUserId.trim()) {
      Alert.alert('请补充信息', '请填写执行人员账号编号。');
      return;
    }
    setSubmitting(true);
    try {
      await ownerService.invitePilotBinding({
        pilot_user_id: Number(pilotUserId),
        is_priority: isPriority,
        note: note.trim() || undefined,
      });
      setPilotUserId('');
      setNote('');
      setIsPriority(true);
      Alert.alert('邀请已发送', '执行人员会在绑定关系列表里看到你的邀请。');
      loadData();
    } catch (e: any) {
      Alert.alert('发送失败', e?.message || '请稍后重试');
    } finally {
      setSubmitting(false);
    }
  }, [canManageBindings, isAuthenticated, isPriority, loadData, note, pilotUserId]);

  const handleAction = useCallback(async (binding: OwnerPilotBindingSummary, action: 'confirm' | 'reject' | 'pause' | 'resume' | 'dissolve') => {
    if (!canManageBindings) {
      Alert.alert('无法操作', isAuthenticated ? '服务商派单能力审核通过后才能管理绑定关系。' : '请先登录服务商账号。');
      return;
    }
    try {
      if (action === 'confirm') {
        await ownerService.confirmPilotBinding(binding.id);
      } else if (action === 'reject') {
        await ownerService.rejectPilotBinding(binding.id);
      } else if (action === 'pause') {
        await ownerService.updatePilotBindingStatus(binding.id, 'paused');
      } else if (action === 'resume') {
        await ownerService.updatePilotBindingStatus(binding.id, 'active');
      } else {
        await ownerService.updatePilotBindingStatus(binding.id, 'dissolved');
      }
      loadData();
    } catch (e: any) {
      Alert.alert('操作失败', e?.message || '请稍后重试');
    }
  }, [canManageBindings, isAuthenticated, loadData]);

  const renderItem = ({item}: {item: OwnerPilotBindingSummary}) => {
    const meta = statusMeta[item.status] || {label: item.status, tone: 'gray' as const};
    const pilotName = item.pilot?.nickname || `执行人员 ${item.pilot_user_id}`;

    return (
      <ObjectCard style={styles.card}>
        <View style={styles.cardHeader}>
          <View>
            <Text style={styles.cardTitle}>{pilotName}</Text>
            <Text style={styles.cardMeta}>发起方：{item.initiated_by === 'owner' ? '服务商邀请' : '执行人员申请'}</Text>
          </View>
          <StatusBadge label={meta.label} tone={meta.tone} />
        </View>

        <Text style={styles.noteText}>{item.note || '未填写合作说明。'}</Text>
        <View style={styles.inlineRow}>
          <Text style={styles.inlineText}>优先合作：{item.is_priority ? '是' : '否'}</Text>
          <Text style={styles.inlineText}>绑定 ID：{item.id}</Text>
        </View>

        <View style={styles.footer}>
          {item.status === 'pending_confirmation' ? (
            <>
              <TouchableOpacity style={styles.secondaryBtn} onPress={() => handleAction(item, 'reject')}>
                <Text style={styles.secondaryBtnText}>拒绝</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.primaryBtn} onPress={() => handleAction(item, 'confirm')}>
                <Text style={styles.primaryBtnText}>确认合作</Text>
              </TouchableOpacity>
            </>
          ) : null}
          {item.status === 'active' ? (
            <>
              <TouchableOpacity style={styles.secondaryBtn} onPress={() => handleAction(item, 'pause')}>
                <Text style={styles.secondaryBtnText}>暂停</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.primaryBtn} onPress={() => handleAction(item, 'dissolve')}>
                <Text style={styles.primaryBtnText}>解除</Text>
              </TouchableOpacity>
            </>
          ) : null}
          {item.status === 'paused' ? (
            <>
              <TouchableOpacity style={styles.secondaryBtn} onPress={() => handleAction(item, 'dissolve')}>
                <Text style={styles.secondaryBtnText}>解除</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.primaryBtn} onPress={() => handleAction(item, 'resume')}>
                <Text style={styles.primaryBtnText}>恢复合作</Text>
              </TouchableOpacity>
            </>
          ) : null}
        </View>
      </ObjectCard>
    );
  };

  if (!canManageBindings) {
    return (
      <SafeAreaView style={[styles.container, {backgroundColor: theme.bg}]}>
        <ProviderAccessNotice
          title={isAuthenticated ? '服务商派单能力未开通' : '请先登录服务商账号'}
          description={isAuthenticated ? '设备服务能力审核通过后，才能邀请、确认和管理协作执行人员。' : '登录后才能管理服务商协作执行人员。'}
          actionText={isAuthenticated ? '查看服务商入驻' : undefined}
          onAction={isAuthenticated ? () => navigation.navigate('ProviderOnboarding') : undefined}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, {backgroundColor: theme.bg}]}>
      <FlatList
        data={bindings}
        keyExtractor={item => String(item.id)}
        renderItem={renderItem}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[theme.refreshColor]} />}
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <View>
            <View style={styles.hero}>
              <Text style={styles.heroEyebrow}>绑定执行人员</Text>
              <Text style={styles.heroTitle}>长期合作关系从这里管理</Text>
              <Text style={styles.heroDesc}>建立长期合作后，后续安排执行会更高效；每次任务仍会单独确认。</Text>
            </View>

            <ObjectCard style={styles.formCard}>
              <Text style={styles.formTitle}>邀请执行人员</Text>
              <Text style={styles.formDesc}>当前可先输入对方账号编号发起邀请，确认后即可建立长期合作。</Text>
              <TextInput style={styles.input} placeholder="执行人员账号编号" keyboardType="number-pad" value={pilotUserId} onChangeText={setPilotUserId} />
              <TextInput style={[styles.input, styles.noteInput]} placeholder="合作说明（选填）" value={note} onChangeText={setNote} multiline textAlignVertical="top" />
              <View style={styles.priorityRow}>
                <Text style={styles.priorityLabel}>设为优先合作</Text>
                <Switch value={isPriority} onValueChange={setIsPriority} trackColor={{false: '#d8e1eb', true: '#60a5fa'}} thumbColor="#fff" />
              </View>
              <TouchableOpacity style={[styles.primaryBtn, submitting && styles.disabledBtn]} onPress={handleInvite} disabled={submitting}>
                <Text style={styles.primaryBtnText}>{submitting ? '发送中...' : '发送邀请'}</Text>
              </TouchableOpacity>
            </ObjectCard>

            <ObjectCard style={styles.filterCard}>
              <Text style={styles.filterTitle}>关系分组</Text>
              <View style={styles.filterRow}>
                {FILTERS.map(filter => (
                  <TouchableOpacity key={filter.key} style={[styles.filterChip, activeFilter === filter.key && styles.filterChipActive]} onPress={() => setActiveFilter(filter.key)}>
                    <Text style={[styles.filterChipText, activeFilter === filter.key && styles.filterChipTextActive]}>{filter.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ObjectCard>
          </View>
        }
        ListEmptyComponent={
          loading ? null : (
            <ObjectCard>
              <EmptyState
                icon="🤝"
                title={activeFilter === 'all' ? '还没有绑定执行人员' : '这个分组下暂无绑定关系'}
                description="你可以先发起邀请，或者等执行人员主动申请后再确认合作。"
              />
            </ObjectCard>
          )
        }
      />
    </SafeAreaView>
  );
}

const getStyles = (theme: AppTheme) => StyleSheet.create({
  container: {flex: 1, backgroundColor: theme.bgSecondary},
  content: {padding: 14, paddingBottom: 28},
  hero: {backgroundColor: theme.isDark ? 'rgba(0,212,255,0.08)' : theme.primary, borderRadius: 24, padding: 20, marginBottom: 12, borderWidth: theme.isDark ? 1 : 0, borderColor: theme.isDark ? theme.primaryBorder : 'transparent'},
  heroEyebrow: {fontSize: 12, color: theme.isDark ? theme.primaryText : 'rgba(255,255,255,0.7)', fontWeight: '700'},
  heroTitle: {marginTop: 8, fontSize: 28, lineHeight: 34, color: theme.isDark ? theme.text : '#FFFFFF', fontWeight: '800'},
  heroDesc: {marginTop: 10, fontSize: 13, lineHeight: 20, color: theme.isDark ? theme.textSub : 'rgba(255,255,255,0.85)'},
  formCard: {marginBottom: 12, gap: 12},
  formTitle: {fontSize: 18, fontWeight: '800', color: theme.text},
  formDesc: {fontSize: 13, lineHeight: 20, color: theme.textSub},
  input: {borderWidth: 1, borderColor: theme.cardBorder, borderRadius: 12, backgroundColor: theme.bgSecondary, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: theme.text},
  noteInput: {minHeight: 88},
  priorityRow: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'},
  priorityLabel: {fontSize: 14, fontWeight: '700', color: theme.text},
  filterCard: {marginBottom: 12},
  filterTitle: {fontSize: 14, color: theme.text, fontWeight: '700', marginBottom: 12},
  filterRow: {flexDirection: 'row', flexWrap: 'wrap', gap: 8},
  filterChip: {paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: theme.primaryBg},
  filterChipActive: {backgroundColor: theme.primaryBg},
  filterChipText: {fontSize: 13, fontWeight: '600', color: theme.textSub},
  filterChipTextActive: {color: theme.primaryText},
  card: {marginBottom: 12, gap: 12},
  cardHeader: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12},
  cardTitle: {fontSize: 18, fontWeight: '800', color: theme.text},
  cardMeta: {marginTop: 4, fontSize: 12, color: theme.textSub},
  noteText: {fontSize: 14, lineHeight: 20, color: theme.text},
  inlineRow: {flexDirection: 'row', justifyContent: 'space-between', gap: 12},
  inlineText: {fontSize: 12, color: theme.textSub},
  footer: {flexDirection: 'row', gap: 10},
  primaryBtn: {flex: 1, borderRadius: 12, backgroundColor: theme.primary, alignItems: 'center', justifyContent: 'center', paddingVertical: 12},
  primaryBtnText: {fontSize: 14, fontWeight: '700', color: theme.btnPrimaryText},
  secondaryBtn: {flex: 1, borderRadius: 12, borderWidth: 1, borderColor: theme.primaryBorder, backgroundColor: theme.bgSecondary, alignItems: 'center', justifyContent: 'center', paddingVertical: 12},
  secondaryBtnText: {fontSize: 14, fontWeight: '700', color: theme.primaryText},
  disabledBtn: {opacity: 0.6},
});
