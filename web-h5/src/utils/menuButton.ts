import Taro from '@tarojs/taro';

export interface MenuButtonRect {
  top: number;
  bottom: number;
  left: number;
  right: number;
  width: number;
  height: number;
}

/**
 * 获取微信小程序胶囊按钮位置。
 *
 * H5 没有胶囊按钮，且 Taro 在 H5 下调用该 API 会返回一个 **reject 的 Promise**，
 * 同步 try/catch 捕获不到，会冒泡成未捕获的 rejection（开发期触发错误浮层）。
 * 因此 H5 直接返回 null，调用方走各自的回退分支（其初始 state 已是回退值）。
 */
export function getMenuButtonRectSafe(): MenuButtonRect | null {
  if (process.env.TARO_ENV === 'h5') {
    return null;
  }
  try {
    const rect = Taro.getMenuButtonBoundingClientRect();
    if (rect && typeof (rect as any).then === 'function') {
      return null;
    }
    return rect as unknown as MenuButtonRect;
  } catch {
    return null;
  }
}
