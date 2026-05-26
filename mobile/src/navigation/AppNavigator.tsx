import React, { useEffect, useState } from 'react';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { ActivityIndicator, Alert, StyleSheet, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../store/store';
import { markMeInitialized, setMeSummary } from '../store/slices/authSlice';
import {
  HAUL_ROLE_MODE_STORAGE_KEY,
  hydrateHaulRoleMode,
} from '../store/slices/roleSlice';
import { pushService } from '../services/pushFacade';
import { sessionService } from '../services/session';
import { wsService } from '../services/websocket';
import { useTheme } from '../theme/ThemeContext';
import AuthNavigator from './AuthNavigator';
import MainNavigator from './MainNavigator';

const navigationRef = createNavigationContainerRef<any>();
let hasPromptedVerificationThisSession = false;
const VERIFICATION_PROMPT_STATUSES = new Set([
  '',
  'unverified',
  'not_verified',
  'not_submitted',
  'rejected',
  'failed',
]);
const shouldPromptVerification = (status?: string | null) =>
  VERIFICATION_PROMPT_STATUSES.has(String(status || '').trim().toLowerCase());

export default function AppNavigator() {
  const { theme } = useTheme();
  const dispatch = useDispatch();
  const isAuthenticated = useSelector(
    (state: RootState) => state.auth.isAuthenticated,
  );
  const meInitialized = useSelector(
    (state: RootState) => state.auth.meInitialized,
  );
  const user = useSelector((state: RootState) => state.auth.user);
  const [bootstrapping, setBootstrapping] = useState(false);
  const navigatorKey = isAuthenticated ? 'main' : 'auth';

  useEffect(() => {
    pushService.init().catch((error: any) => {
      console.warn('[AppNavigator] Push init failed', error);
    });
  }, []);

  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(HAUL_ROLE_MODE_STORAGE_KEY)
      .then(value => {
        if (active) {
          dispatch(hydrateHaulRoleMode(value));
        }
      })
      .catch(() => null);
    return () => {
      active = false;
    };
  }, [dispatch]);

  useEffect(() => {
    if (isAuthenticated) {
      wsService.connect();
    } else {
      wsService.disconnect();
    }
    return () => {
      wsService.disconnect();
    };
  }, [isAuthenticated]);

  useEffect(() => {
    let active = true;

    const bootstrapMe = async () => {
      if (!isAuthenticated || meInitialized) {
        if (active) {
          setBootstrapping(false);
        }
        return;
      }

      setBootstrapping(true);
      try {
        const res = await sessionService.getMe();
        if (active) {
          dispatch(setMeSummary(res.data));
        }
      } catch {
        if (active) {
          dispatch(markMeInitialized());
        }
      } finally {
        if (active) {
          setBootstrapping(false);
        }
      }
    };

    bootstrapMe();

    return () => {
      active = false;
    };
  }, [dispatch, isAuthenticated, meInitialized]);

  useEffect(() => {
    pushService
      .syncUser(isAuthenticated ? user?.id ?? null : null)
      .catch((error: any) => {
        console.warn('[AppNavigator] Push sync failed', error);
      });
  }, [isAuthenticated, user?.id]);

  useEffect(() => {
    if (!isAuthenticated) {
      hasPromptedVerificationThisSession = false;
      return;
    }
    if (
      !meInitialized ||
      !user ||
      !shouldPromptVerification(user.id_verified) ||
      hasPromptedVerificationThisSession
    ) {
      return;
    }
    hasPromptedVerificationThisSession = true;
    setTimeout(() => {
      Alert.alert(
        '完成实名认证',
        '完成实名认证后可发布需求、直达下单并提升账号可信度。是否现在去认证？',
        [
          {text: '稍后', style: 'cancel'},
          {
            text: '去认证',
            onPress: () => {
              if (navigationRef.isReady()) {
                navigationRef.navigate('Verification');
              }
            },
          },
        ],
      );
    }, 300);
  }, [isAuthenticated, meInitialized, user]);

  return (
    <NavigationContainer key={navigatorKey} ref={navigationRef}>
      {isAuthenticated && bootstrapping ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      ) : null}
      {isAuthenticated ? <MainNavigator /> : <AuthNavigator />}
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
});
