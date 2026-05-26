import type {ImageSourcePropType} from 'react-native';

type AssetSource = ImageSourcePropType;

const asset = (path: string) => ({uri: new URL(path, import.meta.url).href}) as AssetSource;

export const haulAssets = {
  logo: asset('./logo_haul_square.png'),
  customerLift: asset('./ill_mode_customer_lift.png'),
  providerOrder: asset('./ill_mode_provider_order.png'),
  chevronRight: asset('./icon_chevron_right.png'),
  shield: asset('./icon_shield.png'),
  wechat: asset('./icon_wechat.png'),
  providerAnyi: asset('./logo_provider_anyi.png'),
  providerQihang: asset('./logo_provider_qihang.png'),
  providerYunling: asset('./logo_provider_yunling.png'),
};
