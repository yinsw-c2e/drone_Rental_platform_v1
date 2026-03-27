import React from 'react';
import {Platform, StatusBar} from 'react-native';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {Provider} from 'react-redux';
import {store} from './src/store/store';
import AppNavigator from './src/navigation/AppNavigator';
import {ThemeProvider, useTheme} from './src/theme/ThemeContext';
import {UpdateProvider, Pushy} from 'react-native-update';
import _updateConfig from './update.json';

const {appKey} = _updateConfig[Platform.OS as 'ios' | 'android'];

const pushyClient = new Pushy({
  appKey,
  updateStrategy: 'alertUpdateAndIgnoreError',
});

function AppInner() {
  const {theme} = useTheme();
  return (
    <SafeAreaProvider>
      <StatusBar
        barStyle={theme.isDark ? 'light-content' : 'dark-content'}
        backgroundColor={theme.bg}
      />
      <AppNavigator />
    </SafeAreaProvider>
  );
}

function App() {
  return (
    <Provider store={store}>
      <ThemeProvider>
        <AppInner />
      </ThemeProvider>
    </Provider>
  );
}

export default function Root() {
  return (
    <UpdateProvider client={pushyClient}>
      <App />
    </UpdateProvider>
  );
}
