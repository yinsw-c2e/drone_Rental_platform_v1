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
import {useTheme} from '../../theme/ThemeContext';
import type {AppTheme} from '../../theme/index';

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
  const {theme} = useTheme();
  const styles = getStyles(theme);
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
  const eligibility = pilot?.eligibility;
  const hoursText = formatHoursFromSeconds(flightStats.totalDurationSeconds);
  const readinessTone: 'green' | 'orange' | 'red' | 'gray' =
    eligibility?.tier === 'dispatch_ready'
      ? 'green'
      : eligibility?.tier === 'candidate_ready' || eligibility?.tier === 'verified_offline'
      ? 'orange'
      : eligibility?.tier === 'needs_resubmission'
      ? 'red'
      : 'gray';

  const canUpdateAvailability = eligibility?.can_update_availability ?? ['verified', 'approved'].includes(pilot?.verification_status || '');
  const isOnline = ['online', 'available'].includes(pilot?.availability_status || 'offline');

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, {backgroundColor: theme.bg}]}>
        <View style={styles.loadingWrap}>
          <Text style={styles.loadingText}>飞手档案加载中...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!pilot) {
    return (
      <SafeAreaView style={[styles.container, {backgroundColor: theme.bg}]}>
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
    <SafeAreaView style={[styles.container, {backgroundColor: theme.bg}]}>
      <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>

        <View style={styles.headerHero}>
          <View style={styles.headerTop}>
            <View>
              <Text style={styles.headerGreeting}>飞手工作台</Text>
              <Text style={styles.headerSubtitle}>执照、接单与飞行统计</Text>
            </View>
            <View style={styles.headerStatusRow}>
              <StatusBadge label={availabilityStatus.label} tone={availabilityStatus.tone} />
            </View>
          </View>

          <View style={styles.statsGrid}>
            <View style={styles.statsCard}>
              <Text style={styles.statsValue}>{dispatchStats.pending}</Text>
              <Text style={styles.statsLabel}>待办派单</Text>
            </View>
            <View style={styles.statsCard}>
              <Text style={styles.statsValue}>{dispatchStats.active}</Text>
              <Text style={styles.statsLabel}>进行中</Text>
            </View>
            <View style={styles.statsCard}>
              <Text style={styles.statsValue}>{flightStats.totalFlights}</Text>
              <Text style={styles.statsLabel}>总飞行</Text>
            </View>
            <View style={styles.statsCard}>
              <Text style={styles.statsValue}>{hoursText}</Text>
              <Text style={styles.statsLabel}>飞行时数</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>市场准入状态</Text>
          <View style={styles.readinessCard}>
            <View style={styles.readinessHeader}>
              <View style={styles.readinessInfo}>
                <Text style={styles.readinessTier}>{eligibility?.label || verificationStatus.label}</Text>
                <Text style={styles.readinessNext}>{eligibility?.recommended_next_step || '完善资料以获得更多权限'}</Text>
              </View>
              <StatusBadge label={eligibility?.tier === 'dispatch_ready' ? '已就绪' : '待达标'} tone={readinessTone} />
            </View>

            {eligibility?.blockers?.length > 0 && (
              <View style={styles.blockerBox}>
                <Text style={styles.blockerTitle}>需要处理以下事项：</Text>
                {eligibility.blockers.map((blocker: any) => (
                  <Text key={blocker.code || blocker.message} style={styles.blockerItem}>
                    • {blocker.message}
                  </Text>
                ))}
              </View>
            )}

            <View style={styles.readinessActions}>
              <TouchableOpacity style={styles.readinessBtn} onPress={() => navigation.navigate('PilotRegister')}>
                <Text style={styles.readinessBtnText}>补充/更新认证资料 ˃</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.switchBox}>
            <View style={styles.switchText}>
              <Text style={styles.switchLabel}>正式派单接单开关</Text>
              <Text style={styles.switchSub}>
                {canUpdateAvailability ? '开启后，机主和系统可直接向你指派任务。' : '完成飞手认证后解锁正式接单开关。'}
              </Text>
            </View>
            <Switch
              value={isOnline}
              onValueChange={toggleAvailability}
              disabled={!canUpdateAvailability}
              trackColor={{false: theme.divider, true: theme.success}}
            />
          </View>
        </View>

        <ObjectCard style={styles.settingsCard}>
          <Text style={styles.sectionTitle}>接单偏好</Text>
          <View style={styles.inputGroup}>
            <Text style={styles.fieldLabel}>常驻服务城市</Text>
            <TextInput
              style={styles.fieldInput}
              placeholder="例如：佛山"
              value={draft.current_city}
              onChangeText={text => setDraft(prev => ({...prev, current_city: text}))}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.fieldLabel}>最大服务半径 (公里)</Text>
            <TextInput
              style={styles.fieldInput}
              placeholder="默认 50"
              keyboardType="number-pad"
              value={draft.service_radius}
              onChangeText={text => setDraft(prev => ({...prev, service_radius: text}))}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.fieldLabel}>专业技能</Text>
            <View style={styles.skillGrid}>
              {skillOptions.map(skill => {
                const active = draft.special_skills.includes(skill);
                return (
                  <TouchableOpacity
                    key={skill}
                    style={[styles.skillBtn, active && styles.skillBtnActive]}
                    onPress={() => toggleSkill(skill)}
                  >
                    <Text style={[styles.skillBtnText, active && styles.skillBtnTextActive]}>{skill}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <TouchableOpacity
            style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
            onPress={handleSave}
            disabled={saving}
          >
            <Text style={styles.saveBtnText}>{saving ? '正在保存...' : '保存接单设置'}</Text>
          </TouchableOpacity>
        </ObjectCard>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>任务与记录</Text>
          <View style={styles.entryGrid}>
            <EntryItem title="正式派单" icon="🎯" count={dispatchStats.pending} onPress={() => navigation.navigate('PilotTaskList')} />
            <EntryItem title="报名需求" icon="🛰️" onPress={() => navigation.navigate('DemandList', {mode: 'pilot'})} />
            <EntryItem title="飞行监控" icon="📍" onPress={handleEnterFlightMonitoring} />
            <EntryItem title="飞行记录" icon="🛫" onPress={() => navigation.navigate('FlightLog')} />
            <EntryItem title="绑定机主" icon="🤝" onPress={() => navigation.navigate('PilotOwnerBindings')} />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function EntryItem({title, icon, count, onPress}: {title: string; icon: string; count?: number; onPress: () => void}) {
  const {theme} = useTheme();
  const styles = getStyles(theme);
  return (
    <TouchableOpacity style={[styles.entryCard, {backgroundColor: theme.card, borderColor: theme.divider}]} onPress={onPress}>
      <Text style={styles.entryIcon}>{icon}</Text>
      <Text style={[styles.entryTitle, {color: theme.text}]}>{title}</Text>
      {typeof count === 'number' && count > 0 && (
        <View style={[styles.entryBadge, {backgroundColor: theme.danger}]}>
          <Text style={styles.entryBadgeText}>{count}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const getStyles = (theme: AppTheme) => StyleSheet.create({
  container: {flex: 1, backgroundColor: theme.bgSecondary},
  content: {paddingBottom: 40},
  loadingWrap: {flex: 1, alignItems: 'center', justifyContent: 'center'},
  loadingText: {fontSize: 15, color: theme.textSub},

  headerHero: {
    backgroundColor: theme.primary,
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 28,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  headerGreeting: {
    fontSize: 24,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  headerSubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 4,
  },
  headerStatusRow: {
    marginTop: 2,
  },
  statsGrid: {
    flexDirection: 'row',
    marginTop: 24,
    gap: 10,
  },
  statsCard: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
  },
  statsValue: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  statsLabel: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 4,
    fontWeight: '600',
  },

  section: {
    marginTop: 20,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: theme.text,
    marginBottom: 12,
  },

  readinessCard: {
    backgroundColor: theme.card,
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: theme.divider,
  },
  readinessHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  readinessInfo: {
    flex: 1,
    paddingRight: 12,
  },
  readinessTier: {
    fontSize: 18,
    fontWeight: '800',
    color: theme.text,
  },
  readinessNext: {
    fontSize: 13,
    color: theme.textSub,
    marginTop: 6,
    lineHeight: 18,
  },
  blockerBox: {
    marginTop: 16,
    padding: 14,
    backgroundColor: theme.warning + '10',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.warning + '20',
  },
  blockerTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: theme.warning,
    marginBottom: 6,
  },
  blockerItem: {
    fontSize: 12,
    color: theme.textSub,
    lineHeight: 18,
  },
  readinessActions: {
    marginTop: 16,
    alignItems: 'flex-end',
  },
  readinessBtn: {
    paddingVertical: 6,
  },
  readinessBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.primaryText,
  },

  switchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.card,
    padding: 18,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: theme.divider,
  },
  switchText: {
    flex: 1,
    paddingRight: 16,
  },
  switchLabel: {
    fontSize: 16,
    fontWeight: '800',
    color: theme.text,
  },
  switchSub: {
    fontSize: 12,
    color: theme.textSub,
    marginTop: 4,
    lineHeight: 18,
  },

  settingsCard: {
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
  skillGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  skillBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: theme.bgSecondary,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  skillBtnActive: {
    borderColor: theme.primary,
    backgroundColor: theme.primaryBg,
  },
  skillBtnText: {
    fontSize: 13,
    color: theme.textSub,
    fontWeight: '600',
  },
  skillBtnTextActive: {
    color: theme.primaryText,
    fontWeight: '700',
  },
  saveBtn: {
    backgroundColor: theme.primary,
    borderRadius: 14,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  saveBtnDisabled: {opacity: 0.6},
  saveBtnText: {fontSize: 15, fontWeight: '800', color: '#FFFFFF'},

  entryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  entryCard: {
    width: '30.5%',
    backgroundColor: theme.card,
    borderRadius: 16,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.divider,
    position: 'relative',
  },
  entryIcon: {
    fontSize: 24,
    marginBottom: 8,
  },
  entryTitle: {
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  entryBadge: {
    position: 'absolute',
    top: -6,
    right: -6,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  entryBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
  },
  emptyWrap: {flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28},
  emptyTitle: {fontSize: 22, fontWeight: '800', color: theme.text, textAlign: 'center'},
  emptyDesc: {marginTop: 10, fontSize: 14, lineHeight: 22, color: theme.textSub, textAlign: 'center'},
  primaryButton: {borderRadius: 14, backgroundColor: theme.primary, alignItems: 'center', justifyContent: 'center', paddingVertical: 15, marginTop: 20},
  primaryButtonText: {fontSize: 15, fontWeight: '800', color: theme.btnPrimaryText},
});
