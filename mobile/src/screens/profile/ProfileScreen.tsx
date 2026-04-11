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
  useWindowDimensions,
  View,
} from 'react-native';
import {useFocusEffect} from '@react-navigation/native';
import {useDispatch, useSelector} from 'react-redux';
import * as ImagePicker from 'react-native-image-picker';
import type {ImagePickerResponse} from 'react-native-image-picker';

import ObjectCard from '../../components/business/ObjectCard';
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
import {getEffectiveRoleSummary} from '../../utils/roleSummary';
import {getResponsiveTwoColumnLayout} from '../../utils/responsiveGrid';
import {useTheme} from '../../theme/ThemeContext';
import type {AppTheme} from '../../theme/index';

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
  desc: string;
  icon: string;
  screen: string;
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
    label: '机主身份',
    heldText: '已拥有',
    missingText: '待建立',
    screen: 'OwnerProfile',
    actionLabel: '机主档案',
  },
  {
    key: 'pilot',
    label: '飞手身份',
    heldText: '已认证',
    missingText: '去认证',
    screen: 'PilotProfile',
    fallbackScreen: 'PilotRegister',
    actionLabel: '飞手中心',
    fallbackActionLabel: '飞手认证',
  },
] as const;

const capabilityCatalog = [
  {
    key: 'publish',
    label: '可发布供给',
    desc: '满足重载准入和关键资质后，可把供给展示到市场。',
  },
  {
    key: 'dispatch',
    label: '可接派单',
    desc: '通过飞手认证并开启接单后，可响应正式派单。',
  },
  {
    key: 'selfExecute',
    label: '可自执行',
    desc: '同时具备机主与飞手能力后，机主可选择自执行。',
  },
] as const;

export default function ProfileScreen({navigation}: any) {
  const {theme} = useTheme();
  const styles = getStyles(theme);
  const {width: viewportWidth} = useWindowDimensions();
  const user = useSelector((state: RootState) => state.auth.user);
  const roleSummary = useSelector((state: RootState) => state.auth.roleSummary);
  const dispatch = useDispatch();
  const userRef = useRef(user);
  const roleSummaryRef = useRef(roleSummary);
  const loadingRef = useRef(false);

  const [refreshing, setRefreshing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [stats, setStats] = useState<ProfileStats>(emptyStats);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const effectiveRoleSummary = getEffectiveRoleSummary(roleSummary, user);
  const verifyInfo = VERIFY_STATUS_MAP[user?.id_verified || 'unverified'] || VERIFY_STATUS_MAP.unverified;

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  useEffect(() => {
    roleSummaryRef.current = roleSummary;
  }, [roleSummary]);

  const loadData = useCallback(async () => {
    if (loadingRef.current) {
      setRefreshing(false);
      return;
    }

    loadingRef.current = true;
    const summary = getEffectiveRoleSummary(roleSummaryRef.current, userRef.current);
    try {
      const [profileRes, meRes, orderRes, demandRes, supplyRes, quoteRes, droneRes, bindingRes, dispatchRes, flightRes] = await Promise.all([
        userService.getProfile().catch(() => null),
        sessionService.getMe().catch(() => null),
        orderV2Service.list({page: 1, page_size: 1}).catch(() => null),
        summary.has_client_role
          ? demandV2Service.listMyDemands({page: 1, page_size: 1}).catch(() => null)
          : Promise.resolve(null),
        summary.has_owner_role
          ? ownerService.listMySupplies({page: 1, page_size: 1}).catch(() => null)
          : Promise.resolve(null),
        summary.has_owner_role
          ? ownerService.listMyQuotes({page: 1, page_size: 1}).catch(() => null)
          : Promise.resolve(null),
        summary.has_owner_role
          ? droneService.myDrones().catch(() => null)
          : Promise.resolve(null),
        summary.has_owner_role
          ? ownerService.listPilotBindings({status: 'active', page: 1, page_size: 1}).catch(() => null)
          : Promise.resolve(null),
        summary.has_pilot_role
          ? dispatchV2Service.list({role: 'pilot', status: 'pending_response', page: 1, page_size: 1}).catch(() => null)
          : Promise.resolve(null),
        summary.has_pilot_role
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

  const accountHighlights = useMemo(
    () => [
      {label: '订单', value: stats.orders, screen: 'MyOrders'},
      {label: '任务', value: stats.demands, screen: 'MyDemands'},
      {label: '服务', value: stats.supplies, screen: 'MyOffers'},
    ],
    [stats.demands, stats.orders, stats.supplies],
  );

  const identityCards = useMemo(() => {
    const summary = effectiveRoleSummary;
    return identityCatalog.map(item => {
      const hasRole =
        item.key === 'client'
          ? summary.has_client_role
          : item.key === 'owner'
            ? summary.has_owner_role
            : summary.has_pilot_role;

      const screen = hasRole ? item.screen : item.fallbackScreen || item.screen;
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
          `生效中服务 ${stats.supplies}`,
          `绑定飞手 ${stats.bindings}`,
        ];
      } else {
        lines = [
          `待响应派单 ${stats.pendingDispatches}`,
          `真实飞行记录 ${stats.flightRecords}`,
          hasRole ? '飞手认证已建立，可继续管理接单能力。' : '完成飞手认证后才能响应正式派单。',
        ];
      }

      return {
        ...item,
        hasRole,
        screen,
        actionLabel,
        statusLabel: hasRole ? item.heldText : item.missingText,
        statusTone: hasRole ? ('green' as const) : item.key === 'client' ? ('orange' as const) : ('gray' as const),
        lines,
      };
    });
  }, [effectiveRoleSummary, stats.bindings, stats.demands, stats.drones, stats.flightRecords, stats.orders, stats.pendingDispatches, stats.supplies]);

  const capabilityItems = useMemo(
    () => [
      {
        ...capabilityCatalog[0],
        enabled: effectiveRoleSummary.can_publish_supply,
      },
      {
        ...capabilityCatalog[1],
        enabled: effectiveRoleSummary.can_accept_dispatch,
      },
      {
        ...capabilityCatalog[2],
        enabled: effectiveRoleSummary.can_self_execute,
      },
    ],
    [effectiveRoleSummary],
  );

  const quickEntries = useMemo<ShortcutItem[]>(() => {
    const items: ShortcutItem[] = [
      {key: 'client-profile', title: '客户档案', desc: '联系人、地址、项目统计', icon: '👔', screen: 'ClientProfile'},
      {key: 'orders', title: '我的订单', desc: '统一查看订单进度与财务', icon: '📋', screen: 'MyOrders'},
      {key: 'verify', title: '实名认证', desc: '完善账号实名与资料校验', icon: '🔒', screen: 'Verification'},
      {key: 'settings', title: '设置', desc: '账号与通知偏好设置', icon: '⚙️', screen: 'Settings'},
    ];

    if (effectiveRoleSummary.has_client_role) {
      items.splice(1, 0, {
        key: 'demands',
        title: '我的任务',
        desc: '继续跟进报价和转单',
        icon: '📝',
        screen: 'MyDemands',
      });
    }

    if (effectiveRoleSummary.has_owner_role) {
      items.push(
      {key: 'owner-profile', title: '机主档案', desc: '查看资产、服务与能力就绪情况', icon: '🧭', screen: 'OwnerProfile'},
      {key: 'drones', title: '我的无人机', desc: '管理设备、资质和状态', icon: '🛩️', screen: 'MyDrones'},
        {key: 'offers', title: '我的服务', desc: '查看上架、暂停和关闭中的服务', icon: '📦', screen: 'MyOffers'},
        {key: 'quotes', title: '我的报价', desc: '继续跟进任务报价结果', icon: '💬', screen: 'MyQuotes'},
      );
    }

    if (effectiveRoleSummary.has_pilot_role) {
      items.push({
        key: 'pilot',
        title: '飞手中心',
        desc: '接单状态、监控入口、飞行统计',
        icon: '🎮',
        screen: 'PilotProfile',
      });
    } else {
      items.push({
        key: 'pilot-register',
        title: '飞手认证',
        desc: '申请飞手后才能接正式派单',
        icon: '🪪',
        screen: 'PilotRegister',
      });
    }

    return items;
  }, [effectiveRoleSummary]);

  const roleBadges = useMemo(() => {
    const summary = effectiveRoleSummary;
    const items: Array<{label: string; tone: 'green' | 'gray' | 'orange'}> = [];
    items.push({label: summary.has_client_role ? '客户已持有' : '客户待补齐', tone: summary.has_client_role ? 'green' : 'orange'});
    items.push({label: summary.has_owner_role ? '机主已持有' : '机主未建立', tone: summary.has_owner_role ? 'green' : 'gray'});
    items.push({label: summary.has_pilot_role ? '飞手已认证' : '飞手未认证', tone: summary.has_pilot_role ? 'green' : 'gray'});
    return items;
  }, [effectiveRoleSummary]);

  const canApplySelfExecute = effectiveRoleSummary.can_publish_supply && effectiveRoleSummary.can_accept_dispatch;
  const shortcutCardLayout = useMemo(
    () =>
      getResponsiveTwoColumnLayout({
        viewportWidth,
        totalHorizontalPadding: 32,
        gap: 12,
        minItemWidth: 136,
      }),
    [viewportWidth],
  );

  return (
    <SafeAreaView style={[styles.container, {backgroundColor: theme.bg}]}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={styles.hero}>
          <View style={styles.heroTop}>
            <TouchableOpacity onPress={handleAvatarPress} disabled={uploading} style={styles.avatarWrap}>
              {user?.avatar_url ? (
                <Image source={{uri: user.avatar_url}} style={styles.avatarImage} />
              ) : (
                <View style={styles.avatarFallback}>
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
            {accountHighlights.map(item => (
              <TouchableOpacity key={item.label} style={styles.heroStatItem} activeOpacity={0.6} onPress={() => navigation.navigate(item.screen)}>
                <Text style={styles.heroStatValue}>{item.value}</Text>
                <Text style={styles.heroStatLabel}>{item.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* 常用入口 - 提升到首屏 */}
        <View style={styles.sectionHeaderLoose}>
          <Text style={styles.sectionTitle}>常用入口</Text>
        </View>
        <View style={styles.shortcutGrid}>
          {quickEntries.map(item => (
            <TouchableOpacity
              key={item.key}
              style={[styles.shortcutCard, {width: shortcutCardLayout.itemWidth}]}
              activeOpacity={0.88}
              onPress={() => navigation.navigate(item.screen)}>
              <Text style={styles.shortcutIcon}>{item.icon}</Text>
              <Text style={styles.shortcutTitle}>{item.title}</Text>
              <Text style={styles.shortcutDesc}>{item.desc}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* 账号与安全 - 简化 */}
        <ObjectCard style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>账号与安全</Text>
            <TouchableOpacity onPress={() => navigation.navigate('EditProfile')}>
              <Text style={styles.sectionLink}>编辑资料</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.roleBadgeWrap}>
            {roleBadges.map(item => (
              <StatusBadge key={item.label} label={item.label} tone={item.tone} />
            ))}
          </View>
        </ObjectCard>

        {/* 身份与能力 - 可折叠 */}
        <TouchableOpacity
          style={styles.foldToggle}
          onPress={() => setShowAdvanced(!showAdvanced)}
          activeOpacity={0.7}>
          <Text style={styles.foldToggleText}>身份与能力详情</Text>
          <Text style={styles.foldToggleArrow}>{showAdvanced ? '收起 ▲' : '展开 ▼'}</Text>
        </TouchableOpacity>

        {showAdvanced && (
          <>
            {identityCards.map(card => (
              <ObjectCard key={card.key} style={styles.identityCard}>
                <View style={styles.identityHeader}>
                  <View>
                    <Text style={styles.identityTitle}>{card.label}</Text>
                  </View>
                  <StatusBadge label={card.statusLabel} tone={card.statusTone} />
                </View>
                <View style={styles.identityMetrics}>
                  {card.lines.map(line => (
                    <Text key={line} style={styles.identityMetricText}>{line}</Text>
                  ))}
                </View>
                <TouchableOpacity style={styles.secondaryAction} onPress={() => navigation.navigate(card.screen)}>
                  <Text style={styles.secondaryActionText}>{card.actionLabel}</Text>
                </TouchableOpacity>
              </ObjectCard>
            ))}

            <ObjectCard style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>能力状态</Text>
              {capabilityItems.map(item => (
                <View key={item.key} style={styles.capabilityRow}>
                  <View style={styles.capabilityCopy}>
                    <Text style={styles.capabilityLabel}>{item.label}</Text>
                    <Text style={styles.capabilityDesc}>{item.desc}</Text>
                  </View>
                  <StatusBadge label={item.enabled ? '可用' : '未就绪'} tone={item.enabled ? 'green' : 'gray'} />
                </View>
              ))}
              <View style={styles.capabilityNotice}>
                <Text style={styles.capabilityNoticeText}>
                  {canApplySelfExecute
                    ? '当前账号已经具备机主与飞手双能力，后续订单可走自执行链路。'
                    : '要实现机主自执行，需要同时具备发布供给和接正式派单两种能力。'}
                </Text>
              </View>
            </ObjectCard>
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
          <Text style={styles.logoutText}>退出登录</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const getStyles = (theme: AppTheme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.bgSecondary,
  },
  content: {
    padding: 14,
    paddingBottom: 28,
  },
  hero: {
    borderRadius: 28,
    backgroundColor: theme.isDark ? 'rgba(0,212,255,0.08)' : theme.primary,
    padding: 20,
    marginBottom: 12,
    borderWidth: theme.isDark ? 1 : 0,
    borderColor: theme.isDark ? theme.primaryBorder : 'transparent',
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarWrap: {
    position: 'relative',
  },
  avatarImage: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: theme.primaryBg,
  },
  avatarFallback: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 30,
    fontWeight: '800',
    color: theme.btnPrimaryText,
  },
  avatarBadge: {
    position: 'absolute',
    right: -4,
    bottom: -4,
    backgroundColor: theme.card,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  avatarBadgeText: {
    fontSize: 10,
    color: theme.primaryText,
    fontWeight: '800',
  },
  heroBody: {
    flex: 1,
    marginLeft: 16,
  },
  heroName: {
    fontSize: 24,
    color: theme.isDark ? theme.text : '#FFFFFF',
    fontWeight: '800',
  },
  heroPhone: {
    marginTop: 6,
    fontSize: 13,
    color: theme.isDark ? theme.textSub : 'rgba(255,255,255,0.85)',
  },
  heroBadgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  heroStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 18,
    borderTopWidth: 1,
    borderTopColor: theme.isDark ? theme.primaryBorder : 'rgba(255,255,255,0.12)',
    paddingTop: 16,
  },
  heroStatItem: {
    flex: 1,
    alignItems: 'center',
  },
  heroStatValue: {
    fontSize: 24,
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
  foldToggleArrow: {
    fontSize: 12,
    color: theme.textSub,
    fontWeight: '600',
  },
  logoutBtn: {
    marginTop: 4,
    borderRadius: 999,
    backgroundColor: theme.danger + '22',
    borderWidth: 1,
    borderColor: theme.danger + '44',
    paddingVertical: 14,
    alignItems: 'center',
  },
  logoutText: {
    fontSize: 14,
    color: theme.danger,
    fontWeight: '800',
  },
});
