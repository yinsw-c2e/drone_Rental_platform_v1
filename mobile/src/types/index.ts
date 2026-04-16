export interface User {
  id: number;
  phone: string;
  nickname: string;
  avatar_url?: string;
  user_type?: 'drone_owner' | 'renter' | 'cargo_owner' | 'client' | 'admin' | 'pilot' | 'both';
  id_verified?: 'pending' | 'approved' | 'rejected';
  credit_score?: number;
  status?: string;
  created_at?: string;
}

export interface RoleSummary {
  has_client_role: boolean;
  has_owner_role: boolean;
  has_pilot_role: boolean;
  can_publish_supply: boolean;
  can_accept_dispatch: boolean;
  can_self_execute: boolean;
}

export interface MeSummary {
  user: Pick<User, 'id' | 'phone' | 'nickname' | 'avatar_url'>;
  role_summary: RoleSummary;
}

export interface HomeDashboardSummary {
  in_progress_order_count: number;
  today_order_count: number;
  today_income_amount: number;
  alert_count: number;
}

export interface HomeDashboardMarketTotals {
  supply_count: number;
  demand_count: number;
}

export interface HomeClientDashboard {
  open_demand_count: number;
  quoted_demand_count: number;
  pending_provider_confirmation_order_count: number;
  pending_payment_order_count: number;
  in_progress_order_count: number;
}

export interface HomeOwnerDashboard {
  recommended_demand_count: number;
  active_supply_count: number;
  pending_quote_count: number;
  pending_provider_confirmation_order_count: number;
  pending_dispatch_order_count: number;
}

export interface HomePilotDashboard {
  pending_response_dispatch_count: number;
  candidate_demand_count: number;
  active_dispatch_count: number;
  recent_flight_count: number;
}

export interface HomeOrderCard {
  id: number;
  order_no: string;
  title: string;
  status: string;
  total_amount: number;
  created_at: string;
}

export interface HomeFeedItem {
  object_type: 'supply' | 'demand';
  object_id: number;
  badge: string;
  title: string;
  subtitle: string;
}

export interface HomeDashboard {
  role_summary: RoleSummary;
  summary: HomeDashboardSummary;
  market_totals: HomeDashboardMarketTotals;
  role_views: {
    client: HomeClientDashboard;
    owner: HomeOwnerDashboard;
    pilot: HomePilotDashboard;
  };
  in_progress_orders: HomeOrderCard[];
  market_feed: HomeFeedItem[];
}

export interface Drone {
  id: number;
  owner_id: number;
  brand: string;
  model: string;
  serial_number: string;
  max_load: number;
  mtow_kg?: number;
  max_payload_kg?: number;
  max_flight_time: number;
  max_distance: number;
  features: string[];
  images: string[];
  certification_status: string;
  uom_verified?: string;
  insurance_verified?: string;
  airworthiness_verified?: string;
  daily_price: number;
  hourly_price: number;
  deposit: number;
  latitude: number;
  longitude: number;
  address: string;
  city: string;
  availability_status: string;
  rating: number;
  order_count: number;
  description: string;
  owner?: User;
}

export interface RentalOffer {
  id: number;
  drone_id: number;
  owner_id: number;
  title: string;
  description: string;
  service_type: string;
  available_from: string;
  available_to: string;
  latitude: number;
  longitude: number;
  address: string;
  service_radius: number;
  price_type: string;
  price: number;
  status: string;
  views?: number;
  drone?: Drone;
  owner?: User;
}

export interface RentalDemand {
  id: number;
  renter_id: number;
  demand_type: string;
  title: string;
  description: string;
  required_features: string[];
  required_load: number;
  latitude: number;
  longitude: number;
  address: string;
  city: string;
  start_time: string;
  end_time: string;
  budget_min: number;
  budget_max: number;
  status: string;
  urgency: string;
  renter?: User;
}

export interface CargoDemand {
  id: number;
  publisher_id: number;
  cargo_type: string;
  cargo_weight: number;
  cargo_description: string;
  pickup_address: string;
  delivery_address: string;
  distance: number;
  pickup_time: string;
  offered_price: number;
  images: string[];
  status: string;
  publisher?: User;
}

export interface Order {
  id: number;
  order_no: string;
  order_type: string;
  drone_id: number;
  owner_id: number;
  renter_id: number;
  title: string;
  service_type: string;
  start_time: string;
  end_time: string;
  total_amount: number;
  platform_commission_rate: number;
  platform_commission: number;
  owner_amount: number;
  deposit_amount: number;
  status: string;
  drone?: Drone;
  owner?: User;
  renter?: User;
  created_at: string;
}

export interface Message {
  id: number;
  conversation_id: string;
  sender_id: number;
  receiver_id: number;
  message_type: string;
  content: string;
  extra_data?: Record<string, any> | null;
  is_read: boolean;
  read_at?: string | null;
  created_at: string;
}

export interface ConversationSummary {
  conversation_id: string;
  last_message: string;
  last_time: string;
  last_type: string;
  peer_id: number;
  unread_count: number;
}

export interface Review {
  id: number;
  order_id: number;
  reviewer_id: number;
  reviewee_id: number;
  review_type: string;
  rating: number;
  content: string;
  images: string[];
  created_at: string;
}

export interface MatchingRecord {
  id: number;
  demand_id: number;
  demand_type: string;
  supply_id: number;
  supply_type: string;
  match_score: number;
  match_reason: any;
  status: string;
}

export interface TokenPair {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

export interface ApiResponse<T = any> {
  code: number;
  message: string;
  data: T;
  timestamp: number;
}

export interface V2ApiResponse<T = any, M = any> {
  code: string;
  message: string;
  data: T;
  meta?: M;
  trace_id: string;
}

export interface V2PageMeta {
  page: number;
  page_size: number;
  total: number;
}

export interface V2ListData<T = any> {
  items: T[];
}

export interface V2NotificationSummary {
  id: number;
  conversation_id: string;
  message_type: string;
  content: string;
  extra_data?: {
    title?: string;
    event_type?: string;
    business_type?: string;
    demand_id?: number;
    demand_no?: string;
    quote_id?: number;
    quote_no?: string;
    order_id?: number;
    order_no?: string;
    dispatch_task_id?: number;
    dispatch_no?: string;
    binding_id?: number;
    drone_id?: number;
    status?: string;
    reason?: string;
    note?: string;
    [key: string]: any;
  };
  is_read: boolean;
  read_at?: string | null;
  created_at: string;
}

export interface V2NotificationMeta extends V2PageMeta {
  unread_count: number;
}

export interface PageData<T = any> {
  list: T[];
  total: number;
  page: number;
  page_size: number;
}

// ============ 地址 & 位置相关 ============

export interface AddressData {
  id?: number;
  label?: string;
  name?: string;
  address: string;
  province?: string;
  city?: string;
  district?: string;
  latitude: number;
  longitude: number;
  is_default?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface AddressSnapshot {
  text: string;
  province?: string;
  city?: string;
  district?: string;
  latitude?: number | null;
  longitude?: number | null;
}

export interface SupplyOwnerSummary {
  id: number;
  nickname: string;
  avatar_url?: string;
}

export interface SupplyDroneSummary {
  id: number;
  brand: string;
  model: string;
  serial_number: string;
  mtow_kg: number;
  max_payload_kg: number;
  city?: string;
}

export interface SupplySummary {
  id: number;
  supply_no: string;
  title: string;
  owner_user_id?: number;
  drone_id?: number;
  service_types: string[];
  cargo_scenes: string[];
  mtow_kg: number;
  max_payload_kg: number;
  base_price_amount: number;
  pricing_unit: string;
  accepts_direct_order: boolean;
  status: string;
  updated_at?: string;
  drone?: SupplyDroneSummary;
}

export interface SupplyDetail extends SupplySummary {
  description?: string;
  service_area_snapshot?: any;
  max_range_km?: number;
  pricing_rule?: any;
  available_time_slots?: any;
  created_at?: string;
  updated_at?: string;
  owner?: SupplyOwnerSummary;
}

export interface DirectOrderInput {
  service_type: 'heavy_cargo_lift_transport';
  cargo_scene: string;
  departure_address: AddressSnapshot;
  destination_address: AddressSnapshot;
  service_address?: AddressSnapshot | null;
  scheduled_start_at: string;
  scheduled_end_at: string;
  cargo_weight_kg: number;
  cargo_volume_m3?: number;
  cargo_type: string;
  cargo_special_requirements?: string;
  description?: string;
}

export interface DirectOrderResult {
  order_id: number;
  order_no: string;
  order_source: string;
  status: string;
  total_amount?: number;
  platform_commission?: number;
  owner_amount?: number;
}

export interface QuickOrderDraft {
  cargo_scene: string;
  cargo_type?: string;
  cargo_weight_kg?: number;
  cargo_volume_m3?: number;
  departure_address?: AddressData | null;
  destination_address?: AddressData | null;
  scheduled_start_at?: string;
  scheduled_end_at?: string;
  description?: string;
  special_requirements?: string;
  match_region?: string;
}

export interface DemandOwnerSummary {
  id: number;
  nickname: string;
  avatar_url?: string;
}

export interface DemandQuoteDemandSummary {
  id: number;
  demand_no: string;
  title: string;
  status: string;
}

export interface DemandQuoteDroneSummary {
  id: number;
  brand: string;
  model: string;
  serial_number?: string;
  mtow_kg?: number;
  max_payload_kg?: number;
}

export interface DemandQuoteSummary {
  id: number;
  quote_no: string;
  demand_id: number;
  owner_user_id: number;
  price_amount: number;
  status: string;
  execution_plan?: string;
  created_at?: string;
  owner?: DemandOwnerSummary;
  drone?: DemandQuoteDroneSummary;
  demand?: DemandQuoteDemandSummary;
}

export interface DemandCandidateSummary {
  id: number;
  demand_id: number;
  pilot_user_id: number;
  status: string;
  availability_snapshot?: any;
  created_at?: string;
  updated_at?: string;
}

export interface DemandSummary {
  id: number;
  demand_no: string;
  client_user_id?: number;
  title: string;
  status: string;
  service_type: string;
  cargo_scene?: string;
  service_address_text?: string;
  scheduled_start_at?: string;
  scheduled_end_at?: string;
  budget_min?: number;
  budget_max?: number;
  allows_pilot_candidate: boolean;
  quote_count: number;
  candidate_pilot_count: number;
  my_quote?: DemandQuoteSummary;
  my_candidate?: DemandCandidateSummary;
}

export interface DemandDetail extends DemandSummary {
  description?: string;
  departure_address?: AddressSnapshot | null;
  destination_address?: AddressSnapshot | null;
  service_address?: AddressSnapshot | null;
  cargo_weight_kg?: number;
  cargo_volume_m3?: number;
  cargo_type?: string;
  cargo_special_requirements?: string;
  estimated_trip_count?: number;
  selected_quote_id?: number | null;
  selected_provider_user_id?: number | null;
  expires_at?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface DemandQuoteInput {
  drone_id: number;
  price_amount: number;
  execution_plan?: string;
}

export interface DemandSelectProviderResult {
  order_id: number;
  order_no: string;
  status: string;
}

export interface OrderPartySummary {
  user_id: number;
  role: 'client' | 'owner' | 'pilot' | string;
  nickname?: string;
  avatar_url?: string;
  phone?: string;
}

export interface OwnerPilotBindingSummary {
  id: number;
  owner_user_id: number;
  pilot_user_id: number;
  initiated_by: 'owner' | 'pilot' | string;
  status: string;
  is_priority?: boolean;
  note?: string;
  confirmed_at?: string | null;
  dissolved_at?: string | null;
  created_at?: string;
  updated_at?: string;
  owner?: {
    id: number;
    nickname?: string;
    avatar_url?: string;
  } | null;
  pilot?: {
    id: number;
    nickname?: string;
    avatar_url?: string;
  } | null;
}

export interface OwnerProfile {
  id: number;
  user_id: number;
  service_city?: string;
  contact_phone?: string;
  intro?: string;
  created_at?: string;
  updated_at?: string;
}

export interface V2PilotEligibilityBlocker {
  code: string;
  message: string;
}

export interface V2PilotEligibility {
  tier: string;
  label: string;
  can_apply_candidate: boolean;
  can_accept_dispatch: boolean;
  can_start_execution: boolean;
  can_update_availability: boolean;
  recommended_next_step: string;
  blockers: V2PilotEligibilityBlocker[];
}

export interface V2PilotProfile {
  id: number;
  user_id: number;
  caac_license_no: string;
  caac_license_type: string;
  caac_license_expire_at?: string | null;
  caac_license_image?: string;
  verification_status: string;
  availability_status: string;
  service_radius_km: number;
  service_radius: number;
  current_city?: string;
  service_cities?: string[];
  special_skills?: string[];
  skill_tags?: string[];
  service_rating?: number;
  credit_score?: number;
  eligibility?: V2PilotEligibility | null;
  created_at?: string;
  updated_at?: string;
}

export interface OwnerWorkbenchSummary {
  recommended_demand_count: number;
  pending_quote_count: number;
  pending_provider_confirmation_order_count: number;
  pending_dispatch_order_count: number;
  draft_supply_count: number;
}

export interface OwnerWorkbenchDemandItem {
  id: number;
  demand_no: string;
  title: string;
  status: string;
  service_address_text: string;
  scheduled_start_at?: string | null;
  scheduled_end_at?: string | null;
  budget_min: number;
  budget_max: number;
  quote_count: number;
  candidate_pilot_count: number;
}

export interface OwnerWorkbenchOrderItem {
  id: number;
  order_no: string;
  title: string;
  status: string;
  order_source: string;
  service_address?: string;
  dest_address?: string;
  total_amount: number;
  created_at?: string;
  updated_at?: string;
}

export interface OwnerWorkbenchSupplyItem {
  id: number;
  supply_no: string;
  title: string;
  status: string;
  drone_id: number;
  base_price_amount: number;
  pricing_unit: string;
  updated_at?: string;
  drone_brand?: string;
  drone_model?: string;
  certification_status?: string;
  uom_verified?: string;
  insurance_verified?: string;
  airworthiness_verified?: string;
}

export interface OwnerWorkbenchView {
  summary: OwnerWorkbenchSummary;
  recommended_demands: OwnerWorkbenchDemandItem[];
  pending_provider_confirmation_orders: OwnerWorkbenchOrderItem[];
  pending_dispatch_orders: OwnerWorkbenchOrderItem[];
  draft_supplies: OwnerWorkbenchSupplyItem[];
}

export interface V2OrderSummary {
  id: number;
  order_no: string;
  title: string;
  order_source: string;
  demand_id?: number | null;
  source_supply_id?: number | null;
  status: string;
  needs_dispatch: boolean;
  execution_mode?: string;
  provider_user_id?: number | null;
  executor_pilot_user_id?: number | null;
  dispatch_task_id?: number | null;
  drone_id?: number | null;
  drone?: {
    id: number;
    brand: string;
    model: string;
    serial_number?: string;
    mtow_kg?: number;
    max_payload_kg?: number;
    availability_status?: string;
  } | null;
  service_type?: string;
  service_address?: string;
  dest_address?: string;
  start_time?: string;
  end_time?: string;
  total_amount: number;
  paid_at?: string | null;
  payment_ready?: boolean;
  contract?: {
    id?: number;
    status: string;
    client_user_id?: number;
    provider_user_id?: number;
    client_signed_at?: string | null;
    provider_signed_at?: string | null;
    payment_ready?: boolean;
  } | null;
  provider_confirmed_at?: string | null;
  provider_rejected_at?: string | null;
  provider_reject_reason?: string;
  cancel_reason?: string;
  cancel_by?: string;
  client?: OrderPartySummary | null;
  provider?: OrderPartySummary | null;
  executor?: OrderPartySummary | null;
  created_at: string;
  updated_at?: string;
}

export interface V2DispatchTaskSummary {
  id: number;
  dispatch_no: string;
  order_id: number;
  provider_user_id?: number | null;
  target_pilot_user_id?: number | null;
  dispatch_source?: string;
  retry_count?: number;
  status: string;
  reason?: string;
  sent_at?: string | null;
  responded_at?: string | null;
  provider?: OrderPartySummary | null;
  target_pilot?: OrderPartySummary | null;
  order?: {
    id: number;
    order_no: string;
    order_source?: string;
    status: string;
    needs_dispatch?: boolean;
    execution_mode?: string;
    title?: string;
    service_type?: string;
    service_address?: string;
    dest_address?: string;
    total_amount?: number;
    created_at?: string;
  };
  created_at?: string;
  updated_at?: string;
}

export interface V2DispatchLogSummary {
  id: number;
  action_type: string;
  operator_user_id?: number;
  operator_nickname?: string;
  note?: string;
  created_at?: string;
}

export interface V2DispatchTaskDetail {
  dispatch_task: V2DispatchTaskSummary;
  order?: {
    id: number;
    order_no: string;
    order_source?: string;
    status: string;
    needs_dispatch?: boolean;
    execution_mode?: string;
    title?: string;
    service_type?: string;
    service_address?: string;
    dest_address?: string;
    total_amount?: number;
    created_at?: string;
  };
  logs: V2DispatchLogSummary[];
}

export interface V2DispatchActionResult {
  order?: {
    id?: number;
    order_no?: string;
    status?: string;
    execution_mode?: string;
  } | null;
  dispatch_task?: V2DispatchTaskSummary | null;
}

export interface V2FlightRecordSummary {
  id: number;
  flight_no?: string;
  order_id?: number;
  dispatch_task_id?: number | null;
  pilot_user_id?: number | null;
  drone_id?: number | null;
  status?: string;
  takeoff_at?: string | null;
  landing_at?: string | null;
  total_duration_seconds?: number;
  total_distance_m?: number;
  max_altitude_m?: number;
  created_at?: string;
  updated_at?: string;
  order?: {
    id: number;
    order_no?: string;
    title?: string;
    status?: string;
  } | null;
}

export interface V2FlightPositionSummary {
  id: number;
  flight_record_id?: number | null;
  order_id?: number;
  latitude: number;
  longitude: number;
  altitude?: number;
  speed?: number;
  heading?: number;
  battery_level?: number;
  signal_strength?: number;
  recorded_at?: string;
}

export interface V2FlightAlertSummary {
  id: number;
  flight_record_id?: number | null;
  order_id?: number;
  alert_type?: string;
  alert_level?: string;
  title?: string;
  description?: string;
  status?: string;
  triggered_at?: string;
}

export interface V2FlightStatsSummary {
  actual_flight_duration?: number;
  actual_flight_distance?: number;
  max_altitude?: number;
  avg_speed?: number;
  flight_start_time?: string;
  flight_end_time?: string;
}

export interface V2OrderMonitor {
  order: V2OrderSummary;
  current_dispatch?: V2DispatchTaskSummary | null;
  active_flight_record?: V2FlightRecordSummary | null;
  latest_flight_record?: V2FlightRecordSummary | null;
  latest_position?: V2FlightPositionSummary | null;
  recent_positions?: V2FlightPositionSummary[];
  active_alerts?: V2FlightAlertSummary[];
  flight_records?: V2FlightRecordSummary[];
  flight_stats?: V2FlightStatsSummary | null;
  timeline?: V2OrderTimelineItem[];
}

export interface V2PaymentSummary {
  id: number;
  payment_no: string;
  order_id?: number;
  user_id?: number;
  payment_type?: string;
  payment_method?: string;
  amount: number;
  status: string;
  third_party_no?: string;
  paid_at?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface V2RefundSummary {
  id: number;
  refund_no: string;
  payment_id?: number;
  amount: number;
  reason?: string;
  status: string;
  created_at?: string;
  updated_at?: string;
}

export interface V2DisputeSummary {
  id: number;
  order_id: number;
  initiator_user_id: number;
  dispute_type?: string;
  status: string;
  summary: string;
  created_at?: string;
  updated_at?: string;
}

export interface V2ReviewSummary {
  id: number;
  order_id: number;
  reviewer_user_id: number;
  target_user_id: number;
  target_role: string;
  rating: number;
  content: string;
  created_at?: string;
  updated_at?: string;
}

export interface V2SettlementSummary {
  id: number;
  settlement_no: string;
  order_id: number;
  order_no?: string;
  total_amount: number;
  final_amount: number;
  platform_fee_rate?: number;
  platform_fee?: number;
  pilot_fee_rate?: number;
  pilot_fee?: number;
  owner_fee_rate?: number;
  owner_fee?: number;
  insurance_deduction?: number;
  pilot_user_id?: number | null;
  owner_user_id?: number | null;
  payer_user_id?: number | null;
  flight_distance?: number;
  flight_duration?: number;
  cargo_weight?: number;
  difficulty_factor?: number;
  cargo_value?: number;
  insurance_rate?: number;
  status?: string;
  calculated_at?: string | null;
  confirmed_at?: string | null;
  settled_at?: string | null;
  settled_by?: number | null;
  notes?: string;
  created_at?: string;
  updated_at?: string;
}

export interface V2CreateOrderPaymentResult {
  payment: V2PaymentSummary;
  pay_params?: Record<string, any> | null;
  payment_flow?: {
    method: string;
    capability?: string;
    status?: string;
    auto_completed?: boolean;
    recommended_method?: string;
    notice?: string;
  } | null;
  order?: {
    id: number;
    order_no?: string;
    status?: string;
    execution_mode?: string;
    needs_dispatch?: boolean;
    paid_at?: string | null;
  } | null;
}

export interface V2OrderTimelineItem {
  id: number;
  status: string;
  note?: string;
  operator_id?: number;
  operator_type?: string;
  created_at?: string;
}

export interface V2OrderTimelineEvent {
  event_id: string;
  source_type: string;
  source_id: number;
  event_type: string;
  title: string;
  description?: string;
  status?: string;
  occurred_at?: string;
  operator_id?: number;
  operator_type?: string;
  payload?: Record<string, any>;
}

export interface V2OrderTimelineResponse {
  order: V2OrderSummary;
  items: V2OrderTimelineEvent[];
}

export interface V2OrderFinancialSummary {
  total_amount: number;
  deposit_amount: number;
  platform_commission: number;
  owner_amount: number;
  paid_amount: number;
  paid_count: number;
  refunded_amount: number;
  refund_count: number;
  provider_reject_reason?: string;
}

export interface V2OrderDetail extends V2OrderSummary {
  source_info?: {
    order_source?: string;
    demand_id?: number | null;
    source_supply_id?: number | null;
    snapshots?: Record<string, any>;
  };
  participants?: {
    client?: OrderPartySummary | null;
    provider?: OrderPartySummary | null;
    executor?: OrderPartySummary | null;
  };
  current_dispatch?: V2DispatchTaskSummary | null;
  dispatch_history?: V2DispatchTaskSummary[];
  financial_summary?: V2OrderFinancialSummary;
  payments?: V2PaymentSummary[];
  refunds?: V2RefundSummary[];
  disputes?: V2DisputeSummary[];
  dispute_count?: number;
  timeline?: V2OrderTimelineItem[];
}

export interface POIItem {
  name: string;
  address: string;
  province?: string;
  city?: string;
  district?: string;
  longitude: number;
  latitude: number;
  type?: string;
  distance?: string;
}

export interface ReverseGeoResult {
  formatted_address: string;
  province: string;
  city: string;
  district: string;
  township?: string;
  street?: string;
  number?: string;
}
