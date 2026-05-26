# 小程序 P1 残留文案审计

## 扫描命令

```bash
rg -n "飞手|机主|执行人员|派单|待派单|待接派单|待确认派单|协作执行" mini-program/src -S
```

## 当前结论

小程序源码中的用户可见旧三端表达已经清零。历史多人确认相关页面仍保留路由兼容，但页面内容已降级为统一提示，不再加载旧列表、创建、详情或人员关系数据。

## P1 必须优先处理

| 范围 | 代表文件 | 问题 | 处理 |
|------|----------|------|------|
| 入驻页 | `mini-program/src/pages/provider/onboarding/index.tsx` | 仍把服务商拆成设备能力、执行人员能力 | 已改成设备资质和履约资质 |
| 我的页 | `mini-program/src/pages/profile/index.tsx` | 执行人员中心、可接派单、自执行等旧文案 | 已改成服务商资料、履约资质、履约推进 |
| 服务商资料页 | `mini-program/src/pages/profile/owner/index.tsx` | 绑定执行人员、派单、自执行说明 | 已隐藏历史合作入口，文案改服务商自履约 |
| 履约资质页 | `mini-program/src/pages/profile/pilot/index.tsx`、`mini-program/src/pages/pilot/register/index.tsx` | 执行人员档案、执行人员认证、派单任务 | 已改为履约资质兼容页，快捷入口不再指向旧派单任务 |
| 评价页 | `mini-program/src/pages/review/index.tsx` | 评价对象仍显示执行人员 | 已统一为承接方/履约方评价 |
| 登录与通知 | `mini-program/src/pages/auth/login/index.tsx`、`mini-program/src/pages/messages/index.tsx` | 开发账号和通知分组仍展示第三类身份或派单动态 | 已收敛为客户/服务商快速登录、履约动态和资质动态 |
| 空域/合规/需求辅助页 | `mini-program/src/pages/airspace/index.tsx`、`mini-program/src/pages/compliance/index.tsx`、`mini-program/src/pages/profile/my-demands/index.tsx` | 资质提示和候选统计仍使用执行人员/飞手表达 | 已改成履约资质、候选服务商 |

## P1 可降级为兼容页

| 范围 | 代表文件 | 处理 |
|------|----------|------|
| 历史多人确认 | `mini-program/src/pages/dispatch/*` | 已降级为历史履约入口提示页，主导航不再指向 |
| 历史人员关系 | `mini-program/src/pages/owner/bind-pilot/*`、`mini-program/src/pages/pilot/bind-drone/*` | 已降级为历史合作入口提示页；后续如要恢复必须重新设计为服务商内部管理能力 |
| 飞行监控 | `mini-program/src/pages/flight/monitor/index.tsx` | 入口提示已改为订单或履约详情，后续再并入服务商履约推进 |

## 暂不处理

- 代码注释和后端兼容字段中的 `pilot/owner/dispatch`。
- 旧数据库和接口模型。
- App 端同类问题，等小程序 P1 冻结后统一对齐。
