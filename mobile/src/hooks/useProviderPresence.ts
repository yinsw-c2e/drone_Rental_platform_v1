import {useFocusEffect} from '@react-navigation/native';
import {AppState} from 'react-native';
import {useCallback, useEffect, useRef} from 'react';
import {useDispatch, useSelector} from 'react-redux';
import {providerPresenceService} from '../services/providerPresence';
import {
  heartbeatFailed,
  heartbeatSucceeded,
  setError,
  wentOffline,
  wentOnline,
} from '../store/slices/providerPresenceSlice';
import type {RootState} from '../store/store';
import {friendlyErrorMessage} from '../utils/errorMessage';
import {getCurrentPosition} from '../utils/LocationService';
import showToast from '../utils/toast';
import type {V2ApiResponse, V2ProviderPresence} from '../types';

const HEARTBEAT_INTERVAL_MS = 10_000;
const MAX_HEARTBEAT_FAILURES_BEFORE_TOAST = 3;

type HeartbeatLifecycle = 'page' | 'manual';

type PresenceLocation = {
  latitude: number;
  longitude: number;
};

export interface UseProviderPresenceOptions {
  managedByGlobalShell?: boolean;
  heartbeatLifecycle?: HeartbeatLifecycle;
  showHeartbeatFailureToast?: boolean;
}

const unwrapPresence = (res: V2ApiResponse<V2ProviderPresence> | V2ProviderPresence) =>
  ((res as V2ApiResponse<V2ProviderPresence>)?.data || res) as V2ProviderPresence;

export function useProviderPresence(options: UseProviderPresenceOptions = {}) {
  const dispatch = useDispatch();
  const state = useSelector((s: RootState) => s.providerPresence);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stateRef = useRef(state);
  const lastLocationErrorRef = useRef<string | null>(null);
  const failureToastShownRef = useRef(false);
  const heartbeatLifecycle: HeartbeatLifecycle =
    options.heartbeatLifecycle ?? (options.managedByGlobalShell ? 'manual' : 'page');
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
      const loc = await getCurrentPosition();
      lastLocationErrorRef.current = null;
      return loc;
    } catch (error: unknown) {
      const message = friendlyErrorMessage(error, '位置授权失败');
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
      const res = await providerPresenceService.heartbeat({
        latitude: loc.latitude,
        longitude: loc.longitude,
        accepted_service_classes: current.acceptedServiceClasses,
        max_radius_km: current.maxRadiusKM,
      });
      failureToastShownRef.current = false;
      dispatch(heartbeatSucceeded({presence: unwrapPresence(res), location: loc}));
    } catch (error: unknown) {
      dispatch(heartbeatFailed(friendlyErrorMessage(error, '心跳失败')));
    }
  }, [acquireLocation, dispatch]);

  const startHeartbeat = useCallback(() => {
    stopHeartbeat();
    timerRef.current = setInterval(() => {
      sendHeartbeat();
    }, HEARTBEAT_INTERVAL_MS);
  }, [sendHeartbeat, stopHeartbeat]);

  const goOnline = useCallback(async (opts?: {acceptedClasses?: string[]; maxRadiusKM?: number}) => {
    const current = stateRef.current;
    const loc = await acquireLocation();
    if (!loc) return false;
    try {
      const res = await providerPresenceService.online({
        latitude: loc.latitude,
        longitude: loc.longitude,
        accepted_service_classes: opts?.acceptedClasses ?? current.acceptedServiceClasses,
        max_radius_km: opts?.maxRadiusKM ?? current.maxRadiusKM,
      });
      failureToastShownRef.current = false;
      dispatch(wentOnline({presence: unwrapPresence(res), location: loc}));
      if (managesHeartbeatLifecycle) {
        startHeartbeat();
      }
      return true;
    } catch (error: unknown) {
      dispatch(setError(friendlyErrorMessage(error, '上线失败')));
      return false;
    }
  }, [acquireLocation, dispatch, managesHeartbeatLifecycle, startHeartbeat]);

  const goOffline = useCallback(async () => {
    stopHeartbeat();
    dispatch(wentOffline());
    try {
      await providerPresenceService.offline();
    } catch {
      // 后端下线失败不阻塞本地状态。
    }
  }, [dispatch, stopHeartbeat]);

  useFocusEffect(
    useCallback(() => {
      if (managesHeartbeatLifecycle && stateRef.current.online && !timerRef.current) {
        startHeartbeat();
      }
      return () => {
        if (managesHeartbeatLifecycle) {
          stopHeartbeat();
        }
      };
    }, [managesHeartbeatLifecycle, startHeartbeat, stopHeartbeat]),
  );

  useEffect(() => {
    const sub = AppState.addEventListener('change', nextState => {
      if (!managesHeartbeatLifecycle) {
        return;
      }
      if (nextState === 'background' || nextState === 'inactive') {
        stopHeartbeat();
        return;
      }
      if (nextState === 'active' && stateRef.current.online && !timerRef.current) {
        startHeartbeat();
      }
    });
    return () => sub.remove();
  }, [managesHeartbeatLifecycle, startHeartbeat, stopHeartbeat]);

  useEffect(() => () => stopHeartbeat(), [stopHeartbeat]);

  useEffect(() => {
    if (
      showHeartbeatFailureToast &&
      state.online &&
      state.heartbeatFailureCount >= MAX_HEARTBEAT_FAILURES_BEFORE_TOAST &&
      !failureToastShownRef.current
    ) {
      failureToastShownRef.current = true;
      showToast('定位心跳异常，系统将自动重试');
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
