import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  Alert,
  Image,
  Platform,
  PermissionsAndroid,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {useFocusEffect} from '@react-navigation/native';
import {useDispatch, useSelector} from 'react-redux';
import * as ImagePicker from 'react-native-image-picker';
import type {ImagePickerResponse} from 'react-native-image-picker';

import StatusBadge from '../../components/business/StatusBadge';
import {logout, setMeSummary, updateUser} from '../../store/slices/authSlice';
import {RootState} from '../../store/store';
import {sessionService} from '../../services/session';
import {userService} from '../../services/user';
import {demandV2Service} from '../../services/demandV2';
import {dispatchV2Service} from '../../services/dispatchV2';
import {droneService} from '../../services/drone';
import {orderV2Service} from '../../services/orderV2';
import {ownerService} from '../../services/owner';
import {pilotV2Service} from '../../services/pilotV2';
import {getEffectiveRoleSummary, resolveProviderCapabilities} from '../../utils/roleSummary';
import {useTheme} from '../../theme/ThemeContext';
import type {AppTheme} from '../../theme/index';
import {profileAssets} from '../../assets/miniProgramAssets';

let ActionSheetIOS: any;
if (Platform.OS === 'ios') {
  ActionSheetIOS = require('react-native').ActionSheetIOS;
}

type ProfileStats = {
  orders: number;
  demands: number;
  supplies: number;
  quotes: number;
  drones: number;
  bindings: number;
  pendingDispatches: number;
  flightRecords: number;
};

type ShortcutItem = {
  key: string;
  title: string;
  desc?: string;
  icon: string;
  screen: string;
  rightText?: string;
};

type ShortcutGroup = {
  key: string;
  title: string;
  items: ShortcutItem[];
};

type IdentityItem = {
  key: 'client' | 'owner' | 'pilot';
  label: string;
  heldText: string;
  missingText: string;
  screen: string;
  fallbackScreen?: string;
  actionLabel: string;
  fallbackActionLabel?: string;
};

const VERIFY_STATUS_MAP: Record<string, {label: string; tone: 'green' | 'orange' | 'red' | 'gray'}> = {
  approved: {label: '已实名', tone: 'green'},
  pending: {label: '审核中', tone: 'orange'},
  rejected: {label: '未通过', tone: 'red'},
  unverified: {label: '未实名', tone: 'gray'},
};

const emptyStats: ProfileStats = {
  orders: 0,
  demands: 0,
  supplies: 0,
  quotes: 0,
  drones: 0,
  bindings: 0,
  pendingDispatches: 0,
  flightRecords: 0,
};

const identityCatalog: IdentityItem[] = [
  {
    key: 'client',
    label: '客户身份',
    heldText: '已拥有',
    missingText: '默认档案未就绪',
    screen: 'ClientProfile',
    actionLabel: '客户档案',
  },
  {
    key: 'owner',
    label: '服务商能力',
    heldText: '已拥有',
    missingText: '待建立',
    screen: 'OwnerProfile',
    actionLabel: '服务商资料',
  },
  {
    key: 'pilot',
    label: '履约资质',
    heldText: '已完善',
    missingText: '去完善',
    screen: 'PilotProfile',
    fallbackScreen: 'PilotRegister',
    actionLabel: '履约资质',
    fallbackActionLabel: '履约资质认证',
  },
] as const;

const capabilityCatalog = [
  {
    key: 'publish',
    label: '可发布服务',
    desc: '满足重载准入和关键资质后，可把供给展示到市场。',
  },
  {
    key: 'dispatch',
    label: '可推进履约',
    desc: '通过履约资质审核后，可推进正式订单履约。',
  },
  {
    key: 'selfExecute',
    label: '服务商履约',
    desc: '同时具备设备服务和履约资质后，可由服务商主体直接履约。',
  },
] as const;

const getMenuAsset = (key: string) => {
  switch (key) {
    case 'orders':
      return profileAssets.cellOrder;
    case 'demands':
    case 'quotes':
    case 'offers':
      return profileAssets.cellTask;
    case 'client-profile':
      return profileAssets.cellArchive;
    case 'verify':
      return profileAssets.cellLock;
    case 'owner-profile':
      return profileAssets.identityOwner;
    case 'pilot':
    case 'pilot-register':
      return profileAssets.cellFlyer;
    case 'drones':
      return profileAssets.identityDrone;
    case 'edit':
      return profileAssets.cellEdit;
    case 'settings':
      return profileAssets.cellSetting;
    default:
      return profileAssets.cellArchive;
  }
};

const getIdentityAsset = (key: string) => {
  if (key === 'client') return profileAssets.identityUser;
  if (key === 'owner') return profileAssets.identityOwner;
  return profileAssets.identityDrone;
};

export default function ProfileScreen({navigation}: any) {
  const {theme} = useTheme();
  const styles = getStyles(theme);
  const user = useSelector((state: RootState) => state.auth.user);
  const roleSummary = useSelector((state: RootState) => state.auth.roleSummary);
  const selectedMode = useSelector((state: RootState) => state.role.selectedMode);
  const dispatch = useDispatch();
  const userRef = useRef(user);
  const roleSummaryRef = useRef(roleSummary);
  const selectedModeRef = useRef(selectedMode);
  const loadingRef = useRef(false);

  const [refreshing, setRefreshing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [stats, setStats] = useState<ProfileStats>(emptyStats);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const effectiveRoleSummary = getEffectiveRoleSummary(roleSummary, user);
  const providerCapabilities = useMemo(
    () => resolveProviderCapabilities(effectiveRoleSummary),
    [effectiveRoleSummary],
  );
  const isProviderMode = selectedMode === 'provider';
  const verifyInfo = VERIFY_STATUS_MAP[user?.id_verified || 'unverified'] || VERIFY_STATUS_MAP.unverified;

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  useEffect(() => {
    roleSummaryRef.current = roleSummary;
  }, [roleSummary]);

  useEffect(() => {
    selectedModeRef.current = selectedMode;
  }, [selectedMode]);

  const loadData = useCallback(async () => {
    if (loadingRef.current) {
      setRefreshing(false);
      return;
    }

    loadingRef.current = true;
    const summary = getEffectiveRoleSummary(roleSummaryRef.current, userRef.current);
    const capabilities = resolveProviderCapabilities(summary);
    const isProviderContext = selectedModeRef.current === 'provider';
    const canUseWorkbench = capabilities.canUseWorkbench;
    const shouldLoadProviderAssets =
      isProviderContext ||
      capabilities.hasProviderApplication ||
      capabilities.canManageAssets;
    const shouldLoadProviderBusiness =
      canUseWorkbench &&
      (capabilities.canPublishSupply || capabilities.canArrangeDispatch || capabilities.hasAssetProviderRole);
    const shouldLoadExecutorBusiness = canUseWorkbench && capabilities.hasExecutorRole;
    try {
      const [profileRes, meRes, orderRes, demandRes, supplyRes, quoteRes, droneRes, bindingRes, dispatchRes, flightRes] = await Promise.all([
        userService.getProfile().catch(() => null),
        sessionService.getMe().catch(() => null),
        orderV2Service.list({page: 1, page_size: 1}).catch(() => null),
        summary.has_client_role
          ? demandV2Service.listMyDemands({page: 1, page_size: 1}).catch(() => null)
          : Promise.resolve(null),
        shouldLoadProviderBusiness
          ? ownerService.listMySupplies({page: 1, page_size: 1}).catch(() => null)
          : Promise.resolve(null),
        shouldLoadProviderBusiness
          ? ownerService.listMyQuotes({page: 1, page_size: 1}).catch(() => null)
          : Promise.resolve(null),
        shouldLoadProviderAssets
          ? droneService.myDrones().catch(() => null)
          : Promise.resolve(null),
        shouldLoadProviderBusiness
          ? ownerService.listPilotBindings({status: 'active', page: 1, page_size: 1}).catch(() => null)
          : Promise.resolve(null),
        shouldLoadExecutorBusiness
          ? dispatchV2Service.list({role: 'pilot', status: 'pending_response', page: 1, page_size: 1}).catch(() => null)
          : Promise.resolve(null),
        shouldLoadExecutorBusiness
          ? pilotV2Service.listFlightRecords({page: 1, page_size: 1}).catch(() => null)
          : Promise.resolve(null),
      ]);

      if (profileRes?.data) {
        dispatch(updateUser(profileRes.data));
      }
      if (meRes?.data) {
        dispatch(setMeSummary(meRes.data));
      }

      setStats({
        orders: Number(orderRes?.meta?.total || 0),
        demands: Number(demandRes?.meta?.total || 0),
        supplies: Number(supplyRes?.meta?.total || 0),
        quotes: Number(quoteRes?.meta?.total || 0),
        drones: Number(droneRes?.data?.list?.length || 0),
        bindings: Number(bindingRes?.meta?.total || 0),
        pendingDispatches: Number(dispatchRes?.meta?.total || 0),
        flightRecords: Number(flightRes?.meta?.total || 0),
      });
    } finally {
      loadingRef.current = false;
      setRefreshing(false);
    }
  }, [dispatch]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData]),
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
  }, [loadData]);

  const handleAvatarPress = () => {
    const options = ['拍照', '从相册选择', '取消'];
    if (Platform.OS === 'ios' && ActionSheetIOS) {
      ActionSheetIOS.showActionSheetWithOptions(
        {options, cancelButtonIndex: 2},
        (index: number) => {
          if (index === 0) {
            pickImage('camera');
          } else if (index === 1) {
            pickImage('library');
          }
        },
      );
      return;
    }

    Alert.alert('更换头像', '选择头像来源', [
      {text: '拍照', onPress: () => pickImage('camera')},
      {text: '从相册选择', onPress: () => pickImage('library')},
      {text: '取消', style: 'cancel'},
    ]);
  };

  const pickImage = async (source: 'camera' | 'library') => {
    if (source === 'camera' && Platform.OS === 'android') {
      const granted = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.CAMERA);
      if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
        Alert.alert('权限不足', '请在设置中允许使用相机');
        return;
      }
    }
    const options = {
      mediaType: 'photo' as const,
      maxWidth: 512,
      maxHeight: 512,
      quality: 0.8 as const,
    };

    const callback = async (response: ImagePickerResponse) => {
      if (response.didCancel || response.errorCode) {
        return;
      }
      const asset = response.assets?.[0];
      if (!asset?.uri) {
        return;
      }

      setUploading(true);
      try {
        const formData = new FormData();
        formData.append('file', {
          uri: asset.uri,
          type: asset.type || 'image/jpeg',
          name: asset.fileName || 'avatar.jpg',
        } as any);
        const res = await userService.uploadAvatar(formData);
        if (res.data?.url) {
          dispatch(updateUser({avatar_url: res.data.url}));
          Alert.alert('成功', '头像已更新');
        }
      } catch {
        Alert.alert('失败', '头像上传失败，请重试');
      } finally {
        setUploading(false);
      }
    };

    if (source === 'camera') {
      ImagePicker.launchCamera?.(options, callback);
      return;
    }
    ImagePicker.launchImageLibrary?.(options, callback);
  };

  const providerStatusText = useMemo(() => {
    if (providerCapabilities.canUseWorkbench) return '已开通';
    if (providerCapabilities.providerStatus === 'pending_review') return '审核中';
    if (providerCapabilities.providerStatus === 'rejected') return '未通过';
    if (providerCapabilities.providerStatus === 'suspended') return '已暂停';
    return '未入驻';
  }, [providerCapabilities.canUseWorkbench, providerCapabilities.providerStatus]);

  const accountHighlights = useMemo(() => {
    const thirdItem = isProviderMode
      ? {
          label: providerCapabilities.canUseWorkbench ? '服务' : '资质',
          value: providerCapabilities.canUseWorkbench ? stats.supplies : providerCapabilities.hasProviderApplication ? 1 : 0,
          screen: providerCapabilities.canUseWorkbench ? 'OwnerProfile' : 'ProviderOnboarding',
        }
      : {
          label: '资质',
          value: providerCapabilities.hasProviderApplication ? 1 : 0,
          screen: providerCapabilities.canUseWorkbench ? 'OwnerProfile' : 'ProviderOnboarding',
        };
    return [
      {label: '订单', value: stats.orders, screen: 'MyOrders'},
      {label: '任务', value: stats.demands, screen: 'MyDemands'},
      thirdItem,
    ];
  }, [
    isProviderMode,
    providerCapabilities.canUseWorkbench,
    providerCapabilities.hasProviderApplication,
    stats.demands,
    stats.orders,
    stats.supplies,
  ]);

  const identityCards = useMemo(() => {
    const summary = effectiveRoleSummary;
    return identityCatalog.map(item => {
      const hasRole =
        item.key === 'client'
          ? summary.has_client_role
          : item.key === 'owner'
            ? providerCapabilities.hasProviderApplication || providerCapabilities.canUseWorkbench
            : providerCapabilities.hasExecutorRole || providerCapabilities.executorStatus !== 'none';

      const screen = item.key === 'owner' && !providerCapabilities.canUseWorkbench
        ? 'ProviderOnboarding'
        : hasRole ? item.screen : item.fallbackScreen || item.screen;
      const actionLabel = hasRole ? item.actionLabel : item.fallbackActionLabel || item.actionLabel;

      let lines: string[] = [];
      if (item.key === 'client') {
        lines = [
          `我的任务 ${stats.demands}`,
          `我的订单 ${stats.orders}`,
          hasRole ? '默认个人客户档案可直接使用。' : '默认客户档案异常，后续需要排查。',
        ];
      } else if (item.key === 'owner') {
        lines = [
          `可用无人机 ${stats.drones}`,
          providerCapabilities.canUseWorkbench ? `生效中服务 ${stats.supplies}` : `服务商状态 ${providerStatusText}`,
          providerCapabilities.canUseWorkbench ? `待开始履约 ${stats.pendingDispatches}` : '审核通过后才能进入正式工作台。',
        ];
      } else {
        lines = [
          `待开始履约 ${stats.pendingDispatches}`,
          `飞行记录 ${stats.flightRecords}`,
          hasRole ? '履约资质已建立，可继续维护服务范围。' : '完善后用于服务商履约推进。',
        ];
      }

      return {
        ...item,
        hasRole,
        screen,
        actionLabel,
        statusLabel: item.key === 'owner' ? providerStatusText : hasRole ? item.heldText : item.missingText,
        statusTone:
          item.key === 'owner'
            ? providerCapabilities.canUseWorkbench
              ? ('green' as const)
              : providerCapabilities.hasProviderApplication
                ? ('orange' as const)
                : ('gray' as const)
            : hasRole
              ? ('green' as const)
              : item.key === 'client'
                ? ('orange' as const)
                : ('gray' as const),
        lines,
      };
    });
  }, [
    effectiveRoleSummary,
    providerCapabilities.canUseWorkbench,
    providerCapabilities.executorStatus,
    providerCapabilities.hasExecutorRole,
    providerCapabilities.hasProviderApplication,
    providerStatusText,
    stats.demands,
    stats.drones,
    stats.flightRecords,
    stats.orders,
    stats.pendingDispatches,
    stats.supplies,
  ]);

  const capabilityItems = useMemo(
    () => [
      {
        ...capabilityCatalog[0],
        enabled: providerCapabilities.canPublishSupply,
      },
      {
        ...capabilityCatalog[1],
        enabled: providerCapabilities.canAcceptDispatch,
      },
      {
        ...capabilityCatalog[2],
        enabled: providerCapabilities.canSelfExecute,
      },
    ],
    [providerCapabilities.canAcceptDispatch, providerCapabilities.canPublishSupply, providerCapabilities.canSelfExecute],
  );

  const profileMenuGroups = useMemo<ShortcutGroup[]>(() => {
    const orderItems: ShortcutItem[] = [
      {
        key: 'orders',
        title: '我的订单',
        desc: '查看订单进度与费用',
        icon: '📋',
        screen: 'MyOrders',
        rightText: `${stats.orders} 单`,
      },
    ];

    if (effectiveRoleSummary.has_client_role) {
      orderItems.push({
        key: 'demands',
        title: '我的任务',
        desc: '跟进报价和转单',
        icon: '📝',
        screen: 'MyDemands',
        rightText: `${stats.demands} 个`,
      });
    }

    if (providerCapabilities.canUseWorkbench && providerCapabilities.canPublishSupply) {
      orderItems.push({
        key: 'quotes',
        title: '我的报价',
        desc: '查看报价结果',
        icon: '💬',
        screen: 'MyQuotes',
        rightText: `${stats.quotes} 条`,
      });
    }

    const identityItems: ShortcutItem[] = [
      {
        key: 'client-profile',
        title: '客户档案',
        desc: '联系人、地址和项目资料',
        icon: '👔',
        screen: 'ClientProfile',
        rightText: effectiveRoleSummary.has_client_role ? '已就绪' : '待补齐',
      },
      {
        key: 'verify',
        title: '实名认证',
        desc: '账号实名与资料校验',
        icon: '🔒',
        screen: 'Verification',
        rightText: verifyInfo.label,
      },
    ];

    if (isProviderMode || providerCapabilities.hasProviderApplication || providerCapabilities.canManageAssets) {
      identityItems.push({
        key: 'owner-profile',
        title: providerCapabilities.canUseWorkbench ? '服务商资料' : '服务商入驻',
        desc: providerCapabilities.canUseWorkbench ? '资产、服务与能力资料' : '资料、设备资质和审核进度',
        icon: '🧭',
        screen: providerCapabilities.canUseWorkbench ? 'OwnerProfile' : 'ProviderOnboarding',
        rightText: providerStatusText,
      });
    }

    identityItems.push({
      key: providerCapabilities.hasExecutorRole ? 'pilot' : 'pilot-register',
      title: providerCapabilities.hasExecutorRole ? '履约资质' : '履约资质认证',
      desc: providerCapabilities.hasExecutorRole
        ? '履约状态、统计与服务范围'
        : '完善后用于服务商履约推进',
      icon: providerCapabilities.hasExecutorRole ? '🎮' : '🪪',
      screen: providerCapabilities.hasExecutorRole ? 'PilotProfile' : 'PilotRegister',
      rightText: providerCapabilities.hasExecutorRole ? '已完善' : '去完善',
    });

    const assetItems: ShortcutItem[] = [];
    if (providerCapabilities.canUseWorkbench && providerCapabilities.canPublishSupply) {
      assetItems.push({
        key: 'offers',
        title: '我的服务',
        desc: '上架、暂停和关闭中的服务',
        icon: '📦',
        screen: 'MyOffers',
        rightText: `${stats.supplies} 个`,
      });
    }
    if (isProviderMode || providerCapabilities.canManageAssets || providerCapabilities.hasProviderApplication) {
      assetItems.push({
        key: 'drones',
        title: '我的无人机',
        desc: providerCapabilities.canUseWorkbench ? '设备、资质和可用状态' : '补充设备和资质用于服务商审核',
        icon: '🛩️',
        screen: 'MyDrones',
        rightText: `${stats.drones} 架`,
      });
    }

    const settingItems: ShortcutItem[] = [
      {
        key: 'edit',
        title: '编辑资料',
        desc: '昵称、头像和基础资料',
        icon: '✏️',
        screen: 'EditProfile',
      },
      {
        key: 'settings',
        title: '设置',
        desc: '账号与通知偏好',
        icon: '⚙️',
        screen: 'Settings',
      },
    ];

    return [
      {key: 'orders', title: '订单与任务', items: orderItems},
      {key: 'identity', title: '身份与能力', items: identityItems},
      {key: 'assets', title: '资产与服务', items: assetItems},
      {key: 'settings', title: '账户设置', items: settingItems},
    ].filter(group => group.items.length > 0);
  }, [
    effectiveRoleSummary,
    isProviderMode,
    providerCapabilities.canManageAssets,
    providerCapabilities.canPublishSupply,
    providerCapabilities.canUseWorkbench,
    providerCapabilities.hasExecutorRole,
    providerCapabilities.hasProviderApplication,
    providerStatusText,
    stats.demands,
    stats.drones,
    stats.orders,
    stats.quotes,
    stats.supplies,
    verifyInfo.label,
  ]);

  const roleBadges = useMemo(() => {
    const summary = effectiveRoleSummary;
    const items: Array<{label: string; tone: 'green' | 'gray' | 'orange'}> = [];
    items.push({label: summary.has_client_role ? '客户已持有' : '客户待补齐', tone: summary.has_client_role ? 'green' : 'orange'});
    items.push({
      label: `服务商${providerStatusText}`,
      tone: providerCapabilities.canUseWorkbench ? 'green' : providerCapabilities.hasProviderApplication ? 'orange' : 'gray',
    });
    items.push({
      label: providerCapabilities.hasExecutorRole ? '履约资质已完善' : '履约资质待完善',
      tone: providerCapabilities.hasExecutorRole ? 'green' : 'gray',
    });
    return items;
  }, [effectiveRoleSummary, providerCapabilities.canUseWorkbench, providerCapabilities.hasExecutorRole, providerCapabilities.hasProviderApplication, providerStatusText]);

  const canApplySelfExecute = providerCapabilities.canPublishSupply && providerCapabilities.canAcceptDispatch;

  return (
    <SafeAreaView style={[styles.container, {backgroundColor: theme.bg}]}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={styles.hero}>
          {!theme.isDark ? (
            <Image source={profileAssets.hero} style={styles.heroBgImage} resizeMode="cover" />
          ) : null}
          <TouchableOpacity
            style={styles.heroProfileArrow}
            activeOpacity={0.72}
            onPress={() => navigation.navigate('EditProfile')}>
            <Text style={styles.heroProfileArrowText}>›</Text>
          </TouchableOpacity>
          <View style={styles.heroTop}>
            <TouchableOpacity onPress={handleAvatarPress} disabled={uploading} style={styles.avatarWrap}>
              {user?.avatar_url ? (
                <Image source={{uri: user.avatar_url}} style={styles.avatarImage} />
              ) : (
                <View style={styles.avatarFallback}>
                  <Image source={profileAssets.defaultAvatar} style={styles.defaultAvatarImage} resizeMode="cover" />
                  <Text style={styles.avatarText}>{user?.nickname?.charAt(0) || 'U'}</Text>
                </View>
              )}
              <View style={styles.avatarBadge}>
                <Text style={styles.avatarBadgeText}>{uploading ? '...' : '编辑'}</Text>
              </View>
            </TouchableOpacity>

            <View style={styles.heroBody}>
              <TouchableOpacity onPress={() => navigation.navigate('EditProfile')}>
                <Text style={styles.heroName}>{user?.nickname || '未设置昵称'}</Text>
              </TouchableOpacity>
              <Text style={styles.heroPhone}>{user?.phone || '未绑定手机号'}</Text>
              <View style={styles.heroBadgeRow}>
                <StatusBadge label={verifyInfo.label} tone={verifyInfo.tone} />
                <StatusBadge label={`信用分 ${user?.credit_score || 100}`} tone="blue" />
              </View>
            </View>
          </View>

          <View style={styles.heroStatsRow}>
            {accountHighlights.map((item, index) => (
              <TouchableOpacity
                key={item.label}
                style={[styles.heroStatItem, index > 0 && styles.heroStatItemDivider]}
                activeOpacity={0.6}
                onPress={() => navigation.navigate(item.screen)}>
                <Text style={styles.heroStatValue}>{item.value}</Text>
                <Text style={styles.heroStatLabel}>{item.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {profileMenuGroups.map(group => (
          <View key={group.key} style={styles.menuGroup}>
            <Text style={styles.menuGroupTitle}>{group.title}</Text>
            <View style={styles.menuGroupBody}>
              {group.items.map((item, index) => (
                <TouchableOpacity
                  key={item.key}
                  activeOpacity={0.82}
                  style={[
                    styles.menuRow,
                    index === group.items.length - 1 ? styles.menuRowLast : null,
                  ]}
                  onPress={() => navigation.navigate(item.screen)}>
                  <View style={styles.menuIconWrap}>
                    <Image source={getMenuAsset(item.key)} style={styles.menuIconImage} resizeMode="contain" />
                  </View>
                  <View style={styles.menuRowCopy}>
                    <Text style={styles.menuRowTitle}>{item.title}</Text>
                  </View>
                  {item.rightText ? (
                    <Text style={styles.menuRowRight} numberOfLines={1}>
                      {item.rightText}
                    </Text>
                  ) : null}
                  <Image source={profileAssets.chevronRight} style={styles.menuChevronImage} resizeMode="contain" />
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))}

        <View style={styles.roleOverview}>
          <Text style={styles.roleOverviewTitle}>身份概览</Text>
          <View style={styles.roleBadgeWrap}>
            {roleBadges.map(item => (
              <StatusBadge key={item.label} label={item.label} tone={item.tone} />
            ))}
          </View>
        </View>

        {/* 身份与能力 - 可折叠 */}
        <TouchableOpacity
          style={styles.foldToggle}
          onPress={() => setShowAdvanced(!showAdvanced)}
          activeOpacity={0.7}>
          <Text style={styles.foldToggleText}>身份与能力详情</Text>
          <View style={styles.foldToggleRight}>
            <Text style={styles.foldToggleState}>{showAdvanced ? '收起' : '展开'}</Text>
            <Image
              source={profileAssets.chevronDown}
              style={[styles.foldToggleIcon, showAdvanced && styles.foldToggleIconOpen]}
              resizeMode="contain"
            />
          </View>
        </TouchableOpacity>

        {showAdvanced && (
          <>
            <View style={styles.menuGroup}>
              <Text style={styles.menuGroupTitle}>身份详情</Text>
              <View style={styles.menuGroupBody}>
                {identityCards.map((card, index) => (
                  <TouchableOpacity
                    key={card.key}
                    activeOpacity={0.82}
                    style={[
                      styles.menuRow,
                      index === identityCards.length - 1 ? styles.menuRowLast : null,
                    ]}
                    onPress={() => navigation.navigate(card.screen)}>
                    <View style={styles.menuIconWrap}>
                      <Image source={getIdentityAsset(card.key)} style={styles.menuIconImage} resizeMode="contain" />
                    </View>
                    <View style={styles.menuRowCopy}>
                      <Text style={styles.menuRowTitle}>{card.label}</Text>
                    </View>
                    <StatusBadge label={card.statusLabel} tone={card.statusTone} />
                    <Image source={profileAssets.chevronRight} style={styles.menuChevronImage} resizeMode="contain" />
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.menuGroup}>
              <Text style={styles.menuGroupTitle}>能力状态</Text>
              <View style={styles.menuGroupBody}>
                {capabilityItems.map((item, index) => (
                  <View
                    key={item.key}
                    style={[
                      styles.menuRow,
                      index === capabilityItems.length - 1 ? styles.menuRowLast : null,
                    ]}>
                    <View style={styles.menuIconWrap}>
                      <Image
                        source={item.enabled ? profileAssets.chipCheck : profileAssets.chipStar}
                        style={styles.menuIconImage}
                        resizeMode="contain"
                      />
                    </View>
                    <View style={styles.menuRowCopy}>
                      <Text style={styles.menuRowTitle}>{item.label}</Text>
                    </View>
                    <StatusBadge label={item.enabled ? '可用' : '未就绪'} tone={item.enabled ? 'green' : 'gray'} />
                  </View>
                ))}
              </View>
              <View style={styles.capabilityNotice}>
                <Text style={styles.capabilityNoticeText}>
                  {canApplySelfExecute
                    ? '你已经具备供给发布和履约推进能力，可由服务商主体承接并履约。'
                    : '要完整履约，需要同时完善设备资质和履约资质。'}
                </Text>
              </View>
            </View>
          </>
        )}

        <TouchableOpacity
          style={styles.logoutBtn}
          onPress={() => {
            Alert.alert('退出登录', '确定要退出当前账号吗？', [
              {text: '取消', style: 'cancel'},
              {text: '退出', style: 'destructive', onPress: () => dispatch(logout())},
            ]);
          }}>
          <Image source={profileAssets.logout} style={styles.logoutIcon} resizeMode="contain" />
          <Text style={styles.logoutText}>退出登录</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const getStyles = (theme: AppTheme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.bg,
  },
  content: {
    padding: 12,
    paddingBottom: 112,
  },
  hero: {
    position: 'relative',
    height: 165,
    borderRadius: 15,
    backgroundColor: theme.isDark ? 'rgba(0,212,255,0.08)' : '#0753D8',
    padding: 0,
    marginBottom: 12,
    overflow: 'hidden',
    borderWidth: theme.isDark ? 1 : 0,
    borderColor: theme.isDark ? theme.primaryBorder : 'transparent',
    shadowColor: '#125EDC',
    shadowOffset: {width: 0, height: 9},
    shadowOpacity: theme.isDark ? 0 : 0.2,
    shadowRadius: 24,
    elevation: 6,
  },
  heroBgImage: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  heroProfileArrow: {
    position: 'absolute',
    zIndex: 3,
    right: 15,
    top: 14,
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroProfileArrowText: {
    color: 'rgba(255,255,255,0.88)',
    fontSize: 24,
    lineHeight: 24,
    fontWeight: '400',
  },
  heroTop: {
    position: 'relative',
    zIndex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 17,
    paddingTop: 18,
  },
  avatarWrap: {
    position: 'relative',
    width: 66,
    height: 66,
  },
  avatarImage: {
    width: 66,
    height: 66,
    borderRadius: 33,
    backgroundColor: theme.primaryBg,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.86)',
  },
  avatarFallback: {
    width: 66,
    height: 66,
    borderRadius: 33,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.86)',
  },
  defaultAvatarImage: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  avatarText: {
    fontSize: 26,
    fontWeight: '800',
    color: theme.btnPrimaryText,
  },
  avatarBadge: {
    position: 'absolute',
    left: 18,
    bottom: -2,
    backgroundColor: theme.card,
    borderRadius: 999,
    minWidth: 30,
    height: 17,
    paddingHorizontal: 6,
    paddingVertical: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarBadgeText: {
    fontSize: 10,
    color: theme.primaryText,
    fontWeight: '800',
  },
  heroBody: {
    flex: 1,
    minWidth: 0,
    marginLeft: 14,
    paddingRight: 20,
  },
  heroName: {
    fontSize: 19,
    lineHeight: 23,
    color: theme.isDark ? theme.text : '#FFFFFF',
    fontWeight: '900',
  },
  heroPhone: {
    marginTop: 5,
    fontSize: 12,
    lineHeight: 16,
    color: theme.isDark ? theme.textSub : 'rgba(255,255,255,0.92)',
  },
  heroBadgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 9,
  },
  heroStatsRow: {
    position: 'relative',
    zIndex: 2,
    flexDirection: 'row',
    justifyContent: 'space-between',
    height: 63,
    marginTop: 17,
    borderTopWidth: 1,
    borderTopColor: theme.isDark ? theme.primaryBorder : 'rgba(255,255,255,0.22)',
    paddingHorizontal: 17,
    alignItems: 'center',
  },
  heroStatItem: {
    flex: 1,
    alignItems: 'center',
    position: 'relative',
  },
  heroStatItemDivider: {
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: theme.isDark ? theme.primaryBorder : 'rgba(255,255,255,0.26)',
  },
  heroStatValue: {
    fontSize: 22,
    lineHeight: 24,
    color: theme.isDark ? theme.primary : '#FFFFFF',
    fontWeight: '800',
  },
  heroStatLabel: {
    marginTop: 6,
    fontSize: 12,
    color: theme.isDark ? theme.textSub : 'rgba(255,255,255,0.85)',
  },
  sectionCard: {
    marginBottom: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sectionHeaderLoose: {
    marginTop: 4,
    marginBottom: 10,
    paddingHorizontal: 2,
  },
  sectionTitle: {
    fontSize: 18,
    color: theme.text,
    fontWeight: '800',
  },
  sectionLink: {
    fontSize: 13,
    color: theme.primaryText,
    fontWeight: '700',
  },
  sectionDesc: {
    marginTop: 6,
    fontSize: 13,
    lineHeight: 20,
    color: theme.textSub,
  },
  accountHint: {
    fontSize: 13,
    lineHeight: 20,
    color: theme.textSub,
  },
  roleBadgeWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 14,
  },
  menuGroup: {
    marginBottom: 12,
  },
  menuGroupTitle: {
    paddingHorizontal: 4,
    marginBottom: 8,
    fontSize: 15,
    color: theme.text,
    fontWeight: '800',
  },
  menuGroupBody: {
    borderRadius: 16,
    backgroundColor: theme.card,
    borderWidth: 1,
    borderColor: theme.cardBorder,
    overflow: 'hidden',
  },
  menuRow: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.divider,
    gap: 12,
  },
  menuRowLast: {
    borderBottomWidth: 0,
  },
  menuIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.primaryBg,
  },
  menuIcon: {
    fontSize: 18,
    color: theme.primaryText,
    fontWeight: '800',
  },
  menuIconImage: {
    width: 22,
    height: 22,
  },
  menuRowCopy: {
    flex: 1,
    minWidth: 0,
  },
  menuRowTitle: {
    fontSize: 15,
    color: theme.text,
    fontWeight: '800',
  },
  menuRowRight: {
    maxWidth: 86,
    fontSize: 12,
    color: theme.textSub,
    fontWeight: '700',
    textAlign: 'right',
  },
  menuChevron: {
    fontSize: 22,
    color: theme.textHint,
    fontWeight: '500',
  },
  menuChevronImage: {
    width: 16,
    height: 16,
  },
  roleOverview: {
    marginBottom: 12,
    borderRadius: 16,
    backgroundColor: theme.card,
    borderWidth: 1,
    borderColor: theme.cardBorder,
    padding: 16,
  },
  roleOverviewTitle: {
    fontSize: 15,
    color: theme.text,
    fontWeight: '800',
  },
  identityCard: {
    marginBottom: 12,
  },
  identityHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 10,
  },
  identityTitle: {
    fontSize: 16,
    color: theme.text,
    fontWeight: '800',
  },
  identityStatusText: {
    marginTop: 6,
    fontSize: 12,
    color: theme.textSub,
  },
  identityMetrics: {
    marginTop: 14,
    gap: 8,
  },
  identityMetricText: {
    fontSize: 13,
    lineHeight: 19,
    color: theme.textSub,
  },
  secondaryAction: {
    alignSelf: 'flex-start',
    marginTop: 16,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.divider,
    paddingHorizontal: 14,
    paddingVertical: 9,
    backgroundColor: theme.card,
  },
  secondaryActionText: {
    fontSize: 12,
    color: theme.primaryText,
    fontWeight: '800',
  },
  capabilityRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.divider,
  },
  capabilityCopy: {
    flex: 1,
  },
  capabilityLabel: {
    fontSize: 14,
    color: theme.text,
    fontWeight: '800',
  },
  capabilityDesc: {
    marginTop: 5,
    fontSize: 12,
    lineHeight: 18,
    color: theme.textSub,
  },
  capabilityNotice: {
    marginTop: 14,
    borderRadius: 16,
    backgroundColor: theme.bgSecondary,
    borderWidth: 1,
    borderColor: theme.primaryBg,
    padding: 12,
  },
  capabilityNoticeText: {
    fontSize: 12,
    lineHeight: 18,
    color: theme.primaryText,
  },
  shortcutGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 14,
  },
  shortcutCard: {
    borderRadius: 20,
    backgroundColor: theme.card,
    padding: 16,
    shadowColor: '#102a43',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: {width: 0, height: 4},
    elevation: 2,
  },
  shortcutIcon: {
    fontSize: 24,
  },
  shortcutTitle: {
    marginTop: 14,
    fontSize: 15,
    color: theme.text,
    fontWeight: '800',
  },
  shortcutDesc: {
    marginTop: 8,
    fontSize: 12,
    lineHeight: 18,
    color: theme.textSub,
  },
  foldToggle: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: theme.card,
    borderWidth: 1,
    borderColor: theme.cardBorder,
  },
  foldToggleText: {
    fontSize: 14,
    color: theme.text,
    fontWeight: '700',
  },
  foldToggleRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  foldToggleState: {
    fontSize: 12,
    color: theme.textSub,
    fontWeight: '600',
  },
  foldToggleIcon: {
    width: 14,
    height: 14,
  },
  foldToggleIconOpen: {
    transform: [{rotate: '180deg'}],
  },
  logoutBtn: {
    marginTop: 4,
    borderRadius: 999,
    backgroundColor: theme.danger + '22',
    borderWidth: 1,
    borderColor: theme.danger + '44',
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  logoutIcon: {
    width: 16,
    height: 16,
    marginRight: 7,
  },
  logoutText: {
    fontSize: 14,
    color: theme.danger,
    fontWeight: '800',
  },
});
