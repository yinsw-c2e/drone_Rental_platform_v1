-- 131_add_users_preferred_mode.sql
-- 落库用户在小程序双端模式下选择的意向身份(我要吊运 customer / 我要接单 provider)。
-- 用于管理端做需求/供给两端的运营分群,以及小程序登录态恢复时返回上次选择。
-- 仅记录用户意向,不替代 role_summary 的能力位口径。

ALTER TABLE users
    ADD COLUMN preferred_mode VARCHAR(20) NULL COMMENT '用户在小程序选择的意向身份: customer/provider';

CREATE INDEX idx_users_preferred_mode ON users (preferred_mode);
