import Taro from '@tarojs/taro';
import React from 'react';
import { ScrollView, Text, View } from '@tarojs/components';
import './index.scss';

const SERVICE_WECHAT_ID = 'drone-haul-service';
const SERVICE_HOURS = '09:00-21:00';

const HELP_ITEMS = [
  {
    title: '订单取消',
    desc: '说明订单号和取消原因，平台会协助确认费用和后续安排。',
  },
  {
    title: '暂未接单',
    desc: '客服可帮你检查地址、时间和预算是否影响服务商响应。',
  },
  {
    title: '联系不到对方',
    desc: '提供订单号后，平台会尝试补充联系方式并协助转达。',
  },
  {
    title: '费用争议',
    desc: '请保留现场照片、沟通记录和支付信息，客服会协助核对。',
  },
];

export default function CustomerServicePage() {
  const copyWechatId = () => {
    Taro.setClipboardData({
      data: SERVICE_WECHAT_ID,
      success: () => Taro.showToast({ title: '已复制客服微信', icon: 'success' }),
    });
  };

  const openMessages = () => {
    Taro.switchTab({ url: '/pages/messages/index' });
  };

  return (
    <ScrollView scrollY className='customer-service-page'>
      <View className='service-hero'>
        <Text className='service-eyebrow'>平台客服</Text>
        <Text className='service-title'>订单、退款和履约问题协助</Text>
        <Text className='service-subtitle'>工作时间 {SERVICE_HOURS}，紧急履约问题会优先处理。</Text>
      </View>

      <View className='service-section'>
        <Text className='section-title'>联系方式</Text>
        <View className='contact-panel'>
          <View className='contact-main'>
            <Text className='contact-label'>客服微信</Text>
            <Text className='contact-value'>{SERVICE_WECHAT_ID}</Text>
          </View>
          <View className='copy-button' onClick={copyWechatId}>
            <Text className='copy-button-text'>复制</Text>
          </View>
        </View>
        <View className='message-button' onClick={openMessages}>
          <Text className='message-button-text'>打开消息中心</Text>
        </View>
      </View>

      <View className='service-section'>
        <Text className='section-title'>常见协助</Text>
        {HELP_ITEMS.map((item) => (
          <View key={item.title} className='help-row'>
            <View className='help-dot' />
            <View className='help-main'>
              <Text className='help-title'>{item.title}</Text>
              <Text className='help-desc'>{item.desc}</Text>
            </View>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}
