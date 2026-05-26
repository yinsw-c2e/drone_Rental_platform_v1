import type {ImageSourcePropType} from 'react-native';

type AssetSource = ImageSourcePropType;

const asset = (path: string) => ({uri: new URL(path, import.meta.url).href}) as AssetSource;

export const tabbarAssets = {
  workbenchActive: asset('./haul/customer-home/icon_tab_home_active.png'),
  workbenchInactive: asset('./haul/customer-home/icon_tab_home_inactive.png'),
  messageActive: asset('./haul/customer-home/icon_tab_message_active.png'),
  messageInactive: asset('./haul/customer-home/icon_tab_message_inactive.png'),
  orderActive: asset('./haul/customer-home/icon_tab_order_active.png'),
  orderInactive: asset('./haul/customer-home/icon_tab_order_inactive.png'),
  mineActive: asset('./haul/customer-home/icon_tab_profile_active.png'),
  mineInactive: asset('./haul/customer-home/icon_tab_profile_inactive.png'),
};

export const loginAssets = {
  bg: asset('./mini-program/login/images/login_page_bg.jpg'),
  wechat: asset('./mini-program/icons/wechat.png'),
  phone: asset('./mini-program/login/icons/phone.png'),
  lock: asset('./mini-program/login/icons/lock.png'),
  eyeOff: asset('./mini-program/login/icons/eye_off.png'),
  tools: asset('./mini-program/login/icons/tools.png'),
  user: asset('./mini-program/login/icons/user.png'),
};

export const workbenchAssets = {
  hero: asset('./mini-program/workbench/images/workbench_hero_drone_bg_750x310.jpg'),
  quickOrder: asset('./mini-program/workbench/icons/paper_plane_blue.png'),
  plusCircle: asset('./mini-program/workbench/icons/plus_circle_white.png'),
  warning: asset('./mini-program/workbench/icons/warning_shield.png'),
  chevronRight: asset('./mini-program/workbench/icons/chevron_right.png'),
  dropdownDown: asset('./mini-program/workbench/icons/dropdown_down.png'),
  entryBrowseService: asset('./mini-program/workbench/icons/entrance_browse_service.png'),
  entryInquiryTask: asset('./mini-program/workbench/icons/entrance_inquiry_task.png'),
  entryMyDemand: asset('./mini-program/workbench/icons/entrance_my_demand.png'),
  entryPublishTask: asset('./mini-program/workbench/icons/entrance_publish_task.png'),
  entryQuickOrder: asset('./mini-program/workbench/icons/entrance_quick_order.png'),
};

export const messageAssets = {
  avatarUser: asset('./mini-program/message/icons/avatar_user.png'),
  packageBox: asset('./mini-program/message/icons/package_box.png'),
};

export const profileAssets = {
  hero: asset('./mini-program/mine/images/mine_profile_drone_bg_750x330.jpg'),
  defaultAvatar: asset('./mini-program/mine/images/default_avatar_circle.png'),
  cellArchive: asset('./mini-program/mine/icons/cell_archive.png'),
  cellEdit: asset('./mini-program/mine/icons/cell_edit.png'),
  cellFlyer: asset('./mini-program/mine/icons/cell_flyer.png'),
  cellLock: asset('./mini-program/mine/icons/cell_lock.png'),
  cellOrder: asset('./mini-program/mine/icons/cell_order.png'),
  cellSetting: asset('./mini-program/mine/icons/cell_setting.png'),
  cellTask: asset('./mini-program/mine/icons/cell_task.png'),
  chevronDown: asset('./mini-program/mine/icons/chevron_down.png'),
  chevronRight: asset('./mini-program/mine/icons/chevron_right.png'),
  chipCheck: asset('./mini-program/mine/icons/chip_check.png'),
  chipStar: asset('./mini-program/mine/icons/chip_star.png'),
  identityDrone: asset('./mini-program/mine/icons/identity_drone.png'),
  identityOwner: asset('./mini-program/mine/icons/identity_owner.png'),
  identityUser: asset('./mini-program/mine/icons/identity_user.png'),
  logout: asset('./mini-program/mine/icons/logout.png'),
};

export const myDemandsAssets = {
  hero: asset('./mini-program/my-demands/images/folder_hero.png'),
  back: asset('./mini-program/my-demands/icons/back.png'),
};

export const marketAssets = {
  arrowRight: asset('./mini-program/service-market/icons/arrow_right.png'),
  back: asset('./mini-program/service-market/icons/back.png'),
  chevronDown: asset('./mini-program/service-market/icons/chevron_down.png'),
  docCta: asset('./mini-program/service-market/icons/doc_cta.png'),
  filter: asset('./mini-program/service-market/icons/filter.png'),
  lightning: asset('./mini-program/service-market/icons/lightning.png'),
  markerHex: asset('./mini-program/service-market/icons/marker_hex.png'),
  plusBox: asset('./mini-program/service-market/icons/plus_box.png'),
  search: asset('./mini-program/service-market/icons/search.png'),
  serviceHex: asset('./mini-program/service-market/icons/service_hex.png'),
  taskHall: asset('./mini-program/service-market/icons/task_hall.png'),
  cardDrone1: asset('./mini-program/service-market/images/service_card_drone_1.jpg'),
  cardDrone2: asset('./mini-program/service-market/images/service_card_drone_2.jpg'),
  cardDrone3: asset('./mini-program/service-market/images/service_card_drone_3.jpg'),
};

export const orderDetailAssets = {
  hero: asset('./mini-program/order-detail/images/order_detail_hero_bg_750x360.jpg'),
  cubeOverlay: asset('./mini-program/order-detail/images/order_detail_hero_cube_overlay.png'),
  actionBriefcase: asset('./mini-program/order-detail/icons/action_briefcase.png'),
  calendarLine: asset('./mini-program/order-detail/icons/calendar_line.png'),
  chevronRight: asset('./mini-program/order-detail/icons/chevron_right.png'),
  locationLine: asset('./mini-program/order-detail/icons/location_line.png'),
  locationWhite: asset('./mini-program/order-detail/icons/location_white.png'),
  progressClipboard: asset('./mini-program/order-detail/icons/progress_clipboard.png'),
  taskDocument: asset('./mini-program/order-detail/icons/task_document.png'),
  timelineClock: asset('./mini-program/order-detail/icons/timeline_clock.png'),
  timelineList: asset('./mini-program/order-detail/icons/timeline_list.png'),
};

export const publishTaskAssets = {
  back: asset('./mini-program/publish-task/icons/back.png'),
  calendar: asset('./mini-program/publish-task/icons/calendar.png'),
  checkCircle: asset('./mini-program/publish-task/icons/check_circle.png'),
  chevronDown: asset('./mini-program/publish-task/icons/chevron_down.png'),
  chevronRight: asset('./mini-program/publish-task/icons/chevron_right.png'),
  clock: asset('./mini-program/publish-task/icons/clock.png'),
  lightbulb: asset('./mini-program/publish-task/icons/lightbulb.png'),
  lock: asset('./mini-program/publish-task/icons/lock.png'),
  pinBlue: asset('./mini-program/publish-task/icons/pin_blue.png'),
  shield: asset('./mini-program/publish-task/icons/shield.png'),
  weightBag: asset('./mini-program/publish-task/icons/weight_bag.png'),
  clipboard: asset('./mini-program/publish-task/images/clipboard_illustration.png'),
  truck: asset('./mini-program/publish-task/images/truck_illustration.png'),
};

export const quickOrderAssets = {
  back: asset('./mini-program/quick-order/icons/back.png'),
  calendar: asset('./mini-program/quick-order/icons/calendar.png'),
  checkCircle: asset('./mini-program/quick-order/icons/check_circle.png'),
  chevronDown: asset('./mini-program/quick-order/icons/chevron_down.png'),
  chevronRight: asset('./mini-program/quick-order/icons/chevron_right.png'),
  clock: asset('./mini-program/quick-order/icons/clock.png'),
  cube: asset('./mini-program/quick-order/icons/cube.png'),
  grid: asset('./mini-program/quick-order/icons/grid.png'),
  pinEnd: asset('./mini-program/quick-order/icons/pin_end.png'),
  pinStart: asset('./mini-program/quick-order/icons/pin_start.png'),
  ruler: asset('./mini-program/quick-order/icons/ruler.png'),
  target: asset('./mini-program/quick-order/icons/target.png'),
  weightBag: asset('./mini-program/quick-order/icons/weight_bag.png'),
};
