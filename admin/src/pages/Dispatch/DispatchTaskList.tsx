import React, { useEffect, useMemo, useState } from 'react';
import { Button, Card, Col, Descriptions, Divider, Input, Modal, Row, Select, Space, Statistic, Table, Tag, Timeline, Typography, message, Tooltip } from 'antd';
import { SearchOutlined, ReloadOutlined, ExportOutlined, EyeOutlined, AimOutlined, HourglassOutlined, SyncOutlined, CheckCircleOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { adminApi } from '../../services/api';

const { Text, Title } = Typography;

interface DispatchTaskItem {
  id: number;
  dispatch_no: string;
  order_id: number;
  provider_user_id: number;
  target_pilot_user_id: number;
  dispatch_source: string;
  retry_count: number;
  status: string;
  reason?: string;
  sent_at?: string;
  responded_at?: string;
  created_at: string;
  order?: { id: number; order_no?: string; title?: string; status?: string; total_amount?: number };
  provider?: { id: number; nickname?: string; phone?: string };
  target_pilot?: { id: number; nickname?: string; phone?: string };
}

const STATUS_MAP: Record<string, { text: string; color: string }> = {
  pending_response: { text: '待飞手响应', color: 'orange' },
  accepted: { text: '飞手已接单', color: 'blue' },
  executing: { text: '执行中', color: 'processing' },
  finished: { text: '已完结', color: 'green' },
  rejected: { text: '飞手已拒绝', color: 'red' },
  cancelled: { text: '已取消', color: 'default' },
  timeout: { text: '响应超时', color: 'red' },
};

const SOURCE_MAP: Record<string, string> = {
  bound_pilot: '指定飞手',
  candidate_pool: '优先池匹配',
  general_pool: '公开池派单',
  self_execute: '机主自执行',
};

const formatTime = (value?: string) => value?.slice(0, 16).replace('T', ' ') || '-';
const formatMoney = (value?: number) => (typeof value === 'number' ? `¥${(value / 100).toFixed(2)}` : '-');

const DispatchTaskList: React.FC = () => {
  const [items, setItems] = useState<DispatchTaskItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');
  const [keyword, setKeyword] = useState('');
  const [detail, setDetail] = useState<DispatchTaskItem | null>(null);

  const fetchList = async (nextPage = page) => {
    setLoading(true);
    try {
      const res: any = await adminApi.getDispatchTasks({
        page: nextPage,
        page_size: 20,
        status: statusFilter || undefined,
        keyword: keyword || undefined,
      });
      setItems(res.data?.list || []);
      setTotal(res.data?.total || 0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchList(page);
  }, [page, statusFilter]);

  const summary = useMemo(() => items.reduce(
    (acc, item) => {
      acc.pendingCount += ['pending_response', 'timeout'].includes(item.status) ? 1 : 0;
      acc.executingCount += ['accepted', 'executing'].includes(item.status) ? 1 : 0;
      acc.retryCount += Number(item.retry_count || 0);
      acc.finishedCount += item.status === 'finished' ? 1 : 0;
      return acc;
    },
    {pendingCount: 0, executingCount: 0, finishedCount: 0, retryCount: 0},
  ), [items]);

  const handleExport = () => {
    message.success(`正在导出 ${items.length} 条派单任务记录...`);
  };

  const columns: ColumnsType<DispatchTaskItem> = [
    {
      title: '派单编号',
      dataIndex: 'dispatch_no',
      width: 190,
      render: (text) => <Text copyable code>{text}</Text>
    },
    {
      title: '关联订单',
      width: 190,
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          <Text strong>{record.order?.title || '-'}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>{record.order?.order_no || '-'}</Text>
        </Space>
      )
    },
    {
      title: '参与主体',
      width: 180,
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          <Text><Tag>机主</Tag>{record.provider?.nickname || '-'}</Text>
          <Text><Tag>飞手</Tag>{record.target_pilot?.nickname || '-'}</Text>
        </Space>
      )
    },
    {
      title: '指派来源',
      dataIndex: 'dispatch_source',
      width: 120,
      render: (v) => <Text type="secondary">{SOURCE_MAP[v] || v}</Text>
    },
    {
      title: '重派',
      dataIndex: 'retry_count',
      width: 80,
      align: 'center',
      render: (v) => (v > 0 ? <Text type="danger" strong>{v}</Text> : <Text type="secondary">0</Text>)
    },
    {
      title: '指派状态',
      dataIndex: 'status',
      width: 120,
      render: value => {
        const status = STATUS_MAP[value] || { text: value, color: 'default' };
        return <Tag color={status.color} style={{ borderRadius: 10 }}>{status.text}</Tag>;
      },
    },
    { title: '指派时间', dataIndex: 'sent_at', width: 160, render: formatTime },
    {
      title: '操作',
      width: 80,
      fixed: 'right',
      align: 'center',
      render: (_, record) => (
        <Tooltip title="查看详情">
          <Button type="text" icon={<EyeOutlined />} onClick={() => setDetail(record)} />
        </Tooltip>
      ),
    },
  ];

  return (
    <div style={{ padding: '0 4px' }}>
      <div style={{ marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Title level={3} style={{ margin: 0 }}>正式派单中心</Title>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={() => fetchList(page)}>刷新</Button>
          <Button type="primary" icon={<ExportOutlined />} onClick={handleExport}>导出列表</Button>
        </Space>
      </div>

      <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
        <Col xs={24} sm={12} md={6}>
          <Card bordered={false}>
            <Statistic
              title={<Space><AimOutlined /> 累计指派次数</Space>}
              value={total}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card bordered={false}>
            <Statistic
              title={<Space><HourglassOutlined /> 待飞手响应</Space>}
              value={summary.pendingCount}
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card bordered={false}>
            <Statistic
              title={<Space><SyncOutlined spin={summary.executingCount > 0} /> 正在执行中</Space>}
              value={summary.executingCount}
              valueStyle={{ color: '#13c2c2' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card bordered={false}>
            <Statistic
              title={<Space><CheckCircleOutlined /> 已完结任务</Space>}
              value={summary.finishedCount}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
      </Row>

      <Card size="small" bordered={false} style={{ marginBottom: 16, borderRadius: 8 }}>
        <Row gutter={[16, 12]} align="middle">
          <Col flex="auto">
            <Space wrap>
              <Input
                allowClear
                prefix={<SearchOutlined />}
                placeholder="搜索派单编号/订单编号"
                style={{ width: 280 }}
                value={keyword}
                onChange={e => setKeyword(e.target.value)}
                onPressEnter={() => { setPage(1); fetchList(1); }}
              />
              <Select
                allowClear
                placeholder="任务状态"
                style={{ width: 140 }}
                value={statusFilter || undefined}
                onChange={value => { setStatusFilter(value || ''); setPage(1); }}>
                {Object.entries(STATUS_MAP).map(([key, value]) => (
                  <Select.Option key={key} value={key}>{value.text}</Select.Option>
                ))}
              </Select>
              <Button type="primary" onClick={() => { setPage(1); fetchList(1); }}>筛选</Button>
              <Button onClick={() => { setKeyword(''); setStatusFilter(''); setPage(1); fetchList(1); }}>重置</Button>
            </Space>
          </Col>
        </Row>
      </Card>

      <Table
        rowKey="id"
        loading={loading}
        columns={columns}
        dataSource={items}
        size="middle"
        scroll={{ x: 1300 }}
        pagination={{
          current: page,
          total,
          pageSize: 20,
          onChange: setPage,
          showTotal: t => `共 ${t} 条派单`,
          showSizeChanger: false
        }}
        style={{ background: '#fff', borderRadius: 8, overflow: 'hidden' }}
      />

      <Modal open={!!detail} title={<Space><EyeOutlined /> 派单任务执行详情</Space>} footer={null} width={920} onCancel={() => setDetail(null)}>
        {detail ? (
          <div style={{ marginTop: -10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f5f5f5', padding: '12px 20px', borderRadius: 8, marginBottom: 20 }}>
              <Space size="large">
                <Statistic title="重派次数" value={detail.retry_count || 0} valueStyle={{ fontSize: 18, color: detail.retry_count > 0 ? '#cf1322' : 'inherit' }} />
                <Statistic title="预估报酬" value={(detail.order?.total_amount || 0) / 100} precision={2} prefix="¥" valueStyle={{ fontSize: 18 }} />
                <Statistic title="指派来源" value={SOURCE_MAP[detail.dispatch_source] || detail.dispatch_source} valueStyle={{ fontSize: 18 }} />
              </Space>
              <div style={{ textAlign: 'right' }}>
                <Text type="secondary">指派状态</Text>
                <div style={{ marginTop: 4 }}>
                  <Tag color={STATUS_MAP[detail.status]?.color || 'default'} style={{ fontSize: 14, padding: '2px 10px' }}>
                    {STATUS_MAP[detail.status]?.text || detail.status}
                  </Tag>
                </div>
              </div>
            </div>

            <Descriptions column={2} bordered size="small" labelStyle={{ background: '#fafafa', width: 120 }}>
              <Descriptions.Item label="派单编号"><Text copyable>{detail.dispatch_no}</Text></Descriptions.Item>
              <Descriptions.Item label="订单编号"><Text copyable>{detail.order?.order_no || '-'}</Text></Descriptions.Item>
              <Descriptions.Item label="关联项目" span={2}>{detail.order?.title || '-'}</Descriptions.Item>
              <Descriptions.Item label="机主 (指派人)">
                {detail.provider?.nickname || '-'}
                {detail.provider?.phone ? <Text type="secondary"> ({detail.provider.phone})</Text> : ''}
              </Descriptions.Item>
              <Descriptions.Item label="飞手 (承接人)">
                {detail.target_pilot?.nickname || '-'}
                {detail.target_pilot?.phone ? <Text type="secondary"> ({detail.target_pilot.phone})</Text> : ''}
              </Descriptions.Item>
              <Descriptions.Item label="指派原因/备注" span={2}>{detail.reason || <Text type="secondary">无备注</Text>}</Descriptions.Item>
            </Descriptions>

            <Divider plain><Text type="secondary" style={{ fontSize: 12 }}>流转时间轴</Text></Divider>
            <div style={{ padding: '0 10px' }}>
              <Timeline
                items={[
                  { color: 'blue', label: formatTime(detail.created_at), children: '指派任务初始化' },
                  detail.sent_at ? { color: 'orange', label: formatTime(detail.sent_at), children: '正式向飞手推送指派消息' } : null,
                  detail.responded_at ? {
                    color: detail.status === 'rejected' ? 'red' : 'green',
                    label: formatTime(detail.responded_at),
                    children: detail.status === 'rejected' ? '飞手拒绝了指派' : '飞手已确认接单'
                  } : null,
                ].filter(Boolean) as any}
              />
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
};

export default DispatchTaskList;
