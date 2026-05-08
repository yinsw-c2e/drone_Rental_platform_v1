import { apiV1 } from './api';

// ==================== 类型定义 ====================

export interface FlightPosition {
  id: number;
  order_id: number;
  drone_id: number;
  pilot_id: number;
  latitude: number;
  longitude: number;
  altitude: number;
  speed: number;
  heading: number;
  battery_level: number;
  signal_strength: number;
  temperature: number;
  wind_speed: number;
  recorded_at: string;
}

export interface FlightAlert {
  id: number;
  order_id: number;
  alert_type: string;
  alert_level: string;
  title: string;
  message: string;
  latitude: number;
  longitude: number;
  altitude: number;
  is_acknowledged: boolean;
  acknowledged_at: string;
  is_resolved: boolean;
  resolved_at: string;
  created_at: string;
}

export interface FlightTrajectory {
  id: number;
  order_id: number;
  drone_id: number;
  pilot_id: number;
  start_time: string;
  end_time: string;
  total_distance: number;
  total_duration: number;
  max_altitude: number;
  max_speed: number;
  avg_speed: number;
  waypoint_count: number;
  is_template: boolean;
  status: string;
  created_at: string;
}

export interface FlightWaypoint {
  id: number;
  trajectory_id: number;
  sequence: number;
  latitude: number;
  longitude: number;
  altitude: number;
  speed: number;
  recorded_at: string;
}

export interface SavedRoute {
  id: number;
  name: string;
  description: string;
  owner_id: number;
  trajectory_id: number;
  start_address: string;
  end_address: string;
  total_distance: number;
  estimated_duration: number;
  average_rating: number;
  use_count: number;
  is_public: boolean;
  created_at: string;
}

export interface MultiPointTask {
  id: number;
  order_id: number;
  task_name: string;
  total_stops: number;
  completed_stops: number;
  current_stop: number;
  status: string;
  started_at: string;
  completed_at: string;
  created_at: string;
  stops?: MultiPointTaskStop[];
}

export interface MultiPointTaskStop {
  id: number;
  task_id: number;
  stop_sequence: number;
  stop_name: string;
  address: string;
  latitude: number;
  longitude: number;
  action_type: string;
  status: string;
  arrived_at: string;
  completed_at: string;
  notes: string;
}

export interface ReportPositionRequest {
  order_id: number;
  drone_id: number;
  latitude: number;
  longitude: number;
  altitude: number;
  speed?: number;
  heading?: number;
  battery_level?: number;
  signal_strength?: number;
  temperature?: number;
  wind_speed?: number;
}

export interface CreateMultiPointTaskRequest {
  order_id: number;
  task_name: string;
  stops: {
    stop_name: string;
    address: string;
    latitude: number;
    longitude: number;
    action_type: string;
    notes?: string;
  }[];
}

// ==================== API 服务 ====================

export const reportPosition = async (data: ReportPositionRequest): Promise<void> => {
  await apiV1.post('/flight/position', data);
};

export const getLatestPosition = async (orderId: number): Promise<FlightPosition> => {
  return apiV1.get<FlightPosition>(`/flight/position/${orderId}/latest`);
};

export const getPositionHistory = async (orderId: number, params?: {
  start_time?: string;
  end_time?: string;
}): Promise<FlightPosition[]> => {
  return apiV1.get<FlightPosition[]>(`/flight/position/${orderId}/history`, params);
};

export const getAlerts = async (orderId: number): Promise<FlightAlert[]> => {
  return apiV1.get<FlightAlert[]>(`/flight/alerts/${orderId}`);
};

export const getActiveAlerts = async (orderId: number): Promise<FlightAlert[]> => {
  return apiV1.get<FlightAlert[]>(`/flight/alerts/${orderId}/active`);
};

export const acknowledgeAlert = async (alertId: number): Promise<void> => {
  await apiV1.post(`/flight/alert/${alertId}/acknowledge`);
};

export const resolveAlert = async (alertId: number): Promise<void> => {
  await apiV1.post(`/flight/alert/${alertId}/resolve`);
};

export const startTrajectory = async (orderId: number): Promise<FlightTrajectory> => {
  return apiV1.post<FlightTrajectory>(`/flight/trajectory/start/${orderId}`);
};

export const stopTrajectory = async (trajectoryId: number): Promise<FlightTrajectory> => {
  return apiV1.post<FlightTrajectory>(`/flight/trajectory/stop/${trajectoryId}`);
};

export const getTrajectory = async (trajectoryId: number): Promise<{ trajectory: FlightTrajectory; waypoints: FlightWaypoint[] }> => {
  return apiV1.get(`/flight/trajectory/${trajectoryId}`);
};

export const createRouteFromTrajectory = async (trajectoryId: number, data: {
  name: string;
  description?: string;
  is_public?: boolean;
}): Promise<SavedRoute> => {
  return apiV1.post<SavedRoute>(`/flight/route/from-trajectory/${trajectoryId}`, data);
};

export const listMyRoutes = async (): Promise<SavedRoute[]> => {
  return apiV1.get<SavedRoute[]>('/flight/routes/my');
};

export const listPublicRoutes = async (params?: {
  latitude?: number;
  longitude?: number;
  radius_km?: number;
}): Promise<SavedRoute[]> => {
  return apiV1.get<SavedRoute[]>('/flight/routes/public', params);
};

export const findNearbyRoutes = async (params: {
  latitude: number;
  longitude: number;
  radius_km?: number;
}): Promise<SavedRoute[]> => {
  return apiV1.get<SavedRoute[]>('/flight/routes/nearby', params);
};

export const deleteRoute = async (routeId: number): Promise<void> => {
  await apiV1.delete(`/flight/route/${routeId}`);
};

export const createMultiPointTask = async (data: CreateMultiPointTaskRequest): Promise<MultiPointTask> => {
  return apiV1.post<MultiPointTask>('/flight/multi-point/task', data);
};

export const getMultiPointTask = async (taskId: number): Promise<MultiPointTask> => {
  return apiV1.get<MultiPointTask>(`/flight/multi-point/task/${taskId}`);
};

export const startMultiPointTask = async (taskId: number): Promise<void> => {
  await apiV1.post(`/flight/multi-point/task/${taskId}/start`);
};

export const arriveAtStop = async (taskId: number): Promise<void> => {
  await apiV1.post(`/flight/multi-point/task/${taskId}/arrive`);
};

export const completeStop = async (taskId: number, notes?: string): Promise<void> => {
  await apiV1.post(`/flight/multi-point/task/${taskId}/complete-stop`, { notes });
};

export const getFlightStats = async (): Promise<any> => {
  return apiV1.get('/flight/stats');
};

export const simulateFlight = async (orderId: number): Promise<{
  message: string;
  order_id: number;
  start_lat: number;
  start_lng: number;
  end_lat: number;
  end_lng: number;
}> => {
  return apiV1.post(`/flight/simulate/${orderId}`);
};

export default {
  reportPosition,
  getLatestPosition,
  getPositionHistory,
  getAlerts,
  getActiveAlerts,
  acknowledgeAlert,
  resolveAlert,
  startTrajectory,
  stopTrajectory,
  getTrajectory,
  createRouteFromTrajectory,
  listMyRoutes,
  listPublicRoutes,
  findNearbyRoutes,
  deleteRoute,
  createMultiPointTask,
  getMultiPointTask,
  startMultiPointTask,
  arriveAtStop,
  completeStop,
  getFlightStats,
  simulateFlight,
};
