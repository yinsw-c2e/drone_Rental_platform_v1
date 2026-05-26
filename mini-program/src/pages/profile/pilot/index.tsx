// @ts-nocheck
import Taro, { useDidShow } from "@tarojs/taro";
import React, { useCallback, useRef, useState } from "react";
import { Input, ScrollView, Switch, Text, View } from "@tarojs/components";

import StatusBadge from "../../../components/business/StatusBadge";
import { locationService } from "../../../services/location";
import { orderV2Service } from "../../../services/orderV2";
import { pilotV2Service } from "../../../services/pilotV2";
import {
  aggregateFlightRecords,
  formatHoursFromSeconds,
} from "../../../utils/flightRecords";
import "./index.scss";

const STATUS_MAP = {
  verified: { label: "已完善", tone: "green" },
  approved: { label: "已完善", tone: "green" },
  pending: { label: "审核中", tone: "orange" },
  rejected: { label: "未通过", tone: "red" },
  unverified: { label: "待完善", tone: "gray" },
};

const availabilityMap = {
  online: { label: "可履约", tone: "green" },
  available: { label: "可履约", tone: "green" },
  busy: { label: "忙碌中", tone: "orange" },
  offline: { label: "离线", tone: "gray" },
};

const skillOptions = [
  "电网吊运",
  "山区运输",
  "应急救援",
  "海岛补给",
  "高原补给",
];

const parseSkills = (skills: any): string[] => {
  if (Array.isArray(skills)) {
    return skills.filter(Boolean).map(String);
  }
  return [];
};

const buildDraftFromProfile = (profile: any) => ({
  current_city: profile.current_city || "",
  service_radius: String(
    profile.service_radius_km ||
      Math.round(profile.service_radius || 50) ||
      50,
  ),
  service_base_address: profile.service_base_address || "",
  service_base_latitude: Number(profile.service_base_latitude || 0),
  service_base_longitude: Number(profile.service_base_longitude || 0),
  special_skills: parseSkills(profile.special_skills),
});

const pickLocationCity = (...values: any[]) =>
  values
    .map((value) => String(value || "").trim())
    .find(Boolean) || "";

const formatServiceBaseSubtitle = (lat: number, lng: number) => {
  if (!lat || !lng) {
    return "履约覆盖会从该地点开始计算服务距离";
  }
  return `坐标 ${Number(lat).toFixed(5)}, ${Number(lng).toFixed(5)}`;
};

export default function PilotProfilePage() {
  const [pilot, setPilot] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState({
    current_city: "",
    service_radius: "50",
    service_base_address: "",
    service_base_latitude: 0,
    service_base_longitude: 0,
    special_skills: [] as string[],
  });
  const [flightStats, setFlightStats] = useState({
    totalFlights: 0,
    totalDurationSeconds: 0,
    totalDistanceM: 0,
    maxAltitudeM: 0,
  });
  const [fulfillmentStats, setFulfillmentStats] = useState({ waiting: 0, active: 0 });
  const draftDirtyRef = useRef(false);
  const skipNextShowReloadRef = useRef(false);

  const loadData = useCallback(async () => {
    try {
      const [profileRes, flightRecords, orderRes] = await Promise.all([
        pilotV2Service.getProfile().catch(() => null),
        pilotV2Service.listAllFlightRecords({ page_size: 50 }).catch(() => []),
        orderV2Service.list({ role: "owner", page: 1, page_size: 50 }).catch(() => null),
      ]);

      setPilot(profileRes || null);
      if (profileRes && !draftDirtyRef.current) {
        setDraft(buildDraftFromProfile(profileRes));
      }

      setFlightStats(aggregateFlightRecords(flightRecords || []));

      const orderItems = orderRes?.items || [];
      setFulfillmentStats({
        waiting: orderItems.filter((item: any) =>
          ["pending_dispatch", "paid"].includes(item.status),
        ).length,
        active: orderItems.filter((item: any) =>
          ["assigned", "preparing", "in_transit", "in_progress"].includes(item.status),
        ).length,
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useDidShow(() => {
    if (skipNextShowReloadRef.current) {
      skipNextShowReloadRef.current = false;
      return;
    }
    loadData();
  });

  const onRefresh = () => {
    setRefreshing(true);
    draftDirtyRef.current = false;
    loadData();
  };

  const toggleSkill = (skill: string) => {
    draftDirtyRef.current = true;
    setDraft((prev) => ({
      ...prev,
      special_skills: prev.special_skills.includes(skill)
        ? prev.special_skills.filter((item) => item !== skill)
        : [...prev.special_skills, skill],
    }));
  };

  const toggleAvailability = async (enabled: boolean) => {
    if (!pilot) {
      return;
    }
    if (
      enabled &&
      (!draft.service_base_latitude || !draft.service_base_longitude)
    ) {
      Taro.showToast({ title: "请先设置服务基准地点", icon: "none" });
      return;
    }
    try {
      const nextProfile = await pilotV2Service.updateAvailability(
        enabled ? "online" : "offline",
      );
      setPilot(nextProfile);
    } catch (error: any) {
      Taro.showToast({ title: error?.message || "更新失败", icon: "none" });
    }
  };

  const chooseServiceBase = async () => {
    try {
      skipNextShowReloadRef.current = true;
      const res = await Taro.chooseLocation({});
      if (!res?.latitude || !res?.longitude) {
        return;
      }
      const address = (res.address || res.name || "").trim();
      let city = "";
      try {
        const geo: any = await locationService.reverseGeoCode(
          res.longitude,
          res.latitude,
        );
        const geoData = geo?.data || geo;
        city = pickLocationCity(
          geoData?.city,
          geoData?.district,
          geoData?.province,
        );
      } catch {}
      draftDirtyRef.current = true;
      setDraft((prev) => ({
        ...prev,
        current_city: city,
        service_base_address:
          address || `${res.latitude.toFixed(6)}, ${res.longitude.toFixed(6)}`,
        service_base_latitude: res.latitude,
        service_base_longitude: res.longitude,
      }));
    } catch (error: any) {
      if (!String(error?.errMsg || "").includes("cancel")) {
        Taro.showToast({ title: "无法选择地点，请重试", icon: "none" });
      }
    }
  };

  const handleSave = async () => {
    if (!pilot) {
      return;
    }
    if (!draft.service_base_latitude || !draft.service_base_longitude) {
      Taro.showToast({ title: "请选择服务基准地点", icon: "none" });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        current_city: draft.current_city.trim(),
        service_radius: Number(draft.service_radius) || 50,
        service_base_address: draft.service_base_address.trim(),
        service_base_latitude: draft.service_base_latitude,
        service_base_longitude: draft.service_base_longitude,
        special_skills: draft.special_skills,
      };
      const nextProfile = await pilotV2Service.upsertProfile(payload);
      const savedProfile = {
        ...nextProfile,
        current_city: payload.current_city,
        service_radius: payload.service_radius,
        service_radius_km: payload.service_radius,
        service_base_address: payload.service_base_address,
        service_base_latitude: payload.service_base_latitude,
        service_base_longitude: payload.service_base_longitude,
        special_skills: payload.special_skills,
      };
      draftDirtyRef.current = false;
      setPilot(savedProfile);
      setDraft(buildDraftFromProfile(savedProfile));
      Taro.showToast({ title: "履约资质设置已更新", icon: "success" });
    } catch (error: any) {
      Taro.showToast({
        title: error?.message || "保存失败，请稍后重试",
        icon: "none",
      });
    } finally {
      setSaving(false);
    }
  };

  const verificationStatus =
    STATUS_MAP[pilot?.verification_status || "unverified"] ||
    STATUS_MAP.unverified;
  const availabilityStatus =
    availabilityMap[pilot?.availability_status || "offline"] ||
    availabilityMap.offline;
  const eligibility = pilot?.eligibility;
  const readinessTone =
    eligibility?.tier === "dispatch_ready"
      ? "green"
      : eligibility?.tier === "candidate_ready" ||
          eligibility?.tier === "verified_offline"
        ? "orange"
        : eligibility?.tier === "needs_resubmission"
          ? "red"
          : "gray";
  const canUpdateAvailability =
    eligibility?.can_update_availability ??
    ["verified", "approved"].includes(pilot?.verification_status || "");
  const isOnline = ["online", "available"].includes(
    pilot?.availability_status || "offline",
  );

  if (loading) {
    return (
      <View className="pilot-wrap">
        <View className="pilot-loading">
          <Text className="pilot-loading-text">履约资质加载中...</Text>
        </View>
      </View>
    );
  }

  if (!pilot) {
    return (
      <View className="pilot-wrap">
        <View className="pilot-empty">
          <Text className="pilot-empty-title">还没有履约资质</Text>
          <Text className="pilot-empty-desc">
            先完成履约资质认证，后面这里才会出现服务范围和飞行统计。
          </Text>
          <View
            className="pilot-empty-btn"
            onClick={() =>
              Taro.navigateTo({ url: "/pages/pilot/register/index" })
            }
          >
            <Text className="pilot-empty-btn-text">去完善履约资质</Text>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View className="pilot-wrap">
      <ScrollView
        scrollY
        className="pilot-scroll"
        refresherEnabled
        refresherTriggered={refreshing}
        onRefresherRefresh={onRefresh}
      >
        <View className="pilot-content">
          <View className="pilot-hero">
            <View className="pilot-hero-top">
              <View>
                <Text className="pilot-hero-title">履约资质</Text>
                <Text className="pilot-hero-sub">执照、服务范围与飞行统计</Text>
              </View>
              <StatusBadge
                label={availabilityStatus.label}
                tone={availabilityStatus.tone}
              />
            </View>

            <View className="pilot-stats-grid">
              <View className="pilot-stat-card">
                <Text className="pilot-stat-value">
                  {fulfillmentStats.waiting}
                </Text>
                <Text className="pilot-stat-label">待开始</Text>
              </View>
              <View className="pilot-stat-card">
                <Text className="pilot-stat-value">{fulfillmentStats.active}</Text>
                <Text className="pilot-stat-label">进行中</Text>
              </View>
              <View className="pilot-stat-card">
                <Text className="pilot-stat-value">
                  {flightStats.totalFlights}
                </Text>
                <Text className="pilot-stat-label">总飞行</Text>
              </View>
              <View className="pilot-stat-card">
                <Text className="pilot-stat-value">
                  {formatHoursFromSeconds(flightStats.totalDurationSeconds)}
                </Text>
                <Text className="pilot-stat-label">飞行时数</Text>
              </View>
            </View>
          </View>

          <View className="pilot-section">
            <Text className="pilot-section-title">履约准入状态</Text>
            <View className="pilot-readiness-card">
              <View className="pilot-readiness-header">
                <View className="pilot-readiness-main">
                  <Text className="pilot-readiness-title">
                    {eligibility?.label || verificationStatus.label}
                  </Text>
                  <Text className="pilot-readiness-desc">
                    {eligibility?.recommended_next_step ||
                      "完善资料以获得更多权限"}
                  </Text>
                </View>
                <StatusBadge
                  label={
                    eligibility?.tier === "dispatch_ready" ? "已就绪" : "待达标"
                  }
                  tone={readinessTone}
                />
              </View>

              {eligibility?.blockers?.length ? (
                <View className="pilot-blocker-box">
                  <Text className="pilot-blocker-title">
                    需要处理以下事项：
                  </Text>
                  {eligibility.blockers.map((blocker: any) => (
                    <Text
                      key={blocker.code || blocker.message}
                      className="pilot-blocker-item"
                    >
                      • {blocker.message}
                    </Text>
                  ))}
                </View>
              ) : null}
            </View>
          </View>

          <View className="pilot-section">
            <View className="pilot-section-header">
              <Text className="pilot-section-title">履约状态</Text>
              <StatusBadge
                label={verificationStatus.label}
                tone={verificationStatus.tone}
              />
            </View>

            <View className="pilot-availability-row">
              <View className="pilot-availability-main">
                <Text className="pilot-availability-label">当前是否可履约</Text>
                <Text className="pilot-availability-desc">
                  资质完善后可切换在线状态，平台会据此判断服务商履约可用性。
                </Text>
              </View>
              <Switch
                checked={isOnline}
                color="#2563EB"

                onChange={(e) => toggleAvailability(!!e.detail.value)}
              />
            </View>
          </View>

          <View className="pilot-section">
            <Text className="pilot-section-title">快捷入口</Text>
            <View className="pilot-quick-grid">
              <View
                className="pilot-quick-card"
                onClick={() =>
                  Taro.switchTab({ url: "/pages/orders/index" })
                }
              >
                <Text className="pilot-quick-icon">📮</Text>
                <Text className="pilot-quick-title">履约订单</Text>
              </View>
              <View
                className="pilot-quick-card"
                onClick={() =>
                  Taro.navigateTo({ url: "/pages/flight/records/index" })
                }
              >
                <Text className="pilot-quick-icon">📈</Text>
                <Text className="pilot-quick-title">飞行记录</Text>
              </View>
              <View
                className="pilot-quick-card"
                onClick={() =>
                  Taro.navigateTo({ url: "/pages/profile/owner/index" })
                }
              >
                <Text className="pilot-quick-icon">🧭</Text>
                <Text className="pilot-quick-title">服务商档案</Text>
              </View>
              <View
                className="pilot-quick-card"
                onClick={() =>
                  Taro.navigateTo({ url: "/pages/profile/drones/index" })
                }
              >
                <Text className="pilot-quick-icon">🚁</Text>
                <Text className="pilot-quick-title">设备资质</Text>
              </View>
            </View>
          </View>

          <View className="pilot-section">
            <Text className="pilot-section-title">服务设置</Text>

            <Text className="pilot-label">服务基准地点</Text>
            <View className="pilot-location-card" onClick={chooseServiceBase}>
              <View className="pilot-location-main">
                <Text className="pilot-location-title">
                  {draft.service_base_address || "请选择服务半径的中心地点"}
                </Text>
                <Text className="pilot-location-sub">
                  {formatServiceBaseSubtitle(
                    draft.service_base_latitude,
                    draft.service_base_longitude,
                  )}
                </Text>
              </View>
              <Text className="pilot-location-arrow">选择</Text>
            </View>

            <Text className="pilot-label">服务半径（公里）</Text>
            <Input
              className="pilot-input"
              type="number"
              placeholder="默认 50"
              value={draft.service_radius}
              onInput={(e) => {
                draftDirtyRef.current = true;
                setDraft((prev) => ({
                  ...prev,
                  service_radius: e.detail.value,
                }));
              }}
            />

            <Text className="pilot-label">技能标签</Text>
            <View className="pilot-skill-row">
              {skillOptions.map((skill) => {
                const active = draft.special_skills.includes(skill);
                return (
                  <View
                    key={skill}
                    className={`pilot-skill-chip ${active ? "pilot-skill-chip-active" : ""}`}
                    onClick={() => toggleSkill(skill)}
                  >
                    <Text
                      className={`pilot-skill-text ${active ? "pilot-skill-text-active" : ""}`}
                    >
                      {skill}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>

          <View
            className={`pilot-save-btn ${saving ? "pilot-save-disabled" : ""}`}
            onClick={handleSave}
          >
            <Text className="pilot-save-text">
              {saving ? "保存中..." : "保存履约设置"}
            </Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
