/**
 * @format
 */

import { AppRegistry } from 'react-native';
import { enableScreens } from 'react-native-screens';
import App from './App';
import { name as appName } from './app.json';

// 启用 react-native-screens 优化
enableScreens(true);

AppRegistry.registerComponent(appName, () => App);
