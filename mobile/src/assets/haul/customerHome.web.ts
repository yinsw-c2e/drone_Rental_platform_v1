import type {ImageSourcePropType} from 'react-native';

type AssetSource = ImageSourcePropType;

const asset = (path: string) => ({uri: new URL(path, import.meta.url).href}) as AssetSource;

export const customerHomeAssets = {
  bookingClipboard: asset('./customer-home/icon_booking_clipboard.png'),
  chevronRight: asset('./customer-home/icon_chevron_right.png'),
  clock: asset('./customer-home/icon_clock.png'),
  locationEnd: asset('./customer-home/icon_location_end.png'),
  locationPin: asset('./customer-home/icon_location_pin.png'),
  locationStart: asset('./customer-home/icon_location_start.png'),
  navChat: asset('./customer-home/icon_nav_chat.png'),
  navChevronDown: asset('./customer-home/icon_nav_chevron_down.png'),
  starFilled: asset('./customer-home/icon_star_filled.png'),
  starOutline: asset('./customer-home/icon_star_outline.png'),
  tabHomeActive: asset('./customer-home/icon_tab_home_active.png'),
  tabHomeInactive: asset('./customer-home/icon_tab_home_inactive.png'),
  tabMessageActive: asset('./customer-home/icon_tab_message_active.png'),
  tabMessageInactive: asset('./customer-home/icon_tab_message_inactive.png'),
  tabOrderActive: asset('./customer-home/icon_tab_order_active.png'),
  tabOrderInactive: asset('./customer-home/icon_tab_order_inactive.png'),
  tabProfileActive: asset('./customer-home/icon_tab_profile_active.png'),
  tabProfileInactive: asset('./customer-home/icon_tab_profile_inactive.png'),
  trustAirspace: asset('./customer-home/icon_trust_airspace.png'),
  trustInsurance: asset('./customer-home/icon_trust_insurance.png'),
  trustProvider: asset('./customer-home/icon_trust_provider.png'),
  weightKg: asset('./customer-home/icon_weight_kg.png'),
};
