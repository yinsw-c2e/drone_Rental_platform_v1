const ROLE_MODE_STORAGE_KEY = 'haulRoleMode';

const customerTabList = [
  {
    key: 'home',
    pagePath: '/pages/home/index',
    text: '首页',
    iconPath: '/custom-tab-bar/assets/icon_tab_home_inactive.png',
    selectedIconPath: '/custom-tab-bar/assets/icon_tab_home_active.png',
    iconWidth: 58,
    iconHeight: 60,
    selectedIconWidth: 58,
    selectedIconHeight: 60,
  },
  {
    key: 'orders',
    pagePath: '/pages/orders/index',
    text: '订单',
    iconPath: '/custom-tab-bar/assets/icon_tab_order_inactive.png',
    selectedIconPath: '/custom-tab-bar/assets/icon_tab_order_active.png',
    iconWidth: 56,
    iconHeight: 60,
    selectedIconWidth: 56,
    selectedIconHeight: 60,
  },
  {
    key: 'messages',
    pagePath: '/pages/messages/index',
    text: '消息',
    iconPath: '/custom-tab-bar/assets/icon_tab_message_inactive.png',
    selectedIconPath: '/custom-tab-bar/assets/icon_tab_message_active.png',
    iconWidth: 58,
    iconHeight: 56,
    selectedIconWidth: 58,
    selectedIconHeight: 56,
  },
  {
    key: 'profile',
    pagePath: '/pages/profile/index',
    text: '我的',
    iconPath: '/custom-tab-bar/assets/icon_tab_profile_inactive.png',
    selectedIconPath: '/custom-tab-bar/assets/icon_tab_profile_active.png',
    iconWidth: 58,
    iconHeight: 60,
    selectedIconWidth: 58,
    selectedIconHeight: 60,
  },
];

const providerTabList = [
  {
    key: 'home',
    pagePath: '/pages/home/index',
    text: '工作台',
    iconPath: '/custom-tab-bar/assets/provider_tab_workbench_inactive.png',
    selectedIconPath: '/custom-tab-bar/assets/provider_tab_workbench_active.png',
    iconWidth: 54,
    iconHeight: 59,
    selectedIconWidth: 57,
    selectedIconHeight: 53,
  },
  {
    key: 'orders',
    pagePath: '/pages/orders/index',
    text: '接单',
    iconPath: '/custom-tab-bar/assets/provider_tab_accept_order_inactive.png',
    selectedIconPath: '/custom-tab-bar/assets/provider_tab_accept_order_active.png',
    iconWidth: 56,
    iconHeight: 51,
    selectedIconWidth: 70,
    selectedIconHeight: 60,
  },
  {
    key: 'messages',
    pagePath: '/pages/messages/index',
    text: '消息',
    iconPath: '/custom-tab-bar/assets/provider_tab_message_inactive.png',
    selectedIconPath: '/custom-tab-bar/assets/provider_tab_message_active.png',
    iconWidth: 58,
    iconHeight: 60,
    selectedIconWidth: 58,
    selectedIconHeight: 60,
  },
  {
    key: 'profile',
    pagePath: '/pages/profile/index',
    text: '我的',
    iconPath: '/custom-tab-bar/assets/provider_tab_profile_inactive.png',
    selectedIconPath: '/custom-tab-bar/assets/provider_tab_profile_active.png',
    iconWidth: 54,
    iconHeight: 61,
    selectedIconWidth: 54,
    selectedIconHeight: 61,
  },
];

function normalizeRoute(route) {
  return `/${String(route || '').replace(/^\//, '')}`;
}

function readRoleMode() {
  try {
    const mode = wx.getStorageSync(ROLE_MODE_STORAGE_KEY);
    return mode === 'provider' ? 'provider' : 'customer';
  } catch {
    return 'customer';
  }
}

function getTabList() {
  return readRoleMode() === 'provider' ? providerTabList : customerTabList;
}

function isSameList(a, b) {
  return Array.isArray(a) && Array.isArray(b)
    && a.length === b.length
    && a.every((item, index) => {
      const next = b[index];
      return item.text === next.text
        && item.iconPath === next.iconPath
        && item.selectedIconPath === next.selectedIconPath
        && item.iconWidth === next.iconWidth
        && item.iconHeight === next.iconHeight
        && item.selectedIconWidth === next.selectedIconWidth
        && item.selectedIconHeight === next.selectedIconHeight;
    });
}

Component({
  data: {
    selected: 0,
    list: getTabList(),
  },

  lifetimes: {
    attached() {
      this.syncSelected();
    },
  },

  pageLifetimes: {
    show() {
      this.syncSelected();
    },
  },

  methods: {
    syncSelected() {
      const pages = getCurrentPages();
      const list = getTabList();
      const current = normalizeRoute(pages.length ? pages[pages.length - 1].route : '');
      const selected = list.findIndex((item) => item.pagePath === current);
      const nextData = {};

      if (!isSameList(this.data.list, list)) {
        nextData.list = list;
      }
      if (selected >= 0 && selected !== this.data.selected) {
        nextData.selected = selected;
      }
      if (Object.keys(nextData).length) {
        this.setData(nextData);
      }
    },

    switchTab(event) {
      const { index, path } = event.currentTarget.dataset;
      const selected = Number(index);

      if (selected === this.data.selected) return;

      wx.switchTab({
        url: path,
        success: () => this.setData({ selected }),
        fail: () => this.syncSelected(),
      });
    },
  },
});
