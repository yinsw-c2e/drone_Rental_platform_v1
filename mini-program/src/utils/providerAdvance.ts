export const getProviderAdvanceConfirmCopy = (label?: string | null) => {
  switch (label) {
    case '确认接单':
      return {
        title: '确认接单',
        content: '确认承接这笔订单？确认后客户会看到服务商已接单，并继续后续支付或履约流程。',
        confirmText: '确认接单',
      };
    case '开始准备':
      return {
        title: '开始准备',
        content: '确认你已到达起吊点、准备装载货物？\n此操作会通知客户"准备中"。可在下一步前撤销。',
        confirmText: '开始准备',
      };
    case '开始飞行':
      return {
        title: '开始飞行',
        content: '确认无人机即将起飞？\n此操作会启动飞行轨迹记录，客户能看到实时位置。',
        confirmText: '开始飞行',
      };
    case '确认送达':
      return {
        title: '确认送达',
        content: '确认货物已送达落放点？\n此操作不可撤销，会触发客户验收流程。',
        confirmText: '确认送达',
      };
    default:
      return null;
  }
};
