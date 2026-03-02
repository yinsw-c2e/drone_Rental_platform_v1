import api from './api';

// ==================== 类型定义 ====================

export interface AirspaceApplication {
  id: number;
  pilot_id: number;
  drone_id: number;
  order_id: number;
  flight_plan_name: string;
  flight_purpose: string;
  departure_latitude: number;
  departure_longitude: number;
  departure_address: string;
  arrival_latitude: number;
  arrival_longitude: number;
  arrival_address: string;
  max_altitude: number;
  planned_start_time: string;
  planned_end_time: string;
  route_description: string;
  status: string;
  uom_application_no: string;
  uom_submitted_at: string;
  uom_response_at: string;
  uom_approval_code: string;
  compliance_check_id: number;
  compliance_passed: boolean;
  compliance_notes: string;
  reviewed_by: number;
  reviewed_at: string;
  review_notes: string;
  created_at: string;
  updated_at: string;
  pilot?: any;
  drone?: any;
}

export interface NoFlyZone {
  id: number;
  name: string;
  zone_type: string;
  geometry_type: string;
  center_latitude: number;
  center_longitude: number;
  radius: number;
  polygon_points: string;
  min_altitude: number;
  max_altitude: number;
  restriction_level: string;
  allowed_with_permit: boolean;
  is_permanent: boolean;
  effective_from: string;
  effective_to: string;
  authority: string;
  contact_info: string;
  description: string;
  status: string;
  created_at: string;
}

export interface ComplianceCheck {
  id: number;
  pilot_id: number;
  drone_id: number;
  order_id: number;
  airspace_application_id: number;
  trigger_type: string;
  overall_result: string;
  pilot_compliance: string;
  drone_compliance: string;
  cargo_compliance: string;
  airspace_compliance: string;
  total_items: number;
  passed_items: number;
  failed_items: number;
  warning_items: number;
  checked_by: string;
  notes: string;
  expires_at: string;
  created_at: string;
  items?: ComplianceCheckItem[];
  pilot?: any;
  drone?: any;
}

export interface ComplianceCheckItem {
  id: number;
  compliance_check_id: number;
  category: string;
  check_code: string;
  check_name: string;
  result: string;
  severity: string;
  expected_value: string;
  actual_value: string;
  message: string;
  is_required: boolean;
  is_blocking: boolean;
}

export interface AirspaceCheckResult {
  available: boolean;
  restrictions: {
    id: number;
    name: string;
    zone_type: string;
    restriction_level: string;
    allowed_with_permit: boolean;
  }[];
}

// ==================== 请求类型 ====================

export interface CreateApplicationRequest {
  pilot_id: number;
  drone_id: number;
  order_id?: number;
  flight_plan_name: string;
  flight_purpose: string;
  departure_latitude: number;
  departure_longitude: number;
  departure_address: string;
  arrival_latitude: number;
  arrival_longitude: number;
  arrival_address: string;
  max_altitude: number;
  planned_start_time: string;
  planned_end_time: string;
  route_description?: string;
}

export interface RunComplianceCheckRequest {
  pilot_id: number;
  drone_id: number;
  order_id?: number;
  airspace_application_id?: number;
  trigger_type?: string;
}

// ==================== 空域申请 API ====================

export const createApplication = async (data: CreateApplicationRequest): Promise<AirspaceApplication> => {
  const res: any = await api.post('/airspace/application', data);
  return res.data;
};

export const getApplication = async (id: number): Promise<AirspaceApplication> => {
  const res: any = await api.get(`/airspace/application/${id}`);
  return res.data;
};

export const getApplicationByOrder = async (orderId: number): Promise<AirspaceApplication> => {
  const res: any = await api.get(`/airspace/application/order/${orderId}`);
  return res.data;
};

export const listMyApplications = async (pilotId: number, page = 1, pageSize = 20): Promise<{data: AirspaceApplication[]; total: number}> => {
  const res: any = await api.get('/airspace/applications', {params: {pilot_id: pilotId, page, page_size: pageSize}});
  return {data: res.data, total: res.total};
};

export const submitForReview = async (id: number, pilotId: number): Promise<void> => {
  await api.post(`/airspace/application/${id}/submit`, {pilot_id: pilotId});
};

export const cancelApplication = async (id: number, pilotId: number): Promise<void> => {
  await api.post(`/airspace/application/${id}/cancel`, {pilot_id: pilotId});
};

export const submitToUOM = async (id: number): Promise<void> => {
  await api.post(`/airspace/application/${id}/uom`);
};

// ==================== 禁飞区 API ====================

export const listNoFlyZones = async (params?: {zone_type?: string; status?: string; page?: number; page_size?: number}): Promise<{data: NoFlyZone[]; total: number}> => {
  const res: any = await api.get('/airspace/no-fly-zones', {params});
  return {data: res.data, total: res.total};
};

export const getNoFlyZone = async (id: number): Promise<NoFlyZone> => {
  const res: any = await api.get(`/airspace/no-fly-zone/${id}`);
  return res.data;
};

export const findNearbyNoFlyZones = async (latitude: number, longitude: number, radius = 50000): Promise<NoFlyZone[]> => {
  const res: any = await api.get('/airspace/no-fly-zones/nearby', {params: {latitude, longitude, radius}});
  return res.data;
};

export const checkAirspaceAvailability = async (latitude: number, longitude: number, altitude = 120): Promise<AirspaceCheckResult> => {
  const res: any = await api.get('/airspace/check-availability', {params: {latitude, longitude, altitude}});
  return res.data;
};

// ==================== 合规检查 API ====================

export const runComplianceCheck = async (data: RunComplianceCheckRequest): Promise<ComplianceCheck> => {
  const res: any = await api.post('/airspace/compliance/check', data);
  return res.data;
};

export const getComplianceCheck = async (id: number): Promise<ComplianceCheck> => {
  const res: any = await api.get(`/airspace/compliance/check/${id}`);
  return res.data;
};

export const listComplianceChecks = async (params?: {pilot_id?: number; drone_id?: number; page?: number; page_size?: number}): Promise<{data: ComplianceCheck[]; total: number}> => {
  const res: any = await api.get('/airspace/compliance/checks', {params});
  return {data: res.data, total: res.total};
};

export const getLatestComplianceCheck = async (pilotId: number, droneId: number): Promise<ComplianceCheck> => {
  const res: any = await api.get('/airspace/compliance/latest', {params: {pilot_id: pilotId, drone_id: droneId}});
  return res.data;
};

export default {
  createApplication,
  getApplication,
  getApplicationByOrder,
  listMyApplications,
  submitForReview,
  cancelApplication,
  submitToUOM,
  listNoFlyZones,
  getNoFlyZone,
  findNearbyNoFlyZones,
  checkAirspaceAvailability,
  runComplianceCheck,
  getComplianceCheck,
  listComplianceChecks,
  getLatestComplianceCheck,
};
