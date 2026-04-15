import React, { useEffect, useMemo, useState } from 'react';
import { Button, Card, Col, Descriptions, Divider, Input, Modal, Row, Select, Space, Statistic, Table, Tag, Timeline, message } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { adminApi } from '../../services/api';

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
  pending: { text: '待开始', color: 'default' },
  executing: { text: '执行中', color: 'processing' },
  completed: { text: '已完成', color: 'green' },
  cancelled: { text: '已取消', color: 'red' },
};

const formatSeconds = (seconds?: number) => {
  const total = Number(seconds || 0);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  return `${hours}h ${minutes}m`;
};
const formatTime = (value?: string) => value?.slice(0, 19).replace('T', ' ') || '-';
const downloadCsv = (filename: string, headers: string[], rows: Array<Array<string | number | undefined>>) => {
  const escapeCell = (value: string | number | undefined) => `"${String(value ?? '').replace(/"/g, '""')}"`;
  const csv = [headers, ...rows].map(row => row.map(escapeCell).join(',')).join('\n');
  const blob = new Blob([`\uFEFF${csv}`], {type: 'text/csv;charset=utf-8;'});
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  window.URL.revokeObjectURL(url);
};

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
      acc.completedCount += item.status === 'completed' ? 1 : 0;
      acc.totalDistance += Number(item.total_distance_m || 0);
      acc.totalDuration += Number(item.total_duration_seconds || 0);
      return acc;
    },
    {executingCount: 0, completedCount: 0, totalDistance: 0, totalDuration: 0},
  ), [items]);

  const handleExport = () => {
    downloadCsv(
      `flight-records-export-${Date.now()}.csv`,
      ['飞行编号', '订单编号', '派单编号', '状态', '飞手', '无人机', '距离', '时长', '起飞时间', '落地时间'],
      items.map(item => [
        item.flight_no,
        item.order?.order_no || item.order_id,
        item.dispatch_task?.dispatch_no || item.dispatch_task_id || '-',
        STATUS_MAP[item.status]?.text || item.status,
        item.pilot?.nickname || item.pilot_user_id,
        item.drone ? `${item.drone.brand || '-'} ${item.drone.model || ''}`.trim() : item.drone_id,
        `${Number(item.total_distance_m || 0).toFixed(0)}m`,
        formatSeconds(item.total_duration_seconds),
        formatTime(item.takeoff_at),
        formatTime(item.landing_at),
      ]),
    );
    message.success(`已导出 ${items.length} 条飞行记录`);
  };

  const columns: ColumnsType<FlightRecordItem> = [
    { title: '飞行编号', dataIndex: 'flight_no', width: 180 },
    { title: '订单编号', width: 180, render: (_, record) => record.order?.order_no || '-' },
    { title: '派单编号', width: 180, render: (_, record) => record.dispatch_task?.dispatch_no || '-' },
    { title: '飞手', width: 120, render: (_, record) => record.pilot?.nickname || '-' },
    { title: '无人机', width: 160, render: (_, record) => record.drone ? `${record.drone.brand || '-'} ${record.drone.model || ''}`.trim() : '-' },
    { title: '飞行距离', dataIndex: 'total_distance_m', width: 110, render: value => `${Number(value || 0).toFixed(0)}m` },
    { title: '飞行时长', dataIndex: 'total_duration_seconds', width: 110, render: formatSeconds },
    { title: '最大高度', dataIndex: 'max_altitude_m', width: 100, render: value => `${Number(value || 0).toFixed(0)}m` },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: value => {
        const status = STATUS_MAP[value] || { text: value, color: 'default' };
        return <Tag color={status.color}>{status.text}</Tag>;
      },
    },
    { title: '操作', width: 90, fixed: 'right', render: (_, record) => <Button size="small" onClick={() => setDetail(record)}>详情</Button> },
  ];

  return (
    <div>
      <h2>飞行记录管理</h2>
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} md={6}>
          <Card><Statistic title="当前列表" value={items.length} suffix={`/ ${total || 0}`} /></Card>
        </Col>
        <Col xs={24} md={6}>
          <Card><Statistic title="执行中飞行" value={summary.executingCount} /></Card>
        </Col>
        <Col xs={24} md={6}>
          <Card><Statistic title="累计飞行距离" value={summary.totalDistance / 1000} precision={2} suffix="km" /></Card>
        </Col>
        <Col xs={24} md={6}>
          <Card><Statistic title="累计飞行时长" value={formatSeconds(summary.totalDuration)} /></Card>
        </Col>
      </Row>
      <Card size="small" style={{ marginBottom: 16 }}>
        <Row gutter={[16, 12]} align="middle">
          <Col>
            <Input allowClear prefix={<SearchOutlined />} placeholder="搜索飞行编号/订单编号" style={{ width: 240 }} value={keyword} onChange={e => setKeyword(e.target.value)} onPressEnter={() => { setPage(1); fetchList(1); }} />
          </Col>
          <Col>
            <Select allowClear placeholder="状态" style={{ width: 150 }} value={statusFilter || undefined} onChange={value => { setStatusFilter(value || ''); setPage(1); }}>
              {Object.entries(STATUS_MAP).map(([key, value]) => <Select.Option key={key} value={key}>{value.text}</Select.Option>)}
            </Select>
          </Col>
          <Col>
            <Space>
              <Button type="primary" onClick={() => { setPage(1); fetchList(1); }}>搜索</Button>
              <Button onClick={() => { setKeyword(''); setStatusFilter(''); setPage(1); fetchList(1); }}>重置</Button>
              <Button onClick={handleExport}>导出当前列表</Button>
            </Space>
          </Col>
        </Row>
      </Card>

      <Table rowKey="id" loading={loading} columns={columns} dataSource={items} scroll={{ x: 1350 }} pagination={{ current: page, total, pageSize: 20, onChange: setPage, showTotal: t => `共 ${t} 条` }} />

      <Modal open={!!detail} title="飞行记录详情" footer={null} width={860} onCancel={() => setDetail(null)}>
        {detail ? (
          <>
            <Space style={{ marginBottom: 12 }} wrap>
              <Tag color={STATUS_MAP[detail.status]?.color || 'default'}>
                {STATUS_MAP[detail.status]?.text || detail.status}
              </Tag>
              {detail.dispatch_task?.dispatch_no ? <Tag color="geekblue">来自正式派单</Tag> : <Tag>无派单关联</Tag>}
            </Space>

            <Row gutter={[16, 16]}>
              <Col xs={24} md={8}>
                <Card size="small"><Statistic title="飞行距离" value={Number(detail.total_distance_m || 0)} suffix="m" /></Card>
              </Col>
              <Col xs={24} md={8}>
                <Card size="small"><Statistic title="飞行时长" value={formatSeconds(detail.total_duration_seconds)} /></Card>
              </Col>
              <Col xs={24} md={8}>
                <Card size="small"><Statistic title="最大高度" value={Number(detail.max_altitude_m || 0)} suffix="m" /></Card>
              </Col>
            </Row>

            <Divider>基础信息</Divider>
            <Descriptions column={2} bordered size="small">
              <Descriptions.Item label="飞行编号">{detail.flight_no}</Descriptions.Item>
              <Descriptions.Item label="订单编号">{detail.order?.order_no || '-'}</Descriptions.Item>
              <Descriptions.Item label="派单编号">{detail.dispatch_task?.dispatch_no || '-'}</Descriptions.Item>
              <Descriptions.Item label="飞手">{detail.pilot?.nickname || '-'}</Descriptions.Item>
              <Descriptions.Item label="无人机">
                {detail.drone ? `${detail.drone.brand || '-'} ${detail.drone.model || ''}`.trim() : '-'}
              </Descriptions.Item>
              <Descriptions.Item label="无人机序列号">{detail.drone?.serial_number || '-'}</Descriptions.Item>
            </Descriptions>

            <Divider>关键流转日志</Divider>
            <Timeline
              items={[
                {color: 'blue', children: `飞行记录创建：${formatTime(detail.created_at)}`},
                {color: detail.takeoff_at ? 'gold' : 'gray', children: `起飞：${formatTime(detail.takeoff_at)}`},
                {color: detail.landing_at ? 'green' : 'gray', children: `落地：${formatTime(detail.landing_at)}`},
              ]}
            />
          </>
        ) : null}
      </Modal>
    </div>
  );
};

export default FlightRecordList;
