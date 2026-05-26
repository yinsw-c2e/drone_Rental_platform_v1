import type {ImageSourcePropType} from 'react-native';

type AssetSource = ImageSourcePropType;

const asset = (path: string) => ({uri: new URL(path, import.meta.url).href}) as AssetSource;

export const quickOrderConfirmAssets = {
  addWorkPointPlus: asset('./quick-order-confirm/icon_add_work_point_plus.png'),
  chevronRight: asset('./quick-order-confirm/icon_chevron_right.png'),
  detectAirspace: asset('./quick-order-confirm/icon_detect_airspace.png'),
  detectDistancePin: asset('./quick-order-confirm/icon_detect_distance_pin.png'),
  detectDurationClock: asset('./quick-order-confirm/icon_detect_duration_clock.png'),
  detectPayloadScale: asset('./quick-order-confirm/icon_detect_payload_scale.png'),
  infoCircle: asset('./quick-order-confirm/icon_info_circle.png'),
  navBack: asset('./quick-order-confirm/icon_nav_back.png'),
  navChat: asset('./quick-order-confirm/icon_nav_chat.png'),
  radioSelected: asset('./quick-order-confirm/icon_radio_selected.png'),
  radioUnselected: asset('./quick-order-confirm/icon_radio_unselected.png'),
  routeEndPin: asset('./quick-order-confirm/icon_route_end_pin.png'),
  routeStartPin: asset('./quick-order-confirm/icon_route_start_pin.png'),
  sectionDetectionShield: asset('./quick-order-confirm/icon_section_detection_shield.png'),
  sectionLocationPin: asset('./quick-order-confirm/icon_section_location_pin.png'),
  sectionPlanClipboard: asset('./quick-order-confirm/icon_section_plan_clipboard.png'),
};
