import Taro from '@tarojs/taro';
import { openLocationPicker, type PickedLocation } from '../components/LocationPickerHost/bus';
import { loadAMap } from './amap';

export type { PickedLocation };

export interface GeoPoint {
  latitude: number;
  longitude: number;
}

/** H5 选点：弹出自建高德选点弹层。取消 resolve(null)。 */
export async function chooseLocationCompat(): Promise<PickedLocation | null> {
  try {
    return await openLocationPicker();
  } catch (error: any) {
    Taro.showToast({ title: '地图选点不可用', icon: 'none' });
    return null;
  }
}

/** H5 定位：优先用高德 Geolocation（返回 gcj02），回退到浏览器定位。 */
export function getLocationCompat(): Promise<GeoPoint> {
  return loadAMap()
    .then((AMap) => new Promise<GeoPoint>((resolve, reject) => {
      const geolocation = new AMap.Geolocation({ timeout: 8000, enableHighAccuracy: true });
      geolocation.getCurrentPosition((status: string, result: any) => {
        if (status === 'complete' && result?.position) {
          resolve({ latitude: result.position.lat, longitude: result.position.lng });
        } else {
          reject(new Error(result?.message || '定位失败'));
        }
      });
    }))
    .catch(() => new Promise<GeoPoint>((resolve, reject) => {
      if (typeof navigator === 'undefined' || !navigator.geolocation) {
        reject(new Error('定位不可用'));
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
        (err) => reject(new Error(err.message || '定位失败')),
        { timeout: 8000, enableHighAccuracy: true },
      );
    }));
}

/** H5 打开地图：跳转高德地图 URI（新标签页）。 */
export function openLocationCompat(opts: { latitude: number; longitude: number; name?: string; address?: string }): Promise<void> {
  const params = new URLSearchParams();
  params.set('position', `${opts.longitude},${opts.latitude}`);
  if (opts.name) params.set('name', opts.name);
  params.set('src', 'wurenji-h5');
  params.set('coordinate', 'gcj02');
  params.set('callnative', '0');
  const url = `https://uri.amap.com/marker?${params.toString()}`;
  if (typeof window !== 'undefined') {
    const win = window.open(url, '_blank');
    if (!win) {
      return Promise.reject(new Error('POPUP_BLOCKED'));
    }
  }
  return Promise.resolve();
}
