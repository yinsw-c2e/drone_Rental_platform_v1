import type {ImageSourcePropType} from 'react-native';

type AssetSource = ImageSourcePropType;

const asset = (path: string) => ({uri: new URL(path, import.meta.url).href}) as AssetSource;

export const providerDemandListAssets = {
  headerMessage: asset('./provider-demand-list/icon_header_message_outline.png'),
  messageDot: asset('./provider-demand-list/badge_message_red_dot.png'),
  filterChevron: asset('./provider-demand-list/icon_filter_chevron_down.png'),
  locationPin: asset('./provider-demand-list/icon_location_pin_blue.png'),
  metricWeight: asset('./provider-demand-list/icon_metric_weight_blue.png'),
  metricClock: asset('./provider-demand-list/icon_metric_clock_orange.png'),
  metricScene: asset('./provider-demand-list/icon_metric_scene_green.png'),
  metricPrice: asset('./provider-demand-list/icon_metric_price_purple.png'),
  airspaceStatus: asset('./provider-demand-list/icon_airspace_status_green.png'),
  chevronRight: asset('./provider-demand-list/icon_chevron_right.png'),
  tabWorkbenchInactive: asset('./provider-demand-list/tab_workbench_inactive.png'),
  tabAcceptOrderActive: asset('./provider-demand-list/tab_accept_order_active.png'),
  tabMessageInactive: asset('./provider-demand-list/tab_message_inactive.png'),
  tabProfileInactive: asset('./provider-demand-list/tab_profile_inactive.png'),
};
