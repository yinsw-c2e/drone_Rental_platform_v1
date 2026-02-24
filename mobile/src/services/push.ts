/**
 * 推送通知服务
 *
 * 当前为模拟实现，集成极光推送需要：
 * 1. npm install jpush-react-native jcore-react-native
 * 2. 在 android/app/build.gradle 配置 JPush
 * 3. 在 iOS 配置推送证书和 JPush
 * 4. 在 .env 中配置 JPUSH_APP_KEY 和 PUSH_ENABLED=true
 */

import {Platform, Alert} from 'react-native';
import {PUSH_CONFIG} from '../constants';

// 推送消息类型
export interface PushMessage {
  title: string;
  content: string;
  extras: Record<string, string>;
}

// 推送服务回调
type PushCallback = (message: PushMessage) => void;

class PushNotificationService {
  private initialized = false;
  private callbacks: PushCallback[] = [];
  private registrationID: string | null = null;

  /**
   * 初始化推送服务
   */
  init() {
    if (this.initialized) return;

    if (!PUSH_CONFIG.enabled || !PUSH_CONFIG.appKey) {
      console.log('[Push] Push service disabled or not configured');
      return;
    }

    try {
      // 实际集成时取消下方注释并安装 jpush-react-native
      // import JPush from 'jpush-react-native';
      //
      // JPush.init({appKey: PUSH_CONFIG.appKey, channel: 'default', production: !__DEV__});
      //
      // JPush.addConnectEventListener((result) => {
      //   console.log('[Push] Connect:', result.connectEnable);
      // });
      //
      // JPush.addNotificationListener((result) => {
      //   console.log('[Push] Notification:', result);
      //   this.handleNotification(result);
      // });
      //
      // JPush.addCustomMessageListener((result) => {
      //   console.log('[Push] Custom Message:', result);
      // });
      //
      // JPush.addOpenNotificationListener((result) => {
      //   console.log('[Push] Open Notification:', result);
      //   this.handleNotificationOpen(result);
      // });
      //
      // JPush.getRegistrationID((result) => {
      //   this.registrationID = result.registerID;
      //   console.log('[Push] RegistrationID:', this.registrationID);
      // });

      console.log('[Push] Push service initialized (mock mode)');
      this.initialized = true;
    } catch (e) {
      console.error('[Push] Init failed:', e);
    }
  }

  /**
   * 设置用户别名（用于定向推送）
   */
  setAlias(userID: number) {
    if (!this.initialized) return;

    const alias = `user_${userID}`;
    console.log('[Push] Setting alias:', alias);

    // 实际集成：
    // JPush.setAlias({alias, sequence: Date.now()});
  }

  /**
   * 清除用户别名（退出登录时调用）
   */
  clearAlias() {
    if (!this.initialized) return;

    console.log('[Push] Clearing alias');
    // 实际集成：
    // JPush.deleteAlias({sequence: Date.now()});
  }

  /**
   * 获取设备注册ID
   */
  getRegistrationID(): string | null {
    return this.registrationID;
  }

  /**
   * 添加推送消息监听
   */
  addListener(callback: PushCallback) {
    this.callbacks.push(callback);
    return () => {
      this.callbacks = this.callbacks.filter(cb => cb !== callback);
    };
  }

  /**
   * 处理收到的推送通知
   */
  private handleNotification(result: any) {
    const message: PushMessage = {
      title: result.title || '',
      content: result.alertContent || result.alert || '',
      extras: result.extras || {},
    };

    this.callbacks.forEach(cb => cb(message));
  }

  /**
   * 处理用户点击推送通知
   */
  private handleNotificationOpen(result: any) {
    const extras = result.extras || {};
    const type = extras.type;

    console.log('[Push] Notification opened, type:', type);

    // 根据推送类型导航到对应页面
    // 实际使用时需要结合 navigation ref 进行页面跳转
    switch (type) {
      case 'order_status':
        // NavigationService.navigate('OrderDetail', {orderId: extras.order_id});
        break;
      case 'new_message':
        // NavigationService.navigate('Chat', {peerId: extras.peer_id});
        break;
      case 'verification':
        // NavigationService.navigate('Verification');
        break;
      default:
        break;
    }
  }

  /**
   * 请求通知权限（iOS）
   */
  requestPermission() {
    if (Platform.OS === 'ios') {
      // 实际集成：
      // JPush.requestNotificationAuthorization({alert: true, badge: true, sound: true});
      console.log('[Push] Requesting notification permission');
    }
  }

  /**
   * 设置角标数字（iOS）
   */
  setBadge(count: number) {
    if (Platform.OS === 'ios') {
      // 实际集成：
      // JPush.setBadge({badge: count, appBadge: count});
      console.log('[Push] Setting badge:', count);
    }
  }
}

export const pushService = new PushNotificationService();
