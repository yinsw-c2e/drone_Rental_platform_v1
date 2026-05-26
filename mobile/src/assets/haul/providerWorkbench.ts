import type {ImageSourcePropType} from 'react-native';

type AssetSource = ImageSourcePropType;

export const providerWorkbenchAssets = {
  logo: require('./provider-workbench/logo_provider_anyi_round_drone.png') as AssetSource,
  headerMessage: require('./provider-workbench/icon_header_message_outline.png') as AssetSource,
  headerSettings: require('./provider-workbench/icon_header_settings_gear.png') as AssetSource,
  metricPending: require('./provider-workbench/icon_metric_pending_today_blue.png') as AssetSource,
  metricQuote: require('./provider-workbench/icon_metric_quote_orange.png') as AssetSource,
  metricContract: require('./provider-workbench/icon_metric_contract_green.png') as AssetSource,
  metricIncome: require('./provider-workbench/icon_metric_income_purple.png') as AssetSource,
  quickNewDemand: require('./provider-workbench/icon_quick_new_demand.png') as AssetSource,
  quickMyQuote: require('./provider-workbench/icon_quick_my_quote.png') as AssetSource,
  quickFulfillment: require('./provider-workbench/icon_quick_fulfillment.png') as AssetSource,
  quickDeviceStaff: require('./provider-workbench/icon_quick_device_staff.png') as AssetSource,
  quickQualification: require('./provider-workbench/icon_quick_qualification_insurance.png') as AssetSource,
  todoNewDemand: require('./provider-workbench/icon_todo_new_demand.png') as AssetSource,
  todoOrderSchedule: require('./provider-workbench/icon_todo_order_schedule.png') as AssetSource,
  todoAirspace: require('./provider-workbench/icon_todo_airspace_confirm.png') as AssetSource,
  todoInsurance: require('./provider-workbench/icon_todo_insurance_expiring.png') as AssetSource,
  chevronRight: require('./provider-workbench/icon_chevron_right.png') as AssetSource,
  tabWorkbenchActive: require('./provider-workbench/tab_workbench_active.png') as AssetSource,
  tabAcceptOrderInactive: require('./provider-workbench/tab_accept_order_inactive.png') as AssetSource,
  tabMessageInactive: require('./provider-workbench/tab_message_inactive.png') as AssetSource,
  tabProfileInactive: require('./provider-workbench/tab_profile_inactive.png') as AssetSource,
};
