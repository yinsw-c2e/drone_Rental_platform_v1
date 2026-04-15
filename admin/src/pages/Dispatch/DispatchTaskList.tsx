import React, { useEffect, useMemo, useState } from 'react';
import { Button, Card, Col, Descriptions, Divider, Input, Modal, Row, Select, Space, Statistic, Table, Tag, Timeline, message } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { adminApi } from '../../services/api';

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
  order?: { id: number; order_no?: string; title?: string; status?: string };
  provider?: { id: number; nickname?: string; phone?: string };
  target_pilot?: { id: number; nickname?: string; phone?: string };
}

const STATUS_MAP: Record<string, { text: string; color: string }> = {
  pending_response: { text: '待响应', color: 'orange' },
  accepted: { text: '已接受', color: 'blue' },
  executing: { text: '执行中', color: 'processing' },
  finished: { text: '已完成', color: 'green' },
  rejected: { text: '已拒绝', color: 'red' },
  cancelled: { text: '已取消', color: 'default' },
  timeout: { text: '已超时', color: 'red' },
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
      acc.closedCount += ['finished', 'rejected', 'cancelled'].includes(item.status) ? 1 : 0;
      acc.retryCount += Number(item.retry_count || 0);
      return acc;
    },
    {pendingCount: 0, executingCount: 0, closedCount: 0, retryCount: 0},
  ), [items]);

  const handleExport = () => {
    downloadCsv(
      `dispatch-export-${Date.now()}.csv`,
      ['派单编号', '订单编号', '状态', '承接方', '目标飞手', '来源', '重派次数', '发起时间', '响应时间'],
      items.map(item => [
        item.dispatch_no,
        item.order?.order_no || item.order_id,
        STATUS_MAP[item.status]?.text || item.status,
        item.provider?.nickname || item.provider_user_id,
        item.target_pilot?.nickname || item.target_pilot_user_id,
        item.dispatch_source,
        item.retry_count,
        formatTime(item.sent_at),
        formatTime(item.responded_at),
      ]),
    );
    message.success(`已导出 ${items.length} 条派单记录`);
  };

  const columns: ColumnsType<DispatchTaskItem> = [
    { title: '派单编号', dataIndex: 'dispatch_no', width: 190 },
    { title: '订单编号', width: 190, render: (_, record) => record.order?.order_no || '-' },
    { title: '承接方', width: 120, render: (_, record) => record.provider?.nickname || '-' },
    { title: '目标飞手', width: 120, render: (_, record) => record.target_pilot?.nickname || '-' },
    { title: '派单来源', dataIndex: 'dispatch_source', width: 120 },
    { title: '重派次数', dataIndex: 'retry_count', width: 100 },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: value => {
        const status = STATUS_MAP[value] || { text: value, color: 'default' };
        return <Tag color={status.color}>{status.text}</Tag>;
      },
    },
    { title: '发起时间', dataIndex: 'sent_at', width: 170, render: value => value?.slice(0, 19).replace('T', ' ') || '-' },
    { title: '响应时间', dataIndex: 'responded_at', width: 170, render: value => value?.slice(0, 19).replace('T', ' ') || '-' },
    { title: '操作', width: 90, fixed: 'right', render: (_, record) => <Button size="small" onClick={() => setDetail(record)}>详情</Button> },
  ];

  return (
    <div>
      <h2>正式派单管理</h2>
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} md={6}>
          <Card><Statistic title="当前列表" value={items.length} suffix={`/ ${total || 0}`} /></Card>
        </Col>
        <Col xs={24} md={6}>
          <Card><Statistic title="待飞手响应" value={summary.pendingCount} /></Card>
        </Col>
        <Col xs={24} md={6}>
          <Card><Statistic title="执行中派单" value={summary.executingCount} /></Card>
        </Col>
        <Col xs={24} md={6}>
          <Card><Statistic title="累计重派次数" value={summary.retryCount} /></Card>
        </Col>
      </Row>
      <Card size="small" style={{ marginBottom: 16 }}>
        <Row gutter={[16, 12]} align="middle">
          <Col>
            <Input allowClear prefix={<SearchOutlined />} placeholder="搜索派单编号/订单编号" style={{ width: 240 }} value={keyword} onChange={e => setKeyword(e.target.value)} onPressEnter={() => { setPage(1); fetchList(1); }} />
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

      <Table rowKey="id" loading={loading} columns={columns} dataSource={items} scroll={{ x: 1250 }} pagination={{ current: page, total, pageSize: 20, onChange: setPage, showTotal: t => `共 ${t} 条` }} />

      <Modal open={!!detail} title="正式派单详情" footer={null} width={860} onCancel={() => setDetail(null)}>
        {detail ? (
          <>
            <Space style={{ marginBottom: 12 }} wrap>
              <Tag color={STATUS_MAP[detail.status]?.color || 'default'}>
                {STATUS_MAP[detail.status]?.text || detail.status}
              </Tag>
              <Tag color="geekblue">{detail.dispatch_source || '-'}</Tag>
              {detail.retry_count > 0 ? <Tag color="orange">已重派 {detail.retry_count} 次</Tag> : <Tag>首次派发</Tag>}
            </Space>

            <Row gutter={[16, 16]}>
              <Col xs={24} md={8}>
                <Card size="small"><Statistic title="重派次数" value={detail.retry_count || 0} /></Card>
              </Col>
              <Col xs={24} md={8}>
                <Card size="small"><Statistic title="承接方用户ID" value={detail.provider_user_id || 0} /></Card>
              </Col>
              <Col xs={24} md={8}>
                <Card size="small"><Statistic title="目标飞手用户ID" value={detail.target_pilot_user_id || 0} /></Card>
              </Col>
            </Row>

            <Divider>派单信息</Divider>
            <Descriptions column={2} bordered size="small">
              <Descriptions.Item label="派单编号">{detail.dispatch_no}</Descriptions.Item>
              <Descriptions.Item label="订单编号">{detail.order?.order_no || '-'}</Descriptions.Item>
              <Descriptions.Item label="订单标题">{detail.order?.title || '-'}</Descriptions.Item>
              <Descriptions.Item label="订单状态">{detail.order?.status || '-'}</Descriptions.Item>
              <Descriptions.Item label="承接方">
                {detail.provider?.nickname || '-'}
                {detail.provider?.phone ? ` (${detail.provider.phone})` : ''}
              </Descriptions.Item>
              <Descriptions.Item label="目标飞手">
                {detail.target_pilot?.nickname || '-'}
                {detail.target_pilot?.phone ? ` (${detail.target_pilot.phone})` : ''}
              </Descriptions.Item>
              <Descriptions.Item label="派单原因" span={2}>{detail.reason || '-'}</Descriptions.Item>
            </Descriptions>

            <Divider>关键流转日志</Divider>
            <Timeline
              items={[
                {color: 'blue', children: `记录创建：${formatTime(detail.created_at)}`},
                {color: detail.sent_at ? 'gold' : 'gray', children: `正式发起：${formatTime(detail.sent_at)}`},
                {color: detail.responded_at ? 'green' : 'gray', children: `飞手响应：${formatTime(detail.responded_at)}`},
              ]}
            />
          </>
        ) : null}
      </Modal>
    </div>
  );
};

export default DispatchTaskList;
