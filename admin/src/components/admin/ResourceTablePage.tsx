import React, { useEffect, useMemo, useState } from 'react';
import { Button, Card, DatePicker, Descriptions, Drawer, Empty, Form, Input, Select, Space, Table, message } from 'antd';
import { ExportOutlined, EyeOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import PageContainer from './PageContainer';
import { exportCsv, formatValue } from '../../utils/business';

export type ResourceFilter = {
  key: string;
  label: string;
  type?: 'input' | 'select' | 'date';
  options?: Array<{ label: string; value: string | number | boolean }>;
  placeholder?: string;
};

export type RowAction<T> = {
  label: string;
  danger?: boolean;
  disabled?: (record: T) => boolean;
  onClick: (record: T, reload: () => void) => void | Promise<void>;
};

export type ResourceTableExtraContext<T extends Record<string, any>> = {
  items: T[];
  query: Record<string, any>;
  page: number;
  pageSize: number;
  loading: boolean;
  reload: () => void;
};

type Props<T extends Record<string, any>> = {
  title: string;
  description?: string;
  rowKey?: string;
  fetcher: (params: Record<string, any>) => Promise<any>;
  columns: ColumnsType<T>;
  filters?: ResourceFilter[];
  actions?: RowAction<T>[];
  extraActions?: (context: ResourceTableExtraContext<T>) => React.ReactNode;
  detailTitle?: (record: T) => string;
};

const extractList = (res: any) => {
  const data = res?.data;
  if (Array.isArray(data)) return { list: data, total: res?.total || data.length };
  if (Array.isArray(data?.list)) return { list: data.list, total: data.total || data.list.length };
  if (Array.isArray(res?.list)) return { list: res.list, total: res.total || res.list.length };
  return { list: [], total: 0 };
};

const normalizeQueryValue = (value: any) => {
  if (value && typeof value === 'object' && typeof value.format === 'function') {
    return value.format('YYYY-MM-DD');
  }
  return value;
};

const compactQuery = (values: Record<string, any>) =>
  Object.fromEntries(
    Object.entries(values)
      .map(([key, value]) => [key, normalizeQueryValue(value)])
      .filter(([, value]) => value !== undefined && value !== null && value !== '')
  );

function ResourceTablePage<T extends Record<string, any>>({
  title,
  description,
  rowKey = 'id',
  fetcher,
  columns,
  filters = [],
  actions = [],
  extraActions,
  detailTitle,
}: Props<T>) {
  const [form] = Form.useForm();
  const [items, setItems] = useState<T[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState<Record<string, any>>({});
  const [detail, setDetail] = useState<T | null>(null);

  const load = async (nextPage = page, nextPageSize = pageSize, nextQuery = query) => {
    setLoading(true);
    try {
      const res = await fetcher({
        page: nextPage,
        page_size: nextPageSize,
        ...compactQuery(nextQuery),
      });
      const { list, total: nextTotal } = extractList(res);
      setItems(list);
      setTotal(nextTotal);
    } catch (error: any) {
      message.error(error?.message || '列表加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(page, pageSize, query);
  }, [page, pageSize, query]);

  const tableColumns = useMemo<ColumnsType<T>>(() => {
    const actionColumn: ColumnsType<T>[number] = {
      title: '操作',
      key: 'actions',
      width: actions.length ? Math.max(170, 72 + actions.length * 58) : 72,
      fixed: 'right',
      render: (_, record) => (
        <Space size={4}>
          <Button type="text" icon={<EyeOutlined />} onClick={() => setDetail(record)} />
          {actions.map(action => (
            <Button
              key={action.label}
              type="link"
              danger={action.danger}
              disabled={action.disabled?.(record)}
              onClick={() => action.onClick(record, () => load(page, pageSize, query))}
            >
              {action.label}
            </Button>
          ))}
        </Space>
      ),
    };
    return [...columns, actionColumn];
  }, [columns, actions, page, pageSize, query]);

  const onSearch = () => {
    const values = compactQuery(form.getFieldsValue());
    setPage(1);
    setQuery(values);
  };

  const onReset = () => {
    form.resetFields();
    setPage(1);
    setQuery({});
  };

  const reload = () => load(page, pageSize, query);

  return (
    <PageContainer
      title={title}
      description={description}
      extra={
        <Space>
          {extraActions?.({ items, query, page, pageSize, loading, reload })}
          <Button icon={<ReloadOutlined />} onClick={reload}>刷新</Button>
          <Button icon={<ExportOutlined />} onClick={() => exportCsv(`${title}.csv`, items)} disabled={!items.length}>导出</Button>
        </Space>
      }
    >
      {filters.length ? (
        <Card className="pro-filter-card" bordered={false}>
          <Form form={form} layout="inline" onFinish={onSearch}>
            {filters.map(filter => (
              <Form.Item key={filter.key} name={filter.key} label={filter.label}>
                {filter.type === 'select' ? (
                  <Select allowClear placeholder={filter.placeholder || '全部'} options={filter.options} style={{ width: 160 }} />
                ) : filter.type === 'date' ? (
                  <DatePicker allowClear format="YYYY-MM-DD" placeholder={filter.placeholder || '选择日期'} style={{ width: 160 }} />
                ) : (
                  <Input allowClear placeholder={filter.placeholder || `请输入${filter.label}`} style={{ width: 220 }} />
                )}
              </Form.Item>
            ))}
            <Form.Item>
              <Space>
                <Button type="primary" htmlType="submit" icon={<SearchOutlined />}>筛选</Button>
                <Button onClick={onReset}>重置</Button>
              </Space>
            </Form.Item>
          </Form>
        </Card>
      ) : null}

      <Card bordered={false}>
        <Table<T>
          rowKey={record => String(record[rowKey] ?? record.id)}
          columns={tableColumns}
          dataSource={items}
          loading={loading}
          size="middle"
          scroll={{ x: 1200 }}
          locale={{ emptyText: <Empty description="暂无数据" /> }}
          pagination={{
            current: page,
            pageSize,
            total,
            showSizeChanger: true,
            showTotal: value => `共 ${value} 条`,
            onChange: (nextPage, nextSize) => {
              setPage(nextPage);
              setPageSize(nextSize);
            },
          }}
        />
      </Card>

      <Drawer
        title={detail ? detailTitle?.(detail) || `${title}详情` : ''}
        open={!!detail}
        onClose={() => setDetail(null)}
        width={720}
      >
        {detail ? (
          <Descriptions column={1} bordered size="small">
            {Object.entries(detail).map(([key, value]) => (
              <Descriptions.Item key={key} label={key}>
                {formatValue(value)}
              </Descriptions.Item>
            ))}
          </Descriptions>
        ) : null}
      </Drawer>
    </PageContainer>
  );
}

export default ResourceTablePage;
