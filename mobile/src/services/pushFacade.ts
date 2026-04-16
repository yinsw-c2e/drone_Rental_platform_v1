import {Platform} from 'react-native';

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

export interface PushMessage {
  title: string;
  content: string;
  extras: Record<string, string>;
  notificationEventType?: string;
}

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

const noopDebugState: PushDebugState = {
  platformSupported: Platform.OS === 'android',
  configured: false,
  enabled: false,
  initialized: false,
  registrationID: null,
  currentAlias: null,
  permissionStatus: Platform.OS === 'android' ? 'unknown' : 'unavailable',
  bindingStatus: 'idle',
  connectionEnabled: null,
  pushStopped: null,
  lastSyncError: null,
  lastNotification: null,
};

const noopPushService = {
  async init() {
    return;
  },
  async getEnabled() {
    return false;
  },
  async setEnabled() {
    return {...noopDebugState};
  },
  async syncUser() {
    return;
  },
  async requestNotificationPermission(): Promise<PushPermissionStatus> {
    return Platform.OS === 'android' ? 'unknown' : 'unavailable';
  },
  async getPermissionStatus(): Promise<PushPermissionStatus> {
    return Platform.OS === 'android' ? 'unknown' : 'unavailable';
  },
  async getDebugState(): Promise<PushDebugState> {
    return {...noopDebugState};
  },
  subscribe(_callback: PushCallback) {
    return () => {};
  },
};

const loadPushService = () => {
  if (Platform.OS !== 'android') {
    return noopPushService;
  }

  try {
    const mod = require('./push');
    if (mod?.pushService) {
      return mod.pushService;
    }
    console.warn('[PushFacade] push service module loaded without pushService export');
    return noopPushService;
  } catch (error) {
    console.warn('[PushFacade] Failed to load push service, fallback to noop', error);
    return noopPushService;
  }
};

export const pushService = loadPushService();
