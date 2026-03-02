import api from './api';

// ==================== 类型定义 ====================

export interface DispatchTask {
  id: number;
  task_no: string;
  client_id: number;
  order_id: number;
  task_type: string;
  priority: string;
  pickup_address: string;
  pickup_latitude: number;
  pickup_longitude: number;
  delivery_address: string;
  delivery_latitude: number;
  delivery_longitude: number;
  cargo_weight: number;
  cargo_description: string;
  required_drone_type: string;
  scheduled_time: string;
  deadline: string;
  max_budget: number;
  status: string;
  assigned_pilot_id: number;
  assigned_drone_id: number;
  match_attempts: number;
  failure_reason: string;
  created_at: string;
  updated_at: string;
}

export interface DispatchCandidate {
  id: number;
  task_id: number;
  pilot_id: number;
  drone_id: number;
  match_score: number;
  distance_km: number;
  estimated_price: number;
  status: string;
  response_deadline: string;
  responded_at: string;
  reject_reason: string;
  created_at: string;
  pilot?: any;
  drone?: any;
}

export interface DispatchLog {
  id: number;
  task_id: number;
  action: string;
  actor_type: string;
  actor_id: number;
  details: string;
  created_at: string;
}

// ==================== 请求类型 ====================

export interface CreateDispatchTaskRequest {
  order_id?: number;
  task_type: string;
  priority?: string;
  pickup_address: string;
  pickup_latitude: number;
  pickup_longitude: number;
  delivery_address: string;
  delivery_latitude: number;
  delivery_longitude: number;
  cargo_weight?: number;
  cargo_description?: string;
  required_drone_type?: string;
  scheduled_time?: string;
  deadline?: string;
  max_budget?: number;
}

// ==================== API 服务 ====================

// 创建派单任务
export const createDispatchTask = async (data: CreateDispatchTaskRequest): Promise<DispatchTask> => {
  const res: any = await api.post('/dispatch/task', data);
  return res.data;
};

// 获取任务详情
export const getDispatchTask = async (id: number): Promise<DispatchTask> => {
  const res: any = await api.get(`/dispatch/task/${id}`);
  return res.data;
};

// 获取业主任务列表
export const listClientTasks = async (params?: {
  page?: number;
  page_size?: number;
  status?: string;
}): Promise<{data: DispatchTask[]; total: number}> => {
  const res: any = await api.get('/dispatch/tasks/client', {params});
  return res;
};

// 取消任务
export const cancelDispatchTask = async (id: number): Promise<void> => {
  await api.post(`/dispatch/task/${id}/cancel`);
};

// 获取候选人
export const getTaskCandidates = async (taskId: number): Promise<DispatchCandidate[]> => {
  const res: any = await api.get(`/dispatch/task/${taskId}/candidates`);
  return res.data;
};

// 获取任务日志
export const getTaskLogs = async (taskId: number): Promise<DispatchLog[]> => {
  const res: any = await api.get(`/dispatch/task/${taskId}/logs`);
  return res.data;
};

// ==================== 飞手端接口 ====================

// 获取飞手任务列表
export const listPilotTasks = async (params?: {
  page?: number;
  page_size?: number;
  status?: string;
}): Promise<{data: DispatchCandidate[]; total: number}> => {
  const res: any = await api.get('/dispatch/tasks/pilot', {params});
  return res;
};

// 获取待处理任务
export const getPendingTask = async (): Promise<DispatchCandidate | null> => {
  const res: any = await api.get('/dispatch/task/pending');
  return res.data;
};

// 接受任务
export const acceptTask = async (candidateId: number): Promise<void> => {
  await api.post(`/dispatch/candidate/${candidateId}/accept`);
};

// 拒绝任务
export const rejectTask = async (candidateId: number, reason?: string): Promise<void> => {
  await api.post(`/dispatch/candidate/${candidateId}/reject`, {reason});
};

export default {
  createDispatchTask,
  getDispatchTask,
  listClientTasks,
  cancelDispatchTask,
  getTaskCandidates,
  getTaskLogs,
  listPilotTasks,
  getPendingTask,
  acceptTask,
  rejectTask,
};
