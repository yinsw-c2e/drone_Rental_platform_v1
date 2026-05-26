import Taro, { useDidShow } from '@tarojs/taro';
import React, { useState } from 'react';
import { Input, ScrollView, Text, View } from '@tarojs/components';

import {
  AirspaceApplication,
  CreateApplicationRequest,
  airspaceService,
} from '../../services/airspace';
import { pilotV2Service } from '../../services/pilotV2';
import { AddressData } from '../../types';
import { formatUnknownEnumLabel } from '../../utils';
import DateTimeField from '../../components/DateTimeField';
import './index.scss';

const PURPOSE_OPTIONS = [
  { label: '货物运输', value: 'cargo_delivery' },
  { label: '航拍测绘', value: 'aerial_mapping' },
  { label: '农业植保', value: 'agriculture' },
  { label: '巡检监测', value: 'inspection' },
  { label: '应急救援', value: 'emergency' },
  { label: '训练飞行', value: 'training' },
];

const STATUS_MAP: Record<string, { label: string; tone: string }> = {
  draft: { label: '草稿', tone: 'gray' },
  pending_review: { label: '待审核', tone: 'orange' },
  approved: { label: '已批准', tone: 'green' },
  rejected: { label: '已拒绝', tone: 'red' },
  submitted_to_uom: { label: '已提交 UOM', tone: 'blue' },
  cancelled: { label: '已取消', tone: 'gray' },
};

const getTomorrowTime = (hourOffset = 0) => {
  const date = new Date(Date.now() + 24 * 60 * 60 * 1000 + hourOffset * 60 * 60 * 1000);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const h = String(hourOffset ? 11 : 9).padStart(2, '0');
  return `${y}-${m}-${d} ${h}:00`;
};

const parseDateInput = (value: string) => {
  const normalized = value.trim().replace(/-/g, '/');
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
};

const formatAddress = (addr?: AddressData | null) =>
  addr?.address || addr?.name || '';

export default function AirspacePage() {
  const params = Taro.getCurrentInstance().router?.params || {};
  const routeDroneId = Number(params.droneId || 0);
  const routeOrderId = Number(params.orderId || 0);

  const [mode, setMode] = useState<'list' | 'create'>('list');
  const [applications, setApplications] = useState<AirspaceApplication[]>([]);
  const [pilotId, setPilotId] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [planName, setPlanName] = useState('');
  const [purpose, setPurpose] = useState('cargo_delivery');
  const [departureAddr, setDepartureAddr] = useState<AddressData | null>(null);
  const [arrivalAddr, setArrivalAddr] = useState<AddressData | null>(null);
  const [maxAltitude, setMaxAltitude] = useState('120');
  const [startTime, setStartTime] = useState(getTomorrowTime(0));
  const [endTime, setEndTime] = useState(getTomorrowTime(2));
  const [routeDesc, setRouteDesc] = useState('');

  const loadApplications = async (nextPilotId = pilotId) => {
    if (!nextPilotId) {
      setApplications([]);
      setLoading(false);
      setRefreshing(false);
      return;
    }
    try {
      const result = await airspaceService.listMyApplications(nextPilotId);
      setApplications(result.data || []);
    } catch (error: any) {
      Taro.showToast({ title: error?.message || '加载报备失败', icon: 'none' });
      setApplications([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const profile = await pilotV2Service.getProfile();
      const nextPilotId = Number((profile as any)?.id || 0);
      setPilotId(nextPilotId);
      await loadApplications(nextPilotId);
    } catch {
      setPilotId(0);
      setApplications([]);
      setLoading(false);
      setRefreshing(false);
    }
  };

  useDidShow(() => {
    loadData();
  });

  const chooseLocation = async (type: 'departure' | 'arrival') => {
    try {
      const res = await Taro.chooseLocation({});
      if (!res?.name && !res?.address) {
        return;
      }
      const addr: AddressData = {
        name: res.name || res.address,
        address: res.address || res.name,
        latitude: res.latitude,
        longitude: res.longitude,
      };
      if (type === 'departure') {
        setDepartureAddr(addr);
      } else {
        setArrivalAddr(addr);
      }
    } catch {
      // 用户取消选点时保持原值。
    }
  };

  const resetForm = () => {
    setPlanName('');
    setPurpose('cargo_delivery');
    setDepartureAddr(null);
    setArrivalAddr(null);
    setMaxAltitude('120');
    setStartTime(getTomorrowTime(0));
    setEndTime(getTomorrowTime(2));
    setRouteDesc('');
  };

  const handleCreate = async () => {
    if (!pilotId) {
      Taro.showToast({ title: '请先完成履约资质认证', icon: 'none' });
      return;
    }
    if (!planName.trim()) {
      Taro.showToast({ title: '请输入报备名称', icon: 'none' });
      return;
    }
    if (!departureAddr) {
      Taro.showToast({ title: '请选择起飞点', icon: 'none' });
      return;
    }
    if (!arrivalAddr) {
      Taro.showToast({ title: '请选择降落点', icon: 'none' });
      return;
    }
    const startDate = parseDateInput(startTime);
    const endDate = parseDateInput(endTime);
    if (!startDate || !endDate || endDate <= startDate) {
      Taro.showToast({ title: '请填写正确作业时间', icon: 'none' });
      return;
    }

    setSubmitting(true);
    try {
      const payload: CreateApplicationRequest = {
        pilot_id: pilotId,
        drone_id: routeDroneId,
        order_id: routeOrderId || undefined,
        flight_plan_name: planName.trim(),
        flight_purpose: purpose,
        departure_latitude: departureAddr.latitude || 0,
        departure_longitude: departureAddr.longitude || 0,
        departure_address: formatAddress(departureAddr),
        arrival_latitude: arrivalAddr.latitude || 0,
        arrival_longitude: arrivalAddr.longitude || 0,
        arrival_address: formatAddress(arrivalAddr),
        max_altitude: Number(maxAltitude) || 120,
        planned_start_time: startDate.toISOString(),
        planned_end_time: endDate.toISOString(),
        route_description: routeDesc.trim() || undefined,
      };
      await airspaceService.createApplication(payload);
      Taro.showToast({ title: '空域报备已提交存证', icon: 'success' });
      setMode('list');
      resetForm();
      await loadApplications(pilotId);
    } catch (error: any) {
      Taro.showToast({ title: error?.message || '提交失败', icon: 'none' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitReview = (id: number) => {
    Taro.showModal({
      title: '确认报备',
      content: '确定要提交此空域报备进行正式存证与审核吗？提交前将自动进行合规性校验。',
      success: async (res) => {
        if (!res.confirm) {
          return;
        }
        try {
          await airspaceService.submitForReview(id, pilotId);
          Taro.showToast({ title: '已提交存证', icon: 'success' });
          loadApplications(pilotId);
        } catch (error: any) {
          Taro.showToast({ title: error?.message || '提交失败', icon: 'none' });
        }
      },
    });
  };

  const handleCancel = (id: number) => {
    Taro.showModal({
      title: '撤销报备',
      content: '确定要撤销此空域报备申请吗？',
      confirmText: '撤销',
      confirmColor: '#F5222D',
      success: async (res) => {
        if (!res.confirm) {
          return;
        }
        try {
          await airspaceService.cancelApplication(id, pilotId);
          Taro.showToast({ title: '已撤销', icon: 'success' });
          loadApplications(pilotId);
        } catch (error: any) {
          Taro.showToast({ title: error?.message || '操作失败', icon: 'none' });
        }
      },
    });
  };

  if (mode === 'create') {
    return (
      <ScrollView scrollY className='airspace-wrap'>
        <View className='airspace-header'>
          <View className='airspace-back' onClick={() => setMode('list')}>
            <Text className='airspace-back-text'>‹ 取消</Text>
          </View>
          <Text className='airspace-header-title'>新建空域报备</Text>
          <View style={{ width: '60px' }} />
        </View>

        <View className='airspace-form'>
          <View className='card'>
            <Text className='section-title'>基本信息</Text>
            <Text className='airspace-label'>报备名称 *</Text>
            <Input className='airspace-input' placeholder='例如：某项目物资运输空域报备' value={planName} onInput={(e) => setPlanName(e.detail.value)} />

            <Text className='airspace-label'>作业用途 *</Text>
            <View className='airspace-option-row'>
              {PURPOSE_OPTIONS.map((opt) => (
                <View key={opt.value} className={`airspace-option-btn ${purpose === opt.value ? 'airspace-option-active' : ''}`} onClick={() => setPurpose(opt.value)}>
                  <Text className={`airspace-option-text ${purpose === opt.value ? 'airspace-option-text-active' : ''}`}>{opt.label}</Text>
                </View>
              ))}
            </View>
          </View>

          <View className='card'>
            <Text className='section-title'>起降点设置</Text>
            <View className='airspace-address-row' onClick={() => chooseLocation('departure')}>
              <Text className='airspace-address-label'>起飞点 *</Text>
              <Text className={`airspace-address-value ${departureAddr ? '' : 'airspace-placeholder'}`}>{formatAddress(departureAddr) || '点击选择作业起点'}</Text>
            </View>
            <View className='airspace-address-row airspace-address-row-last' onClick={() => chooseLocation('arrival')}>
              <Text className='airspace-address-label'>降落点 *</Text>
              <Text className={`airspace-address-value ${arrivalAddr ? '' : 'airspace-placeholder'}`}>{formatAddress(arrivalAddr) || '点击选择作业终点'}</Text>
            </View>
          </View>

          <View className='card'>
            <Text className='section-title'>作业时间与参数</Text>
            <DateTimeField label='计划开始' value={startTime} onChange={setStartTime} required />
            <DateTimeField label='计划结束' value={endTime} onChange={setEndTime} required />
            <Text className='airspace-label'>最大飞行高度 (米) *</Text>
            <Input className='airspace-input' type='number' placeholder='120' value={maxAltitude} onInput={(e) => setMaxAltitude(e.detail.value)} />
            <Text className='airspace-label'>航线描述 (选填)</Text>
            <Input className='airspace-input airspace-textarea' placeholder='描述大致飞行路径、绕飞障碍物等信息' value={routeDesc} onInput={(e) => setRouteDesc(e.detail.value)} />
          </View>

          <View className={`airspace-submit-btn ${submitting ? 'airspace-submit-disabled' : ''}`} onClick={handleCreate}>
            <Text className='airspace-submit-text'>{submitting ? '提交中...' : '提交空域报备'}</Text>
          </View>
        </View>
      </ScrollView>
    );
  }

  return (
    <View className='airspace-wrap'>
      <View className='airspace-header'>
        <Text className='airspace-header-title'>空域报备管理</Text>
        <View className='airspace-create-btn' onClick={() => setMode('create')}>
          <Text className='airspace-create-text'>+ 新建报备</Text>
        </View>
      </View>

      <ScrollView
        scrollY
        refresherEnabled
        refresherTriggered={refreshing}
        onRefresherRefresh={() => {
          setRefreshing(true);
          loadData();
        }}
      >
        <View className='airspace-list'>
          {loading ? (
            <View className='empty-state'><Text className='empty-state-text'>加载中...</Text></View>
          ) : !pilotId ? (
            <View className='empty-state'>
              <Text className='empty-state-icon'>🪪</Text>
              <Text className='empty-state-text'>请先完成履约资质认证后再办理空域报备</Text>
            </View>
          ) : applications.length === 0 ? (
            <View className='empty-state'>
              <Text className='empty-state-icon'>🗺️</Text>
              <Text className='empty-state-text'>暂无空域报备记录</Text>
            </View>
          ) : applications.map((item) => {
            const status = STATUS_MAP[item.status] || { label: formatUnknownEnumLabel(item.status, '状态未知'), tone: 'gray' };
            return (
              <View key={item.id} className='card airspace-card' onClick={() => Taro.navigateTo({ url: `/pages/compliance/index?applicationId=${item.id}&pilotId=${pilotId}&droneId=${item.drone_id || routeDroneId}` })}>
                <View className='airspace-card-header'>
                  <Text className='airspace-card-title'>{item.flight_plan_name || '未命名报备'}</Text>
                  <View className={`airspace-status airspace-status-${status.tone}`}>
                    <Text className={`airspace-status-text airspace-status-text-${status.tone}`}>{status.label}</Text>
                  </View>
                </View>
                <Text className='airspace-card-info'>用途: {PURPOSE_OPTIONS.find((opt) => opt.value === item.flight_purpose)?.label || formatUnknownEnumLabel(item.flight_purpose, '-')}</Text>
                <Text className='airspace-card-info'>起飞: {item.departure_address || '未设置'}</Text>
                <Text className='airspace-card-info'>降落: {item.arrival_address || '未设置'}</Text>
                <Text className='airspace-card-info'>限高: {item.max_altitude || '-'}m</Text>
                {item.uom_application_no ? <Text className='airspace-card-info'>UOM存证编号: {item.uom_application_no}</Text> : null}
                <View className='airspace-card-footer'>
                  <Text className='airspace-time'>创建: {item.created_at ? new Date(item.created_at).toLocaleDateString() : '-'}</Text>
                  <View className='airspace-action-row'>
                    {item.status === 'draft' ? (
                      <View className='airspace-action-btn airspace-action-primary' onClick={(e) => { e.stopPropagation(); handleSubmitReview(item.id); }}>
                        <Text className='airspace-action-primary-text'>提交存证</Text>
                      </View>
                    ) : null}
                    {item.status === 'draft' || item.status === 'pending_review' ? (
                      <View className='airspace-action-btn airspace-action-ghost' onClick={(e) => { e.stopPropagation(); handleCancel(item.id); }}>
                        <Text className='airspace-action-ghost-text'>{item.status === 'draft' ? '撤销' : '撤回'}</Text>
                      </View>
                    ) : null}
                  </View>
                </View>
              </View>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}
