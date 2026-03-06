import React, { useEffect, useState } from 'react';
import {
  Table, Tag, Button, Space, message, Modal, Select, Card, Row, Col, Input, Divider, Image,
} from 'antd';
import { CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { adminApi } from '../../services/api';

interface Pilot {
  id: number;
  user_id: number;
  nickname: string;
  phone: string;
  caac_license_no: string;
  caac_license_type: string;
  caac_license_image: string;
  criminal_check_status: string;
  criminal_check_doc: string;
  health_check_status: string;
  health_check_doc: string;
  verification_status: string;
  verification_note: string;
  service_radius: number;
  total_orders: number;
  service_rating: number;
  created_at: string;
}

const VERIFY_STATUS_MAP: Record<string, { text: string; color: string }> = {
  verified: { text: '已通过', color: 'green' },
  pending:  { text: '待审核', color: 'orange' },
  rejected: { text: '已拒绝', color: 'red' },
};

const CHECK_STATUS_MAP: Record<string, { text: string; color: string }> = {
  approved: { text: '已通过', color: 'green' },
  pending:  { text: '待审核', color: 'orange' },
  rejected: { text: '已拒绝', color: 'red' },
};

const PilotList: React.FC = () => {
  const [pilots, setPilots] = useState<Pilot[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');

  const [detailPilot, setDetailPilot] = useState<Pilot | null>(null);
  const [detailVisible, setDetailVisible] = useState(false);
  const [rejectNote, setRejectNote] = useState('');

  const fetchPilots = async (p = 1) => {
    setLoading(true);
    try {
      const params: any = { page: p, page_size: 20 };
      if (statusFilter) params.verification_status = statusFilter;
      const res: any = await adminApi.getPilots(params);
      setPilots(res.data?.list || []);
      setTotal(res.data?.total || 0);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  useEffect(() => { fetchPilots(page); }, [page, statusFilter]);

  const handleVerify = (pilot: Pilot, approved: boolean) => {
    if (!approved) {
      // 拒绝时需要填写原因
      Modal.confirm({
        title: '拒绝飞手认证',
        content: (
          <Input.TextArea
            placeholder="请输入拒绝原因（可选）"
            onChange={e => setRejectNote(e.target.value)}
            rows={3}
          />
        ),
        okText: '确认拒绝',
        okType: 'danger',
        onOk: async () => {
          await adminApi.verifyPilot(pilot.id, false, rejectNote);
          message.success('已拒绝');
          setDetailPilot(prev => prev ? { ...prev, verification_status: 'rejected', verification_note: rejectNote } : prev);
          fetchPilots(page);
          setRejectNote('');
        },
      });
    } else {
      Modal.confirm({
        title: '确认通过该飞手认证？',
        okText: '通过',
        onOk: async () => {
          await adminApi.verifyPilot(pilot.id, true);
          message.success('已通过');
          setDetailPilot(prev => prev ? { ...prev, verification_status: 'verified' } : prev);
          fetchPilots(page);
        },
      });
    }
  };

  const handleCheckApprove = async (
    type: 'criminal' | 'health',
    approved: boolean,
  ) => {
    if (!detailPilot) return;
    const label = type === 'criminal' ? '无犯罪记录证明' : '健康体检证明';
    Modal.confirm({
      title: `确认${approved ? '通过' : '拒绝'}${label}审核？`,
      okText: approved ? '通过' : '拒绝',
      okType: approved ? 'primary' : 'danger',
      onOk: async () => {
        const fn = type === 'criminal'
          ? adminApi.approvePilotCriminalCheck
          : adminApi.approvePilotHealthCheck;
        await fn(detailPilot.id, approved);
        message.success('操作成功');
        const status = approved ? 'approved' : 'rejected';
        if (type === 'criminal') {
          setDetailPilot(prev => prev ? { ...prev, criminal_check_status: status } : prev);
        } else {
          setDetailPilot(prev => prev ? { ...prev, health_check_status: status } : prev);
        }
        fetchPilots(page);
      },
    });
  };

  const columns: ColumnsType<Pilot> = [
    { title: 'ID', dataIndex: 'id', width: 60 },
    {
      title: '飞手', width: 160,
      render: (_, r) => (
        <div>
          <div style={{ fontWeight: 600 }}>{r.nickname || '-'}</div>
          <div style={{ color: '#999', fontSize: 12 }}>{r.phone}</div>
        </div>
      ),
    },
    { title: 'CAAC执照号', dataIndex: 'caac_license_no', width: 140 },
    {
      title: '执照类型', dataIndex: 'caac_license_type', width: 90,
      render: v => v || '-',
    },
    {
      title: '认证状态', dataIndex: 'verification_status', width: 100,
      render: v => {
        const s = VERIFY_STATUS_MAP[v] || { text: v, color: 'default' };
        return <Tag color={s.color}>{s.text}</Tag>;
      },
    },
    {
      title: '无犯罪记录', dataIndex: 'criminal_check_status', width: 110,
      render: v => {
        const s = CHECK_STATUS_MAP[v] || { text: v || '未提交', color: 'default' };
        return <Tag color={s.color}>{s.text}</Tag>;
      },
    },
    {
      title: '健康证明', dataIndex: 'health_check_status', width: 100,
      render: v => {
        const s = CHECK_STATUS_MAP[v] || { text: v || '未提交', color: 'default' };
        return <Tag color={s.color}>{s.text}</Tag>;
      },
    },
    { title: '订单数', dataIndex: 'total_orders', width: 80 },
    { title: '注册时间', dataIndex: 'created_at', width: 150 },
    {
      title: '操作', width: 200, fixed: 'right',
      render: (_, record) => (
        <Space>
          <Button size="small" onClick={() => { setDetailPilot(record); setDetailVisible(true); }}>
            详情
          </Button>
          {record.verification_status === 'pending' && (
            <>
              <Button size="small" type="primary" onClick={() => handleVerify(record, true)}>通过</Button>
              <Button size="small" danger onClick={() => handleVerify(record, false)}>拒绝</Button>
            </>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div>
      <h2>飞手管理</h2>
      <Card size="small" style={{ marginBottom: 16 }}>
        <Row gutter={[16, 12]} align="middle">
          <Col>
            <Select
              placeholder="认证状态"
              allowClear
              style={{ width: 140 }}
              value={statusFilter || undefined}
              onChange={v => { setStatusFilter(v || ''); setPage(1); }}>
              {Object.entries(VERIFY_STATUS_MAP).map(([k, v]) => (
                <Select.Option key={k} value={k}>{v.text}</Select.Option>
              ))}
            </Select>
          </Col>
        </Row>
      </Card>

      <Table
        columns={columns}
        dataSource={pilots}
        rowKey="id"
        loading={loading}
        scroll={{ x: 1100 }}
        pagination={{ current: page, total, pageSize: 20, onChange: setPage, showTotal: t => `共 ${t} 条` }}
      />

      {/* 飞手详情弹窗 */}
      <Modal
        title="飞手详情"
        open={detailVisible}
        onCancel={() => setDetailVisible(false)}
        footer={null}
        width={660}>
        {detailPilot && (
          <div>
            <Row gutter={[0, 12]}>
              <Col span={8}><strong>飞手姓名:</strong></Col>
              <Col span={16}>{detailPilot.nickname || '-'}</Col>
              <Col span={8}><strong>手机号:</strong></Col>
              <Col span={16}>{detailPilot.phone || '-'}</Col>
              <Col span={8}><strong>CAAC执照号:</strong></Col>
              <Col span={16}>{detailPilot.caac_license_no || '-'}</Col>
              <Col span={8}><strong>执照类型:</strong></Col>
              <Col span={16}>{detailPilot.caac_license_type || '-'}</Col>
              <Col span={8}><strong>服务半径:</strong></Col>
              <Col span={16}>{detailPilot.service_radius} 公里</Col>
              <Col span={8}><strong>总订单数:</strong></Col>
              <Col span={16}>{detailPilot.total_orders}</Col>
              <Col span={8}><strong>服务评分:</strong></Col>
              <Col span={16}>{detailPilot.service_rating?.toFixed(1)}</Col>
              <Col span={8}><strong>认证状态:</strong></Col>
              <Col span={16}>
                <Space>
                  <Tag color={VERIFY_STATUS_MAP[detailPilot.verification_status]?.color || 'default'}>
                    {VERIFY_STATUS_MAP[detailPilot.verification_status]?.text || detailPilot.verification_status}
                  </Tag>
                  {detailPilot.verification_status !== 'verified' && (
                    <>
                      <Button size="small" type="primary" icon={<CheckCircleOutlined />}
                        onClick={() => handleVerify(detailPilot, true)}>通过</Button>
                      <Button size="small" danger icon={<CloseCircleOutlined />}
                        onClick={() => handleVerify(detailPilot, false)}>拒绝</Button>
                    </>
                  )}
                </Space>
              </Col>
              {detailPilot.verification_note && (
                <>
                  <Col span={8}><strong>审核备注:</strong></Col>
                  <Col span={16} style={{ color: '#f5222d' }}>{detailPilot.verification_note}</Col>
                </>
              )}
              <Col span={8}><strong>注册时间:</strong></Col>
              <Col span={16}>{detailPilot.created_at}</Col>
            </Row>

            {detailPilot.caac_license_image && (
              <>
                <Divider>CAAC 执照照片</Divider>
                <Image src={detailPilot.caac_license_image} style={{ maxHeight: 200 }} />
              </>
            )}

            <Divider>无犯罪记录证明</Divider>
            <Row gutter={[0, 10]}>
              <Col span={8}><strong>审核状态:</strong></Col>
              <Col span={16}>
                <Space>
                  <Tag color={CHECK_STATUS_MAP[detailPilot.criminal_check_status]?.color || 'default'}>
                    {CHECK_STATUS_MAP[detailPilot.criminal_check_status]?.text || '未提交'}
                  </Tag>
                  {detailPilot.criminal_check_doc && detailPilot.criminal_check_status !== 'approved' && (
                    <>
                      <Button size="small" type="primary" icon={<CheckCircleOutlined />}
                        onClick={() => handleCheckApprove('criminal', true)}>通过</Button>
                      <Button size="small" danger icon={<CloseCircleOutlined />}
                        onClick={() => handleCheckApprove('criminal', false)}>拒绝</Button>
                    </>
                  )}
                </Space>
              </Col>
              {detailPilot.criminal_check_doc && (
                <>
                  <Col span={8}><strong>证明文件:</strong></Col>
                  <Col span={16}>
                    <Image src={detailPilot.criminal_check_doc} style={{ maxHeight: 160 }} />
                  </Col>
                </>
              )}
            </Row>

            <Divider>健康体检证明</Divider>
            <Row gutter={[0, 10]}>
              <Col span={8}><strong>审核状态:</strong></Col>
              <Col span={16}>
                <Space>
                  <Tag color={CHECK_STATUS_MAP[detailPilot.health_check_status]?.color || 'default'}>
                    {CHECK_STATUS_MAP[detailPilot.health_check_status]?.text || '未提交'}
                  </Tag>
                  {detailPilot.health_check_doc && detailPilot.health_check_status !== 'approved' && (
                    <>
                      <Button size="small" type="primary" icon={<CheckCircleOutlined />}
                        onClick={() => handleCheckApprove('health', true)}>通过</Button>
                      <Button size="small" danger icon={<CloseCircleOutlined />}
                        onClick={() => handleCheckApprove('health', false)}>拒绝</Button>
                    </>
                  )}
                </Space>
              </Col>
              {detailPilot.health_check_doc && (
                <>
                  <Col span={8}><strong>体检文件:</strong></Col>
                  <Col span={16}>
                    <Image src={detailPilot.health_check_doc} style={{ maxHeight: 160 }} />
                  </Col>
                </>
              )}
            </Row>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default PilotList;
