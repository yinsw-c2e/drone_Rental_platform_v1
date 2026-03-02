import api from './api';

// ==================== 类型定义 ====================

export interface Pilot {
  id: number;
  user_id: number;
  license_type: string;
  license_no: string;
  license_issue_date: string;
  license_expire_date: string;
  license_issuer: string;
  license_image: string;
  total_flight_hours: number;
  total_flight_distance: number;
  max_single_flight_distance: number;
  service_radius_km: number;
  current_latitude: number;
  current_longitude: number;
  current_address: string;
  is_available: boolean;
  availability_status: string;
  credit_score: number;
  average_rating: number;
  total_orders: number;
  completed_orders: number;
  criminal_check_status: string;
  criminal_check_doc: string;
  health_check_status: string;
  health_check_doc: string;
  health_check_expire: string;
  verification_status: string;
  verification_note: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface PilotCertification {
  id: number;
  pilot_id: number;
  cert_type: string;
  cert_no: string;
  cert_name: string;
  issuer: string;
  issue_date: string;
  expire_date: string;
  cert_image: string;
  verification_status: string;
  created_at: string;
}

export interface PilotFlightLog {
  id: number;
  pilot_id: number;
  drone_id: number;
  order_id: number;
  flight_date: string;
  flight_duration: number;
  flight_distance: number;
  takeoff_location: string;
  landing_location: string;
  max_altitude: number;
  weather_condition: string;
  flight_purpose: string;
  notes: string;
  created_at: string;
}

export interface PilotDroneBinding {
  id: number;
  pilot_id: number;
  drone_id: number;
  owner_id: number;
  binding_type: string;
  status: string;
  effective_from: string;
  effective_to: string | null;
  created_at: string;
  drone?: any;
  owner?: any;
}

export interface FlightStats {
  total_flights: number;
  total_hours: number;
  total_distance: number;
  avg_duration: number;
  max_altitude: number;
}

// ==================== 请求类型 ====================

export interface RegisterPilotRequest {
  license_type: string;
  license_no: string;
  license_issue_date: string;
  license_expire_date: string;
  license_issuer: string;
  license_image: string;
  service_radius_km?: number;
}

export interface UpdatePilotRequest {
  license_type?: string;
  license_no?: string;
  license_issue_date?: string;
  license_expire_date?: string;
  license_issuer?: string;
  license_image?: string;
  service_radius_km?: number;
}

export interface UpdateLocationRequest {
  latitude: number;
  longitude: number;
  address?: string;
}

export interface SubmitCertificationRequest {
  cert_type: string;
  cert_no: string;
  cert_name: string;
  issuer: string;
  issue_date: string;
  expire_date: string;
  cert_image: string;
}

export interface AddFlightLogRequest {
  drone_id: number;
  order_id?: number;
  flight_date: string;
  flight_duration: number;
  flight_distance: number;
  takeoff_location: string;
  landing_location: string;
  max_altitude?: number;
  weather_condition?: string;
  flight_purpose?: string;
  notes?: string;
}

export interface BindDroneRequest {
  drone_id: number;
  binding_type: string;
  effective_from: string;
  effective_to?: string;
}

// ==================== API 服务 ====================

// 注册成为飞手
export const registerPilot = async (data: RegisterPilotRequest): Promise<Pilot> => {
  const res: any = await api.post('/pilot/register', data);
  return res.data;
};

// 获取飞手档案
export const getPilotProfile = async (): Promise<Pilot> => {
  const res: any = await api.get('/pilot/profile');
  return res.data;
};

// 更新飞手档案
export const updatePilotProfile = async (data: UpdatePilotRequest): Promise<Pilot> => {
  const res: any = await api.put('/pilot/profile', data);
  return res.data;
};

// 更新实时位置
export const updatePilotLocation = async (data: UpdateLocationRequest): Promise<void> => {
  await api.put('/pilot/location', data);
};

// 更新接单状态
export const updatePilotAvailability = async (isAvailable: boolean): Promise<void> => {
  await api.put('/pilot/availability', {is_available: isAvailable});
};

// 获取飞手列表
export const getPilotList = async (params?: {
  page?: number;
  page_size?: number;
  status?: string;
}): Promise<{data: Pilot[]; total: number}> => {
  const res: any = await api.get('/pilot/list', {params});
  return res;
};

// 查找附近飞手
export const getNearbyPilots = async (params: {
  latitude: number;
  longitude: number;
  radius_km?: number;
}): Promise<Pilot[]> => {
  const res: any = await api.get('/pilot/nearby', {params});
  return res.data;
};

// 获取指定飞手信息
export const getPilotById = async (id: number): Promise<Pilot> => {
  const res: any = await api.get(`/pilot/${id}`);
  return res.data;
};

// ==================== 资质证书 ====================

// 提交资质证书
export const submitCertification = async (data: SubmitCertificationRequest): Promise<PilotCertification> => {
  const res: any = await api.post('/pilot/certification', data);
  return res.data;
};

// 获取证书列表
export const getCertifications = async (): Promise<PilotCertification[]> => {
  const res: any = await api.get('/pilot/certifications');
  return res.data;
};

// 提交无犯罪记录证明
export const submitCriminalCheck = async (docUrl: string): Promise<void> => {
  await api.post('/pilot/criminal-check', {doc_url: docUrl});
};

// 提交健康证明
export const submitHealthCheck = async (data: {
  doc_url: string;
  expire_date: string;
}): Promise<void> => {
  await api.post('/pilot/health-check', data);
};

// ==================== 飞行记录 ====================

// 获取飞行记录
export const getFlightLogs = async (params?: {
  page?: number;
  page_size?: number;
}): Promise<{data: PilotFlightLog[]; total: number}> => {
  const res: any = await api.get('/pilot/flight-logs', {params});
  return res;
};

// 添加飞行记录
export const addFlightLog = async (data: AddFlightLogRequest): Promise<PilotFlightLog> => {
  const res: any = await api.post('/pilot/flight-log', data);
  return res.data;
};

// 获取飞行统计
export const getFlightStats = async (): Promise<FlightStats> => {
  const res: any = await api.get('/pilot/flight-stats');
  return res.data;
};

// ==================== 无人机绑定 ====================

// 获取绑定的无人机
export const getBoundDrones = async (): Promise<PilotDroneBinding[]> => {
  const res: any = await api.get('/pilot/bound-drones');
  return res.data;
};

// 绑定无人机
export const bindDrone = async (data: BindDroneRequest): Promise<PilotDroneBinding> => {
  const res: any = await api.post('/pilot/bind-drone', data);
  return res.data;
};

// 解绑无人机
export const unbindDrone = async (bindingId: number): Promise<void> => {
  await api.delete(`/pilot/unbind/${bindingId}`);
};

export default {
  registerPilot,
  getPilotProfile,
  updatePilotProfile,
  updatePilotLocation,
  updatePilotAvailability,
  getPilotList,
  getNearbyPilots,
  getPilotById,
  submitCertification,
  getCertifications,
  submitCriminalCheck,
  submitHealthCheck,
  getFlightLogs,
  addFlightLog,
  getFlightStats,
  getBoundDrones,
  bindDrone,
  unbindDrone,
};
