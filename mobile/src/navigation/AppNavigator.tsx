import React, {useEffect, useState} from 'react';
import {NavigationContainer} from '@react-navigation/native';
import {ActivityIndicator, StyleSheet, View} from 'react-native';
import {useDispatch, useSelector} from 'react-redux';
import {RootState} from '../store/store';
import {markMeInitialized, setMeSummary} from '../store/slices/authSlice';
import {sessionService} from '../services/session';
import {wsService} from '../services/websocket';
import AuthNavigator from './AuthNavigator';
import MainNavigator from './MainNavigator';

export default function AppNavigator() {
  const dispatch = useDispatch();
  const isAuthenticated = useSelector((state: RootState) => state.auth.isAuthenticated);
  const meInitialized = useSelector((state: RootState) => state.auth.meInitialized);
  const [bootstrapping, setBootstrapping] = useState(false);
  const navigatorKey = isAuthenticated ? 'main' : 'auth';

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

  return (
    <NavigationContainer key={navigatorKey}>
      {isAuthenticated && bootstrapping ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#1677ff" />
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
    backgroundColor: 'rgba(255,255,255,0.82)',
  },
});
