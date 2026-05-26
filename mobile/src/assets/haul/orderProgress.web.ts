import type {ImageSourcePropType} from 'react-native';

type AssetSource = ImageSourcePropType;

const asset = (path: string) => ({uri: new URL(path, import.meta.url).href}) as AssetSource;

export const orderProgressAssets = {
  badgeMessageRed3: asset('./order-progress/badge_message_red_3.png'),
  droneServiceBlue: asset('./order-progress/icon_drone_service_blue.png'),
  dropoffPinOrange: asset('./order-progress/icon_dropoff_pin_orange.png'),
  navBack: asset('./order-progress/icon_nav_back.png'),
  navServiceHeadset: asset('./order-progress/icon_nav_service_headset.png'),
  phoneOutline: asset('./order-progress/icon_phone_outline.png'),
  pickupPinGreen: asset('./order-progress/icon_pickup_pin_green.png'),
  statusAcceptedGreen: asset('./order-progress/icon_status_accepted_green.png'),
  summaryChevronRight: asset('./order-progress/icon_summary_chevron_right.png'),
  summaryWeightGray: asset('./order-progress/icon_summary_weight_gray.png'),
  teamBlue: asset('./order-progress/icon_team_blue.png'),
  timelineActive3: asset('./order-progress/icon_timeline_active_3.png'),
  timelineCheck: asset('./order-progress/icon_timeline_check.png'),
  timelinePending4: asset('./order-progress/icon_timeline_pending_4.png'),
  timelinePending5: asset('./order-progress/icon_timeline_pending_5.png'),
  timelinePending6: asset('./order-progress/icon_timeline_pending_6.png'),
  providerAnyi: asset('./order-progress/logo_provider_anyi.png'),
  tabHomeInactive: asset('./order-progress/tab_home_inactive.png'),
  tabMessageInactive: asset('./order-progress/tab_message_inactive.png'),
  tabOrderActive: asset('./order-progress/tab_order_active.png'),
  tabProfileInactive: asset('./order-progress/tab_profile_inactive.png'),
};
