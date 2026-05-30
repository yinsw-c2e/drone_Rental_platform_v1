import Taro from '@tarojs/taro';
import React, { useMemo, useState } from 'react';
import { Image, Input, Picker, ScrollView, Text, Textarea, View } from '@tarojs/components';
import { getClientEligibility } from '../../../services/client';
import { demandV2Service } from '../../../services/demandV2';
import { AddressData } from '../../../types';
import backIcon from '../../../assets/publish-task/icons/back.png';
import calendarIcon from '../../../assets/publish-task/icons/calendar.png';
import checkCircleIcon from '../../../assets/publish-task/icons/check_circle.png';
import chevronDownIcon from '../../../assets/publish-task/icons/chevron_down.png';
import chevronRightIcon from '../../../assets/publish-task/icons/chevron_right.png';
import clipboardImage from '../../../assets/publish-task/images/clipboard_illustration.png';
import clockIcon from '../../../assets/publish-task/icons/clock.png';
import lightbulbIcon from '../../../assets/publish-task/icons/lightbulb.png';
import lockIcon from '../../../assets/publish-task/icons/lock.png';
import pinBlueIcon from '../../../assets/publish-task/icons/pin_blue.png';
import shieldIcon from '../../../assets/publish-task/icons/shield.png';
import truckImage from '../../../assets/publish-task/images/truck_illustration.png';
import weightBagIcon from '../../../assets/publish-task/icons/weight_bag.png';
import { friendlyErrorMessage } from '../../../utils/errorMessage';
import './index.scss';

const SCENE_OPTIONS = [
  { key: 'power_grid', label: '电网建设' },
  { key: 'mountain_agriculture', label: '山区农副产品' },
  { key: 'plateau_supply', label: '高原给养' },
  { key: 'island_supply', label: '海岛补给' },
  { key: 'emergency', label: '应急救援' },
];

function buildDefaultStart() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(9, 0, 0, 0);
  return d;
}

function buildDefaultEnd(start: Date) {
  const d = new Date(start);
  d.setHours(17, 0, 0, 0);
  return d;
}

function formatDateTime(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const h = String(date.getHours()).padStart(2, '0');
  const mi = String(date.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${d} ${h}:${mi}`;
}

function parseDateInput(value: string) {
  const d = new Date(value.trim().replace(/-/g, '/'));
  return Number.isNaN(d.getTime()) ? null : d;
}

const splitDateTimeValue = (value: string) => {
  const [date = '', time = ''] = String(value || '').split(/\s+/);
  return { date, time };
};

const formatAddress = (addr?: AddressData | null) =>
  addr?.address || addr?.name || '';

const toAddressSnapshot = (addr?: AddressData | null) =>
  addr
    ? {
        text: formatAddress(addr),
        province: addr.province,
        city: addr.city,
        district: addr.district,
        latitude: addr.latitude,
        longitude: addr.longitude,
      }
    : undefined;

export default function PublishDemandPage() {
  const [step, setStep] = useState<1 | 2>(1);
  const [submitting, setSubmitting] = useState(false);

  const [title, setTitle] = useState('');
  const [cargoScene, setCargoScene] = useState(SCENE_OPTIONS[0].key);
  const [customCargoScene, setCustomCargoScene] = useState('');
  const [serviceAddress, setServiceAddress] = useState<AddressData | null>(null);
  const [cargoWeight, setCargoWeight] = useState('');
  const [cargoLength, setCargoLength] = useState('');
  const [cargoWidth, setCargoWidth] = useState('');
  const [cargoHeight, setCargoHeight] = useState('');

  const [tripCount, setTripCount] = useState('1');
  const [budgetMin, setBudgetMin] = useState('');
  const [budgetMax, setBudgetMax] = useState('');
  const [description, setDescription] = useState('');

  const defaultStart = useMemo(() => buildDefaultStart(), []);
  const defaultEnd = useMemo(() => buildDefaultEnd(defaultStart), [defaultStart]);
  const [startTime, setStartTime] = useState(() => formatDateTime(defaultStart));
  const [endTime, setEndTime] = useState(() => formatDateTime(defaultEnd));

  const startParts = splitDateTimeValue(startTime);
  const endParts = splitDateTimeValue(endTime);

  const handleBack = () => {
    const pages = Taro.getCurrentPages();
    if (pages.length > 1) {
      Taro.navigateBack();
      return;
    }
    Taro.switchTab({ url: '/pages/home/index' });
  };

  const chooseServiceAddress = async () => {
    try {
      const res = await Taro.chooseLocation({});
      if (res && (res.name || res.address)) {
        setServiceAddress({
          name: res.name || res.address,
          address: res.address || res.name,
          latitude: res.latitude,
          longitude: res.longitude,
        });
      }
    } catch {
      // 用户取消选点时不打扰。
    }
  };

  const updateSchedulePart = (target: 'start' | 'end', part: 'date' | 'time', value: string) => {
    const current = splitDateTimeValue(target === 'start' ? startTime : endTime);
    const fallback = splitDateTimeValue(formatDateTime(target === 'start' ? defaultStart : defaultEnd));
    const date = part === 'date' ? value : current.date || fallback.date;
    const time = part === 'time' ? value : current.time || fallback.time;
    const nextValue = `${date} ${time}`;

    if (target === 'start') {
      setStartTime(nextValue);
    } else {
      setEndTime(nextValue);
    }
  };

  const getPayload = () => {
    const lengthCM = Number(cargoLength);
    const widthCM = Number(cargoWidth);
    const heightCM = Number(cargoHeight);
    const effectiveCargoScene = customCargoScene.trim() || cargoScene;
    const payload: any = {
      title: title.trim(),
      service_type: 'heavy_cargo_lift_transport' as const,
      cargo_scene: effectiveCargoScene,
      description: description.trim() || undefined,
      service_address: toAddressSnapshot(serviceAddress),
      cargo_weight_kg: Number(cargoWeight),
      estimated_trip_count: Math.max(Number(tripCount) || 1, 1),
      budget_min: budgetMin ? Math.round(Number(budgetMin) * 100) : undefined,
      budget_max: budgetMax ? Math.round(Number(budgetMax) * 100) : undefined,
      allows_pilot_candidate: true,
      scheduled_start_at: parseDateInput(startTime)?.toISOString(),
      scheduled_end_at: parseDateInput(endTime)?.toISOString(),
    };
    if (lengthCM > 0) payload.cargo_length_cm = lengthCM;
    if (widthCM > 0) payload.cargo_width_cm = widthCM;
    if (heightCM > 0) payload.cargo_height_cm = heightCM;
    if (lengthCM > 0 && widthCM > 0 && heightCM > 0) {
      payload.cargo_volume_m3 = lengthCM * widthCM * heightCM / 1000000;
    }
    return payload;
  };

  const validateBaseInfo = () => {
    if (!title.trim()) {
      Taro.showToast({ title: '请输入需求标题', icon: 'none' });
      return false;
    }
    if (!serviceAddress) {
      Taro.showToast({ title: '请选择服务地址', icon: 'none' });
      return false;
    }
    if (!(Number(cargoWeight) > 0)) {
      Taro.showToast({ title: '请填写有效的货物重量', icon: 'none' });
      return false;
    }
    return true;
  };

  const validateSchedule = () => {
    const start = parseDateInput(startTime);
    const end = parseDateInput(endTime);
    if (!start || !end) {
      Taro.showToast({ title: '请填写正确的作业时间', icon: 'none' });
      return false;
    }
    if (start <= new Date()) {
      Taro.showToast({ title: '开始时间需要晚于当前时间', icon: 'none' });
      return false;
    }
    if (end <= start) {
      Taro.showToast({ title: '结束时间必须晚于开始时间', icon: 'none' });
      return false;
    }
    return true;
  };

  const handleNextStep = () => {
    if (!validateBaseInfo()) return;
    setStep(2);
  };

  const handleSaveDraft = async () => {
    if (!title.trim()) {
      Taro.showToast({ title: '至少填写标题才能保存草稿', icon: 'none' });
      return;
    }

    setSubmitting(true);
    try {
      await demandV2Service.create(getPayload());
      Taro.showToast({ title: '草稿已保存', icon: 'success' });
      setTimeout(() => Taro.navigateBack(), 1200);
    } catch (e: any) {
      Taro.showToast({ title: friendlyErrorMessage(e, '保存失败'), icon: 'none' });
    } finally {
      setSubmitting(false);
    }
  };

  const checkEligibility = async () => {
    try {
      const eligibility = await getClientEligibility();
      if (eligibility.can_publish_demand) return true;

      const blocker = eligibility.blockers?.[0];
      if (blocker?.suggested_action === 'verify_identity') {
        const res = await Taro.showModal({
          title: '请先完成实名认证',
          content: blocker.message || '完成实名认证后即可发布需求。',
          confirmText: '去认证',
        });
        if (res.confirm) Taro.navigateTo({ url: '/pages/verification/index' });
      } else {
        Taro.showToast({ title: blocker?.message || '当前暂不可发布', icon: 'none' });
      }
      return false;
    } catch (e: any) {
      Taro.showToast({ title: friendlyErrorMessage(e, '资格检查失败'), icon: 'none' });
      return false;
    }
  };

  const handlePublish = async () => {
    if (!validateBaseInfo() || !validateSchedule()) return;

    setSubmitting(true);
    try {
      const eligible = await checkEligibility();
      if (!eligible) return;

      const created = await demandV2Service.create(getPayload());
      const demandId = (created as any).id || (created as any).data?.id;
      await demandV2Service.publish(demandId);
      Taro.showToast({ title: '发布成功', icon: 'success' });
      setTimeout(() => Taro.navigateBack(), 1200);
    } catch (e: any) {
      Taro.showToast({ title: friendlyErrorMessage(e, '发布失败'), icon: 'none' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View className="pt-page">
      <View className="pt-navbar">
        <View className="pt-nav-left" onClick={handleBack}>
          <Image className="pt-back-icon" src={backIcon} mode="aspectFit" />
        </View>
        <Text className="pt-nav-title">发布任务</Text>
        <View className="pt-nav-right" />
      </View>

      <View className="pt-stepper">
        <View className="pt-step-track">
          <View className="pt-step-item">
            <View className={`pt-step-node ${step >= 1 ? 'is-active' : ''}`}>
              <Text>{step === 1 ? '1' : '✓'}</Text>
            </View>
            <Text className={`pt-step-label ${step >= 1 ? 'is-active' : ''}`}>基础信息</Text>
          </View>
          <View className={`pt-step-line ${step === 2 ? 'is-complete' : ''}`} />
          <View className="pt-step-item">
            <View className={`pt-step-node ${step === 2 ? 'is-active' : ''}`}>
              <Text>2</Text>
            </View>
            <Text className={`pt-step-label ${step === 2 ? 'is-active' : ''}`}>运输细节</Text>
          </View>
        </View>
      </View>

      <ScrollView scrollY className="pt-scroll">
        <View className="pt-body">
          {step === 1 ? (
            <View className="pt-card">
              <Image className="pt-card-ill" src={clipboardImage} mode="aspectFit" />
              <Text className="pt-card-title">第 1/2 步：基础信息</Text>

              <View className="pt-field">
                <View className="pt-label-row">
                  <Text className="pt-label">需求标题</Text>
                  <Text className="pt-required">*</Text>
                </View>
                <Input
                  className="pt-input"
                  placeholder="例如：山区电网建设塔材吊运"
                  placeholderClass="pt-placeholder"
                  value={title}
                  onInput={e => setTitle(e.detail.value)}
                />
              </View>

              <View className="pt-field">
                <View className="pt-label-row">
                  <Text className="pt-label">作业场景</Text>
                  <Text className="pt-required">*</Text>
                </View>
                <View className="pt-scene-row">
                  {SCENE_OPTIONS.map(opt => {
                    const active = !customCargoScene.trim() && cargoScene === opt.key;
                    return (
                      <View
                        key={opt.key}
                        className={`pt-pill ${active ? 'is-active' : ''}`}
                        onClick={() => {
                          setCargoScene(opt.key);
                          setCustomCargoScene('');
                        }}
                      >
                        <Text>{opt.label}</Text>
                        {active ? <Image src={checkCircleIcon} className="pt-pill-check" mode="aspectFit" /> : null}
                      </View>
                    );
                  })}
                </View>
                <Input
                  className="pt-input pt-input-other"
                  placeholder="其他场景，可直接填写"
                  placeholderClass="pt-placeholder"
                  value={customCargoScene}
                  onInput={e => setCustomCargoScene(e.detail.value)}
                />
              </View>

              <View className="pt-field">
                <View className="pt-label-row">
                  <Text className="pt-label">服务地址</Text>
                  <Text className="pt-required">*</Text>
                </View>
                <View className="pt-input pt-input-with-icon" onClick={chooseServiceAddress}>
                  <View className="pt-input-iconbox">
                    <Image src={pinBlueIcon} mode="aspectFit" />
                  </View>
                  <Text className={`pt-field-value ${serviceAddress ? '' : 'is-placeholder'}`}>
                    {formatAddress(serviceAddress) || '点击选择主要作业地址'}
                  </Text>
                  <Image src={chevronRightIcon} className="pt-input-arrow" mode="aspectFit" />
                </View>
              </View>

              <View className="pt-field">
                <View className="pt-label-row">
                  <Text className="pt-label">货物重量（kg）</Text>
                  <Text className="pt-required">*</Text>
                </View>
                <View className="pt-input pt-input-with-icon">
                  <View className="pt-input-iconbox">
                    <Image src={weightBagIcon} mode="aspectFit" />
                  </View>
                  <Input
                    className="pt-inner-input"
                    type="digit"
                    placeholder="例如：80"
                    placeholderClass="pt-placeholder"
                    value={cargoWeight}
                    onInput={e => setCargoWeight(e.detail.value)}
                  />
                  <Text className="pt-unit">kg</Text>
                </View>
              </View>

              <View className="pt-field">
                <View className="pt-label-row">
                  <Text className="pt-label">货物尺寸（cm，可选）</Text>
                </View>
                <View className="pt-size-row">
                  <View className="pt-size-input">
                    <Text className="pt-size-prefix">长</Text>
                    <Input className="pt-size-control" type="digit" placeholder="请输入" placeholderClass="pt-placeholder" value={cargoLength} onInput={e => setCargoLength(e.detail.value)} />
                    <Text className="pt-unit">cm</Text>
                  </View>
                  <View className="pt-size-input">
                    <Text className="pt-size-prefix">宽</Text>
                    <Input className="pt-size-control" type="digit" placeholder="请输入" placeholderClass="pt-placeholder" value={cargoWidth} onInput={e => setCargoWidth(e.detail.value)} />
                    <Text className="pt-unit">cm</Text>
                  </View>
                  <View className="pt-size-input">
                    <Text className="pt-size-prefix">高</Text>
                    <Input className="pt-size-control" type="digit" placeholder="请输入" placeholderClass="pt-placeholder" value={cargoHeight} onInput={e => setCargoHeight(e.detail.value)} />
                    <Text className="pt-unit">cm</Text>
                  </View>
                </View>
              </View>

              <View className="pt-tip">
                <Image src={lightbulbIcon} mode="aspectFit" />
                <View className="pt-tip-content">
                  <Text className="pt-tip-title">草稿提示</Text>
                  <Text className="pt-tip-text">可以先保存草稿，之后在“我的需求”里继续补充和发布。</Text>
                </View>
              </View>

              <View className="pt-actions pt-actions-two">
                <View className={`pt-btn pt-btn-outline ${submitting ? 'is-disabled' : ''}`} onClick={handleSaveDraft}>
                  <Text>保存草稿</Text>
                </View>
                <View className="pt-btn pt-btn-primary" onClick={handleNextStep}>
                  <Text>下一步</Text>
                </View>
              </View>
            </View>
          ) : (
            <View className="pt-card pt-card-step2">
              <Image className="pt-card-ill pt-card-ill-truck" src={truckImage} mode="aspectFit" />
              <Text className="pt-card-title">第 2/2 步：运输细节与说明</Text>

              <View className="pt-field">
                <View className="pt-label-row">
                  <Text className="pt-label">预计架次</Text>
                </View>
                <View className="pt-input pt-input-select">
                  <Input
                    className="pt-inner-input"
                    type="digit"
                    placeholder="默认 1 架次"
                    placeholderClass="pt-placeholder"
                    value={tripCount}
                    onInput={e => setTripCount(e.detail.value)}
                  />
                  <Image src={chevronDownIcon} className="pt-input-arrow" mode="aspectFit" />
                </View>
              </View>

              <View className="pt-field">
                <View className="pt-label-row">
                  <Text className="pt-label">预约开始时间</Text>
                  <Text className="pt-required">*</Text>
                </View>
                <View className="pt-date-row">
                  <Picker mode="date" value={startParts.date} onChange={e => updateSchedulePart('start', 'date', e.detail.value)}>
                    <View className="pt-date-input">
                      <Image src={calendarIcon} mode="aspectFit" />
                      <Text>{startParts.date}</Text>
                    </View>
                  </Picker>
                  <Picker mode="time" value={startParts.time} onChange={e => updateSchedulePart('start', 'time', e.detail.value)}>
                    <View className="pt-date-input">
                      <Image src={clockIcon} mode="aspectFit" />
                      <Text>{startParts.time}</Text>
                    </View>
                  </Picker>
                </View>
              </View>

              <View className="pt-field">
                <View className="pt-label-row">
                  <Text className="pt-label">预约结束时间</Text>
                  <Text className="pt-required">*</Text>
                </View>
                <View className="pt-date-row">
                  <Picker mode="date" value={endParts.date} onChange={e => updateSchedulePart('end', 'date', e.detail.value)}>
                    <View className="pt-date-input">
                      <Image src={calendarIcon} mode="aspectFit" />
                      <Text>{endParts.date}</Text>
                    </View>
                  </Picker>
                  <Picker mode="time" value={endParts.time} onChange={e => updateSchedulePart('end', 'time', e.detail.value)}>
                    <View className="pt-date-input">
                      <Image src={clockIcon} mode="aspectFit" />
                      <Text>{endParts.time}</Text>
                    </View>
                  </Picker>
                </View>
              </View>

              <View className="pt-field">
                <View className="pt-label-row">
                  <Text className="pt-label">预算范围（元）</Text>
                </View>
                <View className="pt-budget-row">
                  <Input className="pt-budget-input" type="digit" placeholder="最低" placeholderClass="pt-placeholder" value={budgetMin} onInput={e => setBudgetMin(e.detail.value)} />
                  <Text className="pt-budget-dash">-</Text>
                  <Input className="pt-budget-input" type="digit" placeholder="最高" placeholderClass="pt-placeholder" value={budgetMax} onInput={e => setBudgetMax(e.detail.value)} />
                </View>
              </View>

              <View className="pt-field">
                <View className="pt-label-row">
                  <Text className="pt-label">需求说明</Text>
                </View>
                <View className="pt-textarea-wrap">
                  <Textarea
                    className="pt-textarea"
                    maxlength={500}
                    placeholder="补充货物类型、现场条件、时效要求等"
                    placeholderClass="pt-placeholder"
                    value={description}
                    onInput={e => setDescription(e.detail.value)}
                  />
                  <Text className="pt-count">{description.length}/500</Text>
                </View>
              </View>

              <View className="pt-tip">
                <Image src={shieldIcon} mode="aspectFit" />
                <View className="pt-tip-content">
                  <Text className="pt-tip-title">温馨提示</Text>
                  <Text className="pt-tip-text">请尽量提供详细信息，有助于服务商更精准地为您报价与服务。</Text>
                </View>
              </View>

              <View className="pt-actions pt-actions-three">
                <View className="pt-btn pt-btn-muted" onClick={() => setStep(1)}>
                  <Text>上一步</Text>
                </View>
                <View className={`pt-btn pt-btn-outline ${submitting ? 'is-disabled' : ''}`} onClick={handleSaveDraft}>
                  <Text>保存草稿</Text>
                </View>
                <View className={`pt-btn pt-btn-primary ${submitting ? 'is-disabled' : ''}`} onClick={handlePublish}>
                  <Text>{submitting ? '发布中...' : '确认发布'}</Text>
                </View>
              </View>

              <View className="pt-safe-note">
                <Image src={lockIcon} mode="aspectFit" />
                <Text>您的信息将严格保密，仅用于本次任务撮合服务</Text>
              </View>
            </View>
          )}
          <View className="pt-bottom-space" />
        </View>
      </ScrollView>
    </View>
  );
}
