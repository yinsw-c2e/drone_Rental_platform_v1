// H5 选点弹层的 promise 中介：
// chooseLocationCompat() 调用 openLocationPicker() 打开弹层并等待结果，
// LocationPickerHost 挂载时通过 registerLocationPicker 注册真正的打开函数。

export interface PickedLocation {
  name: string;
  address: string;
  latitude: number;
  longitude: number;
}

type OpenFn = () => Promise<PickedLocation | null>;

let openImpl: OpenFn | null = null;

export function registerLocationPicker(fn: OpenFn | null) {
  openImpl = fn;
}

export function openLocationPicker(): Promise<PickedLocation | null> {
  if (!openImpl) {
    return Promise.reject(new Error('LOCATION_PICKER_UNAVAILABLE'));
  }
  return openImpl();
}
