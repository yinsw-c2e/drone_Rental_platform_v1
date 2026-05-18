import React from 'react';
import { Space, Typography } from 'antd';

const { Title, Text } = Typography;

type Props = {
  title: string;
  description?: string;
  extra?: React.ReactNode;
  children: React.ReactNode;
};

const PageContainer: React.FC<Props> = ({ title, description, extra, children }) => (
  <div className="pro-page">
    <div className="pro-page-header">
      <Space direction="vertical" size={2}>
        <Title level={3}>{title}</Title>
        {description ? <Text type="secondary">{description}</Text> : null}
      </Space>
      {extra ? <div className="pro-page-extra">{extra}</div> : null}
    </div>
    {children}
  </div>
);

export default PageContainer;
