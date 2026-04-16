import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { APP_CONFIG } from '../../constants';
import { logout, updateUser } from '../../store/slices/authSlice';
import { RootState } from '../../store/store';
import {
  PushBindingStatus,
  PushDebugState,
  PushPermissionStatus,
  pushService,
} from '../../services/pushFacade';
import { pushTestService } from '../../services/pushTest';
import { userService } from '../../services/user';
import { useTheme } from '../../theme/ThemeContext';
import type { AppTheme } from '../../theme/index';

const APP_VERSION = '1.2.0-build11';
const APP_VERSION_CODE = '11';

const formatPermissionStatus = (status: PushPermissionStatus) => {
  switch (status) {
    case 'granted':
      return '已授权';
    case 'blocked':
      return '已拒绝且不再询问';
    case 'denied':
      return '未授权';
    case 'unavailable':
      return '当前平台不支持';
    default:
      return '待确认';
  }
};

const formatPushServiceStatus = (debugState: PushDebugState | null) => {
  if (!debugState) {
    return '读取中...';
  }
  if (!debugState.platformSupported) {
    return '仅支持 Android 设备';
  }
  if (!debugState.configured) {
    return '未配置推送服务';
  }
  if (!debugState.initialized) {
    return '正在初始化...';
  }
  if (!debugState.registrationID) {
    return '等待终端注册';
  }
  return '运行中';
};

const formatBindingStatus = (status: PushBindingStatus) => {
  switch (status) {
    case 'disabled':
      return '当前设备已关闭推送绑定';
    case 'waiting_registration':
      return '等待获取终端标识';
    case 'syncing':
      return '正在绑定当前账号';
    case 'synced':
      return '绑定完成';
    case 'failed':
      return '绑定失败';
    default:
      return '待处理';
  }
};

const formatConnectionStatus = (enabled: boolean | null) => {
  if (enabled === true) {
    return '已连接';
  }
  if (enabled === false) {
    return '未连接';
  }
  return '待确认';
};

const formatPushStoppedStatus = (stopped: boolean | null) => {
  if (stopped === true) {
    return '已停止';
  }
  if (stopped === false) {
    return '运行中';
  }
  return '待确认';
};

export default function SettingsScreen({ navigation }: any) {
  const { theme } = useTheme();
  const styles = getStyles(theme);
  const user = useSelector((state: RootState) => state.auth.user);
  const dispatch = useDispatch();

  const [pushEnabled, setPushEnabled] = useState(true);
  const [pushStateLoading, setPushStateLoading] = useState(true);
  const [pushSaving, setPushSaving] = useState(false);
  const [pushDiagnostics, setPushDiagnostics] = useState<PushDebugState | null>(
    null,
  );
  const [sendingTestPush, setSendingTestPush] = useState(false);

  const showAndroidDebugSection =
    Platform.OS === 'android' && APP_CONFIG.pushDebugToolsEnabled;
  const canSendTestPush =
    !!user?.id &&
    !!pushDiagnostics?.configured &&
    pushEnabled &&
    pushDiagnostics.permissionStatus === 'granted' &&
    !!pushDiagnostics.registrationID &&
    !!pushDiagnostics.currentAlias &&
    pushDiagnostics.connectionEnabled !== false &&
    pushDiagnostics.pushStopped !== true &&
    pushDiagnostics.bindingStatus === 'synced';

  const refreshPushDiagnostics = useCallback(
    async (options?: { showLoading?: boolean }) => {
      const showLoading = options?.showLoading ?? false;
      if (showLoading) {
        setPushStateLoading(true);
      }

    try {
      const debugState = await pushService.getDebugState();
      setPushDiagnostics(debugState);
      setPushEnabled(debugState.enabled);
    } catch (error) {
      console.warn('[Settings] Failed to refresh push diagnostics', error);
    } finally {
        if (showLoading) {
          setPushStateLoading(false);
        }
      }
    },
    [],
  );

  useEffect(() => {
    refreshPushDiagnostics({ showLoading: true }).catch(error => {
      console.warn('[Settings] Failed to bootstrap push diagnostics', error);
    });
  }, [refreshPushDiagnostics]);

  useEffect(() => {
    if (!showAndroidDebugSection) {
      return;
    }

    const timer = setInterval(() => {
      refreshPushDiagnostics().catch(error => {
        console.warn('[Settings] Failed to poll push diagnostics', error);
      });
    }, 3000);

    return () => clearInterval(timer);
  }, [refreshPushDiagnostics, showAndroidDebugSection]);

  const handleLogout = () => {
    Alert.alert('退出登录', '确定要退出当前账号吗？', [
      { text: '取消', style: 'cancel' },
      {
        text: '退出',
        style: 'destructive',
        onPress: () => dispatch(logout()),
      },
    ]);
  };

  const handleChangeNickname = () => {
    Alert.prompt?.(
      '修改昵称',
      '请输入新的昵称',
      async (text: string) => {
        if (!text?.trim()) return;
        try {
          await userService.updateProfile({ nickname: text.trim() });
          dispatch(updateUser({ nickname: text.trim() }));
          Alert.alert('成功', '昵称已更新');
        } catch {
          Alert.alert('失败', '修改昵称失败，请重试');
        }
      },
      'plain-text',
      user?.nickname || '',
    );
    if (!Alert.prompt) {
      Alert.alert(
        '提示',
        '修改昵称功能请在 iOS 上使用，或前往个人资料页面修改',
      );
    }
  };

  const handleClearCache = () => {
    Alert.alert('清除缓存', '确定要清除应用缓存吗？', [
      { text: '取消', style: 'cancel' },
      {
        text: '清除',
        onPress: () => {
          Alert.alert('成功', '缓存已清除');
        },
      },
    ]);
  };

  const handleOpenSystemSettings = async () => {
    try {
      await Linking.openSettings();
    } catch {
      Alert.alert('无法打开设置', '请手动前往系统设置，为应用开启通知权限。');
    }
  };

  const handleTogglePush = async (nextValue: boolean) => {
    setPushSaving(true);
    try {
      const nextState = await pushService.setEnabled(
        nextValue,
        user?.id ?? null,
      );
      setPushEnabled(nextState.enabled);
      setPushDiagnostics(nextState);

      if (nextValue && nextState.permissionStatus !== 'granted') {
        Alert.alert(
          '通知权限待开启',
          '应用内总开关已开启，但系统通知权限还未打开。正常情况下，打开开关时系统会直接弹出授权；如果这次没有弹出，请去系统设置里手动开启通知权限。',
          [
            { text: '稍后处理', style: 'cancel' },
            { text: '去系统设置', onPress: handleOpenSystemSettings },
          ],
        );
      }

      if (!nextValue) {
        Alert.alert(
          '已关闭',
          '当前设备已关闭系统推送绑定，不会再接收这台设备的定向推送。',
        );
      }
    } catch {
      Alert.alert('失败', '更新推送开关失败，请稍后重试。');
      await refreshPushDiagnostics({ showLoading: true });
    } finally {
      setPushSaving(false);
    }
  };

  const handleRequestPermission = async () => {
    const status = await pushService.requestNotificationPermission();
    await refreshPushDiagnostics();

    if (status === 'granted') {
      Alert.alert('已授权', '系统通知权限已开启，当前设备已经具备接收系统推送的前置条件。');
      return;
    }

    Alert.alert(
      '仍未开启',
      status === 'blocked'
        ? '系统已拒绝并不再询问，请到系统设置中手动开启通知权限。'
        : '系统通知权限尚未开启，测试推送不会显示在系统通知栏。',
      [
        { text: '知道了', style: 'cancel' },
        { text: '去系统设置', onPress: handleOpenSystemSettings },
      ],
    );
  };

  const handleSendTestPush = async () => {
    const latestDiagnostics = await pushService.getDebugState();
    setPushDiagnostics(latestDiagnostics);
    setPushEnabled(latestDiagnostics.enabled);

    const readyToSend =
      !!user?.id &&
      !!latestDiagnostics.configured &&
      latestDiagnostics.enabled &&
      latestDiagnostics.permissionStatus === 'granted' &&
      !!latestDiagnostics.registrationID &&
      !!latestDiagnostics.currentAlias &&
      latestDiagnostics.connectionEnabled !== false &&
      latestDiagnostics.pushStopped !== true &&
      latestDiagnostics.bindingStatus === 'synced';

    if (!readyToSend) {
      const detail =
        latestDiagnostics.lastSyncError ||
        (latestDiagnostics.connectionEnabled === false
          ? '极光连接尚未建立，请确认当前网络可访问极光服务后再试。'
          : null) ||
        (latestDiagnostics.pushStopped === true
          ? '极光推送当前处于停止状态，请重装最新安装包后再试。'
          : null) ||
        (latestDiagnostics.registrationID
          ? '当前账号绑定尚未完成，请稍候几秒后重试。'
          : '终端标识尚未获取，请保持网络通畅并等待几秒后重试。');

      Alert.alert('暂不可发送', detail);
      return;
    }

    setSendingTestPush(true);
    try {
      const res = await pushTestService.send();
      Alert.alert(
        '测试请求已提交',
        `已提交到 ${res.data.provider} 推送通道。\n\n这一步表示服务端和极光都已受理，不等于系统通知栏一定立刻展示。\n\n请切到桌面、锁屏，或下拉通知栏查看是否出现“${res.data.title}”通知。`,
      );
    } catch (error: any) {
      Alert.alert(
        '发送失败',
        error?.message || '测试推送发送失败，请检查后端配置。',
      );
    } finally {
      setSendingTestPush(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>账户信息</Text>
        </View>
        <View style={styles.section}>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>手机号</Text>
            <Text style={styles.rowValue}>{user?.phone || '未绑定'}</Text>
          </View>
          <TouchableOpacity style={styles.row} onPress={handleChangeNickname}>
            <Text style={styles.rowLabel}>昵称</Text>
            <View style={styles.rowRight}>
              <Text style={styles.rowValue}>{user?.nickname || '未设置'}</Text>
              <Text style={styles.rowArrow}>&gt;</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.row, styles.rowLast]}
            onPress={() => navigation.navigate('Verification')}
          >
            <Text style={styles.rowLabel}>实名认证</Text>
            <View style={styles.rowRight}>
              <Text
                style={[
                  styles.rowValue,
                  {
                    color:
                      user?.id_verified === 'approved'
                        ? theme.success
                        : theme.warning,
                  },
                ]}
              >
                {user?.id_verified === 'approved'
                  ? '已认证'
                  : user?.id_verified === 'pending'
                  ? '审核中'
                  : '未认证'}
              </Text>
              <Text style={styles.rowArrow}>&gt;</Text>
            </View>
          </TouchableOpacity>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>通知设置</Text>
        </View>
        <View style={styles.section}>
          <View style={styles.row}>
            <View style={styles.rowMain}>
              <Text style={styles.rowLabel}>接收推送通知</Text>
              <Text style={styles.rowHint}>
                控制当前设备是否接收系统下发的实时通知
              </Text>
            </View>
            {pushSaving || pushStateLoading ? (
              <ActivityIndicator size="small" color={theme.primary} />
            ) : (
              <Switch
                value={pushEnabled}
                onValueChange={handleTogglePush}
                trackColor={{ false: theme.inputBorder, true: theme.primary }}
                thumbColor={theme.isDark ? theme.text : '#fff'}
              />
            )}
          </View>
          <View style={styles.row}>
            <View style={styles.rowMain}>
              <Text style={[styles.rowLabel, { color: theme.textHint }]}>新消息通知</Text>
              <Text style={[styles.rowHint, { color: theme.textHint }]}>
                (功能开发中) 后续将支持按消息类型独立配置
              </Text>
            </View>
            <Switch
              disabled
              value={false}
              trackColor={{ false: theme.inputBorder, true: theme.primary }}
              thumbColor={theme.isDark ? theme.textHint : '#f4f4f5'}
            />
          </View>
          <View style={[styles.row, styles.rowLast]}>
            <View style={styles.rowMain}>
              <Text style={[styles.rowLabel, { color: theme.textHint }]}>订单状态通知</Text>
              <Text style={[styles.rowHint, { color: theme.textHint }]}>
                当前默认接收所有订单状态变更通知
              </Text>
            </View>
            <Switch
              disabled
              value={pushEnabled}
              trackColor={{ false: theme.inputBorder, true: theme.primary }}
              thumbColor={theme.isDark ? theme.textHint : '#f4f4f5'}
            />
          </View>
        </View>

        {showAndroidDebugSection ? (
          <>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>开发诊断 · 推送通道</Text>
            </View>
            <View style={[styles.section, styles.diagnosticSection]}>
              <View style={[
                styles.diagnosticBanner,
                { backgroundColor: canSendTestPush ? theme.success + '1A' : theme.warning + '1A' }
              ]}>
                <View style={[
                  styles.statusDot,
                  { backgroundColor: canSendTestPush ? theme.success : theme.warning }
                ]} />
                <Text style={[
                  styles.diagnosticBannerText,
                  { color: canSendTestPush ? theme.success : theme.warning }
                ]}>
                  {canSendTestPush ? '环境已就绪，可进行推送验收' : '环境未就绪，请检查以下配置项'}
                </Text>
              </View>

              <View style={styles.diagnosticContent}>
                <View style={styles.diagnosticItem}>
                  <Text style={styles.diagnosticLabel}>服务状态</Text>
                  <Text style={[styles.diagnosticValue, { color: pushDiagnostics?.configured ? theme.text : theme.warning }]}>
                    {formatPushServiceStatus(pushDiagnostics)}
                  </Text>
                </View>

                <View style={styles.diagnosticItem}>
                  <Text style={styles.diagnosticLabel}>极光连接</Text>
                  <Text style={[styles.diagnosticValue, {
                    color: pushDiagnostics?.connectionEnabled === false ? theme.warning : theme.text,
                  }]}>
                    {formatConnectionStatus(pushDiagnostics?.connectionEnabled ?? null)}
                  </Text>
                </View>

                <View style={styles.diagnosticItem}>
                  <Text style={styles.diagnosticLabel}>推送服务</Text>
                  <Text style={[styles.diagnosticValue, {
                    color: pushDiagnostics?.pushStopped ? theme.warning : theme.text,
                  }]}>
                    {formatPushStoppedStatus(pushDiagnostics?.pushStopped ?? null)}
                  </Text>
                </View>

                <View style={styles.diagnosticItem}>
                  <Text style={styles.diagnosticLabel}>通知权限</Text>
                  <View style={styles.diagnosticValueRow}>
                  <Text style={[styles.diagnosticValue, {
                    color: pushDiagnostics?.permissionStatus === 'granted' ? theme.success : theme.warning
                  }]}>
                      {formatPermissionStatus(pushDiagnostics?.permissionStatus || 'unknown')}
                    </Text>
                    {pushDiagnostics?.permissionStatus !== 'granted' && (
                      <TouchableOpacity onPress={handleRequestPermission} style={styles.diagnosticLink}>
                        <Text style={styles.diagnosticLinkText}>去授权</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>

                <View style={styles.diagnosticItem}>
                  <Text style={styles.diagnosticLabel}>设备别名</Text>
                  <Text style={styles.diagnosticValueMono} selectable>
                    {pushDiagnostics?.currentAlias || '未绑定'}
                  </Text>
                </View>

                <View style={styles.diagnosticItem}>
                  <Text style={styles.diagnosticLabel}>绑定状态</Text>
                  <Text style={[styles.diagnosticValue, {
                      color:
                      pushDiagnostics?.bindingStatus === 'synced'
                        ? theme.success
                        : pushDiagnostics?.bindingStatus === 'failed'
                          ? theme.danger
                          : theme.warning,
                  }]}>
                    {formatBindingStatus(pushDiagnostics?.bindingStatus || 'idle')}
                  </Text>
                </View>

                <View style={styles.diagnosticItem}>
                  <Text style={styles.diagnosticLabel}>终端标识</Text>
                  <Text style={styles.diagnosticValueMono} selectable numberOfLines={1} ellipsizeMode="middle">
                    {pushDiagnostics?.registrationID || '尚未获取'}
                  </Text>
                </View>
              </View>

              {!pushDiagnostics?.configured ? (
                <View style={styles.diagnosticWarningBox}>
                  <Text style={styles.diagnosticWarningText}>
                    提示：当前安装包未启用极光推送。需配置 JPUSH_APP_KEY 并重新打包后，方可获取真实终端标识进行验收。
                  </Text>
                </View>
              ) : null}

              {pushDiagnostics?.lastSyncError ? (
                <View style={styles.diagnosticWarningBox}>
                  <Text style={styles.diagnosticWarningText}>
                    最近一次绑定异常：{pushDiagnostics.lastSyncError}
                  </Text>
                </View>
              ) : null}

              <View style={styles.diagnosticActionArea}>
                <TouchableOpacity
                  disabled={!canSendTestPush || sendingTestPush}
                  style={[
                    styles.primaryAcceptanceButton,
                    (!canSendTestPush || sendingTestPush) && styles.primaryAcceptanceButtonDisabled,
                  ]}
                  onPress={handleSendTestPush}
                >
                  {sendingTestPush ? (
                    <ActivityIndicator size="small" color={theme.textHint} />
                  ) : (
                    <Text style={[
                      styles.primaryAcceptanceButtonText,
                      (!canSendTestPush || sendingTestPush) && styles.primaryAcceptanceButtonTextDisabled,
                    ]}>执行测试推送</Text>
                  )}
                </TouchableOpacity>
                <Text style={styles.diagnosticFootnote}>
                  点击后会先收到“请求已提交”提示，这代表推送通道已受理。真正的验收结果，请看系统通知栏、横幅或锁屏通知。
                </Text>
              </View>
            </View>
          </>
        ) : null}

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>通用</Text>
        </View>
        <View style={styles.section}>
          <TouchableOpacity style={styles.row} onPress={handleClearCache}>
            <Text style={styles.rowLabel}>清除缓存</Text>
            <Text style={styles.rowArrow}>&gt;</Text>
          </TouchableOpacity>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>当前版本</Text>
            <Text style={styles.rowValue}>{APP_VERSION}</Text>
          </View>
          <View style={[styles.row, styles.rowLast]}>
            <Text style={styles.rowLabel}>构建编号</Text>
            <Text style={styles.rowValue}>{APP_VERSION_CODE}</Text>
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>关于</Text>
        </View>
        <View style={styles.section}>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>用户协议</Text>
            <Text style={styles.rowArrow}>&gt;</Text>
          </View>
          <View style={[styles.row, styles.rowLast]}>
            <Text style={styles.rowLabel}>隐私政策</Text>
            <Text style={styles.rowArrow}>&gt;</Text>
          </View>
        </View>

        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Text style={styles.logoutText}>退出登录</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const getStyles = (theme: AppTheme) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.bgSecondary },
    scrollContent: { paddingBottom: 40 },
    sectionHeader: { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 8 },
    sectionTitle: { fontSize: 13, color: theme.textSub, fontWeight: '500' },
    section: {
      marginHorizontal: 12,
      borderRadius: 14,
      backgroundColor: theme.card,
      borderWidth: 1,
      borderColor: theme.cardBorder,
      overflow: 'hidden',
    },
    row: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 14,
      borderBottomWidth: 1,
      borderBottomColor: theme.divider,
    },
    rowLast: {
      borderBottomWidth: 0,
    },
    rowMain: {
      flex: 1,
      paddingRight: 12,
    },
    rowLabel: { fontSize: 15, color: theme.text },
    rowHint: {
      marginTop: 4,
      fontSize: 12,
      lineHeight: 18,
      color: theme.textHint,
    },
    rowRight: { flexDirection: 'row', alignItems: 'center' },
    rowValue: { fontSize: 15, color: theme.textSub },
    rowArrow: { fontSize: 16, color: theme.textHint, marginLeft: 8 },

    // Diagnostic Section Styles
    diagnosticSection: {
      marginHorizontal: 12,
      borderRadius: 14,
      backgroundColor: theme.card,
      borderWidth: 1,
      borderColor: theme.cardBorder,
      overflow: 'hidden',
    },
    diagnosticBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: theme.divider,
    },
    statusDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      marginRight: 8,
    },
    diagnosticBannerText: {
      fontSize: 14,
      fontWeight: '500',
    },
    diagnosticContent: {
      paddingHorizontal: 16,
      paddingTop: 8,
      paddingBottom: 8,
    },
    diagnosticItem: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 10,
    },
    diagnosticLabel: {
      fontSize: 14,
      color: theme.textSub,
    },
    diagnosticValueRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    diagnosticValue: {
      fontSize: 14,
      color: theme.text,
      textAlign: 'right',
    },
    diagnosticValueMono: {
      fontSize: 14,
      color: theme.textSub,
      textAlign: 'right',
      maxWidth: '60%',
    },
    diagnosticLink: {
      marginLeft: 12,
      paddingHorizontal: 10,
      paddingVertical: 4,
      backgroundColor: theme.primaryBg,
      borderRadius: 12,
    },
    diagnosticLinkText: {
      fontSize: 12,
      color: theme.primary,
      fontWeight: '500',
    },
    diagnosticWarningBox: {
      marginHorizontal: 16,
      marginBottom: 16,
      padding: 12,
      backgroundColor: theme.warning + '1A',
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.warning + '33',
    },
    diagnosticWarningText: {
      fontSize: 13,
      lineHeight: 18,
      color: theme.warning,
    },
    diagnosticActionArea: {
      paddingHorizontal: 16,
      paddingBottom: 16,
    },
    diagnosticFootnote: {
      marginTop: 10,
      fontSize: 12,
      lineHeight: 18,
      color: theme.textHint,
    },
    primaryAcceptanceButton: {
      height: 44,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.btnPrimary,
    },
    primaryAcceptanceButtonDisabled: {
      backgroundColor: theme.inputBg,
      borderWidth: 1,
      borderColor: theme.inputBorder,
    },
    primaryAcceptanceButtonText: {
      color: theme.btnPrimaryText,
      fontSize: 15,
      fontWeight: '600',
    },
    primaryAcceptanceButtonTextDisabled: {
      color: theme.textHint,
      fontWeight: '500',
    },

    logoutBtn: {
      marginHorizontal: 24,
      marginTop: 24,
      height: 48,
      backgroundColor: theme.card,
      borderRadius: 12,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: theme.danger,
    },
    logoutText: { color: theme.danger, fontSize: 16, fontWeight: '500' },
  });
