import React from 'react';
import {StatusBar} from 'react-native';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {Provider} from 'react-redux';
import {store} from './src/store/store';
import AppNavigator from './src/navigation/AppNavigator';
import {ThemeProvider, useTheme} from './src/theme/ThemeContext';

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

export default App;
