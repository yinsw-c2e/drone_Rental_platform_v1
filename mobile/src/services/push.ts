import AsyncStorage from '@react-native-async-storage/async-storage';
import JPush from 'jpush-react-native';
import { PermissionsAndroid, Platform } from 'react-native';
import { APP_CONFIG, PUSH_CONFIG } from '../constants';
import { pushDeviceService } from './pushDevice';

const PUSH_ENABLED_STORAGE_KEY = 'push_enabled';
const PUSH_CHANNEL = 'developer-default';
const DEFAULT_PUSH_ENABLED = true;
const REGISTRATION_RETRY_ATTEMPTS = 8;
const REGISTRATION_RETRY_DELAY_MS = 1500;
const ALIAS_OPERATION_TIMEOUT_MS = 8000;
const PUSH_STATUS_TIMEOUT_MS = 2500;
const MAX_SAFE_SEQUENCE = 2147483000;

export interface PushMessage {
  title: string;
  content: string;
  extras: Record<string, string>;
  notificationEventType?: string;
}

export type PushPermissionStatus =
  | 'granted'
  | 'denied'
  | 'blocked'
  | 'unavailable'
  | 'unknown';

export type PushBindingStatus =
  | 'idle'
  | 'disabled'
  | 'waiting_registration'
  | 'syncing'
  | 'synced'
  | 'failed';

export interface PushDebugState {
  platformSupported: boolean;
  configured: boolean;
  enabled: boolean;
  initialized: boolean;
  registrationID: string | null;
  currentAlias: string | null;
  permissionStatus: PushPermissionStatus;
  bindingStatus: PushBindingStatus;
  connectionEnabled: boolean | null;
  pushStopped: boolean | null;
  lastSyncError: string | null;
  lastNotification?: PushMessage | null;
}

type PushCallback = (message: PushMessage) => void;
type AliasOperationKind = 'set' | 'delete';

interface PendingAliasOperation {
  kind: AliasOperationKind;
  alias: string | null;
  resolve: () => void;
  reject: (error: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
}

class PushNotificationService {
  private initialized = false;
  private listenersRegistered = false;
  private callbacks: PushCallback[] = [];
  private registrationID: string | null = null;
  private currentAlias: string | null = null;
  private enabledCache = DEFAULT_PUSH_ENABLED;
  private enabledLoaded = false;
  private lastNotification: PushMessage | null = null;
  private bindingStatus: PushBindingStatus = 'idle';
  private connectionEnabled: boolean | null = null;
  private pushStopped: boolean | null = null;
  private lastSyncError: string | null = null;
  private pendingUserID: number | null = null;
  private registrationWaitPromise: Promise<string | null> | null = null;
  private syncPromise: Promise<void> | null = null;
  private nextSequenceValue = 1;
  private aliasOperations = new Map<number, PendingAliasOperation>();

  private isAndroid() {
    return Platform.OS === 'android';
  }

  private isConfigured() {
    return this.isAndroid() && PUSH_CONFIG.enabled;
  }

  private nextSequence() {
    if (this.nextSequenceValue >= MAX_SAFE_SEQUENCE) {
      this.nextSequenceValue = 1;
    } else {
      this.nextSequenceValue += 1;
    }

    return this.nextSequenceValue;
  }

  private async sleep(ms: number) {
    return new Promise(resolve => {
      setTimeout(resolve, ms);
    });
  }

  private updateBindingStatus(
    status: PushBindingStatus,
    errorMessage: string | null = null,
  ) {
    this.bindingStatus = status;
    this.lastSyncError = errorMessage;
  }

  private async loadEnabledPreference() {
    if (this.enabledLoaded) {
      return this.enabledCache;
    }

    try {
      const rawValue = await AsyncStorage.getItem(PUSH_ENABLED_STORAGE_KEY);
      this.enabledCache =
        rawValue === null ? DEFAULT_PUSH_ENABLED : rawValue === 'true';
    } catch (error) {
      console.warn(
        '[Push] Failed to load push preference, fallback to default',
        error,
      );
      this.enabledCache = DEFAULT_PUSH_ENABLED;
    } finally {
      this.enabledLoaded = true;
    }

    return this.enabledCache;
  }

  private async runAliasOperation(
    kind: AliasOperationKind,
    alias: string | null = null,
  ) {
    return new Promise<void>((resolve, reject) => {
      const sequence = this.nextSequence();
      const timeout = setTimeout(() => {
        this.aliasOperations.delete(sequence);
        reject(new Error(`alias ${kind} timed out`));
      }, ALIAS_OPERATION_TIMEOUT_MS);

      this.aliasOperations.set(sequence, {
        kind,
        alias,
        resolve,
        reject,
        timeout,
      });

      try {
        if (kind === 'set' && alias) {
          JPush.setAlias({ alias, sequence });
        } else {
          JPush.deleteAlias({ sequence });
        }
      } catch (error) {
        clearTimeout(timeout);
        this.aliasOperations.delete(sequence);
        reject(
          error instanceof Error
            ? error
            : new Error(`alias ${kind} failed to start`),
        );
      }
    });
  }

  private registerListeners() {
    if (this.listenersRegistered || !this.isAndroid()) {
      return;
    }

    JPush.addConnectEventListener(result => {
      console.log('[Push] Connect event:', result);
      this.connectionEnabled =
        typeof result?.connectEnable === 'boolean'
          ? result.connectEnable
          : this.connectionEnabled;
      this.refreshRegistrationID()
        .then(registrationID => {
          if (registrationID && this.pendingUserID) {
            this.syncUser(this.pendingUserID).catch(error => {
              console.warn('[Push] Failed to sync user after connect', error);
            });
          }
        })
        .catch(error => {
          console.warn(
            '[Push] Failed to refresh registration id after connect',
            error,
          );
        });
    });

    JPush.addNotificationListener(result => {
      console.log('[Push] Notification event:', result);
      this.handleNotification(result);
    });

    JPush.addTagAliasListener(result => {
      console.log('[Push] Tag/Alias event:', result);
      const operation = this.aliasOperations.get(result.sequence);
      if (!operation) {
        return;
      }

      clearTimeout(operation.timeout);
      this.aliasOperations.delete(result.sequence);

      if (result.code === 0) {
        if (operation.kind === 'set') {
          this.currentAlias = operation.alias;
          this.updateBindingStatus('synced');
        } else {
          this.currentAlias = null;
        }
        operation.resolve();
        return;
      }

      if (operation.kind === 'set') {
        this.currentAlias = null;
      }

      const error = new Error(
        `alias ${operation.kind} failed with code ${result.code}`,
      );
      this.updateBindingStatus('failed', error.message);
      operation.reject(error);
    });

    this.listenersRegistered = true;
  }

  private async refreshRegistrationID() {
    if (!this.isAndroid() || !this.initialized) {
      return null;
    }

    return new Promise<string | null>(resolve => {
      try {
        JPush.getRegistrationID(result => {
          const nextRegistrationID =
            typeof result?.registerID === 'string' && result.registerID.trim()
              ? result.registerID.trim()
              : null;

          const registrationChanged = nextRegistrationID !== this.registrationID;
          this.registrationID = nextRegistrationID;

          if (
            registrationChanged &&
            nextRegistrationID &&
            this.pendingUserID &&
            this.enabledCache
          ) {
            this.syncUser(this.pendingUserID).catch(error => {
              console.warn(
                '[Push] Failed to sync user after registration id refresh',
                error,
              );
            });
          }

          resolve(nextRegistrationID);
        });
      } catch (error) {
        console.warn('[Push] Failed to get registration id', error);
        resolve(this.registrationID);
      }
    });
  }

  private async waitForRegistrationID() {
    if (this.registrationID) {
      return this.registrationID;
    }

    if (this.registrationWaitPromise) {
      return this.registrationWaitPromise;
    }

    this.registrationWaitPromise = (async () => {
      for (let attempt = 0; attempt < REGISTRATION_RETRY_ATTEMPTS; attempt += 1) {
        const registrationID = await this.refreshRegistrationID();
        if (registrationID) {
          return registrationID;
        }

        if (attempt < REGISTRATION_RETRY_ATTEMPTS - 1) {
          await this.sleep(REGISTRATION_RETRY_DELAY_MS);
        }
      }

      return this.registrationID;
    })().finally(() => {
      this.registrationWaitPromise = null;
    });

    return this.registrationWaitPromise;
  }

  private async refreshPushStatus() {
    if (!this.isAndroid() || !this.initialized) {
      return this.pushStopped;
    }

    return new Promise<boolean | null>(resolve => {
      let finished = false;
      const finalize = (value: boolean | null) => {
        if (finished) {
          return;
        }
        finished = true;
        resolve(value);
      };

      const timeout = setTimeout(() => {
        console.warn('[Push] getPushStatus timed out');
        finalize(this.pushStopped);
      }, PUSH_STATUS_TIMEOUT_MS);

      try {
        JPush.getPushStatus(result => {
          clearTimeout(timeout);
          if (typeof result?.isStopped === 'boolean') {
            this.pushStopped = result.isStopped;
          }
          finalize(this.pushStopped);
        });
      } catch (error) {
        clearTimeout(timeout);
        console.warn('[Push] Failed to get push status', error);
        finalize(this.pushStopped);
      }
    });
  }

  private handleNotification(result: any) {
    const message: PushMessage = {
      title: result.title || '',
      content: result.alertContent || result.content || result.alert || '',
      extras: result.extras || {},
      notificationEventType: result.notificationEventType,
    };

    this.lastNotification = message;
    this.callbacks.forEach(callback => callback(message));
  }

  private async performSyncUser(userID: number | null) {
    const enabled = await this.loadEnabledPreference();
    this.pendingUserID = enabled ? userID : null;

    if (!this.isConfigured()) {
      this.currentAlias = null;
      this.registrationID = null;
      this.updateBindingStatus('idle');
      return;
    }

    await this.init();
    if (!this.initialized) {
      return;
    }

    if (!enabled || !userID) {
      try {
        if (this.currentAlias) {
          this.updateBindingStatus('syncing');
          await this.runAliasOperation('delete');
        } else {
          this.currentAlias = null;
        }
      } catch (error) {
        console.warn('[Push] Failed to clear alias', error);
      } finally {
        this.currentAlias = null;
        this.pendingUserID = null;
        this.updateBindingStatus(enabled ? 'idle' : 'disabled');
      }
      return;
    }

    const registrationID = await this.waitForRegistrationID();
    if (!registrationID) {
      this.currentAlias = null;
      this.updateBindingStatus(
        'waiting_registration',
        '极光终端标识尚未返回，请稍候几秒后再试。',
      );
      return;
    }

    const alias = `user_${userID}`;
    if (this.currentAlias === alias && this.bindingStatus === 'synced') {
      return;
    }

    this.updateBindingStatus('syncing');

    try {
      await this.runAliasOperation('set', alias);
      await pushDeviceService.register({
        registration_id: registrationID,
        platform: 'android',
      });
      this.currentAlias = alias;
      this.updateBindingStatus('synced');
      console.log('[Push] Alias synced:', alias);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'push alias sync failed';
      this.currentAlias = null;
      this.updateBindingStatus('failed', message);
      console.warn('[Push] Failed to sync alias/device binding', error);
    }
  }

  async init() {
    await this.loadEnabledPreference();

    if (this.initialized || !this.isConfigured()) {
      if (!this.isConfigured()) {
        console.log(
          '[Push] Android real push is disabled or missing JPUSH_APP_KEY',
        );
      }
      return;
    }

    try {
      this.registerListeners();
      JPush.setLoggerEnable(APP_CONFIG.debugMode);
      JPush.init({
        appKey: PUSH_CONFIG.appKey,
        channel: PUSH_CHANNEL,
        production: !__DEV__,
      });
      JPush.requestPermission();
      JPush.resumePush();
      this.initialized = true;
      await this.waitForRegistrationID();
      await this.refreshPushStatus();
      if (!this.registrationID) {
        this.updateBindingStatus(
          'waiting_registration',
          '极光终端标识尚未返回，请保持网络通畅后稍候重试。',
        );
      }
      console.log('[Push] Android push service initialized');
    } catch (error) {
      this.updateBindingStatus(
        'failed',
        error instanceof Error ? error.message : 'push init failed',
      );
      console.error('[Push] Init failed:', error);
    }
  }

  async getEnabled() {
    return this.loadEnabledPreference();
  }

  async setEnabled(enabled: boolean, userID: number | null) {
    this.enabledCache = enabled;
    this.enabledLoaded = true;
    await AsyncStorage.setItem(PUSH_ENABLED_STORAGE_KEY, String(enabled));

    if (!this.isAndroid()) {
      return this.getDebugState();
    }

    if (enabled) {
      await this.init();
      await this.requestNotificationPermission();
    }

    await this.syncUser(enabled ? userID : null);
    return this.getDebugState();
  }

  async syncUser(userID: number | null) {
    const nextSync = async () => {
      await this.performSyncUser(userID);
    };

    if (this.syncPromise) {
      await this.syncPromise.catch(() => undefined);
    }

    this.syncPromise = nextSync().finally(() => {
      this.syncPromise = null;
    });

    return this.syncPromise;
  }

  async requestNotificationPermission(): Promise<PushPermissionStatus> {
    if (!this.isAndroid()) {
      return 'unavailable';
    }

    const androidVersion =
      typeof Platform.Version === 'string'
        ? parseInt(Platform.Version, 10)
        : Platform.Version;

    if (androidVersion < 33) {
      return 'granted';
    }

    try {
      const result = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
      );

      if (result === PermissionsAndroid.RESULTS.GRANTED) {
        return 'granted';
      }
      if (result === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN) {
        return 'blocked';
      }
      return 'denied';
    } catch (error) {
      console.warn('[Push] Failed to request notification permission', error);
      return 'unknown';
    }
  }

  async getPermissionStatus(): Promise<PushPermissionStatus> {
    if (!this.isAndroid()) {
      return 'unavailable';
    }

    const androidVersion =
      typeof Platform.Version === 'string'
        ? parseInt(Platform.Version, 10)
        : Platform.Version;

    if (androidVersion < 33) {
      return 'granted';
    }

    try {
      const granted = await PermissionsAndroid.check(
        PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
      );
      return granted ? 'granted' : 'denied';
    } catch (error) {
      console.warn('[Push] Failed to check notification permission', error);
      return 'unknown';
    }
  }

  async getRegistrationID() {
    if (!this.registrationID) {
      await this.refreshRegistrationID();
    }
    return this.registrationID;
  }

  async getDebugState(): Promise<PushDebugState> {
    const enabled = await this.loadEnabledPreference();
    const permissionStatus = await this.getPermissionStatus();

    if (this.initialized) {
      await this.refreshRegistrationID();
      await this.refreshPushStatus();
    }

    return {
      platformSupported: this.isAndroid(),
      configured: this.isConfigured(),
      enabled,
      initialized: this.initialized,
      registrationID: this.registrationID,
      currentAlias: this.currentAlias,
      permissionStatus,
      bindingStatus: this.bindingStatus,
      connectionEnabled: this.connectionEnabled,
      pushStopped: this.pushStopped,
      lastSyncError: this.lastSyncError,
      lastNotification: this.lastNotification,
    };
  }

  addListener(callback: PushCallback) {
    this.callbacks.push(callback);
    return () => {
      this.callbacks = this.callbacks.filter(item => item !== callback);
    };
  }
}

export const pushService = new PushNotificationService();
