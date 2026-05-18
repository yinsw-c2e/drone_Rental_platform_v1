import React from 'react';
import { Tag } from 'antd';
import { getStatusMeta } from '../../utils/business';

type Props = {
  status?: string;
};

const StatusTag: React.FC<Props> = ({ status }) => {
  const meta = getStatusMeta(status);
  return <Tag color={meta.color}>{meta.text}</Tag>;
};

export default StatusTag;
