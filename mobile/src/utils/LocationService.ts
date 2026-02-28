import {Platform, PermissionsAndroid} from 'react-native';
import Geolocation from '@react-native-community/geolocation';

export interface LocationCoords {
  latitude: number;
  longitude: number;
}

// ============================================================
// WGS-84 -> GCJ-02 坐标转换 (GPS原始坐标 -> 高德坐标系)
// ============================================================
const PI = Math.PI;
const A = 6378245.0; // 长半轴
const EE = 0.00669342162296594323; // 扁率

function outOfChina(lng: number, lat: number): boolean {
  return lng < 72.004 || lng > 137.8347 || lat < 0.8293 || lat > 55.8271;
}

function transformLat(x: number, y: number): number {
  let ret = -100.0 + 2.0 * x + 3.0 * y + 0.2 * y * y + 0.1 * x * y + 0.2 * Math.sqrt(Math.abs(x));
  ret += (20.0 * Math.sin(6.0 * x * PI) + 20.0 * Math.sin(2.0 * x * PI)) * 2.0 / 3.0;
  ret += (20.0 * Math.sin(y * PI) + 40.0 * Math.sin(y / 3.0 * PI)) * 2.0 / 3.0;
  ret += (160.0 * Math.sin(y / 12.0 * PI) + 320.0 * Math.sin(y * PI / 30.0)) * 2.0 / 3.0;
  return ret;
}

function transformLng(x: number, y: number): number {
  let ret = 300.0 + x + 2.0 * y + 0.1 * x * x + 0.1 * x * y + 0.1 * Math.sqrt(Math.abs(x));
  ret += (20.0 * Math.sin(6.0 * x * PI) + 20.0 * Math.sin(2.0 * x * PI)) * 2.0 / 3.0;
  ret += (20.0 * Math.sin(x * PI) + 40.0 * Math.sin(x / 3.0 * PI)) * 2.0 / 3.0;
  ret += (150.0 * Math.sin(x / 12.0 * PI) + 300.0 * Math.sin(x / 30.0 * PI)) * 2.0 / 3.0;
  return ret;
}

/** WGS-84 转 GCJ-02 */
export function wgs84ToGcj02(wgsLng: number, wgsLat: number): LocationCoords {
  if (outOfChina(wgsLng, wgsLat)) {
    return {longitude: wgsLng, latitude: wgsLat};
  }
  let dLat = transformLat(wgsLng - 105.0, wgsLat - 35.0);
  let dLng = transformLng(wgsLng - 105.0, wgsLat - 35.0);
  const radLat = wgsLat / 180.0 * PI;
  let magic = Math.sin(radLat);
  magic = 1 - EE * magic * magic;
  const sqrtMagic = Math.sqrt(magic);
  dLat = (dLat * 180.0) / ((A * (1 - EE)) / (magic * sqrtMagic) * PI);
  dLng = (dLng * 180.0) / (A / sqrtMagic * Math.cos(radLat) * PI);
  return {
    latitude: wgsLat + dLat,
    longitude: wgsLng + dLng,
  };
}

// ============================================================
// 定位功能
// ============================================================

/**
 * 请求定位权限
 */
async function requestPermission(): Promise<boolean> {
  if (Platform.OS === 'android') {
    try {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        {
          title: '位置权限',
          message: '需要获取您的位置以提供更好的服务',
          buttonPositive: '允许',
          buttonNegative: '拒绝',
        },
      );
      return granted === PermissionsAndroid.RESULTS.GRANTED;
    } catch {
      return false;
    }
  }
  // iOS: 通过原生库触发系统权限弹窗，加超时保护防止挂死
  return new Promise(resolve => {
    const timer = setTimeout(() => resolve(true), 3000); // 3s超时默认放行，让后续getCurrentPosition处理
    try {
      Geolocation.requestAuthorization(
        () => { clearTimeout(timer); resolve(true); },
        () => { clearTimeout(timer); resolve(false); },
      );
    } catch {
      clearTimeout(timer);
      resolve(true); // 出错也放行
    }
  });
}

/** 带超时保护的 Promise 包装 */
function withTimeout<T>(promise: Promise<T>, ms: number, errorMsg: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(errorMsg)), ms);
    promise.then(
      val => { clearTimeout(timer); resolve(val); },
      err => { clearTimeout(timer); reject(err); },
    );
  });
}

/**
 * 获取当前位置坐标 (返回 GCJ-02 坐标，可直接用于高德地图)
 */
export async function getCurrentPosition(): Promise<LocationCoords> {
  const hasPermission = await requestPermission();
  if (!hasPermission) {
    throw new Error('未获取到位置权限');
  }

  const getPos = (): Promise<LocationCoords> =>
    new Promise((resolve, reject) => {
      Geolocation.getCurrentPosition(
        position => {
          const gcj02 = wgs84ToGcj02(
            position.coords.longitude,
            position.coords.latitude,
          );
          resolve(gcj02);
        },
        error => {
          let msg = '获取位置失败';
          if (error.code === 1) {
            msg = '位置权限被拒绝';
          } else if (error.code === 2) {
            msg = '无法获取位置信息';
          } else if (error.code === 3) {
            msg = '获取位置超时';
          }
          reject(new Error(msg));
        },
        {enableHighAccuracy: false, timeout: 10000, maximumAge: 60000},
      );
    });

  // 外层硬超时12秒，防止geolocation模块彻底无响应
  return withTimeout(getPos(), 12000, '定位超时，请检查定位权限是否开启');
}
