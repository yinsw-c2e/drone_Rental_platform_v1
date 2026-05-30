import Taro, { useDidHide, useDidShow } from '@tarojs/taro';
import { useCallback, useEffect, useRef } from 'react';
import { useSelector } from 'react-redux';
import { providerPresenceService } from '../services/providerPresence';
import {
  heartbeatFailed,
  heartbeatSucceeded,
  setError,
  wentOffline,
  wentOnline,
} from '../store/slices/providerPresenceSlice';
import { RootState, useAppDispatch } from '../store/store';

const HEARTBEAT_INTERVAL_MS = 10_000;
const MAX_HEARTBEAT_FAILURES_BEFORE_TOAST = 3;

type HeartbeatLifecycle = 'page' | 'manual';

type PresenceLocation = {
  latitude: number;
  longitude: number;
};

export interface UseProviderPresenceOptions {
  /**
   * Set this for page-level consumers once ProviderGlobalShell owns heartbeat
   * lifecycle. The hook will still expose state and online/offline actions.
   */
  managedByGlobalShell?: boolean;
  heartbeatLifecycle?: HeartbeatLifecycle;
  showHeartbeatFailureToast?: boolean;
}

export function useProviderPresence(options: UseProviderPresenceOptions = {}) {
  const dispatch = useAppDispatch();
  const state = useSelector((s: RootState) => s.providerPresence);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stateRef = useRef(state);
  const lastLocationErrorRef = useRef<string | null>(null);
  const failureToastShownRef = useRef(false);
  const heartbeatLifecycle: HeartbeatLifecycle = options.heartbeatLifecycle
    ?? (options.managedByGlobalShell ? 'manual' : 'page');
  const managesHeartbeatLifecycle = heartbeatLifecycle !== 'manual';
  const showHeartbeatFailureToast = options.showHeartbeatFailureToast ?? managesHeartbeatLifecycle;

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const stopHeartbeat = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const acquireLocation = useCallback(async (): Promise<PresenceLocation | null> => {
    try {
      const res = await Taro.getLocation({ type: 'gcj02' });
      lastLocationErrorRef.current = null;
      return { latitude: res.latitude, longitude: res.longitude };
    } catch (error: any) {
      const message = String(error?.errMsg || '位置授权失败');
      lastLocationErrorRef.current = message;
      dispatch(setError(message));
      return null;
    }
  }, [dispatch]);

  const sendHeartbeat = useCallback(async () => {
    const current = stateRef.current;
    const loc = await acquireLocation();
    if (!loc) {
      dispatch(heartbeatFailed(lastLocationErrorRef.current || '位置授权失败'));
      return;
    }
    try {
      const presence = await providerPresenceService.heartbeat({
        latitude: loc.latitude,
        longitude: loc.longitude,
        accepted_service_classes: current.acceptedServiceClasses,
        max_radius_km: current.maxRadiusKM,
      });
      failureToastShownRef.current = false;
      dispatch(heartbeatSucceeded({ presence, location: loc }));
    } catch (error: any) {
      dispatch(heartbeatFailed(String(error?.message || '心跳失败')));
    }
  }, [acquireLocation, dispatch]);

  const startHeartbeat = useCallback(() => {
    stopHeartbeat();
    timerRef.current = setInterval(() => {
      sendHeartbeat();
    }, HEARTBEAT_INTERVAL_MS);
  }, [sendHeartbeat, stopHeartbeat]);

  const goOnline = useCallback(async (opts?: { acceptedClasses?: string[]; maxRadiusKM?: number }) => {
    const current = stateRef.current;
    const loc = await acquireLocation();
    if (!loc) return false;
    try {
      const presence = await providerPresenceService.online({
        latitude: loc.latitude,
        longitude: loc.longitude,
        accepted_service_classes: opts?.acceptedClasses ?? current.acceptedServiceClasses,
        max_radius_km: opts?.maxRadiusKM ?? current.maxRadiusKM,
      });
      failureToastShownRef.current = false;
      dispatch(wentOnline({ presence, location: loc }));
      if (managesHeartbeatLifecycle) {
        startHeartbeat();
      }
      return true;
    } catch (error: any) {
      dispatch(setError(String(error?.message || '上线失败')));
      return false;
    }
  }, [acquireLocation, dispatch, managesHeartbeatLifecycle, startHeartbeat]);

  const goOffline = useCallback(async () => {
    stopHeartbeat();
    dispatch(wentOffline());
    try {
      await providerPresenceService.offline();
    } catch {
      // 后端失败不阻塞本地下线。
    }
  }, [dispatch, stopHeartbeat]);

  useDidHide(() => {
    if (heartbeatLifecycle === 'page') {
      stopHeartbeat();
    }
  });

  useDidShow(() => {
    if (heartbeatLifecycle === 'page' && stateRef.current.online && !timerRef.current) {
      startHeartbeat();
    }
  });

  useEffect(() => () => stopHeartbeat(), [stopHeartbeat]);

  useEffect(() => {
    if (
      showHeartbeatFailureToast &&
      state.online &&
      state.heartbeatFailureCount >= MAX_HEARTBEAT_FAILURES_BEFORE_TOAST &&
      !failureToastShownRef.current
    ) {
      failureToastShownRef.current = true;
      Taro.showToast({ title: '定位心跳异常，系统将自动重试', icon: 'none' });
    }
  }, [showHeartbeatFailureToast, state.heartbeatFailureCount, state.online]);

  return {
    presence: state,
    goOnline,
    goOffline,
    startHeartbeat,
    stopHeartbeat,
  };
}

export default useProviderPresence;
