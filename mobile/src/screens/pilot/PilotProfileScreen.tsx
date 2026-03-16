import React, {useCallback, useMemo, useState} from 'react';
import {
  Alert,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {useFocusEffect} from '@react-navigation/native';

import ObjectCard from '../../components/business/ObjectCard';
import StatusBadge from '../../components/business/StatusBadge';
import {dispatchV2Service} from '../../services/dispatchV2';
import {pilotV2Service} from '../../services/pilotV2';
import {aggregateFlightRecords, formatHoursFromSeconds} from '../../utils/flightRecords';

const STATUS_MAP: Record<string, {label: string; tone: 'green' | 'orange' | 'red' | 'gray'}> = {
  verified: {label: '已认证', tone: 'green'},
  approved: {label: '已认证', tone: 'green'},
  pending: {label: '审核中', tone: 'orange'},
  rejected: {label: '未通过', tone: 'red'},
  unverified: {label: '未认证', tone: 'gray'},
};

const availabilityMap: Record<string, {label: string; tone: 'green' | 'orange' | 'gray'}> = {
  online: {label: '接单中', tone: 'green'},
  available: {label: '接单中', tone: 'green'},
  busy: {label: '忙碌中', tone: 'orange'},
  offline: {label: '离线', tone: 'gray'},
};

const skillOptions = ['电网吊运', '山区运输', '应急救援', '海岛补给', '高原补给'];

const parseSkills = (skills: any): string[] => {
  if (Array.isArray(skills)) {
    return skills.filter(Boolean).map(String);
  }
  return [];
};

export default function PilotProfileScreen({navigation}: any) {
  const [pilot, setPilot] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState({current_city: '', service_radius: '50', special_skills: [] as string[]});
  const [flightStats, setFlightStats] = useState({
    totalFlights: 0,
    totalDurationSeconds: 0,
    totalDistanceM: 0,
    maxAltitudeM: 0,
  });
  const [dispatchStats, setDispatchStats] = useState({pending: 0, active: 0});

  const loadData = useCallback(async () => {
    try {
      const [profileRes, flightRecords, dispatchRes] = await Promise.all([
        pilotV2Service.getProfile().catch(() => null),
        pilotV2Service.listAllFlightRecords({page_size: 100}),
        dispatchV2Service.list({role: 'pilot', page: 1, page_size: 100}).catch(() => null),
      ]);

      const profile = profileRes?.data || null;
      setPilot(profile);
      if (profile) {
        setDraft({
          current_city: profile.current_city || '',
          service_radius: String(profile.service_radius_km || Math.round(profile.service_radius || 50) || 50),
          special_skills: parseSkills(profile.special_skills),
        });
      }

      setFlightStats(aggregateFlightRecords(flightRecords));

      const dispatchItems = dispatchRes?.data?.items || [];
      setDispatchStats({
        pending: dispatchItems.filter((item: any) => item.status === 'pending_response').length,
        active: dispatchItems.filter((item: any) => ['accepted', 'executing', 'in_progress'].includes(item.status)).length,
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData]),
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
  }, [loadData]);

  const toggleAvailability = useCallback(async (enabled: boolean) => {
    if (!pilot) {
      return;
    }
    try {
      const res = await pilotV2Service.updateAvailability(enabled ? 'online' : 'offline');
      setPilot(res.data);
    } catch (e: any) {
      Alert.alert('更新失败', e?.message || '请稍后重试');
    }
  }, [pilot]);

  const toggleSkill = useCallback((skill: string) => {
    setDraft(prev => ({
      ...prev,
      special_skills: prev.special_skills.includes(skill)
        ? prev.special_skills.filter(item => item !== skill)
        : [...prev.special_skills, skill],
    }));
  }, []);

  const handleSave = useCallback(async () => {
    if (!pilot) {
      return;
    }
    setSaving(true);
    try {
      const res = await pilotV2Service.upsertProfile({
        current_city: draft.current_city.trim(),
        service_radius: Number(draft.service_radius) || 50,
        special_skills: draft.special_skills,
      });
      setPilot(res.data);
      Alert.alert('保存成功', '飞手设置已更新。');
    } catch (e: any) {
      Alert.alert('保存失败', e?.message || '请稍后重试');
    } finally {
      setSaving(false);
    }
  }, [draft, pilot]);

  const handleEnterFlightMonitoring = useCallback(async () => {
    try {
      const res = await dispatchV2Service.list({role: 'pilot', page: 1, page_size: 20});
      const activeTask = (res.data?.items || []).find((item: any) => item.order?.id && !['rejected', 'finished', 'cancelled'].includes(item.status));
      if (activeTask?.order?.id) {
        navigation.navigate('FlightMonitoring', {orderId: activeTask.order.id, dispatchId: activeTask.id});
        return;
      }
      Alert.alert('当前没有可监控任务', '先从正式派单里接受一条执行任务，再进入飞行监控。', [
        {text: '取消', style: 'cancel'},
        {text: '去派单任务', onPress: () => navigation.navigate('PilotTaskList')},
      ]);
    } catch (e: any) {
      Alert.alert('获取失败', e?.message || '请稍后重试');
    }
  }, [navigation]);

  const verificationStatus = STATUS_MAP[pilot?.verification_status || 'unverified'] || STATUS_MAP.unverified;
  const availabilityStatus = availabilityMap[pilot?.availability_status || 'offline'] || availabilityMap.offline;
  const hoursText = formatHoursFromSeconds(flightStats.totalDurationSeconds);
  const serviceRadiusText = Number(draft.service_radius || 0) > 0 ? `${Number(draft.service_radius)}km` : '未设置';
  const isOnline = ['online', 'available'].includes(pilot?.availability_status || 'offline');

  const summaryItems = useMemo(
    () => [
      {label: '待响应派单', value: dispatchStats.pending},
      {label: '执行中任务', value: dispatchStats.active},
      {label: '真实飞行记录', value: flightStats.totalFlights},
      {label: '总飞行时长', value: hoursText},
    ],
    [dispatchStats.active, dispatchStats.pending, flightStats.totalFlights, hoursText],
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingWrap}>
          <Text style={styles.loadingText}>飞手档案加载中...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!pilot) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyTitle}>还没有飞手档案</Text>
          <Text style={styles.emptyDesc}>先完成飞手认证，后面这里才会出现接单状态、服务区域和执行统计。</Text>
          <TouchableOpacity style={styles.primaryButton} onPress={() => navigation.navigate('PilotRegister')}>
            <Text style={styles.primaryButtonText}>去做飞手认证</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
        <ObjectCard style={styles.heroCard}>
          <Text style={styles.heroEyebrow}>飞手档案</Text>
          <Text style={styles.heroTitle}>认证、接单、服务范围在这里统一设置</Text>
          <Text style={styles.heroDesc}>飞手中心现在只保留执行相关能力：认证状态、接单状态、服务区域、技能标签和真实履约统计。</Text>

          <View style={styles.heroBadgeRow}>
            <StatusBadge label={verificationStatus.label} tone={verificationStatus.tone} />
            <StatusBadge label={availabilityStatus.label} tone={availabilityStatus.tone} />
          </View>

          <View style={styles.heroMeta}>
            <Text style={styles.heroMetaLine}>执照类型：{pilot.caac_license_type || '-'}</Text>
            <Text style={styles.heroMetaLine}>执照编号：{pilot.caac_license_no || '-'}</Text>
            <Text style={styles.heroMetaLine}>服务城市：{draft.current_city || '未设置'} · 服务半径：{serviceRadiusText}</Text>
          </View>

          <View style={styles.summaryRow}>
            {summaryItems.map(item => (
              <View key={item.label} style={styles.summaryItem}>
                <Text style={styles.summaryValue}>{item.value}</Text>
                <Text style={styles.summaryLabel}>{item.label}</Text>
              </View>
            ))}
          </View>
        </ObjectCard>

        <ObjectCard style={styles.sectionCard}>
          <View style={styles.switchRow}>
            <View style={styles.switchTextWrap}>
              <Text style={styles.sectionTitle}>接单状态</Text>
              <Text style={styles.sectionDesc}>通过认证后，可随时切换是否接受新的正式派单。</Text>
            </View>
            <Switch value={isOnline} onValueChange={toggleAvailability} trackColor={{false: '#d8e1eb', true: '#22c55e'}} thumbColor="#fff" />
          </View>
        </ObjectCard>

        <ObjectCard style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>服务设置</Text>
          <Text style={styles.inputLabel}>当前服务城市</Text>
          <TextInput
            style={styles.input}
            placeholder="例如：佛山"
            value={draft.current_city}
            onChangeText={text => setDraft(prev => ({...prev, current_city: text}))}
          />

          <Text style={styles.inputLabel}>服务半径（公里）</Text>
          <TextInput
            style={styles.input}
            placeholder="默认 50"
            keyboardType="number-pad"
            value={draft.service_radius}
            onChangeText={text => setDraft(prev => ({...prev, service_radius: text}))}
          />

          <Text style={styles.inputLabel}>技能标签</Text>
          <View style={styles.skillRow}>
            {skillOptions.map(skill => {
              const active = draft.special_skills.includes(skill);
              return (
                <TouchableOpacity key={skill} style={[styles.skillChip, active && styles.skillChipActive]} onPress={() => toggleSkill(skill)}>
                  <Text style={[styles.skillChipText, active && styles.skillChipTextActive]}>{skill}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </ObjectCard>

        <ObjectCard style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>认证与执行入口</Text>
          <TouchableOpacity style={styles.actionRow} onPress={() => navigation.navigate('PilotTaskList')}>
            <Text style={styles.actionTitle}>正式派单</Text>
            <Text style={styles.actionArrow}>›</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionRow} onPress={handleEnterFlightMonitoring}>
            <Text style={styles.actionTitle}>飞行监控</Text>
            <Text style={styles.actionArrow}>›</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionRow} onPress={() => navigation.navigate('FlightLog')}>
            <Text style={styles.actionTitle}>飞行记录</Text>
            <Text style={styles.actionArrow}>›</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionRow} onPress={() => navigation.navigate('PilotOwnerBindings')}>
            <Text style={styles.actionTitle}>绑定机主</Text>
            <Text style={styles.actionArrow}>›</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionRow} onPress={() => navigation.navigate('PilotRegister')}>
            <Text style={styles.actionTitle}>补充/更新认证资料</Text>
            <Text style={styles.actionArrow}>›</Text>
          </TouchableOpacity>
        </ObjectCard>

        <TouchableOpacity style={[styles.primaryButton, saving && styles.primaryButtonDisabled]} onPress={handleSave} disabled={saving}>
          <Text style={styles.primaryButtonText}>{saving ? '保存中...' : '保存飞手设置'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#eef3f8'},
  content: {padding: 16, paddingBottom: 32, gap: 14},
  loadingWrap: {flex: 1, alignItems: 'center', justifyContent: 'center'},
  loadingText: {fontSize: 15, color: '#64748b'},
  emptyWrap: {flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28},
  emptyTitle: {fontSize: 22, fontWeight: '800', color: '#102a43', textAlign: 'center'},
  emptyDesc: {marginTop: 10, fontSize: 14, lineHeight: 22, color: '#64748b', textAlign: 'center'},
  heroCard: {backgroundColor: '#106c4a'},
  heroEyebrow: {fontSize: 12, fontWeight: '700', color: '#d1fae5'},
  heroTitle: {marginTop: 8, fontSize: 28, lineHeight: 34, fontWeight: '800', color: '#fff'},
  heroDesc: {marginTop: 10, fontSize: 13, lineHeight: 20, color: '#d1fae5'},
  heroBadgeRow: {flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 16},
  heroMeta: {marginTop: 16, gap: 6},
  heroMetaLine: {fontSize: 13, color: '#ecfdf5'},
  summaryRow: {flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 18},
  summaryItem: {flex: 1, backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 14, paddingVertical: 12, paddingHorizontal: 8, alignItems: 'center'},
  summaryValue: {fontSize: 18, fontWeight: '800', color: '#fff'},
  summaryLabel: {marginTop: 4, fontSize: 12, color: '#d1fae5', textAlign: 'center'},
  sectionCard: {gap: 12},
  sectionTitle: {fontSize: 20, fontWeight: '800', color: '#102a43'},
  sectionDesc: {marginTop: 6, fontSize: 13, lineHeight: 19, color: '#64748b'},
  switchRow: {flexDirection: 'row', justifyContent: 'space-between', gap: 12, alignItems: 'center'},
  switchTextWrap: {flex: 1},
  inputLabel: {fontSize: 13, fontWeight: '700', color: '#334e68'},
  input: {borderWidth: 1, borderColor: '#d8e1eb', borderRadius: 12, backgroundColor: '#f8fafc', paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: '#102a43'},
  skillRow: {flexDirection: 'row', flexWrap: 'wrap', gap: 10},
  skillChip: {paddingHorizontal: 14, paddingVertical: 10, borderRadius: 999, backgroundColor: '#edf2f7'},
  skillChipActive: {backgroundColor: '#d1fae5'},
  skillChipText: {fontSize: 13, fontWeight: '600', color: '#52606d'},
  skillChipTextActive: {color: '#047857'},
  actionRow: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#e2e8f0'},
  actionTitle: {fontSize: 15, fontWeight: '700', color: '#102a43'},
  actionArrow: {fontSize: 18, color: '#94a3b8'},
  primaryButton: {borderRadius: 14, backgroundColor: '#047857', alignItems: 'center', justifyContent: 'center', paddingVertical: 15},
  primaryButtonDisabled: {opacity: 0.6},
  primaryButtonText: {fontSize: 15, fontWeight: '800', color: '#fff'},
});
