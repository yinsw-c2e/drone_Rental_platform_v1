import type {ImageSourcePropType} from 'react-native';

type AssetSource = ImageSourcePropType;

export const providerDemandListAssets = {
  headerMessage: require('./provider-demand-list/icon_header_message_outline.png') as AssetSource,
  messageDot: require('./provider-demand-list/badge_message_red_dot.png') as AssetSource,
  filterChevron: require('./provider-demand-list/icon_filter_chevron_down.png') as AssetSource,
  locationPin: require('./provider-demand-list/icon_location_pin_blue.png') as AssetSource,
  metricWeight: require('./provider-demand-list/icon_metric_weight_blue.png') as AssetSource,
  metricClock: require('./provider-demand-list/icon_metric_clock_orange.png') as AssetSource,
  metricScene: require('./provider-demand-list/icon_metric_scene_green.png') as AssetSource,
  metricPrice: require('./provider-demand-list/icon_metric_price_purple.png') as AssetSource,
  airspaceStatus: require('./provider-demand-list/icon_airspace_status_green.png') as AssetSource,
  chevronRight: require('./provider-demand-list/icon_chevron_right.png') as AssetSource,
  tabWorkbenchInactive: require('./provider-demand-list/tab_workbench_inactive.png') as AssetSource,
  tabAcceptOrderActive: require('./provider-demand-list/tab_accept_order_active.png') as AssetSource,
  tabMessageInactive: require('./provider-demand-list/tab_message_inactive.png') as AssetSource,
  tabProfileInactive: require('./provider-demand-list/tab_profile_inactive.png') as AssetSource,
};
