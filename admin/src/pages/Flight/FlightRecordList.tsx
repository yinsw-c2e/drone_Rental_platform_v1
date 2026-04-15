import React, { useEffect, useMemo, useState } from 'react';
import { Button, Card, Col, Descriptions, Divider, Input, Modal, Row, Select, Space, Statistic, Table, Tag, Timeline, Typography, message, Tooltip } from 'antd';
import { SearchOutlined, ReloadOutlined, ExportOutlined, EyeOutlined, DashboardOutlined, HistoryOutlined, ColumnHeightOutlined, CompassOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { adminApi } from '../../services/api';

const { Text, Title } = Typography;

interface FlightRecordItem {
  id: number;
  flight_no: string;
  order_id: number;
  dispatch_task_id?: number | null;
  pilot_user_id: number;
  drone_id: number;
  takeoff_at?: string;
  landing_at?: string;
  total_duration_seconds: number;
  total_distance_m: number;
  max_altitude_m: number;
  status: string;
  created_at: string;
  order?: { id: number; order_no?: string; title?: string };
  dispatch_task?: { id: number; dispatch_no?: string };
  pilot?: { id: number; nickname?: string };
  drone?: { id: number; brand?: string; model?: string; serial_number?: string };
}

const STATUS_MAP: Record<string, { text: string; color: string }> = {
  pending: { text: '待起飞', color: 'default' },
  executing: { text: '飞行中', color: 'processing' },
  completed: { text: '已降落', color: 'green' },
  cancelled: { text: '异常终止', color: 'red' },
};

const formatSeconds = (seconds?: number) => {
  const total = Number(seconds || 0);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
};
const formatTime = (value?: string) => value?.slice(0, 16).replace('T', ' ') || '-';

const FlightRecordList: React.FC = () => {
  const [items, setItems] = useState<FlightRecordItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');
  const [keyword, setKeyword] = useState('');
  const [detail, setDetail] = useState<FlightRecordItem | null>(null);

  const fetchList = async (nextPage = page) => {
    setLoading(true);
    try {
      const res: any = await adminApi.getFlightRecords({
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
      acc.executingCount += item.status === 'executing' ? 1 : 0;
      acc.totalDistance += Number(item.total_distance_m || 0);
      acc.totalDuration += Number(item.total_duration_seconds || 0);
      return acc;
    },
    {executingCount: 0, totalDistance: 0, totalDuration: 0},
  ), [items]);

  const handleExport = () => {
    message.success('正在导出当前飞行履约数据记录...');
  };

  const columns: ColumnsType<FlightRecordItem> = [
    {
      title: '飞行识别码',
      dataIndex: 'flight_no',
      width: 180,
      render: (text) => <Text copyable code>{text}</Text>
    },
    {
      title: '关联订单/派单',
      width: 200,
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          <Text strong ellipsis style={{ maxWidth: 180 }}>{record.order?.title || '-'}</Text>
          <Text type="secondary" style={{ fontSize: 11 }}>单号: {record.order?.order_no || '-'}</Text>
        </Space>
      )
    },
    {
      title: '执行资产',
      width: 180,
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          <Text><Tag>人</Tag>{record.pilot?.nickname || '-'}</Text>
          <Text><Tag>机</Tag>{record.drone ? `${record.drone.brand} ${record.drone.model}` : '-'}</Text>
        </Space>
      )
    },
    {
      title: '航行距离',
      dataIndex: 'total_distance_m',
      width: 100,
      align: 'right',
      render: value => <Text strong>{Number(value || 0).toFixed(0)}m</Text>
    },
    {
      title: '航行时长',
      dataIndex: 'total_duration_seconds',
      width: 100,
      align: 'right',
      render: value => <Text>{formatSeconds(value)}</Text>
    },
    {
      title: '峰值高度',
      dataIndex: 'max_altitude_m',
      width: 90,
      align: 'right',
      render: value => <Text type="secondary">{Number(value || 0).toFixed(0)}m</Text>
    },
    {
      title: '飞行状态',
      dataIndex: 'status',
      width: 100,
      render: value => {
        const status = STATUS_MAP[value] || { text: value, color: 'default' };
        return <Tag color={status.color} style={{ borderRadius: 10 }}>{status.text}</Tag>;
      },
    },
    { title: '记录时间', dataIndex: 'created_at', width: 160, render: formatTime },
    {
      title: '操作',
      width: 80,
      fixed: 'right',
      align: 'center',
      render: (_, record) => (
        <Tooltip title="查看飞行详情">
          <Button type="text" icon={<EyeOutlined />} onClick={() => setDetail(record)} />
        </Tooltip>
      ),
    },
  ];

  return (
    <div style={{ padding: '0 4px' }}>
      <div style={{ marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Title level={3} style={{ margin: 0 }}>飞行履约监管</Title>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={() => fetchList(page)}>刷新</Button>
          <Button type="primary" icon={<ExportOutlined />} onClick={handleExport}>导出数据</Button>
        </Space>
      </div>

      <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
        <Col xs={24} sm={12} md={6}>
          <Card bordered={false}>
            <Statistic
              title={<Space><DashboardOutlined /> 累计架次</Space>}
              value={total}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card bordered={false}>
            <Statistic
              title={<Space><HistoryOutlined /> 累计飞行时长</Space>}
              value={summary.totalDuration / 3600}
              precision={1}
              suffix="h"
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card bordered={false}>
            <Statistic
              title={<Space><CompassOutlined /> 累计飞行距离</Space>}
              value={summary.totalDistance / 1000}
              precision={2}
              suffix="km"
              valueStyle={{ color: '#13c2c2' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card bordered={false}>
            <Statistic
              title={<Space><ColumnHeightOutlined /> 执行中飞行</Space>}
              value={summary.executingCount}
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
                placeholder="搜索飞行编号/订单编号"
                style={{ width: 280 }}
                value={keyword}
                onChange={e => setKeyword(e.target.value)}
                onPressEnter={() => { setPage(1); fetchList(1); }}
              />
              <Select
                allowClear
                placeholder="飞行状态"
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
          showTotal: t => `共 ${t} 条记录`,
          showSizeChanger: false
        }}
        style={{ background: '#fff', borderRadius: 8, overflow: 'hidden' }}
      />

      <Modal open={!!detail} title={<Space><EyeOutlined /> 飞行履约存证详情</Space>} footer={null} width={920} onCancel={() => setDetail(null)}>
        {detail ? (
          <div style={{ marginTop: -10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f5f5f5', padding: '12px 20px', borderRadius: 8, marginBottom: 20 }}>
              <Space size="large">
                <Statistic title="飞行里程" value={Number(detail.total_distance_m || 0)} suffix="m" valueStyle={{ fontSize: 18 }} />
                <Statistic title="持续时长" value={formatSeconds(detail.total_duration_seconds)} valueStyle={{ fontSize: 18 }} />
                <Statistic title="最大高度" value={Number(detail.max_altitude_m || 0)} suffix="m" valueStyle={{ color: '#1890ff', fontSize: 18 }} />
              </Space>
              <div style={{ textAlign: 'right' }}>
                <Text type="secondary">记录状态</Text>
                <div style={{ marginTop: 4 }}>
                  <Tag color={STATUS_MAP[detail.status]?.color || 'default'} style={{ fontSize: 14, padding: '2px 10px' }}>
                    {STATUS_MAP[detail.status]?.text || detail.status}
                  </Tag>
                </div>
              </div>
            </div>

            <Descriptions column={2} bordered size="small" labelStyle={{ background: '#fafafa', width: 120 }}>
              <Descriptions.Item label="飞行编号"><Text copyable>{detail.flight_no}</Text></Descriptions.Item>
              <Descriptions.Item label="订单编号"><Text copyable>{detail.order?.order_no || '-'}</Text></Descriptions.Item>
              <Descriptions.Item label="派单识别码">{detail.dispatch_task?.dispatch_no || <Text type="secondary">无派单关联</Text>}</Descriptions.Item>
              <Descriptions.Item label="关联项目名称" span={2}>{detail.order?.title || '-'}</Descriptions.Item>
              <Descriptions.Item label="执行飞手">{detail.pilot?.nickname || '-'}</Descriptions.Item>
              <Descriptions.Item label="执行设备">{detail.drone ? `${detail.drone.brand} ${detail.drone.model}` : '-'}</Descriptions.Item>
              <Descriptions.Item label="设备序列号">{detail.drone?.serial_number || '-'}</Descriptions.Item>
              <Descriptions.Item label="数据源类型"><Tag color="purple">黑匣子实时回传</Tag></Descriptions.Item>
            </Descriptions>

            <Divider plain><Text type="secondary" style={{ fontSize: 12 }}>时间节点存证</Text></Divider>
            <div style={{ padding: '0 10px' }}>
              <Timeline
                items={[
                  { color: 'blue', label: formatTime(detail.created_at), children: '飞行记录单初始化' },
                  detail.takeoff_at ? { color: 'gold', label: formatTime(detail.takeoff_at), children: '传感器检测到无人机已起飞' } : null,
                  detail.landing_at ? { color: 'green', label: formatTime(detail.landing_at), children: '传感器检测到无人机已安全落地' } : null,
                ].filter(Boolean) as any}
              />
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
};

export default FlightRecordList;
