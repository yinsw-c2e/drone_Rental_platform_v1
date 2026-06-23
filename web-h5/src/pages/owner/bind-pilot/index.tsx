import Taro from '@tarojs/taro';
import React from 'react';
import ProviderAccessNotice from '../../../components/business/ProviderAccessNotice';

export default function BindPilotPage() {
  return (
    <ProviderAccessNotice
      title="历史合作入口已暂停"
      description="当前小程序主流程不再维护单独的人员绑定关系。服务商完成资质后直接接单并推进履约。"
      actionText="查看服务商资料"
      onAction={() => Taro.navigateTo({ url: '/pages/profile/owner/index' })}
    />
  );
}
