import Taro from '@tarojs/taro';
import React, { useEffect, useState } from 'react';
import { Input, ScrollView, Text, View } from '@tarojs/components';

import {
  AirspaceCheckResult,
  airspaceService,
} from '../../../services/airspace';
import { demandV2Service } from '../../../services/demandV2';
import { AddressData } from '../../../types';
import { isAirspaceHardBlocked } from '../../../utils/airspaceRisk';
import './index.scss';

const SCENE_OPTIONS = [
  { key: 'power_grid', label: '电网建设' },
  { key: 'mountain_agriculture', label: '山区农副产品' },
  { key: 'plateau_supply', label: '高原给养' },
  { key: 'island_supply', label: '海岛补给' },
  { key: 'emergency', label: '应急救援' },
];

const buildDefaultTime = (hourOffset = 0) => {
  const date = new Date(Date.now() + 24 * 60 * 60 * 1000 + hourOffset * 60 * 60 * 1000);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const h = String(hourOffset ? 11 : 9).padStart(2, '0');
  return `${y}-${m}-${d} ${h}:00`;
};

const parseDateInput = (value: string) => {
  const date = new Date(value.trim().replace(/-/g, '/'));
  return Number.isNaN(date.getTime()) ? null : date;
};

const formatAddress = (addr?: AddressData | null) =>
  addr?.address || addr?.name || '';

const getAirspaceLabel = (result?: AirspaceCheckResult | null, hasAddress = false, error = '') => {
  if (error) {
    return error;
  }
  if (!hasAddress) {
    return '选择地址后自动检测空域';
  }
  if (!result) {
    return '等待自动检测空域';
  }
  if (isAirspaceHardBlocked(result)) {
    return result.recommended_action || result.blocked_reason || '当前位置命中禁飞限制';
  }
  if (result.status === 'warning' || (result.restrictions || []).length > 0) {
    return result.recommended_action || '附近存在限飞/提醒区域，请按要求报备';
  }
  return '空域可用';
};

export default function QuickOrderPage() {
  const params = Taro.getCurrentInstance().router?.params || {};
  const targetSupplyId = Number(params.supplyId || 0);

  const [cargoScene, setCargoScene] = useState(SCENE_OPTIONS[0].key);
  const [cargoWeight, setCargoWeight] = useState('');
  const [cargoType, setCargoType] = useState('重载物资');
  const [pickupAddress, setPickupAddress] = useState<AddressData | null>(null);
  const [deliveryAddress, setDeliveryAddress] = useState<AddressData | null>(null);
  const [startTime, setStartTime] = useState(buildDefaultTime(0));
  const [endTime, setEndTime] = useState(buildDefaultTime(2));
  const [pickupAirspace, setPickupAirspace] = useState<AirspaceCheckResult | null>(null);
  const [deliveryAirspace, setDeliveryAirspace] = useState<AirspaceCheckResult | null>(null);
  const [pickupAirspaceError, setPickupAirspaceError] = useState('');
  const [deliveryAirspaceError, setDeliveryAirspaceError] = useState('');
  const [checkingPickup, setCheckingPickup] = useState(false);
  const [checkingDelivery, setCheckingDelivery] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!pickupAddress?.latitude || !pickupAddress?.longitude) {
      setPickupAirspace(null);
      setPickupAirspaceError('');
      return () => {
        cancelled = true;
      };
    }
    setCheckingPickup(true);
    setPickupAirspaceError('');
    airspaceService.checkAirspaceAvailability(pickupAddress.latitude, pickupAddress.longitude, 120)
      .then((result) => {
        if (!cancelled) {
          setPickupAirspace(result);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setPickupAirspace(null);
          setPickupAirspaceError('空域检测失败，请点详情重试');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setCheckingPickup(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [pickupAddress?.latitude, pickupAddress?.longitude]);

  useEffect(() => {
    let cancelled = false;
    if (!deliveryAddress?.latitude || !deliveryAddress?.longitude) {
      setDeliveryAirspace(null);
      setDeliveryAirspaceError('');
      return () => {
        cancelled = true;
      };
    }
    setCheckingDelivery(true);
    setDeliveryAirspaceError('');
    airspaceService.checkAirspaceAvailability(deliveryAddress.latitude, deliveryAddress.longitude, 120)
      .then((result) => {
        if (!cancelled) {
          setDeliveryAirspace(result);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setDeliveryAirspace(null);
          setDeliveryAirspaceError('空域检测失败，请点详情重试');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setCheckingDelivery(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [deliveryAddress?.latitude, deliveryAddress?.longitude]);

  const hasAirspaceHardBlock =
    isAirspaceHardBlocked(pickupAirspace) || isAirspaceHardBlocked(deliveryAirspace);
  const hasAirspaceCheckError =
    Boolean(pickupAddress && pickupAirspaceError) || Boolean(deliveryAddress && deliveryAirspaceError);

  const handleChooseLocation = async (type: 'pickup' | 'delivery') => {
    try {
      const res = await Taro.chooseLocation({});
      if (res && (res.name || res.address)) {
        const addr: AddressData = {
          name: res.name || res.address,
          address: res.address || res.name,
          latitude: res.latitude,
          longitude: res.longitude,
        };
        if (type === 'pickup') {
          setPickupAddress(addr);
        } else {
          setDeliveryAddress(addr);
        }
      }
    } catch {
      // 用户取消选点时不打扰。
    }
  };

  const openNoFlyDetails = (addr?: AddressData | null) => {
    if (!addr?.latitude || !addr?.longitude) {
      return;
    }
    Taro.navigateTo({
      url: `/pages/airspace/no-fly/index?latitude=${addr.latitude}&longitude=${addr.longitude}`,
    });
  };

  const handleSubmit = async () => {
    if (!cargoWeight || !pickupAddress || !deliveryAddress || !startTime || !endTime) {
      return Taro.showToast({ title: '请完善订单信息', icon: 'none' });
    }
    if (Number(cargoWeight) <= 0) {
      return Taro.showToast({ title: '请填写有效货物重量', icon: 'none' });
    }
    if (checkingPickup || checkingDelivery) {
      return Taro.showToast({ title: '空域检测中，请稍候', icon: 'none' });
    }
    if (hasAirspaceCheckError) {
      return Taro.showToast({ title: '空域检测失败，请先查看详情', icon: 'none' });
    }
    if (hasAirspaceHardBlock) {
      return Taro.showToast({ title: '地址命中禁飞区，请先更换地址', icon: 'none' });
    }
    const startDate = parseDateInput(startTime);
    const endDate = parseDateInput(endTime);
    if (!startDate || !endDate || endDate <= startDate) {
      return Taro.showToast({ title: '请填写正确作业时间', icon: 'none' });
    }

    setSubmitting(true);
    try {
      const payload = {
        title: `${formatAddress(pickupAddress)} 到 ${formatAddress(deliveryAddress)}吊运`,
        service_type: 'heavy_cargo_lift_transport',
        cargo_scene: cargoScene,
        cargo_type: cargoType.trim() || '重载物资',
        cargo_weight_kg: Number(cargoWeight),
        departure_address: {
          text: formatAddress(pickupAddress),
          latitude: pickupAddress.latitude,
          longitude: pickupAddress.longitude,
        },
        destination_address: {
          text: formatAddress(deliveryAddress),
          latitude: deliveryAddress.latitude,
          longitude: deliveryAddress.longitude,
        },
        scheduled_start_at: startDate.toISOString(),
        scheduled_end_at: endDate.toISOString(),
        target_supply_id: targetSupplyId || undefined,
      };

      await demandV2Service.create(payload as any);
      Taro.showToast({ title: '快捷下单成功', icon: 'success' });
      setTimeout(() => {
        Taro.navigateBack({ delta: targetSupplyId ? 2 : 1 }).catch(() => Taro.switchTab({ url: '/pages/home/index' }));
      }, 1500);
    } catch (e: any) {
      Taro.showToast({ title: e.message || '下单失败', icon: 'none' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View className='page-wrap'>
      <ScrollView scrollY className='form-content'>
        <View className='form-group'>
          <Text className='section-title'>第 1 步：填写最小信息</Text>
          <View className='form-item' onClick={() => handleChooseLocation('pickup')}>
            <Text className='form-label'>起点地址 *</Text>
            <Text className={`form-value ${!pickupAddress ? 'placeholder' : ''}`}>{formatAddress(pickupAddress) || '点击选择起点地址 >'}</Text>
          </View>
          <View className={`airspace-line ${isAirspaceHardBlocked(pickupAirspace) ? 'airspace-line-danger' : pickupAirspaceError ? 'airspace-line-warning' : ''}`} onClick={() => openNoFlyDetails(pickupAddress)}>
            <Text className='airspace-line-text'>
              {checkingPickup
                ? '起点空域检测中...'
                : `起点：${getAirspaceLabel(pickupAirspace, Boolean(pickupAddress), pickupAirspaceError)}`}
            </Text>
            {pickupAddress ? <Text className='airspace-line-link'>详情</Text> : null}
          </View>

          <View className='form-item' onClick={() => handleChooseLocation('delivery')}>
            <Text className='form-label'>终点地址 *</Text>
            <Text className={`form-value ${!deliveryAddress ? 'placeholder' : ''}`}>{formatAddress(deliveryAddress) || '点击选择终点地址 >'}</Text>
          </View>
          <View className={`airspace-line ${isAirspaceHardBlocked(deliveryAirspace) ? 'airspace-line-danger' : deliveryAirspaceError ? 'airspace-line-warning' : ''}`} onClick={() => openNoFlyDetails(deliveryAddress)}>
            <Text className='airspace-line-text'>
              {checkingDelivery
                ? '终点空域检测中...'
                : `终点：${getAirspaceLabel(deliveryAirspace, Boolean(deliveryAddress), deliveryAirspaceError)}`}
            </Text>
            {deliveryAddress ? <Text className='airspace-line-link'>详情</Text> : null}
          </View>

          <View className='form-item'>
            <Text className='form-label'>货物重量 *</Text>
            <Input className='form-input' type='digit' placeholder='例如：120' value={cargoWeight} onInput={(e) => setCargoWeight(e.detail.value)} />
          </View>
          <View className='form-item'>
            <Text className='form-label'>货物类型</Text>
            <Input className='form-input' placeholder='例如：塔材、设备箱' value={cargoType} onInput={(e) => setCargoType(e.detail.value)} />
          </View>

          <Text className='form-section-label'>作业场景 *</Text>
          <View className='scene-list'>
            {SCENE_OPTIONS.map((s) => (
              <View key={s.key} className={`scene-chip ${cargoScene === s.key ? 'active' : ''}`} onClick={() => setCargoScene(s.key)}>
                <Text className={`scene-text ${cargoScene === s.key ? 'active-text' : ''}`}>{s.label}</Text>
              </View>
            ))}
          </View>

          <View className='form-item'>
            <Text className='form-label'>预计开始</Text>
            <Input className='form-input' placeholder='例如：2026-05-10 09:00' value={startTime} onInput={(e) => setStartTime(e.detail.value)} />
          </View>
          <View className='form-item border-none'>
            <Text className='form-label'>预计结束</Text>
            <Input className='form-input' placeholder='例如：2026-05-10 11:00' value={endTime} onInput={(e) => setEndTime(e.detail.value)} />
          </View>
        </View>

        {hasAirspaceHardBlock ? (
          <Text className='blocked-hint'>当前起飞点或降落点命中禁飞限制，请先更换地址后再下单。</Text>
        ) : null}

        <View className='btn-wrap'>
          <View className={`btn-primary ${(submitting || hasAirspaceHardBlock) ? 'disabled' : ''}`} onClick={handleSubmit}>
            <Text className='btn-text'>{submitting ? '提交中...' : '立即下单'}</Text>
          </View>
        </View>
        <View className='form-bottom-spacer' />
      </ScrollView>
    </View>
  );
}
