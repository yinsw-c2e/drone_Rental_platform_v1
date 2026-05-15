import type {ImageSourcePropType} from 'react-native';

type AssetSource = ImageSourcePropType;

export const tabbarAssets = {
  workbenchActive: require('./tabbar/ic_tab_workbench_active.png') as AssetSource,
  workbenchInactive: require('./tabbar/ic_tab_workbench_inactive.png') as AssetSource,
  messageActive: require('./tabbar/ic_tab_message_active.png') as AssetSource,
  messageInactive: require('./tabbar/ic_tab_message_inactive.png') as AssetSource,
  mineActive: require('./tabbar/ic_tab_mine_active.png') as AssetSource,
  mineInactive: require('./tabbar/ic_tab_mine_inactive.png') as AssetSource,
};

export const loginAssets = {
  bg: require('./mini-program/login/images/login_page_bg.jpg') as AssetSource,
  wechat: require('./mini-program/icons/wechat.png') as AssetSource,
  phone: require('./mini-program/login/icons/phone.png') as AssetSource,
  lock: require('./mini-program/login/icons/lock.png') as AssetSource,
  eyeOff: require('./mini-program/login/icons/eye_off.png') as AssetSource,
  tools: require('./mini-program/login/icons/tools.png') as AssetSource,
  user: require('./mini-program/login/icons/user.png') as AssetSource,
};

export const workbenchAssets = {
  hero: require('./mini-program/workbench/images/workbench_hero_drone_bg_750x310.jpg') as AssetSource,
  quickOrder: require('./mini-program/workbench/icons/paper_plane_blue.png') as AssetSource,
  plusCircle: require('./mini-program/workbench/icons/plus_circle_white.png') as AssetSource,
  warning: require('./mini-program/workbench/icons/warning_shield.png') as AssetSource,
  chevronRight: require('./mini-program/workbench/icons/chevron_right.png') as AssetSource,
  dropdownDown: require('./mini-program/workbench/icons/dropdown_down.png') as AssetSource,
  entryBrowseService: require('./mini-program/workbench/icons/entrance_browse_service.png') as AssetSource,
  entryInquiryTask: require('./mini-program/workbench/icons/entrance_inquiry_task.png') as AssetSource,
  entryMyDemand: require('./mini-program/workbench/icons/entrance_my_demand.png') as AssetSource,
  entryPublishTask: require('./mini-program/workbench/icons/entrance_publish_task.png') as AssetSource,
  entryQuickOrder: require('./mini-program/workbench/icons/entrance_quick_order.png') as AssetSource,
};

export const messageAssets = {
  avatarUser: require('./mini-program/message/icons/avatar_user.png') as AssetSource,
  packageBox: require('./mini-program/message/icons/package_box.png') as AssetSource,
};

export const profileAssets = {
  hero: require('./mini-program/mine/images/mine_profile_drone_bg_750x330.jpg') as AssetSource,
  defaultAvatar: require('./mini-program/mine/images/default_avatar_circle.png') as AssetSource,
  cellArchive: require('./mini-program/mine/icons/cell_archive.png') as AssetSource,
  cellEdit: require('./mini-program/mine/icons/cell_edit.png') as AssetSource,
  cellFlyer: require('./mini-program/mine/icons/cell_flyer.png') as AssetSource,
  cellLock: require('./mini-program/mine/icons/cell_lock.png') as AssetSource,
  cellOrder: require('./mini-program/mine/icons/cell_order.png') as AssetSource,
  cellSetting: require('./mini-program/mine/icons/cell_setting.png') as AssetSource,
  cellTask: require('./mini-program/mine/icons/cell_task.png') as AssetSource,
  chevronDown: require('./mini-program/mine/icons/chevron_down.png') as AssetSource,
  chevronRight: require('./mini-program/mine/icons/chevron_right.png') as AssetSource,
  chipCheck: require('./mini-program/mine/icons/chip_check.png') as AssetSource,
  chipStar: require('./mini-program/mine/icons/chip_star.png') as AssetSource,
  identityDrone: require('./mini-program/mine/icons/identity_drone.png') as AssetSource,
  identityOwner: require('./mini-program/mine/icons/identity_owner.png') as AssetSource,
  identityUser: require('./mini-program/mine/icons/identity_user.png') as AssetSource,
  logout: require('./mini-program/mine/icons/logout.png') as AssetSource,
};

export const myDemandsAssets = {
  hero: require('./mini-program/my-demands/images/folder_hero.png') as AssetSource,
  back: require('./mini-program/my-demands/icons/back.png') as AssetSource,
};

export const marketAssets = {
  arrowRight: require('./mini-program/service-market/icons/arrow_right.png') as AssetSource,
  back: require('./mini-program/service-market/icons/back.png') as AssetSource,
  chevronDown: require('./mini-program/service-market/icons/chevron_down.png') as AssetSource,
  docCta: require('./mini-program/service-market/icons/doc_cta.png') as AssetSource,
  filter: require('./mini-program/service-market/icons/filter.png') as AssetSource,
  lightning: require('./mini-program/service-market/icons/lightning.png') as AssetSource,
  markerHex: require('./mini-program/service-market/icons/marker_hex.png') as AssetSource,
  plusBox: require('./mini-program/service-market/icons/plus_box.png') as AssetSource,
  search: require('./mini-program/service-market/icons/search.png') as AssetSource,
  serviceHex: require('./mini-program/service-market/icons/service_hex.png') as AssetSource,
  taskHall: require('./mini-program/service-market/icons/task_hall.png') as AssetSource,
  cardDrone1: require('./mini-program/service-market/images/service_card_drone_1.jpg') as AssetSource,
  cardDrone2: require('./mini-program/service-market/images/service_card_drone_2.jpg') as AssetSource,
  cardDrone3: require('./mini-program/service-market/images/service_card_drone_3.jpg') as AssetSource,
};

export const orderDetailAssets = {
  hero: require('./mini-program/order-detail/images/order_detail_hero_bg_750x360.jpg') as AssetSource,
  cubeOverlay: require('./mini-program/order-detail/images/order_detail_hero_cube_overlay.png') as AssetSource,
  actionBriefcase: require('./mini-program/order-detail/icons/action_briefcase.png') as AssetSource,
  calendarLine: require('./mini-program/order-detail/icons/calendar_line.png') as AssetSource,
  chevronRight: require('./mini-program/order-detail/icons/chevron_right.png') as AssetSource,
  locationLine: require('./mini-program/order-detail/icons/location_line.png') as AssetSource,
  locationWhite: require('./mini-program/order-detail/icons/location_white.png') as AssetSource,
  progressClipboard: require('./mini-program/order-detail/icons/progress_clipboard.png') as AssetSource,
  taskDocument: require('./mini-program/order-detail/icons/task_document.png') as AssetSource,
  timelineClock: require('./mini-program/order-detail/icons/timeline_clock.png') as AssetSource,
  timelineList: require('./mini-program/order-detail/icons/timeline_list.png') as AssetSource,
};

export const publishTaskAssets = {
  back: require('./mini-program/publish-task/icons/back.png') as AssetSource,
  calendar: require('./mini-program/publish-task/icons/calendar.png') as AssetSource,
  checkCircle: require('./mini-program/publish-task/icons/check_circle.png') as AssetSource,
  chevronDown: require('./mini-program/publish-task/icons/chevron_down.png') as AssetSource,
  chevronRight: require('./mini-program/publish-task/icons/chevron_right.png') as AssetSource,
  clock: require('./mini-program/publish-task/icons/clock.png') as AssetSource,
  lightbulb: require('./mini-program/publish-task/icons/lightbulb.png') as AssetSource,
  lock: require('./mini-program/publish-task/icons/lock.png') as AssetSource,
  pinBlue: require('./mini-program/publish-task/icons/pin_blue.png') as AssetSource,
  shield: require('./mini-program/publish-task/icons/shield.png') as AssetSource,
  weightBag: require('./mini-program/publish-task/icons/weight_bag.png') as AssetSource,
  clipboard: require('./mini-program/publish-task/images/clipboard_illustration.png') as AssetSource,
  truck: require('./mini-program/publish-task/images/truck_illustration.png') as AssetSource,
};

export const quickOrderAssets = {
  back: require('./mini-program/quick-order/icons/back.png') as AssetSource,
  calendar: require('./mini-program/quick-order/icons/calendar.png') as AssetSource,
  checkCircle: require('./mini-program/quick-order/icons/check_circle.png') as AssetSource,
  chevronDown: require('./mini-program/quick-order/icons/chevron_down.png') as AssetSource,
  chevronRight: require('./mini-program/quick-order/icons/chevron_right.png') as AssetSource,
  clock: require('./mini-program/quick-order/icons/clock.png') as AssetSource,
  cube: require('./mini-program/quick-order/icons/cube.png') as AssetSource,
  grid: require('./mini-program/quick-order/icons/grid.png') as AssetSource,
  pinEnd: require('./mini-program/quick-order/icons/pin_end.png') as AssetSource,
  pinStart: require('./mini-program/quick-order/icons/pin_start.png') as AssetSource,
  ruler: require('./mini-program/quick-order/icons/ruler.png') as AssetSource,
  target: require('./mini-program/quick-order/icons/target.png') as AssetSource,
  weightBag: require('./mini-program/quick-order/icons/weight_bag.png') as AssetSource,
};
