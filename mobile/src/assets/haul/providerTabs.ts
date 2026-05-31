import type {ImageSourcePropType} from 'react-native';

type AssetSource = ImageSourcePropType;

export const providerTabAssets = {
  workbenchActive: require('../tabbar/provider_tab_workbench_active.png') as AssetSource,
  workbenchInactive: require('../tabbar/provider_tab_workbench_inactive.png') as AssetSource,
  acceptOrderActive: require('../tabbar/provider_tab_accept_order_active.png') as AssetSource,
  acceptOrderInactive: require('../tabbar/provider_tab_accept_order_inactive.png') as AssetSource,
  messageActive: require('../tabbar/icon_tab_message_active.png') as AssetSource,
  messageInactive: require('../tabbar/icon_tab_message_inactive.png') as AssetSource,
  profileActive: require('../tabbar/provider_tab_profile_active.png') as AssetSource,
  profileInactive: require('../tabbar/provider_tab_profile_inactive.png') as AssetSource,
};
