const tabList = [
  { key: 'home', pagePath: '/pages/home/index', text: '工作台' },
  { key: 'messages', pagePath: '/pages/messages/index', text: '消息' },
  { key: 'profile', pagePath: '/pages/profile/index', text: '我的' },
];

function normalizeRoute(route) {
  return `/${String(route || '').replace(/^\//, '')}`;
}

Component({
  data: {
    selected: 0,
    list: tabList,
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
      const current = normalizeRoute(pages.length ? pages[pages.length - 1].route : '');
      const selected = tabList.findIndex((item) => item.pagePath === current);

      if (selected >= 0 && selected !== this.data.selected) {
        this.setData({ selected });
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
