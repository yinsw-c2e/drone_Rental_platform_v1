import Taro from '@tarojs/taro';
import { AddressData } from '../types';

export const TEST_SERVICE_ADDRESS: AddressData = {
  name: '佛山南海变电站',
  address: '广东省佛山市南海区桂城街道海五路南海变电站',
  province: '广东省',
  city: '佛山市',
  district: '南海区',
  latitude: 23.04762,
  longitude: 113.15405,
};

export const TEST_PICKUP_ADDRESS: AddressData = {
  name: '佛山顺德陈村仓',
  address: '广东省佛山市顺德区陈村镇花卉大道测试装货点',
  province: '广东省',
  city: '佛山市',
  district: '顺德区',
  latitude: 22.93256,
  longitude: 113.2117,
};

export const TEST_DELIVERY_ADDRESS: AddressData = {
  name: '佛山南海桂城作业点',
  address: '广东省佛山市南海区桂城街道海五路测试卸货点',
  province: '广东省',
  city: '佛山市',
  district: '南海区',
  latitude: 23.04762,
  longitude: 113.15405,
};

export function canUseDevTestData() {
  try {
    const envVersion = (Taro as any).getAccountInfoSync?.().miniProgram?.envVersion;
    return envVersion !== 'release';
  } catch {
    return false;
  }
}

export function cloneAddress(address: AddressData): AddressData {
  return { ...address };
}
