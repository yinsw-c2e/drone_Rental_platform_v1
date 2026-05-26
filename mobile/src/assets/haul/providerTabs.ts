import type {ImageSourcePropType} from 'react-native';

type AssetSource = ImageSourcePropType;

export const providerTabAssets = {
  workbenchActive: require('./provider-tabs/tab_workbench_active.png') as AssetSource,
  workbenchInactive: require('./provider-tabs/tab_workbench_inactive.png') as AssetSource,
  acceptOrderActive: require('./provider-tabs/tab_accept_order_active.png') as AssetSource,
  acceptOrderInactive: require('./provider-tabs/tab_accept_order_inactive.png') as AssetSource,
  messageActive: require('./provider-tabs/tab_message_active.png') as AssetSource,
  messageInactive: require('./provider-tabs/tab_message_inactive.png') as AssetSource,
  profileActive: require('./provider-tabs/tab_profile_active.png') as AssetSource,
  profileInactive: require('./provider-tabs/tab_profile_inactive.png') as AssetSource,
};
