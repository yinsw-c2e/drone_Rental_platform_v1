import {Alert, Platform, ToastAndroid} from 'react-native';

export const showToast = (message: string) => {
  if (Platform.OS === 'android') {
    ToastAndroid.show(message, ToastAndroid.SHORT);
    return;
  }
  Alert.alert('', message);
};

export default showToast;
