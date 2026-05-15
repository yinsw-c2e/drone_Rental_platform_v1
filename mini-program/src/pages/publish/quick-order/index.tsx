import Taro from '@tarojs/taro';
import React, { useEffect, useState } from 'react';
import { Image, Input, Picker, ScrollView, Text, View } from '@tarojs/components';

import {
  AirspaceCheckResult,
  airspaceService,
} from '../../../services/airspace';
import { getClientEligibility } from '../../../services/client';
import { supplyService } from '../../../services/supply';
import { AddressData, DirectOrderInput, SupplySummary } from '../../../types';
import { isAirspaceHardBlocked } from '../../../utils/airspaceRisk';
import backIcon from '../../../assets/quick-order/icons/back.png';
import calendarIcon from '../../../assets/quick-order/icons/calendar.png';
import checkCircleIcon from '../../../assets/quick-order/icons/check_circle.png';
import chevronDownIcon from '../../../assets/quick-order/icons/chevron_down.png';
import chevronRightIcon from '../../../assets/quick-order/icons/chevron_right.png';
import clockIcon from '../../../assets/quick-order/icons/clock.png';
import cubeIcon from '../../../assets/quick-order/icons/cube.png';
import gridIcon from '../../../assets/quick-order/icons/grid.png';
import pinEndIcon from '../../../assets/quick-order/icons/pin_end.png';
import pinStartIcon from '../../../assets/quick-order/icons/pin_start.png';
import rulerIcon from '../../../assets/quick-order/icons/ruler.png';
import targetIcon from '../../../assets/quick-order/icons/target.png';
import weightBagIcon from '../../../assets/quick-order/icons/weight_bag.png';
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

const splitDateTimeValue = (value: string) => {
  const [date = '', time = ''] = String(value || '').split(/\s+/);
  return { date, time };
};

const toAddressSnapshot = (addr: AddressData) => ({
  text: formatAddress(addr),
  latitude: addr.latitude,
  longitude: addr.longitude,
});

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
  const [customCargoScene, setCustomCargoScene] = useState('');
  const [cargoWeight, setCargoWeight] = useState('');
  const [cargoLength, setCargoLength] = useState('');
  const [cargoWidth, setCargoWidth] = useState('');
  const [cargoHeight, setCargoHeight] = useState('');
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
  const effectiveCargoScene = customCargoScene.trim() || cargoScene;

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
      // 用户取消选点或地图不可用时不注入测试地址。
    }
  };

  const resolveDirectSupplyId = async (weightKG: number) => {
    if (targetSupplyId > 0) {
      return targetSupplyId;
    }

    const res = await supplyService.list({
      page: 1,
      page_size: 10,
      accepts_direct_order: true,
      service_type: 'heavy_cargo_lift_transport',
      cargo_scene: effectiveCargoScene,
      min_payload_kg: weightKG,
    });
    const items = ((res as any).items || []) as SupplySummary[];
    const matched = items.find((item) => {
      const scenes = item.cargo_scenes || [];
      return item.accepts_direct_order &&
        Number(item.max_payload_kg || 0) >= weightKG &&
        (scenes.length === 0 || scenes.includes(effectiveCargoScene));
    });

    if (!matched) {
      throw new Error('暂无匹配的直达服务，请改为发布任务');
    }
    return matched.id;
  };

  const openNoFlyDetails = (addr?: AddressData | null) => {
    if (!addr?.latitude || !addr?.longitude) {
      return;
    }
    Taro.navigateTo({
      url: `/pages/airspace/no-fly/index?latitude=${addr.latitude}&longitude=${addr.longitude}`,
    });
  };

  const handleBack = () => {
    const pages = Taro.getCurrentPages();
    if (pages.length > 1) {
      Taro.navigateBack();
      return;
    }
    Taro.switchTab({ url: '/pages/home/index' });
  };

  const startParts = splitDateTimeValue(startTime);
  const endParts = splitDateTimeValue(endTime);

  const setSchedulePart = (
    type: 'start' | 'end',
    part: 'date' | 'time',
    value: string,
  ) => {
    const current = type === 'start' ? startParts : endParts;
    const nextDate = part === 'date' ? value : current.date;
    const nextTime = part === 'time' ? value : current.time;
    const nextValue = `${nextDate || buildDefaultTime(0).slice(0, 10)} ${nextTime || '09:00'}`;
    if (type === 'start') {
      setStartTime(nextValue);
    } else {
      setEndTime(nextValue);
    }
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
    try {
      const eligibility = await getClientEligibility();
      if (!eligibility.can_create_direct_order) {
        const blocker = eligibility.blockers?.[0];
        if (blocker?.suggested_action === 'verify_identity') {
          const res = await Taro.showModal({
            title: '请先完成实名认证',
            content: blocker.message || '完成实名认证后即可直达下单。',
            confirmText: '去认证',
            cancelText: '稍后再说',
          });
          if (res.confirm) {
            Taro.navigateTo({ url: '/pages/verification/index' });
          }
        } else {
          Taro.showToast({ title: blocker?.message || '当前暂不可下单', icon: 'none' });
        }
        return;
      }
    } catch (error: any) {
      return Taro.showToast({ title: error?.message || '资格检查失败', icon: 'none' });
    }

    setSubmitting(true);
    try {
      const weightKG = Number(cargoWeight);
      const lengthCM = Number(cargoLength);
      const widthCM = Number(cargoWidth);
      const heightCM = Number(cargoHeight);
      const supplyId = await resolveDirectSupplyId(weightKG);
      const payload: DirectOrderInput = {
        service_type: 'heavy_cargo_lift_transport',
        cargo_scene: effectiveCargoScene,
        cargo_type: cargoType.trim() || '重载物资',
        cargo_weight_kg: weightKG,
        departure_address: toAddressSnapshot(pickupAddress),
        destination_address: toAddressSnapshot(deliveryAddress),
        service_address: toAddressSnapshot(pickupAddress),
        scheduled_start_at: startDate.toISOString(),
        scheduled_end_at: endDate.toISOString(),
        description: `${formatAddress(pickupAddress)} 到 ${formatAddress(deliveryAddress)}吊运`,
      };
      if (lengthCM > 0) payload.cargo_length_cm = lengthCM;
      if (widthCM > 0) payload.cargo_width_cm = widthCM;
      if (heightCM > 0) payload.cargo_height_cm = heightCM;
      if (lengthCM > 0 && widthCM > 0 && heightCM > 0) {
        payload.cargo_volume_m3 = lengthCM * widthCM * heightCM / 1000000;
      }

      const result = await supplyService.createDirectOrder(supplyId, payload);
      Taro.showToast({ title: '下单成功，待确认', icon: 'success' });
      setTimeout(() => {
        Taro.redirectTo({ url: `/pages/orders/detail/index?orderId=${result.order_id}` })
          .catch(() => Taro.switchTab({ url: '/pages/home/index' }));
      }, 1500);
    } catch (e: any) {
      Taro.showToast({ title: e.message || '下单失败', icon: 'none' });
    } finally {
      setSubmitting(false);
    }
  };

  const renderAddressBlock = (
    type: 'pickup' | 'delivery',
    title: string,
    icon: string,
    address: AddressData | null,
    checking: boolean,
    result: AirspaceCheckResult | null,
    error: string,
  ) => {
    const hasAddress = Boolean(address);
    const isBlocked = isAirspaceHardBlocked(result);
    const showNote = hasAddress || checking || Boolean(error);
    return (
      <View className='qo-field-block'>
        <View className='qo-field-title-row'>
          <Image className='qo-field-icon' src={icon} mode='aspectFit' />
          <Text className='qo-field-title'>{title}</Text>
          <Text className='qo-required'>*</Text>
        </View>
        <View className='qo-large-input' onClick={() => handleChooseLocation(type)}>
          <Text className={`qo-address-text ${hasAddress ? '' : 'qo-placeholder'}`}>
            {formatAddress(address) || '选择地址后自动检测空域'}
          </Text>
          <View className='qo-input-right'>
            <Image className='qo-right-icon' src={chevronRightIcon} mode='aspectFit' />
            <View className='qo-right-divider' />
            <View
              className='qo-target-btn'
              onClick={(e: any) => {
                e.stopPropagation();
                openNoFlyDetails(address);
              }}
            >
              <Image className='qo-target-icon' src={targetIcon} mode='aspectFit' />
            </View>
          </View>
        </View>
        {showNote ? (
          <View
            className={`qo-airspace-note ${isBlocked ? 'qo-airspace-note-danger' : error ? 'qo-airspace-note-warning' : ''}`}
            onClick={() => openNoFlyDetails(address)}
          >
            <Text className='qo-airspace-note-text'>
              {checking
                ? `${title.replace('地址', '')}空域检测中...`
                : getAirspaceLabel(result, hasAddress, error)}
            </Text>
            {hasAddress ? <Text className='qo-airspace-note-link'>详情</Text> : null}
          </View>
        ) : null}
      </View>
    );
  };

  const renderScheduleRow = (
    title: string,
    type: 'start' | 'end',
    parts: { date: string; time: string },
  ) => (
    <View className='qo-schedule-row'>
      <View className='qo-left-label-row qo-calendar-label'>
        <Image className='qo-field-icon' src={calendarIcon} mode='aspectFit' />
        <Text className='qo-field-title'>{title}</Text>
        <Text className='qo-required'>*</Text>
      </View>
      <View className='qo-date-time-wrap'>
        <Picker mode='date' value={parts.date} onChange={(e) => setSchedulePart(type, 'date', String(e.detail.value || ''))}>
          <View className='qo-date-input'>
            <Text className='qo-value qo-date-text'>{parts.date || '请选择日期'}</Text>
            <Image className='qo-small-side-icon' src={calendarIcon} mode='aspectFit' />
          </View>
        </Picker>
        <Picker mode='time' value={parts.time} onChange={(e) => setSchedulePart(type, 'time', String(e.detail.value || ''))}>
          <View className='qo-time-input'>
            <Text className='qo-value qo-time-text'>{parts.time || '时间'}</Text>
            <Image className='qo-small-side-icon' src={clockIcon} mode='aspectFit' />
          </View>
        </Picker>
      </View>
    </View>
  );

  return (
    <View className='qo-page'>
      <View className='qo-navbar'>
        <View className='qo-nav-side'>
          <View className='qo-nav-back' onClick={handleBack}>
            <Image className='qo-back-icon' src={backIcon} mode='aspectFit' />
          </View>
        </View>
        <Text className='qo-nav-title'>快速下单</Text>
        <View className='qo-nav-side qo-nav-side-right' />
      </View>

      <ScrollView scrollY className='qo-scroll'>
        <View className='qo-body'>
          <View className='qo-form-card'>
            {renderAddressBlock('pickup', '起点地址', pinStartIcon, pickupAddress, checkingPickup, pickupAirspace, pickupAirspaceError)}
            {renderAddressBlock('delivery', '终点地址', pinEndIcon, deliveryAddress, checkingDelivery, deliveryAirspace, deliveryAirspaceError)}

            <View className='qo-split-row'>
              <View className='qo-left-label-row'>
                <Image className='qo-field-icon' src={weightBagIcon} mode='aspectFit' />
                <Text className='qo-field-title'>货物重量</Text>
                <Text className='qo-required'>*</Text>
              </View>
              <View className='qo-inline-input'>
                <Input
                  className='qo-inline-input-field'
                  type='digit'
                  placeholder='请输入重量'
                  placeholderClass='qo-input-placeholder'
                  value={cargoWeight}
                  onInput={(e) => setCargoWeight(e.detail.value)}
                />
                <Text className='qo-unit'>kg</Text>
              </View>
            </View>

            <View className='qo-split-row qo-split-row-gap'>
              <View className='qo-left-label-row'>
                <Image className='qo-field-icon' src={cubeIcon} mode='aspectFit' />
                <Text className='qo-field-title'>货物类型</Text>
                <Text className='qo-required'>*</Text>
              </View>
              <View className='qo-inline-input qo-select-input'>
                <Input
                  className='qo-inline-input-field qo-cargo-type-input'
                  placeholder='重载物资'
                  placeholderClass='qo-input-placeholder'
                  value={cargoType}
                  onInput={(e) => setCargoType(e.detail.value)}
                />
                <Image className='qo-down-icon' src={chevronDownIcon} mode='aspectFit' />
              </View>
            </View>

            <View className='qo-field-block qo-dim-block'>
              <View className='qo-field-title-row'>
                <Image className='qo-field-icon' src={rulerIcon} mode='aspectFit' />
                <Text className='qo-field-title'>货物尺寸（cm，可选）</Text>
              </View>
              <View className='qo-dim-row'>
                <View className='qo-dim-input'>
                  <Text className='qo-dim-prefix'>长</Text>
                  <Input className='qo-dim-native-input' type='digit' placeholder='请输入' placeholderClass='qo-input-placeholder' value={cargoLength} onInput={(e) => setCargoLength(e.detail.value)} />
                </View>
                <View className='qo-dim-input'>
                  <Text className='qo-dim-prefix'>宽</Text>
                  <Input className='qo-dim-native-input' type='digit' placeholder='请输入' placeholderClass='qo-input-placeholder' value={cargoWidth} onInput={(e) => setCargoWidth(e.detail.value)} />
                </View>
                <View className='qo-dim-input'>
                  <Text className='qo-dim-prefix'>高</Text>
                  <Input className='qo-dim-native-input' type='digit' placeholder='请输入' placeholderClass='qo-input-placeholder' value={cargoHeight} onInput={(e) => setCargoHeight(e.detail.value)} />
                </View>
              </View>
            </View>

            <View className='qo-field-block qo-scene-block'>
              <View className='qo-field-title-row'>
                <Image className='qo-field-icon' src={gridIcon} mode='aspectFit' />
                <Text className='qo-field-title'>作业场景</Text>
                <Text className='qo-required'>*</Text>
              </View>
              <View className='qo-scene-row'>
                {SCENE_OPTIONS.map((s) => {
                  const active = !customCargoScene.trim() && cargoScene === s.key;
                  return (
                    <View
                      key={s.key}
                      className={`qo-scene-pill ${active ? 'is-active' : ''}`}
                      onClick={() => {
                        setCargoScene(s.key);
                        setCustomCargoScene('');
                      }}
                    >
                      <Text className={`qo-scene-text ${active ? 'active' : ''}`}>{s.label}</Text>
                      {active ? <Image className='qo-check-icon' src={checkCircleIcon} mode='aspectFit' /> : null}
                    </View>
                  );
                })}
              </View>
              <Input
                className='qo-other-input'
                placeholder='其他场景，可直接填写'
                placeholderClass='qo-input-placeholder'
                value={customCargoScene}
                onInput={(e) => setCustomCargoScene(e.detail.value)}
              />
            </View>

            <View className='qo-schedule-block'>
              {renderScheduleRow('预计开始', 'start', startParts)}
              <View className='qo-schedule-row-gap'>
                {renderScheduleRow('预计结束', 'end', endParts)}
              </View>
            </View>
          </View>

          {hasAirspaceHardBlock ? (
            <Text className='qo-blocked-hint'>当前起飞点或降落点命中禁飞限制，请先更换地址后再下单。</Text>
          ) : null}

          <View className='qo-bottom-spacer' />
        </View>
      </ScrollView>

      <View className='qo-bottom-bar'>
        <View className={`qo-submit-btn ${(submitting || hasAirspaceHardBlock) ? 'disabled' : ''}`} onClick={handleSubmit}>
          <Text className='qo-submit-btn-text'>{submitting ? '提交中...' : '立即下单'}</Text>
        </View>
      </View>
    </View>
  );
}
