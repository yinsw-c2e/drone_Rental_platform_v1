import Taro from '@tarojs/taro';
import type { PickedLocation } from '../components/LocationPickerHost/bus';

export type { PickedLocation };

export interface GeoPoint {
  latitude: number;
  longitude: number;
}

/**
 * 选点。微信小程序走原生 chooseLocation；取消时 resolve(null)，方便统一处理。
 */
export async function chooseLocationCompat(): Promise<PickedLocation | null> {
  try {
    const res = await Taro.chooseLocation({});
    if (!res || (!res.name && !res.address)) {
      return null;
    }
    return {
      name: res.name || res.address,
      address: res.address || res.name,
      latitude: res.latitude,
      longitude: res.longitude,
    };
  } catch (error: any) {
    if (String(error?.errMsg || '').includes('cancel')) {
      return null;
    }
    throw error;
  }
}

/** 获取当前定位（gcj02）。 */
export function getLocationCompat(): Promise<GeoPoint> {
  return Taro.getLocation({ type: 'gcj02' }).then((res) => ({
    latitude: res.latitude,
    longitude: res.longitude,
  }));
}

/** 打开地图查看某个点。 */
export function openLocationCompat(opts: { latitude: number; longitude: number; name?: string; address?: string; scale?: number }): Promise<any> {
  return Taro.openLocation({
    latitude: opts.latitude,
    longitude: opts.longitude,
    name: opts.name,
    address: opts.address,
    scale: opts.scale ?? 16,
  });
}
