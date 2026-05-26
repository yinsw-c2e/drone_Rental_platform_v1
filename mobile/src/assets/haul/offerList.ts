import type {ImageSourcePropType} from 'react-native';

type AssetSource = ImageSourcePropType;

export const offerListAssets = {
  clock: require('./offer-list/icon_clock.png') as AssetSource,
  locationPin: require('./offer-list/icon_location_pin.png') as AssetSource,
  navBack: require('./offer-list/icon_nav_back.png') as AssetSource,
  navChat: require('./offer-list/icon_nav_chat.png') as AssetSource,
  routeArrow: require('./offer-list/icon_route_arrow_right.png') as AssetSource,
  starFilled: require('./offer-list/icon_star_filled.png') as AssetSource,
  weightM: require('./offer-list/icon_weight_m.png') as AssetSource,
  providerAnyi: require('./offer-list/logo_provider_anyi.png') as AssetSource,
  providerQihang: require('./offer-list/logo_provider_qihang.png') as AssetSource,
  providerYunling: require('./offer-list/logo_provider_yunling.png') as AssetSource,
  tabHomeInactive: require('./offer-list/tab_home_inactive.png') as AssetSource,
  tabMessageInactive: require('./offer-list/tab_message_inactive.png') as AssetSource,
  tabOrderActive: require('./offer-list/tab_order_active.png') as AssetSource,
  tabProfileInactive: require('./offer-list/tab_profile_inactive.png') as AssetSource,
};
