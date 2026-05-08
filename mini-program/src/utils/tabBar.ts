import Taro from '@tarojs/taro';

export function syncCustomTabBar(selected: number) {
  const pages = Taro.getCurrentPages();
  const currentPage = pages[pages.length - 1] as any;
  const tabBar = currentPage?.getTabBar?.();

  if (tabBar?.setData) {
    tabBar.setData({ selected });
  }
}
