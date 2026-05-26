import type {ImageSourcePropType} from 'react-native';

type AssetSource = ImageSourcePropType;

const asset = (path: string) => ({uri: new URL(path, import.meta.url).href}) as AssetSource;

export const providerWorkbenchAssets = {
  logo: asset('./provider-workbench/logo_provider_anyi_round_drone.png'),
  headerMessage: asset('./provider-workbench/icon_header_message_outline.png'),
  headerSettings: asset('./provider-workbench/icon_header_settings_gear.png'),
  metricPending: asset('./provider-workbench/icon_metric_pending_today_blue.png'),
  metricQuote: asset('./provider-workbench/icon_metric_quote_orange.png'),
  metricContract: asset('./provider-workbench/icon_metric_contract_green.png'),
  metricIncome: asset('./provider-workbench/icon_metric_income_purple.png'),
  quickNewDemand: asset('./provider-workbench/icon_quick_new_demand.png'),
  quickMyQuote: asset('./provider-workbench/icon_quick_my_quote.png'),
  quickFulfillment: asset('./provider-workbench/icon_quick_fulfillment.png'),
  quickDeviceStaff: asset('./provider-workbench/icon_quick_device_staff.png'),
  quickQualification: asset('./provider-workbench/icon_quick_qualification_insurance.png'),
  todoNewDemand: asset('./provider-workbench/icon_todo_new_demand.png'),
  todoOrderSchedule: asset('./provider-workbench/icon_todo_order_schedule.png'),
  todoAirspace: asset('./provider-workbench/icon_todo_airspace_confirm.png'),
  todoInsurance: asset('./provider-workbench/icon_todo_insurance_expiring.png'),
  chevronRight: asset('./provider-workbench/icon_chevron_right.png'),
  tabWorkbenchActive: asset('./provider-workbench/tab_workbench_active.png'),
  tabAcceptOrderInactive: asset('./provider-workbench/tab_accept_order_inactive.png'),
  tabMessageInactive: asset('./provider-workbench/tab_message_inactive.png'),
  tabProfileInactive: asset('./provider-workbench/tab_profile_inactive.png'),
};
