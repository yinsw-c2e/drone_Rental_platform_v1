import { apiV2 } from './api';
import { V2ApiResponse } from '../types';

export interface DevFlightSimulationRoute {
  start_latitude: number;
  start_longitude: number;
  start_address?: string;
  end_latitude: number;
  end_longitude: number;
  end_address?: string;
  straight_distance_m: number;
  estimated_distance_m: number;
  cruise_altitude_m: number;
  interval_seconds: number;
  estimated_duration_seconds: number;
}

export interface DevFlightSimulationTelemetry {
  latitude: number;
  longitude: number;
  altitude: number;
  speed: number;
  heading: number;
  vertical_speed: number;
  battery_level: number;
  signal_strength: number;
}

export interface DevFlightSimulationState {
  order_id: number;
  flight_record_id?: number;
  flight_no?: string;
  status: 'idle' | 'running' | 'completed' | 'stopped' | 'failed';
  phase?: string;
  phase_label?: string;
  step_index?: number;
  total_steps?: number;
  position_count?: number;
  alert_count?: number;
  sample_alerts_enabled?: boolean;
  started_at?: string | null;
  updated_at?: string | null;
  completed_at?: string | null;
  last_error?: string;
  route: DevFlightSimulationRoute;
  latest_telemetry?: DevFlightSimulationTelemetry | null;
}

export const devFlightSimulationService = {
  get: (orderId: number) =>
    apiV2.get<any, V2ApiResponse<DevFlightSimulationState>>(
      `/orders/${orderId}/dev-flight-simulation`,
    ),

  start: (
    orderId: number,
    payload?: { reset_existing_data?: boolean; inject_sample_alerts?: boolean },
  ) =>
    apiV2.post<any, V2ApiResponse<DevFlightSimulationState>>(
      `/orders/${orderId}/dev-flight-simulation/start`,
      payload || {},
    ),

  stop: (orderId: number) =>
    apiV2.post<any, V2ApiResponse<DevFlightSimulationState>>(
      `/orders/${orderId}/dev-flight-simulation/stop`,
    ),
};
