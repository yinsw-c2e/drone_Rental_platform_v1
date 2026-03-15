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
  offered_price?: number;
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
  owner_id: number;
  total_score: number;      // 综合得分(0-100)
  distance_score: number;
  load_score: number;
  qualification_score: number;
  credit_score: number;
  price_score: number;
  time_score: number;
  rating_score: number;
  distance: number;         // 距离(km)
  estimated_time: number;  // 预计完成时间(分钟)
  quoted_price: number;    // 报价(分)
  status: string;
  notified_at?: string;
  responded_at?: string;
  response_note?: string;
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
  priority?: number;
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
}): Promise<{list: DispatchTask[]; total: number}> => {
  const res: any = await api.get('/dispatch/tasks/client', {params});
  return {list: res.data?.list || [], total: res.data?.total || 0};
};

// 取消任务
export const cancelDispatchTask = async (id: number): Promise<void> => {
  await api.post(`/dispatch/task/${id}/cancel`);
};

// 获取候选人
export const getTaskCandidates = async (taskId: number): Promise<DispatchCandidate[]> => {
  const res: any = await api.get(`/dispatch/task/${taskId}/candidates`);
  const list: DispatchCandidate[] = res.data || [];
  // 按 pilot_id 去重，保留总分最高的一条
  const map = new Map<number, DispatchCandidate>();
  for (const c of list) {
    const existing = map.get(c.pilot_id);
    if (!existing || (c.total_score ?? 0) > (existing.total_score ?? 0)) {
      map.set(c.pilot_id, c);
    }
  }
  return Array.from(map.values()).sort((a, b) => (b.total_score ?? 0) - (a.total_score ?? 0));
};

// 获取任务日志
export const getTaskLogs = async (taskId: number): Promise<DispatchLog[]> => {
  const res: any = await api.get(`/dispatch/task/${taskId}/logs`);
  return res.data || [];
};

// 手动触发匹配
export const triggerMatch = async (taskId: number): Promise<DispatchCandidate[]> => {
  const res: any = await api.post(`/dispatch/task/${taskId}/match`);
  return res.data?.candidates || [];
};

// ==================== 飞手端接口 ====================

// 获取飞手任务列表
export const listPilotTasks = async (params?: {
  page?: number;
  page_size?: number;
}): Promise<{data: any[]; total: number}> => {
  const res: any = await api.get('/dispatch/tasks/pilot', {params});
  // 拦截器返回整个 {code,message,data} 对象，SuccessWithPage 的 data = {list:[], total:n}
  const list = res?.data?.list || res?.list || [];
  return {data: Array.isArray(list) ? list : [], total: res?.data?.total || res?.total || 0};
};

// 获取待处理任务
export const getPendingTask = async (): Promise<DispatchCandidate | null> => {
  const res: any = await api.get('/dispatch/task/pending');
  return res.data;
};

// 接受任务
// 返回 {message, order_id}
export const acceptTask = async (candidateId: number): Promise<{order_id?: number}> => {
  const res: any = await api.post(`/dispatch/candidate/${candidateId}/accept`);
  return res?.data || {};
};

// 拒绝任务
export const rejectTask = async (candidateId: number, reason?: string): Promise<void> => {
  await api.post(`/dispatch/candidate/${candidateId}/reject`, {reason});
};

// 根据派单任务ID获取关联订单
export const getOrderByTaskId = async (taskId: number): Promise<any | null> => {
  const res: any = await api.get(`/dispatch/task/${taskId}/order`);
  return res?.data || null;
};

// 获取飞手当前执行中的订单
export const getMyActiveOrder = async (): Promise<any | null> => {
  const res: any = await api.get('/dispatch/order/active');
  return res?.data || null;
};

// 更新飞手执行订单状态
export const updateExecutionStatus = async (orderId: number, status: string): Promise<void> => {
  await api.post(`/dispatch/order/${orderId}/status`, {status});
};

export default {
  createDispatchTask,
  getDispatchTask,
  listClientTasks,
  cancelDispatchTask,
  getTaskCandidates,
  getTaskLogs,
  triggerMatch,
  listPilotTasks,
  getPendingTask,
  acceptTask,
  rejectTask,
  getOrderByTaskId,
  getMyActiveOrder,
  updateExecutionStatus,
};
