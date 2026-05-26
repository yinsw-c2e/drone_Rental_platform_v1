import type {ImageSourcePropType} from 'react-native';

type AssetSource = ImageSourcePropType;

const asset = (path: string) => ({uri: new URL(path, import.meta.url).href}) as AssetSource;

export const offerListAssets = {
  clock: asset('./offer-list/icon_clock.png'),
  locationPin: asset('./offer-list/icon_location_pin.png'),
  navBack: asset('./offer-list/icon_nav_back.png'),
  navChat: asset('./offer-list/icon_nav_chat.png'),
  routeArrow: asset('./offer-list/icon_route_arrow_right.png'),
  starFilled: asset('./offer-list/icon_star_filled.png'),
  weightM: asset('./offer-list/icon_weight_m.png'),
  providerAnyi: asset('./offer-list/logo_provider_anyi.png'),
  providerQihang: asset('./offer-list/logo_provider_qihang.png'),
  providerYunling: asset('./offer-list/logo_provider_yunling.png'),
  tabHomeInactive: asset('./offer-list/tab_home_inactive.png'),
  tabMessageInactive: asset('./offer-list/tab_message_inactive.png'),
  tabOrderActive: asset('./offer-list/tab_order_active.png'),
  tabProfileInactive: asset('./offer-list/tab_profile_inactive.png'),
};
