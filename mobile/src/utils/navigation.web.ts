import { useEffect } from 'react';

/**
 * Web 版本的 useFocusEffect polyfill
 * 在 Web 环境下，直接使用 useEffect 替代
 * 因为 Web 应用没有"页面焦点"的概念（除非使用 visibility API）
 */
export function useFocusEffect(effect: () => void | (() => void)) {
  useEffect(() => {
    return effect();
  }, [effect]);
}

// 为了保持 API 兼容性，也导出一个默认对象
export default {
  useFocusEffect,
};
