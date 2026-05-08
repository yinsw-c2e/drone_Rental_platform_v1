import { apiV1 } from './api';

export interface AirspaceApplication {
  id: number;
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
  status: string;
  uom_application_no?: string;
  compliance_check_id?: number;
  compliance_passed?: boolean;
  compliance_notes?: string;
  created_at?: string;
  updated_at?: string;
}

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

export interface NoFlyZone {
  id: number;
  name: string;
  zone_type: string;
  center_latitude: number;
  center_longitude: number;
  radius: number;
  min_altitude?: number;
  max_altitude?: number;
  restriction_level: string;
  allowed_with_permit: boolean;
  authority?: string;
  contact_info?: string;
  description?: string;
  status: string;
}

export interface AirspaceCheckResult {
  available: boolean;
  status?: 'clear' | 'warning' | 'blocked' | string;
  allows_continue?: boolean;
  recommended_action?: string;
  blocked_reason?: string;
  restrictions: Array<{
    id: number;
    name: string;
    zone_type: string;
    restriction_level: string;
    allowed_with_permit: boolean;
  }>;
}

export interface ComplianceCheckItem {
  id: number;
  category: string;
  check_code: string;
  check_name: string;
  result: string;
  severity: string;
  expected_value?: string;
  actual_value?: string;
  message?: string;
  is_required?: boolean;
  is_blocking?: boolean;
}

export interface ComplianceCheck {
  id: number;
  pilot_id: number;
  drone_id: number;
  order_id?: number;
  airspace_application_id?: number;
  trigger_type: string;
  overall_result: string;
  pilot_compliance?: string;
  drone_compliance?: string;
  cargo_compliance?: string;
  airspace_compliance?: string;
  total_items: number;
  passed_items: number;
  failed_items: number;
  warning_items: number;
  notes?: string;
  expires_at?: string;
  created_at?: string;
  items?: ComplianceCheckItem[];
}

export interface RunComplianceCheckRequest {
  pilot_id: number;
  drone_id: number;
  order_id?: number;
  airspace_application_id?: number;
  trigger_type?: string;
}

const normalizeList = <T>(res: any): { data: T[]; total: number } => {
  if (Array.isArray(res)) {
    return { data: res, total: res.length };
  }
  if (Array.isArray(res?.data)) {
    return { data: res.data, total: Number(res.total || res.data.length || 0) };
  }
  if (Array.isArray(res?.list)) {
    return { data: res.list, total: Number(res.total || res.list.length || 0) };
  }
  if (Array.isArray(res?.items)) {
    return { data: res.items, total: Number(res.meta?.total || res.items.length || 0) };
  }
  return { data: [], total: 0 };
};

export const airspaceService = {
  createApplication: (data: CreateApplicationRequest) =>
    apiV1.post<AirspaceApplication>('/airspace/application', data),

  getApplication: (id: number) =>
    apiV1.get<AirspaceApplication>(`/airspace/application/${id}`),

  listMyApplications: async (pilotId: number, page = 1, pageSize = 20) => {
    const res = await apiV1.get('/airspace/applications', {
      pilot_id: pilotId,
      page,
      page_size: pageSize,
    });
    return normalizeList<AirspaceApplication>(res);
  },

  submitForReview: (id: number, pilotId: number) =>
    apiV1.post(`/airspace/application/${id}/submit`, { pilot_id: pilotId }),

  cancelApplication: (id: number, pilotId: number) =>
    apiV1.post(`/airspace/application/${id}/cancel`, { pilot_id: pilotId }),

  listNoFlyZones: async (params?: {
    zone_type?: string;
    status?: string;
    page?: number;
    page_size?: number;
  }) => {
    const res = await apiV1.get('/airspace/no-fly-zones', params);
    return normalizeList<NoFlyZone>(res);
  },

  findNearbyNoFlyZones: async (latitude: number, longitude: number, radius = 50000) => {
    const res = await apiV1.get('/airspace/no-fly-zones/nearby', {
      latitude,
      longitude,
      radius,
    });
    return Array.isArray(res) ? (res as NoFlyZone[]) : ((res as any)?.data || []);
  },

  checkAirspaceAvailability: (latitude: number, longitude: number, altitude = 120) =>
    apiV1.get<AirspaceCheckResult>('/airspace/check-availability', {
      latitude,
      longitude,
      altitude,
    }),

  runComplianceCheck: (data: RunComplianceCheckRequest) =>
    apiV1.post<ComplianceCheck>('/airspace/compliance/check', data),

  getComplianceCheck: (id: number) =>
    apiV1.get<ComplianceCheck>(`/airspace/compliance/check/${id}`),

  getLatestComplianceCheck: (pilotId: number, droneId: number) =>
    apiV1.get<ComplianceCheck>('/airspace/compliance/latest', {
      pilot_id: pilotId,
      drone_id: droneId,
    }),
};

export const {
  createApplication,
  getApplication,
  listMyApplications,
  submitForReview,
  cancelApplication,
  listNoFlyZones,
  findNearbyNoFlyZones,
  checkAirspaceAvailability,
  runComplianceCheck,
  getComplianceCheck,
  getLatestComplianceCheck,
} = airspaceService;

export default airspaceService;
