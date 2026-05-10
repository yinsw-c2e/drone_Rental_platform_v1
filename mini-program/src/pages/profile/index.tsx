// @ts-nocheck
import Taro, { useDidShow } from '@tarojs/taro';
import React, { useCallback, useMemo, useState } from 'react';
import { Image, ScrollView, Text, View } from '@tarojs/components';
import { useDispatch, useSelector } from 'react-redux';

import { demandV2Service } from '../../services/demandV2';
import { dispatchV2Service } from '../../services/dispatchV2';
import { droneService } from '../../services/drone';
import { orderV2Service } from '../../services/orderV2';
import { ownerService } from '../../services/owner';
import { pilotV2Service } from '../../services/pilotV2';
import { sessionService } from '../../services/session';
import { userService } from '../../services/user';
import { logout, setMeSummary, updateUser } from '../../store/slices/authSlice';
import { RootState } from '../../store/store';
import { getEffectiveRoleSummary } from '../../utils/roleSummary';
import { syncCustomTabBar } from '../../utils/tabBar';
import profileBgImage from '../../assets/mine/images/mine_profile_drone_bg_750x330.png';
import defaultAvatarImage from '../../assets/mine/images/default_avatar_circle.png';
import cellOrderIcon from '../../assets/mine/icons/cell_order.png';
import cellTaskIcon from '../../assets/mine/icons/cell_task.png';
import cellArchiveIcon from '../../assets/mine/icons/cell_archive.png';
import cellLockIcon from '../../assets/mine/icons/cell_lock.png';
import cellFlyerIcon from '../../assets/mine/icons/cell_flyer.png';
import cellEditIcon from '../../assets/mine/icons/cell_edit.png';
import cellSettingIcon from '../../assets/mine/icons/cell_setting.png';
import identityUserIcon from '../../assets/mine/icons/identity_user.png';
import identityOwnerIcon from '../../assets/mine/icons/identity_owner.png';
import identityDroneIcon from '../../assets/mine/icons/identity_drone.png';
import logoutIcon from '../../assets/mine/icons/logout.png';
import chevronRightIcon from '../../assets/mine/icons/chevron_right.png';
import chevronDownIcon from '../../assets/mine/icons/chevron_down.png';
import chipCheckIcon from '../../assets/mine/icons/chip_check.png';
import chipStarIcon from '../../assets/mine/icons/chip_star.png';
import './index.scss';

const VERIFY_META = {
  approved: { label: '已实名', tone: 'green' },
  pending: { label: '审核中', tone: 'orange' },
  rejected: { label: '未通过', tone: 'red' },
  unverified: { label: '未实名', tone: 'gray' },
};

const readTotal = (payload: any) =>
  Number(payload?.meta?.total || payload?.total || payload?.data?.total || 0);

const getVerifyMeta = (status?: string) =>
  VERIFY_META[status || 'unverified'] || VERIFY_META.unverified;

const getRoleTone = (enabled: boolean, pendingTone: 'orange' | 'gray' = 'gray') =>
  (enabled ? 'green' : pendingTone) as 'green' | 'orange' | 'gray';

const getMenuIcon = (key: string) => {
  switch (key) {
    case 'my-orders':
      return cellOrderIcon;
    case 'my-demands':
    case 'my-quotes':
      return cellTaskIcon;
    case 'client-profile':
      return cellArchiveIcon;
    case 'verify':
      return cellLockIcon;
    case 'owner-profile':
      return identityOwnerIcon;
    case 'pilot-profile':
    case 'pilot-register':
      return cellFlyerIcon;
    case 'my-offers':
      return cellTaskIcon;
    case 'my-drones':
      return identityDroneIcon;
    case 'edit-profile':
      return cellEditIcon;
    case 'settings':
      return cellSettingIcon;
    default:
      return cellArchiveIcon;
  }
};

const getMenuTone = (key: string) => {
  switch (key) {
    case 'my-orders':
      return 'blue';
    case 'my-demands':
    case 'my-quotes':
      return 'teal';
    case 'verify':
    case 'owner-profile':
      return 'green';
    case 'pilot-profile':
    case 'pilot-register':
    case 'my-drones':
      return 'blue';
    case 'my-offers':
      return 'teal';
    case 'edit-profile':
      return 'purple';
    case 'settings':
      return 'gray';
    default:
      return 'blue';
  }
};

const getStatusTextTone = (text?: string) => {
  if (!text) return 'gray';
  if (text.includes('去') || text.includes('待') || text.includes('补齐')) return 'blue';
  if (text.includes('未')) return 'gray';
  if (text.includes('审核')) return 'orange';
  if (text.includes('实名') || text.includes('就绪') || text.includes('认证') || text.includes('建立')) return 'green';
  return 'gray';
};

const getRoleBadgeIcon = (label: string) => {
  if (label.includes('客户')) return identityUserIcon;
  if (label.includes('机主')) return identityOwnerIcon;
  return identityDroneIcon;
};

export default function ProfilePage() {
  const dispatch = useDispatch();
  const user = useSelector((state: RootState) => state.auth.user);
  const roleSummary = useSelector((state: RootState) => state.auth.roleSummary);
  const effectiveRoleSummary = getEffectiveRoleSummary(roleSummary, user);

  const [stats, setStats] = useState({
    orders: 0,
    demands: 0,
    supplies: 0,
    quotes: 0,
    drones: 0,
    bindings: 0,
    pendingDispatches: 0,
    flightRecords: 0,
  });
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    const summary = getEffectiveRoleSummary(roleSummary, user);

    try {
      const [
        profileRes,
        meRes,
        orderRes,
        demandRes,
        supplyRes,
        quoteRes,
        droneRes,
        bindingRes,
        dispatchRes,
        flightRes,
      ] = await Promise.all([
        userService.getProfile().catch(() => null),
        sessionService.getMe().catch(() => null),
        orderV2Service.list({ page: 1, page_size: 1 }).catch(() => null),
        summary.has_client_role
          ? demandV2Service.listMyDemands({ page: 1, page_size: 1 }).catch(() => null)
          : Promise.resolve(null),
        summary.has_owner_role
          ? ownerService.listMySupplies({ page: 1, page_size: 1 }).catch(() => null)
          : Promise.resolve(null),
        summary.has_owner_role
          ? ownerService.listMyQuotes({ page: 1, page_size: 1 }).catch(() => null)
          : Promise.resolve(null),
        summary.has_owner_role
          ? droneService.myDrones({ page: 1, page_size: 100 }).catch(() => null)
          : Promise.resolve(null),
        summary.has_owner_role
          ? ownerService.listPilotBindings({ status: 'active', page: 1, page_size: 1 }).catch(() => null)
          : Promise.resolve(null),
        summary.has_pilot_role
          ? dispatchV2Service.list({ role: 'pilot', status: 'pending_response', page: 1, page_size: 1 }).catch(() => null)
          : Promise.resolve(null),
        summary.has_pilot_role
          ? pilotV2Service.listFlightRecords({ page: 1, page_size: 1 }).catch(() => null)
          : Promise.resolve(null),
      ]);

      if (profileRes) {
        dispatch(updateUser(profileRes));
      }
      if (meRes) {
        dispatch(setMeSummary(meRes));
      }

      setStats({
        orders: readTotal(orderRes),
        demands: readTotal(demandRes),
        supplies: readTotal(supplyRes),
        quotes: readTotal(quoteRes),
        drones: Number(droneRes?.list?.length || droneRes?.total || 0),
        bindings: readTotal(bindingRes),
        pendingDispatches: readTotal(dispatchRes),
        flightRecords: readTotal(flightRes),
      });
    } finally {
      setLoading(false);
    }
  }, [dispatch, roleSummary, user]);

  useDidShow(() => {
    syncCustomTabBar(2);
    loadData();
  });

  const handleNavigate = (url: string) => {
    Taro.navigateTo({ url });
  };

  const handleAvatarPress = async () => {
    if (uploading) {
      return;
    }

    try {
      const action = await Taro.showActionSheet({
        itemList: ['拍照', '从相册选择'],
      });
      const sourceType = action.tapIndex === 0 ? ['camera'] : ['album'];
      const chooseRes = await Taro.chooseImage({
        count: 1,
        sizeType: ['compressed'],
        sourceType,
      });
      const filePath = chooseRes.tempFilePaths?.[0];
      if (!filePath) {
        return;
      }

      setUploading(true);
      const avatarUrl = await userService.uploadAvatar(filePath);
      if (avatarUrl) {
        dispatch(updateUser({ avatar_url: avatarUrl }));
        Taro.showToast({ title: '头像已更新', icon: 'success' });
      }
    } catch (error: any) {
      if (error?.errMsg?.includes('cancel')) {
        return;
      }
      Taro.showToast({ title: error?.message || '更新失败', icon: 'none' });
    } finally {
      setUploading(false);
    }
  };

  const handleLogout = () => {
    Taro.showModal({
      title: '退出登录',
      content: '确定要退出当前账号吗？',
      success: (res) => {
        if (!res.confirm) {
          return;
        }
        dispatch(logout());
        Taro.reLaunch({ url: '/pages/auth/login/index' });
      },
    });
  };

  const verifyInfo = getVerifyMeta(user?.id_verified);

  const accountHighlights = useMemo(
    () => [
      { label: '订单', value: stats.orders, screen: '/pages/orders/index' },
      { label: '任务', value: stats.demands, screen: '/pages/profile/my-demands/index' },
      { label: '服务', value: stats.supplies, screen: '/pages/profile/my-offers/index' },
    ],
    [stats],
  );

  const menuGroups = useMemo(() => {
    const orderItems = [
      {
        key: 'my-orders',
        title: '我的订单',
        desc: '查看下单、履约和结算进度',
        icon: '📋',
        screen: '/pages/orders/index',
        rightText: `${stats.orders} 单`,
      },
    ];

    if (effectiveRoleSummary.has_client_role) {
      orderItems.push({
        key: 'my-demands',
        title: '我的任务',
        desc: '需求发布、询价与转单记录',
        icon: '📝',
        screen: '/pages/profile/my-demands/index',
        rightText: `${stats.demands} 个`,
      });
    }

    if (effectiveRoleSummary.has_owner_role) {
      orderItems.push({
        key: 'my-quotes',
        title: '我的报价',
        desc: '已发送方案与成交跟进',
        icon: '💬',
        screen: '/pages/profile/my-quotes/index',
        rightText: `${stats.quotes} 条`,
      });
    }

    const identityItems = [
      {
        key: 'client-profile',
        title: '客户档案',
        desc: '联系人、地址和任务偏好',
        icon: '👔',
        screen: '/pages/client/profile/index',
        rightText: effectiveRoleSummary.has_client_role ? '已就绪' : '待补齐',
      },
      {
        key: 'verify',
        title: '实名认证',
        desc: '账号实名与资料校验',
        icon: '🔒',
        screen: '/pages/verification/index',
        rightText: verifyInfo.label,
      },
    ];

    if (effectiveRoleSummary.has_owner_role) {
      identityItems.push({
        key: 'owner-profile',
        title: '机主档案',
        desc: '资产、服务与履约资料',
        icon: '🧭',
        screen: '/pages/profile/owner/index',
        rightText: '已建立',
      });
    }

    identityItems.push({
      key: effectiveRoleSummary.has_pilot_role ? 'pilot-profile' : 'pilot-register',
      title: effectiveRoleSummary.has_pilot_role ? '飞手中心' : '飞手认证',
      desc: effectiveRoleSummary.has_pilot_role ? '接单状态、统计与服务范围' : '完成认证后才能接正式派单',
      icon: effectiveRoleSummary.has_pilot_role ? '🎮' : '🪪',
      screen: effectiveRoleSummary.has_pilot_role
        ? '/pages/profile/pilot/index'
        : '/pages/pilot/register/index',
      rightText: effectiveRoleSummary.has_pilot_role ? '已认证' : '去认证',
    });

    const assetItems = [];
    if (effectiveRoleSummary.has_owner_role) {
      assetItems.push(
        {
          key: 'my-offers',
          title: '我的服务',
          desc: '上架、暂停和草稿中的服务',
          icon: '📦',
          screen: '/pages/profile/my-offers/index',
          rightText: `${stats.supplies} 个`,
        },
        {
          key: 'my-drones',
          title: '我的无人机',
          desc: '设备、资质和可用状态',
          icon: '🛩️',
          screen: '/pages/profile/drones/index',
          rightText: `${stats.drones} 架`,
        },
      );
    }

    const settingItems = [
      {
        key: 'edit-profile',
        title: '编辑资料',
        desc: '昵称、头像和基础信息',
        icon: '✏️',
        screen: '/pages/edit-profile/index',
      },
      {
        key: 'settings',
        title: '设置',
        desc: '账号与通知偏好',
        icon: '⚙️',
        screen: '/pages/settings/index',
      },
    ];

    return [
      { key: 'orders', title: '订单与任务', items: orderItems },
      { key: 'identity', title: '身份与能力', items: identityItems },
      { key: 'assets', title: '资产与服务', items: assetItems },
      { key: 'settings', title: '账户设置', items: settingItems },
    ].filter((group) => group.items.length > 0);
  }, [effectiveRoleSummary, stats, verifyInfo.label]);

  const roleBadges = useMemo(
    () => [
      {
        label: effectiveRoleSummary.has_client_role ? '客户已持有' : '客户待补齐',
        tone: getRoleTone(effectiveRoleSummary.has_client_role, 'orange'),
      },
      {
        label: effectiveRoleSummary.has_owner_role ? '机主已持有' : '机主未建立',
        tone: getRoleTone(effectiveRoleSummary.has_owner_role),
      },
      {
        label: effectiveRoleSummary.has_pilot_role ? '飞手已认证' : '飞手未认证',
        tone: getRoleTone(effectiveRoleSummary.has_pilot_role),
      },
    ],
    [effectiveRoleSummary],
  );

  const identityCards = useMemo(
    () => [
      {
        key: 'client',
        label: '客户身份',
        screen: '/pages/client/profile/index',
        statusLabel: effectiveRoleSummary.has_client_role ? '已持有' : '待补齐',
        statusTone: effectiveRoleSummary.has_client_role ? 'green' : 'orange',
        lines: [
          `我的任务 ${stats.demands}`,
          `我的订单 ${stats.orders}`,
          effectiveRoleSummary.has_client_role
            ? '默认客户档案已启用，可继续维护常用地址。'
            : '完善客户档案后，可更顺畅地发布任务。',
        ],
      },
      {
        key: 'owner',
        label: '机主身份',
        screen: '/pages/profile/owner/index',
        statusLabel: effectiveRoleSummary.has_owner_role ? '已建立' : '未建立',
        statusTone: effectiveRoleSummary.has_owner_role ? 'green' : 'gray',
        lines: [
          `可用无人机 ${stats.drones}`,
          `在线服务 ${stats.supplies}`,
          `协作飞手 ${stats.bindings}`,
        ],
      },
      {
        key: 'pilot',
        label: '飞手身份',
        screen: effectiveRoleSummary.has_pilot_role
          ? '/pages/profile/pilot/index'
          : '/pages/pilot/register/index',
        statusLabel: effectiveRoleSummary.has_pilot_role ? '已认证' : '未认证',
        statusTone: effectiveRoleSummary.has_pilot_role ? 'green' : 'gray',
        lines: [
          `待响应派单 ${stats.pendingDispatches}`,
          `真实飞行记录 ${stats.flightRecords}`,
          effectiveRoleSummary.has_pilot_role
            ? '飞手档案已建立，可继续管理在线状态。'
            : '完成认证后，才能响应正式派单。',
        ],
      },
    ],
    [effectiveRoleSummary, stats],
  );

  const capabilityItems = useMemo(
    () => [
      { key: 'supply', label: '可发布供给', enabled: effectiveRoleSummary.can_publish_supply },
      { key: 'dispatch', label: '可接派单', enabled: effectiveRoleSummary.can_accept_dispatch },
      { key: 'self-execute', label: '可自执行', enabled: effectiveRoleSummary.can_self_execute },
    ],
    [effectiveRoleSummary],
  );

  const canApplySelfExecute =
    effectiveRoleSummary.can_publish_supply && effectiveRoleSummary.can_accept_dispatch;

  return (
    <View className='profile-page'>
      <ScrollView
        scrollY
        className='profile-scroll'
        refresherEnabled
        refresherTriggered={loading}
        onRefresherRefresh={loadData}
      >
        <View className='profile-content'>
          <View className='hero-card'>
            <Image className='hero-bg-image' src={profileBgImage} mode='aspectFill' />
            <Text className='hero-profile-arrow' onClick={() => handleNavigate('/pages/edit-profile/index')}>›</Text>
            <View className='hero-top'>
              <View className='avatar-wrap' onClick={handleAvatarPress}>
                <Image src={user?.avatar_url || defaultAvatarImage} className='avatar-image' mode='aspectFill' />
                <View className='avatar-edit-badge'>
                  <Text className='avatar-edit-text'>{uploading ? '上传中' : '编辑'}</Text>
                </View>
              </View>

              <View className='hero-body'>
                <Text className='hero-name' onClick={() => handleNavigate('/pages/edit-profile/index')}>
                  {user?.nickname || '未设置昵称'}
                </Text>
                <Text className='hero-phone'>{user?.phone || '未绑定手机号'}</Text>
                <View className='hero-badge-row'>
                  <View className={`hero-chip hero-chip-${verifyInfo.tone}`}>
                    <Image className='hero-chip-icon' src={chipCheckIcon} mode='aspectFit' />
                    <Text className='hero-chip-text'>{verifyInfo.label}</Text>
                  </View>
                  <View className='hero-chip hero-chip-blue'>
                    <Image className='hero-chip-icon' src={chipStarIcon} mode='aspectFit' />
                    <Text className='hero-chip-text'>{`信用分 ${user?.credit_score ?? 100}`}</Text>
                  </View>
                </View>
              </View>
            </View>

            <View className='hero-divider' />
            <View className='hero-stats-row'>
              {accountHighlights.map((item) => (
                <View
                  key={item.label}
                  className='hero-stat-item'
                  onClick={() => handleNavigate(item.screen)}
                >
                  <Text className='hero-stat-value'>{item.value}</Text>
                  <Text className='hero-stat-label'>{item.label}</Text>
                </View>
              ))}
            </View>
          </View>

          {menuGroups.map((group) => (
            <View key={group.key} className='group-block'>
              <Text className='group-title'>{group.title}</Text>
              <View className='group-body'>
                {group.items.map((item, index) => (
                  <View
                    key={item.key}
                    className={`menu-row ${index === group.items.length - 1 ? 'menu-row-last' : ''}`}
                    onClick={() => handleNavigate(item.screen)}
                  >
                    <View className={`menu-icon-wrap menu-icon-wrap-${getMenuTone(item.key)}`}>
                      <Image className='menu-icon-img' src={getMenuIcon(item.key)} mode='aspectFit' />
                    </View>
                    <View className='menu-main'>
                      <Text className='menu-title'>{item.title}</Text>
                      {item.desc ? <Text className='menu-desc'>{item.desc}</Text> : null}
                    </View>
                    {item.rightText ? (
                      <Text className={`menu-right-text menu-right-text-${getStatusTextTone(item.rightText)}`}>
                        {item.rightText}
                      </Text>
                    ) : null}
                    <Image className='menu-chevron-img' src={chevronRightIcon} mode='aspectFit' />
                  </View>
                ))}
              </View>
            </View>
          ))}

          <View className='section-card'>
            <Text className='section-title'>身份概览</Text>
            <View className='role-badge-wrap'>
              {roleBadges.map((item) => (
                <View key={item.label} className={`role-overview-chip role-overview-chip-${item.tone}`}>
                  <Image className='role-overview-icon' src={getRoleBadgeIcon(item.label)} mode='aspectFit' />
                  <Text className='role-overview-text'>{item.label}</Text>
                </View>
              ))}
            </View>
          </View>

          <View className='fold-toggle' onClick={() => setShowAdvanced((prev) => !prev)}>
            <Text className='fold-toggle-text'>身份与能力详情</Text>
            <View className='fold-toggle-right'>
              <Text className='fold-toggle-state'>{showAdvanced ? '收起' : '展开'}</Text>
              <Image className={`fold-toggle-icon ${showAdvanced ? 'fold-toggle-icon-open' : ''}`} src={chevronDownIcon} mode='aspectFit' />
            </View>
          </View>

          {showAdvanced ? (
            <>
              <View className='advanced-section'>
                <Text className='advanced-title'>身份详情</Text>
                <View className='advanced-card'>
                  {identityCards.map((card, index) => (
                    <View
                      key={card.key}
                      className={`advanced-row ${index === identityCards.length - 1 ? 'advanced-row-last' : ''}`}
                      onClick={() => handleNavigate(card.screen)}
                    >
                      <View className={`advanced-icon-wrap advanced-icon-wrap-${card.key === 'owner' ? 'blue' : card.key === 'pilot' ? 'teal' : 'green'}`}>
                        <Image
                          className='advanced-icon-img'
                          src={card.key === 'client' ? identityUserIcon : card.key === 'owner' ? identityOwnerIcon : identityDroneIcon}
                          mode='aspectFit'
                        />
                      </View>
                      <Text className='advanced-row-title'>{card.label}</Text>
                      <View className={`advanced-status advanced-status-${card.statusTone}`}>
                        <Text className='advanced-status-text'>{card.statusLabel}</Text>
                      </View>
                      <Image className='advanced-chevron-img' src={chevronRightIcon} mode='aspectFit' />
                    </View>
                  ))}
                </View>
              </View>

              <View className='advanced-section advanced-section-compact'>
                <Text className='advanced-title'>能力状态</Text>
                <View className='advanced-card'>
                  {capabilityItems.map((item, index) => (
                    <View
                      key={item.key}
                      className={`advanced-row ${index === capabilityItems.length - 1 ? 'advanced-row-last' : ''}`}
                    >
                      <View className={`advanced-icon-wrap capability-icon-wrap ${item.enabled ? 'capability-icon-wrap-ready' : ''}`}>
                        <Text className={`capability-dot ${item.enabled ? 'capability-dot-ready' : ''}`}>
                          {item.enabled ? '✓' : '•'}
                        </Text>
                      </View>
                      <Text className='advanced-row-title'>{item.label}</Text>
                      <View className={`advanced-status ${item.enabled ? 'advanced-status-green' : 'advanced-status-gray'}`}>
                        <Text className='advanced-status-text'>{item.enabled ? '已就绪' : '未就绪'}</Text>
                      </View>
                    </View>
                  ))}
                </View>
                <Text className='capability-note'>
                  {canApplySelfExecute
                    ? '你已经同时具备发布供给和接派单能力，可在机主档案里继续配置自执行。'
                    : '要实现机主自执行，需要同时具备发布供给和接正式派单两种能力。'}
                </Text>
              </View>
            </>
          ) : null}

          <View className='logout-wrap'>
            <View className='logout-btn' onClick={handleLogout}>
              <Image className='logout-icon' src={logoutIcon} mode='aspectFit' />
              <Text className='logout-text'>退出登录</Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
