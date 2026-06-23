import { apiV2 } from './api';

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
  await apiV2.post('/flight/position', data);
};

export const getLatestPosition = async (orderId: number): Promise<FlightPosition> => {
  return apiV2.get<FlightPosition>(`/flight/position/${orderId}/latest`);
};

export const getPositionHistory = async (orderId: number, params?: {
  start_time?: string;
  end_time?: string;
}): Promise<FlightPosition[]> => {
  return apiV2.get<FlightPosition[]>(`/flight/position/${orderId}/history`, params);
};

export const getAlerts = async (orderId: number): Promise<FlightAlert[]> => {
  return apiV2.get<FlightAlert[]>(`/flight/alerts/${orderId}`);
};

export const getActiveAlerts = async (orderId: number): Promise<FlightAlert[]> => {
  return apiV2.get<FlightAlert[]>(`/flight/alerts/${orderId}/active`);
};

export const acknowledgeAlert = async (alertId: number): Promise<void> => {
  await apiV2.post(`/flight/alert/${alertId}/acknowledge`);
};

export const resolveAlert = async (alertId: number): Promise<void> => {
  await apiV2.post(`/flight/alert/${alertId}/resolve`);
};

export const startTrajectory = async (orderId: number): Promise<FlightTrajectory> => {
  return apiV2.post<FlightTrajectory>('/flight/trajectory/start', { order_id: orderId });
};

export const stopTrajectory = async (trajectoryId: number): Promise<FlightTrajectory> => {
  return apiV2.post<FlightTrajectory>('/flight/trajectory/stop', { trajectory_id: trajectoryId });
};

export const getTrajectory = async (trajectoryId: number): Promise<{ trajectory: FlightTrajectory; waypoints: FlightWaypoint[] }> => {
  return apiV2.get(`/flight/trajectory/${trajectoryId}`);
};

export const createRouteFromTrajectory = async (trajectoryId: number, data: {
  name: string;
  description?: string;
  is_public?: boolean;
}): Promise<SavedRoute> => {
  return apiV2.post<SavedRoute>('/flight/route/from-trajectory', {
    trajectory_id: trajectoryId,
    ...data,
    visibility: data.is_public ? 'public' : 'private',
  });
};

export const listMyRoutes = async (): Promise<SavedRoute[]> => {
  return apiV2.get<SavedRoute[]>('/flight/routes/my');
};

export const listPublicRoutes = async (params?: {
  latitude?: number;
  longitude?: number;
  radius_km?: number;
}): Promise<SavedRoute[]> => {
  return apiV2.get<SavedRoute[]>('/flight/routes/public', params);
};

export const findNearbyRoutes = async (params: {
  latitude: number;
  longitude: number;
  radius_km?: number;
}): Promise<SavedRoute[]> => {
  return apiV2.get<SavedRoute[]>('/flight/routes/nearby', params);
};

export const deleteRoute = async (routeId: number): Promise<void> => {
  await apiV2.delete(`/flight/route/${routeId}`);
};

export const createMultiPointTask = async (data: CreateMultiPointTaskRequest): Promise<MultiPointTask> => {
  return apiV2.post<MultiPointTask>('/flight/multipoint-task', data);
};

export const getMultiPointTask = async (orderId: number): Promise<MultiPointTask> => {
  return apiV2.get<MultiPointTask>(`/flight/multipoint-task/order/${orderId}`);
};

export const startMultiPointTask = async (taskId: number): Promise<void> => {
  await apiV2.post(`/flight/multipoint-task/${taskId}/start`);
};

export const arriveAtStop = async (
  taskOrStopId: number,
  stopId?: number,
  _position?: { latitude: number; longitude: number },
): Promise<void> => {
  await apiV2.post(`/flight/multipoint-task/stop/${stopId ?? taskOrStopId}/arrive`);
};

export const completeStop = async (taskOrStopId: number, stopIdOrNotes?: number | string, notes?: string): Promise<void> => {
  const stopId = typeof stopIdOrNotes === 'number' ? stopIdOrNotes : taskOrStopId;
  const resolvedNotes = typeof stopIdOrNotes === 'string' ? stopIdOrNotes : notes;
  await apiV2.post(`/flight/multipoint-task/stop/${stopId}/complete`, { notes: resolvedNotes });
};

export const getFlightStats = async (): Promise<any> => {
  return apiV2.get('/flight/stats');
};

export const simulateFlight = async (orderId: number): Promise<{
  message: string;
  order_id: number;
  start_lat: number;
  start_lng: number;
  end_lat: number;
  end_lng: number;
}> => {
  return apiV2.post(`/flight/simulate/${orderId}`);
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
