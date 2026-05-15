import Taro, { useDidShow } from '@tarojs/taro';
import React, { useMemo, useState } from 'react';
import { ScrollView, Text, View } from '@tarojs/components';

import {
  AirspaceCheckResult,
  NoFlyZone,
  airspaceService,
} from '../../../services/airspace';
import { formatUnknownEnumLabel } from '../../../utils';
import './index.scss';

const ZONE_TYPE_LABELS: Record<string, string> = {
  airport: '机场净空',
  military: '军事管制',
  no_fly: '禁飞',
  restricted: '限飞',
  temporary: '临时管制',
};

const LEVEL_META: Record<string, { label: string; tone: string }> = {
  no_fly: { label: '禁飞', tone: 'red' },
  blocked: { label: '禁飞', tone: 'red' },
  restricted: { label: '限飞', tone: 'orange' },
  warning: { label: '提醒', tone: 'orange' },
  notice: { label: '提醒', tone: 'blue' },
};

const CHECK_META: Record<string, { title: string; tone: string }> = {
  blocked: { title: '当前位置不可飞行', tone: 'red' },
  warning: { title: '当前位置需留意限制', tone: 'orange' },
  clear: { title: '当前位置空域可用', tone: 'green' },
};

const getFriendlyErrorMessage = (error: any, fallback: string) => {
  const message = String(error?.message || error?.errMsg || '').toLowerCase();
  if (message.includes('authorization') || message.includes('登录') || message.includes('401')) {
    return '登录状态已失效，请重新登录';
  }
  return fallback;
};

const formatRadius = (radius?: number) => {
  const value = Number(radius || 0);
  if (value <= 0) {
    return '-';
  }
  if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}km`;
  }
  return `${Math.round(value)}m`;
};

export default function NoFlyZonePage() {
  const params = Taro.getCurrentInstance().router?.params || {};
  const latitude = Number(params.latitude || 0);
  const longitude = Number(params.longitude || 0);
  const hasLocation = Number.isFinite(latitude) && Number.isFinite(longitude) && latitude !== 0 && longitude !== 0;

  const [zones, setZones] = useState<NoFlyZone[]>([]);
  const [checkResult, setCheckResult] = useState<AirspaceCheckResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [checkError, setCheckError] = useState('');

  const loadZones = async () => {
    setLoading(true);
    setLoadError('');
    try {
      const nextZones = hasLocation
        ? await airspaceService.findNearbyNoFlyZones(latitude, longitude, 50000)
        : (await airspaceService.listNoFlyZones({ status: 'active', page: 1, page_size: 50 })).data;
      setZones(nextZones || []);
    } catch (error: any) {
      const message = getFriendlyErrorMessage(error, '禁飞区加载失败');
      setLoadError(message);
      Taro.showToast({ title: message, icon: 'none' });
      setZones([]);
    } finally {
      setLoading(false);
    }
  };

  const runCheck = async () => {
    if (!hasLocation || checking) {
      return;
    }
    setChecking(true);
    setCheckError('');
    try {
      const result = await airspaceService.checkAirspaceAvailability(latitude, longitude, 120);
      setCheckResult(result);
      if (result.status === 'blocked' || result.available === false) {
        Taro.showToast({ title: '当前位置受限', icon: 'none' });
      } else {
        Taro.showToast({ title: '空域检测完成', icon: 'success' });
      }
    } catch (error: any) {
      const message = getFriendlyErrorMessage(error, '空域检测失败');
      setCheckError(message);
      Taro.showToast({ title: message, icon: 'none' });
    } finally {
      setChecking(false);
    }
  };

  useDidShow(() => {
    loadZones();
    if (hasLocation) {
      runCheck();
    }
  });

  const checkMeta = useMemo(() => {
    if (!checkResult) {
      if (checkError) {
        return { title: '空域检测失败', tone: 'orange' };
      }
      return checking
        ? { title: '正在检测空域', tone: 'blue' }
        : { title: '当前位置待检测', tone: 'blue' };
    }
    const status = String(checkResult?.status || (checkResult?.available ? 'clear' : 'warning')).toLowerCase();
    return CHECK_META[status] || CHECK_META.warning;
  }, [checkResult, checking, checkError]);

  return (
    <View className='nf-wrap'>
      <ScrollView scrollY className='nf-scroll'>
        <View className='nf-content'>
          {hasLocation ? (
            <View className={`nf-check nf-check-${checkMeta.tone}`}>
              <View>
                <Text className='nf-check-title'>{checkMeta.title}</Text>
                <Text className='nf-check-desc'>
                  {checking
                    ? `正在检查坐标 ${latitude.toFixed(5)}, ${longitude.toFixed(5)}`
                    : checkError
                    ? `${checkError}，可点击重新检测`
                    : (checkResult?.recommended_action ||
                      checkResult?.blocked_reason ||
                      `已检测坐标 ${latitude.toFixed(5)}, ${longitude.toFixed(5)}`)}
                </Text>
              </View>
              <View className='nf-check-btn' onClick={runCheck}>
                <Text className='nf-check-btn-text'>{checking ? '检测中' : '重新检测'}</Text>
              </View>
            </View>
          ) : (
            <View className='nf-check nf-check-blue'>
              <Text className='nf-check-title'>禁飞区列表</Text>
              <Text className='nf-check-desc'>未带入具体坐标，当前展示平台内已启用的禁飞/限飞区域。</Text>
            </View>
          )}

          {loading ? (
            <View className='empty-state'>
              <Text className='empty-state-text'>加载中...</Text>
            </View>
          ) : loadError ? (
            <View className='empty-state'>
              <Text className='empty-state-text'>{loadError}</Text>
            </View>
          ) : zones.length === 0 ? (
            <View className='empty-state'>
              <Text className='empty-state-icon'>🗺️</Text>
              <Text className='empty-state-text'>{hasLocation ? '附近暂无禁飞区' : '暂无禁飞区数据'}</Text>
            </View>
          ) : (
            <>
              <Text className='nf-count'>共 {zones.length} 个禁飞区/限飞区</Text>
              {zones.map((zone) => {
                const level = String(zone.restriction_level || '').toLowerCase();
                const meta = LEVEL_META[level] || { label: zone.restriction_level || '限制', tone: 'gray' };
                return (
                  <View key={zone.id} className='nf-card'>
                    <View className='nf-card-header'>
                      <Text className='nf-card-title'>{zone.name}</Text>
                      <View className={`nf-badge nf-badge-${meta.tone}`}>
                        <Text className={`nf-badge-text nf-badge-text-${meta.tone}`}>{meta.label}</Text>
                      </View>
                    </View>
                    <Text className='nf-card-line'>
                      {ZONE_TYPE_LABELS[zone.zone_type] || formatUnknownEnumLabel(zone.zone_type, '空域限制')} · 半径 {formatRadius(zone.radius)}
                    </Text>
                    <Text className='nf-card-line'>
                      限高 {zone.min_altitude || 0}m - {zone.max_altitude || '-'}m
                    </Text>
                    {zone.allowed_with_permit ? (
                      <Text className='nf-card-line'>取得许可后可按要求飞行</Text>
                    ) : null}
                    {zone.description ? <Text className='nf-card-desc'>{zone.description}</Text> : null}
                  </View>
                );
              })}
            </>
          )}
        </View>
      </ScrollView>
    </View>
  );
}
