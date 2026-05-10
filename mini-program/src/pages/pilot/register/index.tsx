// @ts-nocheck
import Taro from "@tarojs/taro";
import React, { useMemo, useState } from "react";
import { Image, Input, ScrollView, Text, View } from "@tarojs/components";

import StatusBadge from "../../../components/business/StatusBadge";
import DateTimeField from "../../../components/DateTimeField";
import { API_ROOT_URL } from "../../../constants";
import {
  submitCriminalCheck,
  submitHealthCheck,
} from "../../../services/pilot";
import { locationService } from "../../../services/location";
import { pilotV2Service } from "../../../services/pilotV2";
import { uploadFileToEndpoint } from "../../../services/user";
import "./index.scss";

const CAAC_TYPES = [
  { label: "VLOS（视距内）", value: "VLOS" },
  { label: "BVLOS（超视距）", value: "BVLOS" },
  { label: "教员证", value: "instructor" },
];

const skillOptions = [
  "电网吊运",
  "山区运输",
  "应急救援",
  "海岛补给",
  "高原补给",
];

const resolveImageUrl = (url?: string) => {
  const raw = (url || "").trim();
  if (!raw) return "";
  if (/^(https?:|wxfile:|data:|blob:)/i.test(raw)) return raw;
  return `${API_ROOT_URL}${raw.startsWith("/") ? raw : `/${raw}`}`;
};

const pickLocationCity = (...values: any[]) =>
  values
    .map((value) => String(value || "").trim())
    .find(Boolean) || "";

const formatServiceBaseSubtitle = (lat: number, lng: number) => {
  if (!lat || !lng) {
    return "后续派单会以该地点和服务半径计算覆盖范围";
  }
  return `坐标 ${Number(lat).toFixed(5)}, ${Number(lng).toFixed(5)}`;
};

export default function PilotRegisterPage() {
  const [licenseType, setLicenseType] = useState("VLOS");
  const [licenseNo, setLicenseNo] = useState("");
  const [licenseExpireDate, setLicenseExpireDate] = useState("");
  const [licenseImage, setLicenseImage] = useState("");
  const [serviceRadius, setServiceRadius] = useState("50");
  const [currentCity, setCurrentCity] = useState("");
  const [serviceBaseAddress, setServiceBaseAddress] = useState("");
  const [serviceBaseLatitude, setServiceBaseLatitude] = useState(0);
  const [serviceBaseLongitude, setServiceBaseLongitude] = useState(0);
  const [specialSkills, setSpecialSkills] = useState<string[]>(["电网吊运"]);
  const [criminalDoc, setCriminalDoc] = useState("");
  const [healthDoc, setHealthDoc] = useState("");
  const [healthExpireDate, setHealthExpireDate] = useState("");
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false);

  const progress = useMemo(
    () =>
      [licenseNo, licenseExpireDate, licenseImage, serviceBaseAddress].filter(
        Boolean,
      ).length,
    [licenseExpireDate, licenseImage, licenseNo, serviceBaseAddress],
  );

  const chooseAndUpload = async (
    setter: (url: string) => void,
    label: string,
  ) => {
    try {
      const action = await Taro.showActionSheet({
        itemList: ["拍照", "从相册选择"],
      });
      const sourceType = action.tapIndex === 0 ? ["camera"] : ["album"];
      const chooseRes = await Taro.chooseImage({
        count: 1,
        sizeType: ["compressed"],
        sourceType,
      });
      const filePath = chooseRes.tempFilePaths?.[0];
      if (!filePath) {
        return;
      }

      setUploading(true);
      const result = await uploadFileToEndpoint(
        "/pilot/upload-cert",
        filePath,
        "file",
        "v2",
      );
      const uploadedUrl = result?.url || result?.data?.url || "";
      if (!uploadedUrl) {
        throw new Error("上传成功但未返回文件地址，请重试");
      }
      setter(uploadedUrl);
      Taro.showToast({ title: `${label}已上传`, icon: "success" });
    } catch (error: any) {
      if (error?.errMsg?.includes("cancel")) {
        return;
      }
      Taro.showToast({ title: error?.message || "上传失败", icon: "none" });
    } finally {
      setUploading(false);
    }
  };

  const toggleSkill = (skill: string) => {
    setSpecialSkills((prev) =>
      prev.includes(skill)
        ? prev.filter((item) => item !== skill)
        : [...prev, skill],
    );
  };

  const previewImage = (url: string) => {
    const previewUrl = resolveImageUrl(url);
    if (!previewUrl) return;
    Taro.previewImage({
      current: previewUrl,
      urls: [previewUrl],
    });
  };

  const chooseServiceBase = async () => {
    try {
      const res = await Taro.chooseLocation({});
      if (!res?.latitude || !res?.longitude) return;
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
      setCurrentCity(city);
      setServiceBaseAddress(
        (res.address || res.name || "").trim() ||
          `${res.latitude.toFixed(6)}, ${res.longitude.toFixed(6)}`,
      );
      setServiceBaseLatitude(res.latitude);
      setServiceBaseLongitude(res.longitude);
    } catch (error: any) {
      if (!String(error?.errMsg || "").includes("cancel")) {
        Taro.showToast({ title: "无法选择地点，请重试", icon: "none" });
      }
    }
  };

  const handleSubmit = async () => {
    if (!licenseNo.trim()) {
      Taro.showToast({ title: "请输入 CAAC 执照编号", icon: "none" });
      return;
    }
    if (!licenseExpireDate.trim()) {
      Taro.showToast({ title: "请输入执照有效期", icon: "none" });
      return;
    }
    if (!licenseImage) {
      Taro.showToast({ title: "请上传 CAAC 执照照片", icon: "none" });
      return;
    }
    if (!serviceBaseLatitude || !serviceBaseLongitude) {
      Taro.showToast({ title: "请选择服务基准地点", icon: "none" });
      return;
    }

    setLoading(true);
    try {
      await pilotV2Service.upsertProfile({
        caac_license_no: licenseNo.trim(),
        caac_license_type: licenseType,
        caac_license_expire_date: `${licenseExpireDate.trim()}T00:00:00Z`,
        caac_license_image: licenseImage,
        service_radius: Number(serviceRadius) || 50,
        current_city: currentCity.trim(),
        service_base_address: serviceBaseAddress.trim(),
        service_base_latitude: serviceBaseLatitude,
        service_base_longitude: serviceBaseLongitude,
        special_skills: specialSkills,
      });

      if (criminalDoc) {
        try {
          await submitCriminalCheck(criminalDoc);
        } catch {}
      }
      if (healthDoc && healthExpireDate.trim()) {
        try {
          await submitHealthCheck({
            doc_url: healthDoc,
            expire_date: `${healthExpireDate.trim()}T00:00:00Z`,
          });
        } catch {}
      }

      Taro.showModal({
        title: "提交成功",
        content:
          "飞手认证资料已提交，后续可在飞手中心继续管理接单状态和服务范围。",
        showCancel: false,
        success: () => {
          Taro.redirectTo({ url: "/pages/profile/pilot/index" });
        },
      });
    } catch (error: any) {
      Taro.showToast({
        title: error?.message || "提交失败，请稍后重试",
        icon: "none",
      });
    } finally {
      setLoading(false);
    }
  };

  const UploadBlock = ({
    label,
    value,
    required,
    onPick,
    onClear,
  }: {
    label: string;
    value: string;
    required?: boolean;
    onPick: () => void;
    onClear: () => void;
  }) => (
    <View className="pilot-register-field">
      <Text className="pilot-register-label">
        {label}
        {required ? " *" : ""}
      </Text>
      <View
        className={`pilot-register-upload ${value ? "pilot-register-upload-filled" : ""}`}
        onClick={() => (value ? previewImage(value) : onPick())}
      >
        {value ? (
          <>
            <Image
              src={resolveImageUrl(value)}
              className="pilot-register-uploaded-image"
              mode="aspectFill"
            />
            <View className="pilot-register-upload-mask">
              <Text className="pilot-register-upload-status">已上传</Text>
              <Text className="pilot-register-upload-hint">
                点击图片可查看大图
              </Text>
            </View>
          </>
        ) : (
          <View className="pilot-register-upload-placeholder">
            <Text className="pilot-register-upload-plus">
              {uploading ? "..." : "+"}
            </Text>
            <Text className="pilot-register-upload-text">点击上传{label}</Text>
          </View>
        )}
      </View>
      {value ? (
        <View className="pilot-register-upload-actions">
          <View
            className="pilot-register-upload-action"
            onClick={() => previewImage(value)}
          >
            <Text className="pilot-register-upload-action-text">查看</Text>
          </View>
          <View className="pilot-register-upload-action" onClick={onPick}>
            <Text className="pilot-register-upload-action-text">更换</Text>
          </View>
          <View
            className="pilot-register-upload-action pilot-register-upload-action-danger"
            onClick={onClear}
          >
            <Text className="pilot-register-upload-action-danger-text">
              删除
            </Text>
          </View>
        </View>
      ) : null}
    </View>
  );

  return (
    <View className="pilot-register-page">
      <ScrollView scrollY className="pilot-register-scroll">
        <View className="pilot-register-content">
          <View className="pilot-register-hero">
            <View className="pilot-register-hero-top">
              <View className="pilot-register-hero-main">
                <Text className="pilot-register-hero-title">
                  飞手认证与能力设置
                </Text>
                <Text className="pilot-register-hero-subtitle">
                  这里负责建立飞手档案。后续在线状态、服务城市和技能标签都围绕这份档案展开。
                </Text>
              </View>
              <StatusBadge label={`进度 ${progress}/4`} tone="blue" />
            </View>
          </View>

          <View className="pilot-register-section">
            <Text className="pilot-register-section-title">执照信息</Text>

            <View className="pilot-register-field">
              <Text className="pilot-register-label">CAAC 执照类型 *</Text>
              <View className="pilot-register-type-row">
                {CAAC_TYPES.map((type) => {
                  const active = licenseType === type.value;
                  return (
                    <View
                      key={type.value}
                      className={`pilot-register-type-chip ${
                        active ? "pilot-register-type-chip-active" : ""
                      }`}
                      onClick={() => setLicenseType(type.value)}
                    >
                      <Text
                        className={`pilot-register-type-text ${
                          active ? "pilot-register-type-text-active" : ""
                        }`}
                      >
                        {type.label}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </View>

            <View className="pilot-register-field">
              <Text className="pilot-register-label">CAAC 执照编号 *</Text>
              <Input
                className="pilot-register-input"
                placeholder="请输入 CAAC 执照编号"
                value={licenseNo}
                onInput={(e) => setLicenseNo(e.detail.value)}
              />
            </View>

            <DateTimeField
              label="执照有效期"
              value={licenseExpireDate}
              onChange={setLicenseExpireDate}
              mode="date"
              required
            />

            <UploadBlock
              label="CAAC 执照照片"
              value={licenseImage}
              required
              onPick={() => chooseAndUpload(setLicenseImage, "CAAC 执照照片")}
              onClear={() => setLicenseImage("")}
            />
          </View>

          <View className="pilot-register-section">
            <Text className="pilot-register-section-title">接单能力设置</Text>

            <View className="pilot-register-field">
              <Text className="pilot-register-label">服务基准地点 *</Text>
              <View
                className="pilot-register-location-card"
                onClick={chooseServiceBase}
              >
                <View className="pilot-register-location-main">
                  <Text className="pilot-register-location-title">
                    {serviceBaseAddress || "请选择服务半径的中心地点"}
                  </Text>
                  <Text className="pilot-register-location-sub">
                    {formatServiceBaseSubtitle(
                      serviceBaseLatitude,
                      serviceBaseLongitude,
                    )}
                  </Text>
                </View>
                <Text className="pilot-register-location-action">选择</Text>
              </View>
            </View>

            <View className="pilot-register-field">
              <Text className="pilot-register-label">服务半径（公里）</Text>
              <Input
                className="pilot-register-input"
                type="number"
                placeholder="默认 50"
                value={serviceRadius}
                onInput={(e) => setServiceRadius(e.detail.value)}
              />
            </View>

            <View className="pilot-register-field">
              <Text className="pilot-register-label">技能标签</Text>
              <View className="pilot-register-skill-row">
                {skillOptions.map((skill) => {
                  const active = specialSkills.includes(skill);
                  return (
                    <View
                      key={skill}
                      className={`pilot-register-skill-chip ${
                        active ? "pilot-register-skill-chip-active" : ""
                      }`}
                      onClick={() => toggleSkill(skill)}
                    >
                      <Text
                        className={`pilot-register-skill-text ${
                          active ? "pilot-register-skill-text-active" : ""
                        }`}
                      >
                        {skill}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </View>
          </View>

          <View className="pilot-register-section">
            <View className="pilot-register-section-header">
              <Text className="pilot-register-section-title">补充材料</Text>
              <Text className="pilot-register-section-desc">
                这些材料有助于提高审核通过率。
              </Text>
            </View>

            <UploadBlock
              label="无犯罪记录证明"
              value={criminalDoc}
              onPick={() => chooseAndUpload(setCriminalDoc, "无犯罪记录证明")}
              onClear={() => setCriminalDoc("")}
            />
            <UploadBlock
              label="健康证明"
              value={healthDoc}
              onPick={() => chooseAndUpload(setHealthDoc, "健康证明")}
              onClear={() => setHealthDoc("")}
            />
            <DateTimeField
              label="健康证明有效期"
              value={healthExpireDate}
              onChange={setHealthExpireDate}
              mode="date"
            />
          </View>

          <View
            className={`pilot-register-submit-btn ${
              loading || uploading ? "pilot-register-submit-btn-disabled" : ""
            }`}
            onClick={handleSubmit}
          >
            <Text className="pilot-register-submit-text">
              {loading ? "提交中..." : "提交飞手认证"}
            </Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
