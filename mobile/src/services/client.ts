import api, {apiV2} from './api';

// ==================== 类型定义 ====================

export interface Client {
  id: number;
  user_id: number;
  client_type: string;
  company_name: string;
  business_license_no: string;
  business_license_doc: string;
  legal_representative: string;
  contact_person: string;
  contact_phone: string;
  contact_email: string;
  credit_provider: string;
  credit_score: number;
  credit_check_status: string;
  platform_credit_score: number;
  enterprise_verified: string;
  industry_category: string;
  registration_capital: number;
  operating_years: number;
  preferred_cargo_types: string[];
  default_pickup_address: string;
  default_delivery_address: string;
  total_orders: number;
  completed_orders: number;
  cancelled_orders: number;
  total_spending: number;
  average_rating: number;
  verification_status: string;
  client_verification_status?: string;
  identity_verification_status?: string;
  verification_note: string;
  status: string;
  eligibility?: ClientEligibility;
  created_at: string;
  updated_at: string;
}

export interface ClientEligibilityBlocker {
  code: string;
  message: string;
  suggested_action?: 'verify_identity' | 'repair_credit' | 'contact_support' | string;
}

export interface ClientEligibility {
  eligible: boolean;
  can_publish_demand: boolean;
  can_create_direct_order: boolean;
  account_active: boolean;
  identity_verified: boolean;
  credit_qualified: boolean;
  enterprise_upgrade_optional: boolean;
  summary: string;
  blockers?: ClientEligibilityBlocker[];
}

export interface CargoDeclaration {
  id: number;
  client_id: number;
  order_id: number;
  declaration_no: string;
  cargo_category: string;
  cargo_name: string;
  cargo_description: string;
  quantity: number;
  total_weight: number;
  length: number;
  width: number;
  height: number;
  declared_value: number;
  is_hazardous: boolean;
  hazard_class: string;
  is_temperature_control: boolean;
  temperature_min: number;
  temperature_max: number;
  requires_insurance: boolean;
  insurance_amount: number;
  compliance_status: string;
  compliance_note: string;
  cargo_images: string[];
  packing_images: string[];
  created_at: string;
}

export interface CreditCheckRecord {
  id: number;
  client_id: number;
  check_provider: string;
  credit_score: number;
  credit_level: string;
  risk_level: string;
  overdue: boolean;
  status: string;
  created_at: string;
}

// ==================== 请求类型 ====================

export interface RegisterEnterpriseRequest {
  company_name: string;
  business_license_no: string;
  business_license_doc: string;
  legal_representative?: string;
  contact_person?: string;
  contact_phone?: string;
  contact_email?: string;
}

export interface UpdateProfileRequest {
  contact_person?: string;
  contact_phone?: string;
  contact_email?: string;
  default_pickup_address?: string;
  default_delivery_address?: string;
  preferred_cargo_types?: string[];
}

export interface CreateCargoDeclarationRequest {
  cargo_category: string;
  cargo_name: string;
  cargo_description?: string;
  quantity: number;
  total_weight: number;
  length?: number;
  width?: number;
  height?: number;
  declared_value: number;
  is_hazardous?: boolean;
  hazard_class?: string;
  is_temperature_control?: boolean;
  temperature_min?: number;
  temperature_max?: number;
  requires_insurance?: boolean;
  insurance_amount?: number;
  cargo_images?: string[];
}

// ==================== API 服务 ====================

// 注册个人客户
export const registerIndividual = async (): Promise<Client> => {
  const res: any = await api.post('/client/register/individual');
  return res.data;
};

// 注册企业客户
export const registerEnterprise = async (data: RegisterEnterpriseRequest): Promise<Client> => {
  const res: any = await api.post('/client/register/enterprise', data);
  return res.data;
};

// 获取客户档案
export const getClientProfile = async (): Promise<Client> => {
  const res: any = await apiV2.get('/client/profile');
  return res.data;
};

// 更新客户档案
export const updateClientProfile = async (data: UpdateProfileRequest): Promise<Client> => {
  const res: any = await apiV2.patch('/client/profile', data);
  return res.data;
};

// 获取当前客户资格
export const getClientEligibility = async (): Promise<ClientEligibility> => {
  const res: any = await apiV2.get('/client/eligibility');
  return res.data;
};

// 发起征信查询
export const requestCreditCheck = async (): Promise<void> => {
  await api.post('/client/credit/check');
};

// 获取征信历史
export const getCreditHistory = async (): Promise<CreditCheckRecord[]> => {
  const res: any = await api.get('/client/credit/history');
  return res.data;
};

// 检查下单资格
export const checkOrderEligibility = async (): Promise<{eligible: boolean; reasons?: string[]}> => {
  const res: any = await api.get('/client/order/eligibility');
  return res.data;
};

// 创建货物申报
export const createCargoDeclaration = async (data: CreateCargoDeclarationRequest): Promise<CargoDeclaration> => {
  const res: any = await api.post('/client/cargo/declaration', data);
  return res.data;
};

// 获取货物申报列表
export const listCargoDeclarations = async (params?: {
  page?: number;
  page_size?: number;
}): Promise<{list: CargoDeclaration[]; total: number}> => {
  const res: any = await api.get('/client/cargo/declarations', {params});
  return {list: res.data?.list || [], total: res.data?.total || 0};
};

// 获取货物申报详情
export const getCargoDeclaration = async (id: number): Promise<CargoDeclaration> => {
  const res: any = await api.get(`/client/cargo/declaration/${id}`);
  return res.data;
};

// 更新货物申报
export const updateCargoDeclaration = async (id: number, data: Partial<CreateCargoDeclarationRequest>): Promise<CargoDeclaration> => {
  const res: any = await api.put(`/client/cargo/declaration/${id}`, data);
  return res.data;
};

export default {
  registerIndividual,
  registerEnterprise,
  getClientProfile,
  updateClientProfile,
  getClientEligibility,
  requestCreditCheck,
  getCreditHistory,
  checkOrderEligibility,
  createCargoDeclaration,
  listCargoDeclarations,
  getCargoDeclaration,
  updateCargoDeclaration,
};
