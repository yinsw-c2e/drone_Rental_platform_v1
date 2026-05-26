import type {ImageSourcePropType} from 'react-native';

type AssetSource = ImageSourcePropType;

export const fulfillmentScheduleAssets = {
  navBack: require('./fulfillment-schedule/icon_nav_back.png') as AssetSource,
  navServiceHeadset: require('./fulfillment-schedule/icon_nav_service_headset.png') as AssetSource,
  navMore: require('./fulfillment-schedule/icon_nav_more.png') as AssetSource,
  statusPendingClock: require('./fulfillment-schedule/icon_status_pending_clock_orange.png') as AssetSource,
  chevronRight: require('./fulfillment-schedule/icon_chevron_right_gray.png') as AssetSource,
  pickupPin: require('./fulfillment-schedule/icon_pickup_pin_green.png') as AssetSource,
  dropoffPin: require('./fulfillment-schedule/icon_dropoff_pin_orange.png') as AssetSource,
  weight: require('./fulfillment-schedule/icon_weight_gray.png') as AssetSource,
  clock: require('./fulfillment-schedule/icon_clock_gray.png') as AssetSource,
  note: require('./fulfillment-schedule/icon_note_gray.png') as AssetSource,
  drone: require('./fulfillment-schedule/icon_drone_blue.png') as AssetSource,
  executor: require('./fulfillment-schedule/icon_executor_blue.png') as AssetSource,
  safetyShield: require('./fulfillment-schedule/icon_safety_shield_blue.png') as AssetSource,
  insuranceShield: require('./fulfillment-schedule/icon_insurance_shield_blue.png') as AssetSource,
  info: require('./fulfillment-schedule/icon_info_gray.png') as AssetSource,
  noticeInfo: require('./fulfillment-schedule/icon_notice_info_gray.png') as AssetSource,
  phoneOutline: require('./fulfillment-schedule/icon_phone_outline_blue.png') as AssetSource,
  tabWorkbenchInactive: require('./fulfillment-schedule/tab_workbench_inactive.png') as AssetSource,
  tabAcceptOrderActive: require('./fulfillment-schedule/tab_accept_order_active.png') as AssetSource,
  tabMessageInactive: require('./fulfillment-schedule/tab_message_inactive.png') as AssetSource,
  tabProfileInactive: require('./fulfillment-schedule/tab_profile_inactive.png') as AssetSource,
};
