import React, { useEffect, useState } from 'react';
import { Table, Tag, Button, Space, message, Modal, Input, Select, Card, Row, Col } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { adminApi } from '../../services/api';

interface Drone {
  id: number;
  owner_id: number;
  brand: string;
  model: string;
  serial_number: string;
  certification_status: string;
  availability_status: string;
  daily_price: number;
  hourly_price: number;
  deposit: number;
  max_load: number;
  max_flight_time: number;
  max_distance: number;
  city: string;
  address: string;
  rating: number;
  order_count: number;
  description: string;
  created_at: string;
  owner_nickname: string;
  owner_phone: string;
}

const CERT_STATUS_MAP: Record<string, { text: string; color: string }> = {
  approved: { text: '已认证', color: 'green' },
  pending: { text: '待审核', color: 'orange' },
  rejected: { text: '未通过', color: 'red' },
};

const AVAIL_STATUS_MAP: Record<string, { text: string; color: string }> = {
  available: { text: '空闲可租', color: 'green' },
  rented: { text: '使用中', color: 'orange' },
  maintenance: { text: '维护中', color: 'red' },
  offline: { text: '离线', color: 'default' },
};

const DroneList: React.FC = () => {
  const [drones, setDrones] = useState<Drone[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);

  // 搜索筛选
  const [keyword, setKeyword] = useState('');
  const [certFilter, setCertFilter] = useState<string>('');
  const [availFilter, setAvailFilter] = useState<string>('');

  // 详情弹窗
  const [detailDrone, setDetailDrone] = useState<Drone | null>(null);
  const [detailVisible, setDetailVisible] = useState(false);

  const fetchDrones = async (p = 1) => {
    setLoading(true);
    try {
      const params: any = { page: p, page_size: 20 };
      if (keyword) params.keyword = keyword;
      if (certFilter) params.certification_status = certFilter;
      console.log('[DroneList] Fetching drones with params:', params);
      const res: any = await adminApi.getDrones(params);
      console.log('[DroneList] API response:', res);
      console.log('[DroneList] res.data:', res.data);
      console.log('[DroneList] res.data.list:', res.data?.list);
      setDrones(res.data?.list || []);
      setTotal(res.data?.total || 0);
    } catch (e) {
      console.error('[DroneList] Error:', e);
    }
    setLoading(false);
  };

  useEffect(() => { fetchDrones(page); }, [page]);

  const handleSearch = () => {
    setPage(1);
    fetchDrones(1);
  };

  const handleReset = () => {
    setKeyword('');
    setCertFilter('');
    setAvailFilter('');
    setPage(1);
    fetchDrones(1);
  };

  const handleCertify = (id: number, approved: boolean) => {
    Modal.confirm({
      title: `确认${approved ? '通过' : '拒绝'}该无人机认证？`,
      content: approved ? '通过后该无人机可上线出租' : '拒绝后机主需要重新提交认证',
      okText: approved ? '通过' : '拒绝',
      okType: approved ? 'primary' : 'danger',
      onOk: async () => {
        await adminApi.approveCertification(id, approved);
        message.success('操作成功');
        fetchDrones(page);
      },
    });
  };

  // 本地筛选可用状态
  const filteredDrones = drones.filter(d => {
    if (availFilter && d.availability_status !== availFilter) return false;
    return true;
  });

  const columns: ColumnsType<Drone> = [
    { title: 'ID', dataIndex: 'id', width: 60 },
    {
      title: '品牌/型号', width: 160,
      render: (_, r) => (
        <div>
          <div style={{ fontWeight: 600 }}>{r.brand}</div>
          <div style={{ color: '#999', fontSize: 12 }}>{r.model}</div>
        </div>
      ),
    },
    { title: '序列号', dataIndex: 'serial_number', width: 140 },
    {
      title: '所有者', width: 120,
      render: (_, r) => (
        <div>
          <div>{r.owner_nickname || '-'}</div>
          <div style={{ color: '#999', fontSize: 12 }}>{r.owner_phone || ''}</div>
        </div>
      ),
    },
    { title: '城市', dataIndex: 'city', width: 80 },
    {
      title: '日租金', dataIndex: 'daily_price', width: 100,
      render: (v: number) => <span style={{ color: '#f5222d', fontWeight: 600 }}>{`¥${(v / 100).toFixed(0)}`}</span>,
    },
    {
      title: '评分', dataIndex: 'rating', width: 80,
      render: (v: number) => v > 0 ? <span style={{ color: '#faad14' }}>{v.toFixed(1)}</span> : '-',
    },
    {
      title: '认证状态', dataIndex: 'certification_status', width: 100,
      render: (v: string) => {
        const s = CERT_STATUS_MAP[v] || { text: v, color: 'default' };
        return <Tag color={s.color}>{s.text}</Tag>;
      },
    },
    {
      title: '可用状态', dataIndex: 'availability_status', width: 100,
      render: (v: string) => {
        const s = AVAIL_STATUS_MAP[v] || { text: v, color: 'default' };
        return <Tag color={s.color}>{s.text}</Tag>;
      },
    },
    {
      title: '操作', width: 200, fixed: 'right',
      render: (_, record) => (
        <Space>
          <Button size="small" onClick={() => { setDetailDrone(record); setDetailVisible(true); }}>
            详情
          </Button>
          {record.certification_status === 'pending' && (
            <>
              <Button size="small" type="primary" onClick={() => handleCertify(record.id, true)}>通过</Button>
              <Button size="small" danger onClick={() => handleCertify(record.id, false)}>拒绝</Button>
            </>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div>
      <h2>无人机管理</h2>

      {/* 搜索筛选栏 */}
      <Card size="small" style={{ marginBottom: 16 }}>
        <Row gutter={[16, 12]} align="middle">
          <Col>
            <Input
              placeholder="搜索品牌/型号/序列号"
              prefix={<SearchOutlined />}
              value={keyword}
              onChange={e => setKeyword(e.target.value)}
              onPressEnter={handleSearch}
              style={{ width: 200 }}
              allowClear
            />
          </Col>
          <Col>
            <Select
              placeholder="认证状态"
              allowClear
              style={{ width: 130 }}
              value={certFilter || undefined}
              onChange={v => setCertFilter(v || '')}>
              {Object.entries(CERT_STATUS_MAP).map(([k, v]) => (
                <Select.Option key={k} value={k}>{v.text}</Select.Option>
              ))}
            </Select>
          </Col>
          <Col>
            <Select
              placeholder="可用状态"
              allowClear
              style={{ width: 130 }}
              value={availFilter || undefined}
              onChange={v => setAvailFilter(v || '')}>
              {Object.entries(AVAIL_STATUS_MAP).map(([k, v]) => (
                <Select.Option key={k} value={k}>{v.text}</Select.Option>
              ))}
            </Select>
          </Col>
          <Col>
            <Space>
              <Button type="primary" onClick={handleSearch}>搜索</Button>
              <Button onClick={handleReset}>重置</Button>
            </Space>
          </Col>
        </Row>
      </Card>

      <Table
        columns={columns}
        dataSource={filteredDrones}
        rowKey="id"
        loading={loading}
        scroll={{ x: 1200 }}
        pagination={{ current: page, total, pageSize: 20, onChange: setPage, showTotal: t => `共 ${t} 条` }}
      />

      {/* 无人机详情弹窗 */}
      <Modal
        title="无人机详情"
        open={detailVisible}
        onCancel={() => setDetailVisible(false)}
        footer={null}
        width={600}>
        {detailDrone && (
          <div>
            <Row gutter={[0, 12]}>
              <Col span={24}>
                <h3 style={{ margin: 0 }}>{detailDrone.brand} {detailDrone.model}</h3>
              </Col>
              <Col span={8}><strong>序列号:</strong></Col>
              <Col span={16}>{detailDrone.serial_number || '-'}</Col>
              <Col span={8}><strong>所有者:</strong></Col>
              <Col span={16}>{detailDrone.owner_nickname || '-'} ({detailDrone.owner_phone || '-'})</Col>
              <Col span={8}><strong>所在城市:</strong></Col>
              <Col span={16}>{detailDrone.city || '-'}</Col>
              <Col span={8}><strong>详细地址:</strong></Col>
              <Col span={16}>{detailDrone.address || '-'}</Col>
              <Col span={8}><strong>最大载重:</strong></Col>
              <Col span={16}>{detailDrone.max_load ? `${detailDrone.max_load} kg` : '-'}</Col>
              <Col span={8}><strong>续航时间:</strong></Col>
              <Col span={16}>{detailDrone.max_flight_time ? `${detailDrone.max_flight_time} 分钟` : '-'}</Col>
              <Col span={8}><strong>最远距离:</strong></Col>
              <Col span={16}>{detailDrone.max_distance ? `${detailDrone.max_distance} km` : '-'}</Col>
              <Col span={8}><strong>日租金:</strong></Col>
              <Col span={16} style={{ color: '#f5222d', fontWeight: 600 }}>
                ¥{(detailDrone.daily_price / 100).toFixed(0)}/天
              </Col>
              <Col span={8}><strong>时租金:</strong></Col>
              <Col span={16}>
                {detailDrone.hourly_price ? `¥${(detailDrone.hourly_price / 100).toFixed(0)}/小时` : '-'}
              </Col>
              <Col span={8}><strong>押金:</strong></Col>
              <Col span={16}>
                {detailDrone.deposit ? `¥${(detailDrone.deposit / 100).toFixed(0)}` : '-'}
              </Col>
              <Col span={8}><strong>评分:</strong></Col>
              <Col span={16}>{detailDrone.rating > 0 ? detailDrone.rating.toFixed(1) : '暂无'}</Col>
              <Col span={8}><strong>订单数:</strong></Col>
              <Col span={16}>{detailDrone.order_count}</Col>
              <Col span={8}><strong>认证状态:</strong></Col>
              <Col span={16}>
                <Tag color={CERT_STATUS_MAP[detailDrone.certification_status]?.color || 'default'}>
                  {CERT_STATUS_MAP[detailDrone.certification_status]?.text || detailDrone.certification_status}
                </Tag>
              </Col>
              <Col span={8}><strong>可用状态:</strong></Col>
              <Col span={16}>
                <Tag color={AVAIL_STATUS_MAP[detailDrone.availability_status]?.color || 'default'}>
                  {AVAIL_STATUS_MAP[detailDrone.availability_status]?.text || detailDrone.availability_status}
                </Tag>
              </Col>
              {detailDrone.description && (
                <>
                  <Col span={8}><strong>描述:</strong></Col>
                  <Col span={16}>{detailDrone.description}</Col>
                </>
              )}
              <Col span={8}><strong>创建时间:</strong></Col>
              <Col span={16}>{detailDrone.created_at?.slice(0, 19)}</Col>
            </Row>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default DroneList;
