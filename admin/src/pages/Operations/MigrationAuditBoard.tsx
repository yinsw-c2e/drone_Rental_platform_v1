import React, { useEffect, useState } from 'react';
import { Button, Card, Col, Descriptions, Input, Modal, Row, Select, Space, Statistic, Table, Tabs, Tag } from 'antd';
import { SearchOutlined, WarningOutlined, DatabaseOutlined, DeploymentUnitOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { adminApi } from '../../services/api';

interface CountBucket {
  key: string;
  count: number;
}

interface MigrationAuditSummary {
  total: number;
  open_count: number;
  resolved_count: number;
  critical_count: number;
  warning_count: number;
  info_count: number;
  by_issue_type: CountBucket[];
  by_stage: CountBucket[];
}

interface MigrationAuditRecord {
  id: number;
  audit_stage: string;
  legacy_table: string;
  legacy_id: string;
  related_table: string;
  related_id: string;
  issue_type: string;
  severity: string;
  issue_message: string;
  payload_json?: Record<string, unknown>;
  resolution_status: string;
  created_at: string;
  updated_at: string;
}

interface OrderAnomalySummary {
  total: number;
  critical_count: number;
  warning_count: number;
  by_anomaly_type: CountBucket[];
  by_order_status: CountBucket[];
}

interface OrderAnomaly {
  order_id: number;
  order_no: string;
  title: string;
  status: string;
  order_source: string;
  execution_mode: string;
  needs_dispatch: boolean;
  dispatch_task_id?: number | null;
  provider_user_id: number;
  client_user_id: number;
  provider_nickname?: string;
  client_nickname?: string;
  anomaly_type: string;
  severity: string;
  message: string;
  created_at: string;
  updated_at: string;
  completed_at?: string | null;
}

const SEVERITY_MAP: Record<string, { text: string; color: string }> = {
  critical: { text: '严重', color: 'red' },
  warning: { text: '警告', color: 'orange' },
  info: { text: '提示', color: 'blue' },
};

const RESOLUTION_MAP: Record<string, { text: string; color: string }> = {
  open: { text: '待处理', color: 'red' },
  resolved: { text: '已解决', color: 'green' },
  ignored: { text: '已忽略', color: 'default' },
};

const ORDER_STATUS_MAP: Record<string, string> = {
  pending_provider_confirmation: '待机主确认',
  provider_rejected: '机主已拒绝',
  pending_payment: '待支付',
  pending_dispatch: '待派单',
  assigned: '已分配执行',
  preparing: '准备中',
  in_progress: '执行中',
  delivered: '已送达',
  completed: '已完成',
  cancelled: '已取消',
};

const ORDER_SOURCE_MAP: Record<string, string> = {
  demand_market: '需求转单',
  supply_direct: '供给直达',
};

const EXECUTION_MODE_MAP: Record<string, string> = {
  self_execute: '自执行',
  bound_pilot: '绑定飞手',
  dispatch_pool: '正式派单',
};

const formatTime = (value?: string | null) => (value ? value.slice(0, 19).replace('T', ' ') : '-');

const MigrationAuditBoard: React.FC = () => {
  const [activeTab, setActiveTab] = useState('audits');
  const [loading, setLoading] = useState(false);
  const [auditSummary, setAuditSummary] = useState<MigrationAuditSummary | null>(null);
  const [anomalySummary, setAnomalySummary] = useState<OrderAnomalySummary | null>(null);

  const [auditItems, setAuditItems] = useState<MigrationAuditRecord[]>([]);
  const [auditTotal, setAuditTotal] = useState(0);
  const [auditPage, setAuditPage] = useState(1);
  const [auditSeverity, setAuditSeverity] = useState('');
  const [auditResolution, setAuditResolution] = useState('');
  const [auditKeyword, setAuditKeyword] = useState('');
  const [auditDetail, setAuditDetail] = useState<MigrationAuditRecord | null>(null);

  const [anomalyItems, setAnomalyItems] = useState<OrderAnomaly[]>([]);
  const [anomalyTotal, setAnomalyTotal] = useState(0);
  const [anomalyPage, setAnomalyPage] = useState(1);
  const [anomalySeverity, setAnomalySeverity] = useState('');
  const [anomalyType, setAnomalyType] = useState('');
  const [anomalyKeyword, setAnomalyKeyword] = useState('');
  const [anomalyDetail, setAnomalyDetail] = useState<OrderAnomaly | null>(null);

  const fetchAuditSummary = async () => {
    const res: any = await adminApi.getMigrationAuditSummary();
    setAuditSummary(res.data || null);
  };

  const fetchAnomalySummary = async () => {
    const res: any = await adminApi.getOrderAnomalySummary();
    setAnomalySummary(res.data || null);
  };

  const fetchAudits = async (page = auditPage) => {
    const res: any = await adminApi.getMigrationAudits({
      page,
      page_size: 20,
      severity: auditSeverity || undefined,
      resolution_status: auditResolution || undefined,
      keyword: auditKeyword || undefined,
    });
    setAuditItems(res.data?.list || []);
    setAuditTotal(res.data?.total || 0);
  };

  const fetchAnomalies = async (page = anomalyPage) => {
    const res: any = await adminApi.getOrderAnomalies({
      page,
      page_size: 20,
      severity: anomalySeverity || undefined,
      anomaly_type: anomalyType || undefined,
      keyword: anomalyKeyword || undefined,
    });
    setAnomalyItems(res.data?.list || []);
    setAnomalyTotal(res.data?.total || 0);
  };

  const refreshAll = async () => {
    setLoading(true);
    try {
      await Promise.all([
        fetchAuditSummary(),
        fetchAnomalySummary(),
        fetchAudits(activeTab === 'audits' ? auditPage : 1),
        fetchAnomalies(activeTab === 'anomalies' ? anomalyPage : 1),
      ]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetchAudits(auditPage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auditPage, auditSeverity, auditResolution]);

  useEffect(() => {
    fetchAnomalies(anomalyPage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anomalyPage, anomalySeverity, anomalyType]);

  const auditColumns: ColumnsType<MigrationAuditRecord> = [
    { title: '阶段', dataIndex: 'audit_stage', width: 110 },
    { title: '旧表/ID', width: 180, render: (_, record) => `${record.legacy_table} / ${record.legacy_id || '-'}` },
    { title: '新表/ID', width: 180, render: (_, record) => `${record.related_table || '-'} / ${record.related_id || '-'}` },
    { title: '问题类型', dataIndex: 'issue_type', width: 180 },
    {
      title: '严重度',
      dataIndex: 'severity',
      width: 100,
      render: value => <Tag color={SEVERITY_MAP[value]?.color || 'default'}>{SEVERITY_MAP[value]?.text || value}</Tag>,
    },
    {
      title: '处理状态',
      dataIndex: 'resolution_status',
      width: 100,
      render: value => <Tag color={RESOLUTION_MAP[value]?.color || 'default'}>{RESOLUTION_MAP[value]?.text || value}</Tag>,
    },
    { title: '问题描述', dataIndex: 'issue_message', ellipsis: true },
    { title: '更新时间', dataIndex: 'updated_at', width: 170, render: formatTime },
    { title: '操作', width: 90, fixed: 'right', render: (_, record) => <Button size="small" onClick={() => setAuditDetail(record)}>详情</Button> },
  ];

  const anomalyColumns: ColumnsType<OrderAnomaly> = [
    { title: '订单编号', dataIndex: 'order_no', width: 180 },
    { title: '标题', dataIndex: 'title', width: 220, ellipsis: true },
    { title: '异常类型', dataIndex: 'anomaly_type', width: 220 },
    {
      title: '严重度',
      dataIndex: 'severity',
      width: 100,
      render: value => <Tag color={SEVERITY_MAP[value]?.color || 'default'}>{SEVERITY_MAP[value]?.text || value}</Tag>,
    },
    { title: '订单状态', dataIndex: 'status', width: 120, render: value => ORDER_STATUS_MAP[value] || value },
    { title: '订单来源', dataIndex: 'order_source', width: 110, render: value => ORDER_SOURCE_MAP[value] || value },
    { title: '承接方', width: 120, render: (_, record) => record.provider_nickname || `用户 ${record.provider_user_id || '-'}` },
    { title: '客户', width: 120, render: (_, record) => record.client_nickname || `用户 ${record.client_user_id || '-'}` },
    { title: '最近更新时间', dataIndex: 'updated_at', width: 170, render: formatTime },
    { title: '操作', width: 90, fixed: 'right', render: (_, record) => <Button size="small" onClick={() => setAnomalyDetail(record)}>详情</Button> },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <h2 style={{ marginBottom: 8 }}>迁移审计与异常看板</h2>
          <div style={{ color: '#666' }}>集中跟踪迁移未落稳数据、来源缺失订单和状态异常订单，给阶段 9 的双读校验和切流兜底。</div>
        </div>
        <Button type="primary" onClick={refreshAll} loading={loading}>刷新看板</Button>
      </div>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card>
            <Statistic title="待处理迁移审计" value={auditSummary?.open_count || 0} prefix={<DatabaseOutlined />} valueStyle={{ color: '#cf1322' }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="严重迁移问题" value={auditSummary?.critical_count || 0} prefix={<WarningOutlined />} valueStyle={{ color: '#ff4d4f' }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="异常订单总数" value={anomalySummary?.total || 0} prefix={<DeploymentUnitOutlined />} valueStyle={{ color: '#fa8c16' }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="严重订单异常" value={anomalySummary?.critical_count || 0} prefix={<WarningOutlined />} valueStyle={{ color: '#ff4d4f' }} />
          </Card>
        </Col>
      </Row>

      <Tabs activeKey={activeTab} onChange={setActiveTab} items={[
        {
          key: 'audits',
          label: '迁移审计',
          children: (
            <>
              <Card size="small" style={{ marginBottom: 16 }}>
                <Row gutter={[16, 12]} align="middle">
                  <Col>
                    <Input
                      allowClear
                      prefix={<SearchOutlined />}
                      placeholder="搜索表名 / ID / 问题说明"
                      style={{ width: 260 }}
                      value={auditKeyword}
                      onChange={e => setAuditKeyword(e.target.value)}
                      onPressEnter={() => { setAuditPage(1); fetchAudits(1); }}
                    />
                  </Col>
                  <Col>
                    <Select allowClear placeholder="严重度" style={{ width: 140 }} value={auditSeverity || undefined} onChange={value => { setAuditSeverity(value || ''); setAuditPage(1); }}>
                      {Object.entries(SEVERITY_MAP).map(([key, item]) => <Select.Option key={key} value={key}>{item.text}</Select.Option>)}
                    </Select>
                  </Col>
                  <Col>
                    <Select allowClear placeholder="处理状态" style={{ width: 140 }} value={auditResolution || undefined} onChange={value => { setAuditResolution(value || ''); setAuditPage(1); }}>
                      {Object.entries(RESOLUTION_MAP).map(([key, item]) => <Select.Option key={key} value={key}>{item.text}</Select.Option>)}
                    </Select>
                  </Col>
                  <Col>
                    <Space>
                      <Button type="primary" onClick={() => { setAuditPage(1); fetchAudits(1); }}>搜索</Button>
                      <Button onClick={() => { setAuditKeyword(''); setAuditSeverity(''); setAuditResolution(''); setAuditPage(1); fetchAudits(1); }}>重置</Button>
                    </Space>
                  </Col>
                </Row>
              </Card>

              <Row gutter={16} style={{ marginBottom: 16 }}>
                <Col span={12}>
                  <Card title="开放问题 Top" size="small">
                    {(auditSummary?.by_issue_type || []).map(item => (
                      <div key={item.key} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                        <span>{item.key}</span>
                        <Tag color="orange">{item.count}</Tag>
                      </div>
                    ))}
                  </Card>
                </Col>
                <Col span={12}>
                  <Card title="按审计阶段分布" size="small">
                    {(auditSummary?.by_stage || []).map(item => (
                      <div key={item.key} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                        <span>{item.key}</span>
                        <Tag color="blue">{item.count}</Tag>
                      </div>
                    ))}
                  </Card>
                </Col>
              </Row>

              <Table
                rowKey="id"
                loading={loading}
                columns={auditColumns}
                dataSource={auditItems}
                scroll={{ x: 1400 }}
                pagination={{ current: auditPage, total: auditTotal, pageSize: 20, onChange: setAuditPage, showTotal: total => `共 ${total} 条` }}
              />
            </>
          ),
        },
        {
          key: 'anomalies',
          label: '异常订单',
          children: (
            <>
              <Card size="small" style={{ marginBottom: 16 }}>
                <Row gutter={[16, 12]} align="middle">
                  <Col>
                    <Input
                      allowClear
                      prefix={<SearchOutlined />}
                      placeholder="搜索订单号 / 标题 / 用户 / 异常说明"
                      style={{ width: 280 }}
                      value={anomalyKeyword}
                      onChange={e => setAnomalyKeyword(e.target.value)}
                      onPressEnter={() => { setAnomalyPage(1); fetchAnomalies(1); }}
                    />
                  </Col>
                  <Col>
                    <Select allowClear placeholder="严重度" style={{ width: 140 }} value={anomalySeverity || undefined} onChange={value => { setAnomalySeverity(value || ''); setAnomalyPage(1); }}>
                      {Object.entries(SEVERITY_MAP).map(([key, item]) => <Select.Option key={key} value={key}>{item.text}</Select.Option>)}
                    </Select>
                  </Col>
                  <Col>
                    <Select allowClear placeholder="异常类型" style={{ width: 260 }} value={anomalyType || undefined} onChange={value => { setAnomalyType(value || ''); setAnomalyPage(1); }}>
                      {(anomalySummary?.by_anomaly_type || []).map(item => <Select.Option key={item.key} value={item.key}>{item.key}</Select.Option>)}
                    </Select>
                  </Col>
                  <Col>
                    <Space>
                      <Button type="primary" onClick={() => { setAnomalyPage(1); fetchAnomalies(1); }}>搜索</Button>
                      <Button onClick={() => { setAnomalyKeyword(''); setAnomalySeverity(''); setAnomalyType(''); setAnomalyPage(1); fetchAnomalies(1); }}>重置</Button>
                    </Space>
                  </Col>
                </Row>
              </Card>

              <Row gutter={16} style={{ marginBottom: 16 }}>
                <Col span={12}>
                  <Card title="异常类型分布" size="small">
                    {(anomalySummary?.by_anomaly_type || []).map(item => (
                      <div key={item.key} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                        <span>{item.key}</span>
                        <Tag color="volcano">{item.count}</Tag>
                      </div>
                    ))}
                  </Card>
                </Col>
                <Col span={12}>
                  <Card title="异常订单状态分布" size="small">
                    {(anomalySummary?.by_order_status || []).map(item => (
                      <div key={item.key} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                        <span>{ORDER_STATUS_MAP[item.key] || item.key}</span>
                        <Tag color="purple">{item.count}</Tag>
                      </div>
                    ))}
                  </Card>
                </Col>
              </Row>

              <Table
                rowKey={record => `${record.order_id}-${record.anomaly_type}`}
                loading={loading}
                columns={anomalyColumns}
                dataSource={anomalyItems}
                scroll={{ x: 1500 }}
                pagination={{ current: anomalyPage, total: anomalyTotal, pageSize: 20, onChange: setAnomalyPage, showTotal: total => `共 ${total} 条` }}
              />
            </>
          ),
        },
      ]} />

      <Modal open={!!auditDetail} title="迁移审计详情" footer={null} width={760} onCancel={() => setAuditDetail(null)}>
        {auditDetail ? (
          <Descriptions column={2} bordered size="small">
            <Descriptions.Item label="审计阶段">{auditDetail.audit_stage}</Descriptions.Item>
            <Descriptions.Item label="处理状态">{RESOLUTION_MAP[auditDetail.resolution_status]?.text || auditDetail.resolution_status}</Descriptions.Item>
            <Descriptions.Item label="旧表">{auditDetail.legacy_table}</Descriptions.Item>
            <Descriptions.Item label="旧记录ID">{auditDetail.legacy_id || '-'}</Descriptions.Item>
            <Descriptions.Item label="新表">{auditDetail.related_table || '-'}</Descriptions.Item>
            <Descriptions.Item label="新记录ID">{auditDetail.related_id || '-'}</Descriptions.Item>
            <Descriptions.Item label="问题类型">{auditDetail.issue_type}</Descriptions.Item>
            <Descriptions.Item label="严重度">{SEVERITY_MAP[auditDetail.severity]?.text || auditDetail.severity}</Descriptions.Item>
            <Descriptions.Item label="问题描述" span={2}>{auditDetail.issue_message}</Descriptions.Item>
            <Descriptions.Item label="补充上下文" span={2}>
              <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                {JSON.stringify(auditDetail.payload_json || {}, null, 2)}
              </pre>
            </Descriptions.Item>
            <Descriptions.Item label="创建时间">{formatTime(auditDetail.created_at)}</Descriptions.Item>
            <Descriptions.Item label="更新时间">{formatTime(auditDetail.updated_at)}</Descriptions.Item>
          </Descriptions>
        ) : null}
      </Modal>

      <Modal open={!!anomalyDetail} title="异常订单详情" footer={null} width={760} onCancel={() => setAnomalyDetail(null)}>
        {anomalyDetail ? (
          <Descriptions column={2} bordered size="small">
            <Descriptions.Item label="订单编号">{anomalyDetail.order_no}</Descriptions.Item>
            <Descriptions.Item label="异常类型">{anomalyDetail.anomaly_type}</Descriptions.Item>
            <Descriptions.Item label="订单状态">{ORDER_STATUS_MAP[anomalyDetail.status] || anomalyDetail.status}</Descriptions.Item>
            <Descriptions.Item label="严重度">{SEVERITY_MAP[anomalyDetail.severity]?.text || anomalyDetail.severity}</Descriptions.Item>
            <Descriptions.Item label="订单来源">{ORDER_SOURCE_MAP[anomalyDetail.order_source] || anomalyDetail.order_source}</Descriptions.Item>
            <Descriptions.Item label="执行模式">{EXECUTION_MODE_MAP[anomalyDetail.execution_mode] || anomalyDetail.execution_mode}</Descriptions.Item>
            <Descriptions.Item label="待派单">{anomalyDetail.needs_dispatch ? '是' : '否'}</Descriptions.Item>
            <Descriptions.Item label="当前正式派单">{anomalyDetail.dispatch_task_id || '-'}</Descriptions.Item>
            <Descriptions.Item label="承接方">{anomalyDetail.provider_nickname || `用户 ${anomalyDetail.provider_user_id || '-'}`}</Descriptions.Item>
            <Descriptions.Item label="客户">{anomalyDetail.client_nickname || `用户 ${anomalyDetail.client_user_id || '-'}`}</Descriptions.Item>
            <Descriptions.Item label="异常说明" span={2}>{anomalyDetail.message}</Descriptions.Item>
            <Descriptions.Item label="创建时间">{formatTime(anomalyDetail.created_at)}</Descriptions.Item>
            <Descriptions.Item label="最近更新时间">{formatTime(anomalyDetail.updated_at)}</Descriptions.Item>
            <Descriptions.Item label="完成时间" span={2}>{formatTime(anomalyDetail.completed_at)}</Descriptions.Item>
          </Descriptions>
        ) : null}
      </Modal>
    </div>
  );
};

export default MigrationAuditBoard;
