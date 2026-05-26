import type {ImageSourcePropType} from 'react-native';

type AssetSource = ImageSourcePropType;

export const haulAssets = {
  logo: require('./logo_haul_square.png') as AssetSource,
  customerLift: require('./ill_mode_customer_lift.png') as AssetSource,
  providerOrder: require('./ill_mode_provider_order.png') as AssetSource,
  chevronRight: require('./icon_chevron_right.png') as AssetSource,
  shield: require('./icon_shield.png') as AssetSource,
  wechat: require('./icon_wechat.png') as AssetSource,
  providerAnyi: require('./logo_provider_anyi.png') as AssetSource,
  providerQihang: require('./logo_provider_qihang.png') as AssetSource,
  providerYunling: require('./logo_provider_yunling.png') as AssetSource,
};
