// @ts-nocheck
import Taro, { useDidShow } from '@tarojs/taro';
import React, { useCallback, useState } from 'react';
import { Input, ScrollView, Switch, Text, View } from '@tarojs/components';

import StatusBadge from '../../../components/business/StatusBadge';
import { dispatchV2Service } from '../../../services/dispatchV2';
import { pilotV2Service } from '../../../services/pilotV2';
import { aggregateFlightRecords, formatHoursFromSeconds } from '../../../utils/flightRecords';
import './index.scss';

const STATUS_MAP = {
  verified: { label: '已认证', tone: 'green' },
  approved: { label: '已认证', tone: 'green' },
  pending: { label: '审核中', tone: 'orange' },
  rejected: { label: '未通过', tone: 'red' },
  unverified: { label: '未认证', tone: 'gray' },
};

const availabilityMap = {
  online: { label: '接单中', tone: 'green' },
  available: { label: '接单中', tone: 'green' },
  busy: { label: '忙碌中', tone: 'orange' },
  offline: { label: '离线', tone: 'gray' },
};

const skillOptions = ['电网吊运', '山区运输', '应急救援', '海岛补给', '高原补给'];

const parseSkills = (skills: any): string[] => {
  if (Array.isArray(skills)) {
    return skills.filter(Boolean).map(String);
  }
  return [];
};

export default function PilotProfilePage() {
  const [pilot, setPilot] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState({
    current_city: '',
    service_radius: '50',
    special_skills: [] as string[],
  });
  const [flightStats, setFlightStats] = useState({
    totalFlights: 0,
    totalDurationSeconds: 0,
    totalDistanceM: 0,
    maxAltitudeM: 0,
  });
  const [dispatchStats, setDispatchStats] = useState({ pending: 0, active: 0 });

  const loadData = useCallback(async () => {
    try {
      const [profileRes, flightRecords, dispatchRes] = await Promise.all([
        pilotV2Service.getProfile().catch(() => null),
        pilotV2Service.listAllFlightRecords({ page_size: 100 }).catch(() => []),
        dispatchV2Service.list({ role: 'pilot', page: 1, page_size: 100 }).catch(() => null),
      ]);

      setPilot(profileRes || null);
      if (profileRes) {
        setDraft({
          current_city: profileRes.current_city || '',
          service_radius: String(
            profileRes.service_radius_km || Math.round(profileRes.service_radius || 50) || 50,
          ),
          special_skills: parseSkills(profileRes.special_skills),
        });
      }

      setFlightStats(aggregateFlightRecords(flightRecords || []));

      const dispatchItems = dispatchRes?.items || [];
      setDispatchStats({
        pending: dispatchItems.filter((item: any) => item.status === 'pending_response').length,
        active: dispatchItems.filter((item: any) =>
          ['accepted', 'executing', 'in_progress'].includes(item.status),
        ).length,
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useDidShow(() => {
    loadData();
  });

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const toggleSkill = (skill: string) => {
    setDraft((prev) => ({
      ...prev,
      special_skills: prev.special_skills.includes(skill)
        ? prev.special_skills.filter((item) => item !== skill)
        : [...prev.special_skills, skill],
    }));
  };

  const toggleAvailability = async (enabled: boolean) => {
    if (!pilot) {
      return;
    }
    try {
      const nextProfile = await pilotV2Service.updateAvailability(enabled ? 'online' : 'offline');
      setPilot(nextProfile);
    } catch (error: any) {
      Taro.showToast({ title: error?.message || '更新失败', icon: 'none' });
    }
  };

  const handleSave = async () => {
    if (!pilot) {
      return;
    }
    setSaving(true);
    try {
      const nextProfile = await pilotV2Service.upsertProfile({
        current_city: draft.current_city.trim(),
        service_radius: Number(draft.service_radius) || 50,
        special_skills: draft.special_skills,
      });
      setPilot(nextProfile);
      Taro.showToast({ title: '飞手设置已更新', icon: 'success' });
    } catch (error: any) {
      Taro.showToast({ title: error?.message || '保存失败，请稍后重试', icon: 'none' });
    } finally {
      setSaving(false);
    }
  };

  const handleEnterFlightMonitoring = async () => {
    try {
      const res = await dispatchV2Service.list({ role: 'pilot', page: 1, page_size: 20 });
      const activeTask = (res.items || []).find(
        (item: any) =>
          item.order?.id && !['rejected', 'finished', 'cancelled'].includes(item.status),
      );
      if (activeTask?.order?.id) {
        Taro.navigateTo({
          url: `/pages/flight/monitor/index?orderId=${activeTask.order.id}&dispatchId=${activeTask.id}`,
        });
        return;
      }
      Taro.showModal({
        title: '当前没有可监控任务',
        content: '先从正式派单里接受一条执行任务，再进入飞行监控。',
        confirmText: '去派单任务',
        success: (modalRes) => {
          if (modalRes.confirm) {
            Taro.navigateTo({ url: '/pages/dispatch/list/index' });
          }
        },
      });
    } catch (error: any) {
      Taro.showToast({ title: error?.message || '获取失败，请稍后重试', icon: 'none' });
    }
  };

  const verificationStatus =
    STATUS_MAP[pilot?.verification_status || 'unverified'] || STATUS_MAP.unverified;
  const availabilityStatus =
    availabilityMap[pilot?.availability_status || 'offline'] || availabilityMap.offline;
  const eligibility = pilot?.eligibility;
  const readinessTone =
    eligibility?.tier === 'dispatch_ready'
      ? 'green'
      : eligibility?.tier === 'candidate_ready' || eligibility?.tier === 'verified_offline'
      ? 'orange'
      : eligibility?.tier === 'needs_resubmission'
      ? 'red'
      : 'gray';
  const canUpdateAvailability =
    eligibility?.can_update_availability ??
    ['verified', 'approved'].includes(pilot?.verification_status || '');
  const isOnline = ['online', 'available'].includes(pilot?.availability_status || 'offline');

  if (loading) {
    return (
      <View className='pilot-wrap'>
        <View className='pilot-loading'>
          <Text className='pilot-loading-text'>飞手档案加载中...</Text>
        </View>
      </View>
    );
  }

  if (!pilot) {
    return (
      <View className='pilot-wrap'>
        <View className='pilot-empty'>
          <Text className='pilot-empty-title'>还没有飞手档案</Text>
          <Text className='pilot-empty-desc'>
            先完成飞手认证，后面这里才会出现接单状态、服务范围和飞行统计。
          </Text>
          <View
            className='pilot-empty-btn'
            onClick={() => Taro.navigateTo({ url: '/pages/pilot/register/index' })}
          >
            <Text className='pilot-empty-btn-text'>去做飞手认证</Text>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View className='pilot-wrap'>
      <ScrollView
        scrollY
        className='pilot-scroll'
        refresherEnabled
        refresherTriggered={refreshing}
        onRefresherRefresh={onRefresh}
      >
        <View className='pilot-content'>
          <View className='pilot-hero'>
            <View className='pilot-hero-top'>
              <View>
                <Text className='pilot-hero-title'>飞手工作台</Text>
                <Text className='pilot-hero-sub'>执照、接单与飞行统计</Text>
              </View>
              <StatusBadge label={availabilityStatus.label} tone={availabilityStatus.tone} />
            </View>

            <View className='pilot-stats-grid'>
              <View className='pilot-stat-card'>
                <Text className='pilot-stat-value'>{dispatchStats.pending}</Text>
                <Text className='pilot-stat-label'>待办派单</Text>
              </View>
              <View className='pilot-stat-card'>
                <Text className='pilot-stat-value'>{dispatchStats.active}</Text>
                <Text className='pilot-stat-label'>进行中</Text>
              </View>
              <View className='pilot-stat-card'>
                <Text className='pilot-stat-value'>{flightStats.totalFlights}</Text>
                <Text className='pilot-stat-label'>总飞行</Text>
              </View>
              <View className='pilot-stat-card'>
                <Text className='pilot-stat-value'>
                  {formatHoursFromSeconds(flightStats.totalDurationSeconds)}
                </Text>
                <Text className='pilot-stat-label'>飞行时数</Text>
              </View>
            </View>
          </View>

          <View className='pilot-section'>
            <Text className='pilot-section-title'>市场准入状态</Text>
            <View className='pilot-readiness-card'>
              <View className='pilot-readiness-header'>
                <View className='pilot-readiness-main'>
                  <Text className='pilot-readiness-title'>
                    {eligibility?.label || verificationStatus.label}
                  </Text>
                  <Text className='pilot-readiness-desc'>
                    {eligibility?.recommended_next_step || '完善资料以获得更多权限'}
                  </Text>
                </View>
                <StatusBadge
                  label={eligibility?.tier === 'dispatch_ready' ? '已就绪' : '待达标'}
                  tone={readinessTone}
                />
              </View>

              {eligibility?.blockers?.length ? (
                <View className='pilot-blocker-box'>
                  <Text className='pilot-blocker-title'>需要处理以下事项：</Text>
                  {eligibility.blockers.map((blocker: any) => (
                    <Text key={blocker.code || blocker.message} className='pilot-blocker-item'>
                      • {blocker.message}
                    </Text>
                  ))}
                </View>
              ) : null}
            </View>
          </View>

          <View className='pilot-section'>
            <View className='pilot-section-header'>
              <Text className='pilot-section-title'>接单状态</Text>
              <StatusBadge label={verificationStatus.label} tone={verificationStatus.tone} />
            </View>

            <View className='pilot-availability-row'>
              <View className='pilot-availability-main'>
                <Text className='pilot-availability-label'>当前是否接单</Text>
                <Text className='pilot-availability-desc'>
                  已认证后可切换在线状态，平台会据此安排正式派单。
                </Text>
              </View>
              <Switch
                checked={isOnline}
                color='#2563EB'
                disabled={!canUpdateAvailability}
                onChange={(e) => toggleAvailability(!!e.detail.value)}
              />
            </View>
          </View>

          <View className='pilot-section'>
            <Text className='pilot-section-title'>快捷入口</Text>
            <View className='pilot-quick-grid'>
              <View
                className='pilot-quick-card'
                onClick={() => Taro.navigateTo({ url: '/pages/dispatch/list/index' })}
              >
                <Text className='pilot-quick-icon'>📮</Text>
                <Text className='pilot-quick-title'>派单任务</Text>
              </View>
              <View
                className='pilot-quick-card'
                onClick={() => Taro.navigateTo({ url: '/pages/flight/records/index' })}
              >
                <Text className='pilot-quick-icon'>📈</Text>
                <Text className='pilot-quick-title'>飞行记录</Text>
              </View>
              <View className='pilot-quick-card' onClick={handleEnterFlightMonitoring}>
                <Text className='pilot-quick-icon'>🛰️</Text>
                <Text className='pilot-quick-title'>飞行监控</Text>
              </View>
              <View
                className='pilot-quick-card'
                onClick={() => Taro.navigateTo({ url: '/pages/pilot/bind-drone/index' })}
              >
                <Text className='pilot-quick-icon'>🤝</Text>
                <Text className='pilot-quick-title'>绑定无人机</Text>
              </View>
            </View>
          </View>

          <View className='pilot-section'>
            <Text className='pilot-section-title'>服务设置</Text>

            <Text className='pilot-label'>当前服务城市</Text>
            <Input
              className='pilot-input'
              placeholder='例如：佛山'
              value={draft.current_city}
              onInput={(e) => setDraft((prev) => ({ ...prev, current_city: e.detail.value }))}
            />

            <Text className='pilot-label'>服务半径（公里）</Text>
            <Input
              className='pilot-input'
              type='number'
              placeholder='默认 50'
              value={draft.service_radius}
              onInput={(e) => setDraft((prev) => ({ ...prev, service_radius: e.detail.value }))}
            />

            <Text className='pilot-label'>技能标签</Text>
            <View className='pilot-skill-row'>
              {skillOptions.map((skill) => {
                const active = draft.special_skills.includes(skill);
                return (
                  <View
                    key={skill}
                    className={`pilot-skill-chip ${active ? 'pilot-skill-chip-active' : ''}`}
                    onClick={() => toggleSkill(skill)}
                  >
                    <Text
                      className={`pilot-skill-text ${active ? 'pilot-skill-text-active' : ''}`}
                    >
                      {skill}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>

          <View
            className={`pilot-save-btn ${saving ? 'pilot-save-disabled' : ''}`}
            onClick={handleSave}
          >
            <Text className='pilot-save-text'>{saving ? '保存中...' : '保存接单设置'}</Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
