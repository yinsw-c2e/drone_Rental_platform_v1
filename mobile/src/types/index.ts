export interface User {
  id: number;
  phone: string;
  nickname: string;
  avatar_url: string;
  user_type: 'drone_owner' | 'renter' | 'cargo_owner' | 'admin';
  id_verified: 'pending' | 'approved' | 'rejected';
  credit_score: number;
  status: string;
  created_at: string;
}

export interface Drone {
  id: number;
  owner_id: number;
  brand: string;
  model: string;
  serial_number: string;
  max_load: number;
  max_flight_time: number;
  max_distance: number;
  features: string[];
  images: string[];
  certification_status: string;
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
  is_read: boolean;
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

export interface PageData<T = any> {
  list: T[];
  total: number;
  page: number;
  page_size: number;
}
