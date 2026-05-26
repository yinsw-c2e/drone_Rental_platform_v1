import Taro from '@tarojs/taro';
import React from 'react';
import ProviderAccessNotice from '../../../components/business/ProviderAccessNotice';

export default function CreateDispatchPage() {
  const params = Taro.getCurrentInstance().router?.params || {};
  const orderId = Number(params.orderId || 0);

  const openTarget = () => {
    if (orderId) {
      Taro.redirectTo({ url: `/pages/fulfillment/hub/index?orderId=${orderId}` }).catch(() => {
        Taro.switchTab({ url: '/pages/orders/index' });
      });
      return;
    }
    Taro.switchTab({ url: '/pages/orders/index' });
  };

  return (
    <ProviderAccessNotice
      title="历史履约入口已暂停"
      description="当前小程序主流程为服务商主体接单并自行推进履约，不再从这里安排其他账号确认。请回到履约订单继续处理。"
      actionText={orderId ? '进入履约安排' : '查看履约订单'}
      onAction={openTarget}
    />
  );
}
