import type {ImageSourcePropType} from 'react-native';

type AssetSource = ImageSourcePropType;

const asset = (path: string) => ({uri: new URL(path, import.meta.url).href}) as AssetSource;

export const providerTabAssets = {
  workbenchActive: asset('./provider-tabs/tab_workbench_active.png'),
  workbenchInactive: asset('./provider-tabs/tab_workbench_inactive.png'),
  acceptOrderActive: asset('./provider-tabs/tab_accept_order_active.png'),
  acceptOrderInactive: asset('./provider-tabs/tab_accept_order_inactive.png'),
  messageActive: asset('./provider-tabs/tab_message_active.png'),
  messageInactive: asset('./provider-tabs/tab_message_inactive.png'),
  profileActive: asset('./provider-tabs/tab_profile_active.png'),
  profileInactive: asset('./provider-tabs/tab_profile_inactive.png'),
};
