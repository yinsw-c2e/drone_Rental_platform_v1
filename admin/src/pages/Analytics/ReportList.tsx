import React, { useEffect, useState, useCallback } from 'react';
import { 
  Card, Table, Button, Tag, Modal, Descriptions, Space, Select, 
  DatePicker, message, Popconfirm, Row, Col, Statistic, Spin 
} from 'antd';
import { 
  PlusOutlined, ReloadOutlined, FileTextOutlined, DeleteOutlined, 
  EyeOutlined, DownloadOutlined 
} from '@ant-design/icons';
import { adminApi } from '../../services/api';
import dayjs from 'dayjs';

const { RangePicker } = DatePicker;
const { Option } = Select;

// 类型定义
interface AnalyticsReport {
  id: number;
  report_no: string;
  report_type: string;
  report_name: string;
  period_start: string;
  period_end: string;
  summary: string;
  order_analysis: string;
  revenue_analysis: string;
  user_analysis: string;
  flight_analysis: string;
  risk_analysis: string;
  recommendations: string;
  status: string;
  generated_by: string;
  generated_at: string;
  created_at: string;
}

interface ReportSummary {
  total_orders: number;
  completed_orders: number;
  completion_rate: number;
  total_revenue: number;
  platform_fee: number;
  new_users: number;
  total_flights: number;
  alerts_count: number;
  violations_count: number;
}

// 辅助函数
const getReportTypeText = (type: string): string => {
  const types: Record<string, string> = {
    daily: '日报',
    weekly: '周报',
    monthly: '月报',
    quarterly: '季报',
    yearly: '年报',
    custom: '自定义',
  };
  return types[type] || type;
};

const getReportTypeColor = (type: string): string => {
  const colors: Record<string, string> = {
    daily: 'blue',
    weekly: 'green',
    monthly: 'purple',
    quarterly: 'orange',
    yearly: 'red',
    custom: 'default',
  };
  return colors[type] || 'default';
};

const getStatusText = (status: string): string => {
  const statuses: Record<string, string> = {
    generating: '生成中',
    completed: '已完成',
    failed: '生成失败',
  };
  return statuses[status] || status;
};

const getStatusColor = (status: string): string => {
  const colors: Record<string, string> = {
    generating: 'processing',
    completed: 'success',
    failed: 'error',
  };
  return colors[status] || 'default';
};

const formatAmount = (amount: number): string => {
  const yuan = amount / 100;
  if (yuan >= 10000) {
    return (yuan / 10000).toFixed(2) + '万';
  }
  return yuan.toFixed(2);
};

const parseJSON = (str: string): any => {
  try {
    return JSON.parse(str);
  } catch {
    return null;
  }
};

const ReportList: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [reports, setReports] = useState<AnalyticsReport[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [filterType, setFilterType] = useState<string>('');
  
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [selectedReport, setSelectedReport] = useState<AnalyticsReport | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  
  const [generateModalVisible, setGenerateModalVisible] = useState(false);
  const [generateType, setGenerateType] = useState('daily');
  const [generateDates, setGenerateDates] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(null);
  const [generating, setGenerating] = useState(false);

  const fetchReports = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminApi.getReportList({ 
        type: filterType || undefined, 
        page, 
        page_size: pageSize 
      });
      setReports((res as any).data || []);
      setTotal((res as any).total || 0);
    } catch (error) {
      console.error('Failed to fetch reports:', error);
      message.error('获取报表列表失败');
    } finally {
      setLoading(false);
    }
  }, [filterType, page, pageSize]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  const handleViewDetail = async (report: AnalyticsReport) => {
    setDetailLoading(true);
    setDetailModalVisible(true);
    try {
      const res = await adminApi.getReport(report.id);
      setSelectedReport((res as any).data);
    } catch (error) {
      message.error('获取报表详情失败');
    } finally {
      setDetailLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await adminApi.deleteReport(id);
      message.success('删除成功');
      fetchReports();
    } catch (error) {
      message.error('删除失败');
    }
  };

  const handleGenerate = async () => {
    if (!generateDates) {
      message.warning('请选择日期范围');
      return;
    }
    
    setGenerating(true);
    try {
      await adminApi.generateReport(
        generateType,
        generateDates[0].format('YYYY-MM-DD'),
        generateDates[1].format('YYYY-MM-DD')
      );
      message.success('报表生成任务已提交');
      setGenerateModalVisible(false);
      setGenerateDates(null);
      fetchReports();
    } catch (error) {
      message.error('生成报表失败');
    } finally {
      setGenerating(false);
    }
  };

  // 快捷日期选择
  const handleQuickGenerate = (type: string) => {
    const now = dayjs();
    let start: dayjs.Dayjs;
    let end: dayjs.Dayjs;
    
    switch (type) {
      case 'daily':
        start = now.subtract(1, 'day');
        end = now.subtract(1, 'day');
        break;
      case 'weekly':
        start = now.subtract(7, 'day');
        end = now.subtract(1, 'day');
        break;
      case 'monthly':
        start = now.startOf('month').subtract(1, 'month');
        end = now.startOf('month').subtract(1, 'day');
        break;
      default:
        return;
    }
    
    setGenerateType(type);
    setGenerateDates([start, end]);
  };

  const columns = [
    {
      title: '报表编号',
      dataIndex: 'report_no',
      key: 'report_no',
      width: 160,
    },
    {
      title: '报表名称',
      dataIndex: 'report_name',
      key: 'report_name',
    },
    {
      title: '类型',
      dataIndex: 'report_type',
      key: 'report_type',
      width: 80,
      render: (type: string) => (
        <Tag color={getReportTypeColor(type)}>{getReportTypeText(type)}</Tag>
      ),
    },
    {
      title: '统计周期',
      key: 'period',
      width: 200,
      render: (_: any, record: AnalyticsReport) => (
        <span>
          {record.period_start?.split('T')[0]} ~ {record.period_end?.split('T')[0]}
        </span>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => (
        <Tag color={getStatusColor(status)}>{getStatusText(status)}</Tag>
      ),
    },
    {
      title: '生成时间',
      dataIndex: 'generated_at',
      key: 'generated_at',
      width: 180,
      render: (time: string) => time ? dayjs(time).format('YYYY-MM-DD HH:mm') : '-',
    },
    {
      title: '操作',
      key: 'action',
      width: 150,
      render: (_: any, record: AnalyticsReport) => (
        <Space>
          <Button 
            type="link" 
            size="small" 
            icon={<EyeOutlined />}
            onClick={() => handleViewDetail(record)}
            disabled={record.status !== 'completed'}
          >
            查看
          </Button>
          <Popconfirm
            title="确定删除该报表？"
            onConfirm={() => handleDelete(record.id)}
            okText="确定"
            cancelText="取消"
          >
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  // 解析报表摘要
  const summary: ReportSummary | null = selectedReport?.summary ? parseJSON(selectedReport.summary) : null;
  const recommendations: string[] = selectedReport?.recommendations ? parseJSON(selectedReport.recommendations) : [];

  return (
    <div>
      {/* 页头 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h2 style={{ margin: 0 }}>智能报表</h2>
        <Space>
          <Select
            placeholder="报表类型"
            allowClear
            style={{ width: 120 }}
            value={filterType || undefined}
            onChange={setFilterType}
          >
            <Option value="daily">日报</Option>
            <Option value="weekly">周报</Option>
            <Option value="monthly">月报</Option>
            <Option value="quarterly">季报</Option>
            <Option value="yearly">年报</Option>
          </Select>
          <Button icon={<ReloadOutlined />} onClick={fetchReports}>
            刷新
          </Button>
          <Button 
            type="primary" 
            icon={<PlusOutlined />}
            onClick={() => setGenerateModalVisible(true)}
          >
            生成报表
          </Button>
        </Space>
      </div>

      {/* 报表列表 */}
      <Card>
        <Table
          columns={columns}
          dataSource={reports}
          rowKey="id"
          loading={loading}
          pagination={{
            current: page,
            pageSize,
            total,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (t) => `共 ${t} 条`,
            onChange: (p, ps) => {
              setPage(p);
              setPageSize(ps);
            },
          }}
        />
      </Card>

      {/* 报表详情Modal */}
      <Modal
        title={selectedReport?.report_name || '报表详情'}
        open={detailModalVisible}
        onCancel={() => setDetailModalVisible(false)}
        width={800}
        footer={null}
      >
        {detailLoading ? (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <Spin size="large" />
          </div>
        ) : selectedReport ? (
          <div>
            {/* 基本信息 */}
            <Descriptions bordered size="small" column={2}>
              <Descriptions.Item label="报表编号">{selectedReport.report_no}</Descriptions.Item>
              <Descriptions.Item label="报表类型">
                <Tag color={getReportTypeColor(selectedReport.report_type)}>
                  {getReportTypeText(selectedReport.report_type)}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="统计周期" span={2}>
                {selectedReport.period_start?.split('T')[0]} ~ {selectedReport.period_end?.split('T')[0]}
              </Descriptions.Item>
              <Descriptions.Item label="生成时间">
                {selectedReport.generated_at ? dayjs(selectedReport.generated_at).format('YYYY-MM-DD HH:mm:ss') : '-'}
              </Descriptions.Item>
              <Descriptions.Item label="生成方式">
                {selectedReport.generated_by === 'system' ? '系统自动' : '手动生成'}
              </Descriptions.Item>
            </Descriptions>

            {/* 数据摘要 */}
            {summary && (
              <Card title="数据摘要" size="small" style={{ marginTop: 16 }}>
                <Row gutter={16}>
                  <Col span={6}>
                    <Statistic title="总订单" value={summary.total_orders} />
                  </Col>
                  <Col span={6}>
                    <Statistic title="完成订单" value={summary.completed_orders} valueStyle={{ color: '#52c41a' }} />
                  </Col>
                  <Col span={6}>
                    <Statistic title="完成率" value={summary.completion_rate?.toFixed(1)} suffix="%" />
                  </Col>
                  <Col span={6}>
                    <Statistic title="总收入" value={formatAmount(summary.total_revenue)} prefix="¥" valueStyle={{ color: '#1890ff' }} />
                  </Col>
                </Row>
                <Row gutter={16} style={{ marginTop: 16 }}>
                  <Col span={6}>
                    <Statistic title="平台费" value={formatAmount(summary.platform_fee)} prefix="¥" />
                  </Col>
                  <Col span={6}>
                    <Statistic title="新增用户" value={summary.new_users} />
                  </Col>
                  <Col span={6}>
                    <Statistic title="告警数" value={summary.alerts_count} valueStyle={{ color: '#faad14' }} />
                  </Col>
                  <Col span={6}>
                    <Statistic title="违规数" value={summary.violations_count} valueStyle={{ color: '#ff4d4f' }} />
                  </Col>
                </Row>
              </Card>
            )}

            {/* 分析建议 */}
            {recommendations && recommendations.length > 0 && (
              <Card title="分析建议" size="small" style={{ marginTop: 16 }}>
                <ul style={{ margin: 0, paddingLeft: 20 }}>
                  {recommendations.map((rec, index) => (
                    <li key={index} style={{ marginBottom: 8, color: '#333' }}>{rec}</li>
                  ))}
                </ul>
              </Card>
            )}
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>暂无数据</div>
        )}
      </Modal>

      {/* 生成报表Modal */}
      <Modal
        title="生成报表"
        open={generateModalVisible}
        onCancel={() => setGenerateModalVisible(false)}
        onOk={handleGenerate}
        confirmLoading={generating}
        okText="生成"
      >
        <div style={{ marginBottom: 16 }}>
          <div style={{ marginBottom: 8, fontWeight: 500 }}>快捷选择：</div>
          <Space>
            <Button size="small" onClick={() => handleQuickGenerate('daily')}>昨日日报</Button>
            <Button size="small" onClick={() => handleQuickGenerate('weekly')}>上周周报</Button>
            <Button size="small" onClick={() => handleQuickGenerate('monthly')}>上月月报</Button>
          </Space>
        </div>
        
        <div style={{ marginBottom: 16 }}>
          <div style={{ marginBottom: 8, fontWeight: 500 }}>报表类型：</div>
          <Select 
            style={{ width: '100%' }} 
            value={generateType}
            onChange={setGenerateType}
          >
            <Option value="daily">日报</Option>
            <Option value="weekly">周报</Option>
            <Option value="monthly">月报</Option>
            <Option value="quarterly">季报</Option>
            <Option value="yearly">年报</Option>
            <Option value="custom">自定义</Option>
          </Select>
        </div>
        
        <div>
          <div style={{ marginBottom: 8, fontWeight: 500 }}>统计周期：</div>
          <RangePicker 
            style={{ width: '100%' }}
            value={generateDates}
            onChange={(dates) => setGenerateDates(dates as [dayjs.Dayjs, dayjs.Dayjs])}
          />
        </div>
      </Modal>
    </div>
  );
};

export default ReportList;
