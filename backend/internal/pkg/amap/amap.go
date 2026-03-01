package amap

import (
	"crypto/tls"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"time"

	"go.uber.org/zap"
)

// FlexString 处理高德API中可能为字符串或空数组的字段
// 例如直辖市的city字段返回[]而非""
type FlexString string

func (f *FlexString) UnmarshalJSON(data []byte) error {
	// 尝试解析为字符串
	var s string
	if err := json.Unmarshal(data, &s); err == nil {
		*f = FlexString(s)
		return nil
	}
	// 如果不是字符串（比如空数组[]），则设为空字符串
	*f = ""
	return nil
}

func (f FlexString) String() string {
	return string(f)
}

// AmapService 高德地图服务
type AmapService struct {
	apiKey string
	client *http.Client
	logger *zap.Logger
}

// NewAmapService 创建高德地图服务实例
func NewAmapService(apiKey string, logger *zap.Logger) *AmapService {
	// 创建自定义HTTP客户端,配置TLS以解决证书验证问题
	transport := &http.Transport{
		TLSClientConfig: &tls.Config{
			// 对于高德API,使用系统证书池但增加容错性
			MinVersion: tls.VersionTLS12,
		},
		MaxIdleConns:        100,
		MaxIdleConnsPerHost: 10,
		IdleConnTimeout:     90 * time.Second,
	}

	return &AmapService{
		apiKey: apiKey,
		client: &http.Client{
			Timeout:   15 * time.Second, // 增加超时时间
			Transport: transport,
		},
		logger: logger,
	}
}

// IsEnabled 检查高德地图服务是否已配置
func (s *AmapService) IsEnabled() bool {
	return s.apiKey != ""
}

// ============================================================
// 地理编码 - 地址转坐标
// ============================================================

// GeoCodeResult 地理编码结果
type GeoCodeResult struct {
	FormattedAddress string  `json:"formatted_address"`
	Province         string  `json:"province"`
	City             string  `json:"city"`
	District         string  `json:"district"`
	Longitude        float64 `json:"longitude"`
	Latitude         float64 `json:"latitude"`
}

// GeoCode 地理编码：地址 -> 坐标
func (s *AmapService) GeoCode(address, city string) ([]GeoCodeResult, error) {
	if !s.IsEnabled() {
		return nil, fmt.Errorf("amap service not configured")
	}

	params := url.Values{}
	params.Set("key", s.apiKey)
	params.Set("address", address)
	params.Set("output", "JSON")
	if city != "" {
		params.Set("city", city)
	}

	resp, err := s.client.Get("https://restapi.amap.com/v3/geocode/geo?" + params.Encode())
	if err != nil {
		s.logger.Error("amap geocode request failed", zap.Error(err))
		return nil, fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("read response failed: %w", err)
	}

	var result struct {
		Status   string `json:"status"`
		Info     string `json:"info"`
		Geocodes []struct {
			FormattedAddress string `json:"formatted_address"`
			Province         string `json:"province"`
			City             string `json:"city"`
			District         string `json:"district"`
			Location         string `json:"location"` // "lng,lat"
		} `json:"geocodes"`
	}

	if err := json.Unmarshal(body, &result); err != nil {
		return nil, fmt.Errorf("parse response failed: %w", err)
	}

	if result.Status != "1" {
		return nil, fmt.Errorf("amap error: %s", result.Info)
	}

	var results []GeoCodeResult
	for _, geo := range result.Geocodes {
		var lng, lat float64
		fmt.Sscanf(geo.Location, "%f,%f", &lng, &lat)
		results = append(results, GeoCodeResult{
			FormattedAddress: geo.FormattedAddress,
			Province:         geo.Province,
			City:             geo.City,
			District:         geo.District,
			Longitude:        lng,
			Latitude:         lat,
		})
	}

	return results, nil
}

// ============================================================
// 逆地理编码 - 坐标转地址
// ============================================================

// ReverseGeoResult 逆地理编码结果
type ReverseGeoResult struct {
	FormattedAddress string `json:"formatted_address"`
	Province         string `json:"province"`
	City             string `json:"city"`
	District         string `json:"district"`
	Township         string `json:"township"`
	Street           string `json:"street"`
	Number           string `json:"number"`
}

// ReverseGeoCode 逆地理编码：坐标 -> 地址
func (s *AmapService) ReverseGeoCode(longitude, latitude float64) (*ReverseGeoResult, error) {
	if !s.IsEnabled() {
		return nil, fmt.Errorf("amap service not configured")
	}

	location := fmt.Sprintf("%.6f,%.6f", longitude, latitude)
	params := url.Values{}
	params.Set("key", s.apiKey)
	params.Set("location", location)
	params.Set("output", "JSON")
	params.Set("extensions", "base")

	resp, err := s.client.Get("https://restapi.amap.com/v3/geocode/regeo?" + params.Encode())
	if err != nil {
		s.logger.Error("amap reverse geocode failed", zap.Error(err))
		return nil, fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("read response failed: %w", err)
	}

	var result struct {
		Status    string `json:"status"`
		Info      string `json:"info"`
		ReGeocode struct {
			FormattedAddress string `json:"formatted_address"`
			AddressComponent struct {
				Province     FlexString `json:"province"`
				City         FlexString `json:"city"`
				District     FlexString `json:"district"`
				Township     FlexString `json:"township"`
				StreetNumber struct {
					Street FlexString `json:"street"`
					Number FlexString `json:"number"`
				} `json:"streetNumber"`
			} `json:"addressComponent"`
		} `json:"regeocode"`
	}

	if err := json.Unmarshal(body, &result); err != nil {
		return nil, fmt.Errorf("parse response failed: %w", err)
	}

	if result.Status != "1" {
		return nil, fmt.Errorf("amap error: %s", result.Info)
	}

	addr := result.ReGeocode
	cityStr := addr.AddressComponent.City.String()
	// 高德API中直辖市city可能为空数组[]
	if cityStr == "" {
		cityStr = addr.AddressComponent.Province.String()
	}

	return &ReverseGeoResult{
		FormattedAddress: addr.FormattedAddress,
		Province:         addr.AddressComponent.Province.String(),
		City:             cityStr,
		District:         addr.AddressComponent.District.String(),
		Township:         addr.AddressComponent.Township.String(),
		Street:           addr.AddressComponent.StreetNumber.Street.String(),
		Number:           addr.AddressComponent.StreetNumber.Number.String(),
	}, nil
}

// ============================================================
// POI搜索 - 兴趣点搜索
// ============================================================

// POIResult POI搜索结果
type POIResult struct {
	Name      string  `json:"name"`
	Address   string  `json:"address"`
	Province  string  `json:"province"`
	City      string  `json:"city"`
	District  string  `json:"district"`
	Longitude float64 `json:"longitude"`
	Latitude  float64 `json:"latitude"`
	Type      string  `json:"type"`
	Distance  string  `json:"distance"`
}

// SearchPOI 关键词搜索POI
func (s *AmapService) SearchPOI(keyword, city string, page, pageSize int) ([]POIResult, int, error) {
	if !s.IsEnabled() {
		return nil, 0, fmt.Errorf("amap service not configured")
	}

	params := url.Values{}
	params.Set("key", s.apiKey)
	params.Set("keywords", keyword)
	params.Set("output", "JSON")
	params.Set("offset", fmt.Sprintf("%d", pageSize))
	params.Set("page", fmt.Sprintf("%d", page))
	if city != "" {
		params.Set("city", city)
	}

	resp, err := s.client.Get("https://restapi.amap.com/v3/place/text?" + params.Encode())
	if err != nil {
		s.logger.Error("amap poi search failed", zap.Error(err))
		return nil, 0, fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, 0, fmt.Errorf("read response failed: %w", err)
	}

	var result struct {
		Status string `json:"status"`
		Info   string `json:"info"`
		Count  string `json:"count"`
		POIs   []struct {
			Name     FlexString `json:"name"`
			Address  FlexString `json:"address"`
			Province FlexString `json:"pname"`
			City     FlexString `json:"cityname"`
			District FlexString `json:"adname"`
			Location FlexString `json:"location"`
			Type     FlexString `json:"type"`
			Distance FlexString `json:"distance"`
		} `json:"pois"`
	}

	if err := json.Unmarshal(body, &result); err != nil {
		return nil, 0, fmt.Errorf("parse response failed: %w", err)
	}

	if result.Status != "1" {
		return nil, 0, fmt.Errorf("amap error: %s", result.Info)
	}

	var total int
	fmt.Sscanf(result.Count, "%d", &total)

	var pois []POIResult
	for _, p := range result.POIs {
		var lng, lat float64
		fmt.Sscanf(p.Location.String(), "%f,%f", &lng, &lat)
		pois = append(pois, POIResult{
			Name:      p.Name.String(),
			Address:   p.Address.String(),
			Province:  p.Province.String(),
			City:      p.City.String(),
			District:  p.District.String(),
			Longitude: lng,
			Latitude:  lat,
			Type:      p.Type.String(),
			Distance:  p.Distance.String(),
		})
	}

	return pois, total, nil
}

// SearchNearby 周边搜索POI
func (s *AmapService) SearchNearby(longitude, latitude float64, radius int, keyword string, page, pageSize int) ([]POIResult, int, error) {
	if !s.IsEnabled() {
		return nil, 0, fmt.Errorf("amap service not configured")
	}

	location := fmt.Sprintf("%.6f,%.6f", longitude, latitude)
	params := url.Values{}
	params.Set("key", s.apiKey)
	params.Set("location", location)
	params.Set("radius", fmt.Sprintf("%d", radius))
	params.Set("output", "JSON")
	params.Set("offset", fmt.Sprintf("%d", pageSize))
	params.Set("page", fmt.Sprintf("%d", page))
	if keyword != "" {
		params.Set("keywords", keyword)
	}

	resp, err := s.client.Get("https://restapi.amap.com/v3/place/around?" + params.Encode())
	if err != nil {
		s.logger.Error("amap nearby search failed", zap.Error(err))
		return nil, 0, fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, 0, fmt.Errorf("read response failed: %w", err)
	}

	var result struct {
		Status string `json:"status"`
		Info   string `json:"info"`
		Count  string `json:"count"`
		POIs   []struct {
			Name     FlexString `json:"name"`
			Address  FlexString `json:"address"`
			Province FlexString `json:"pname"`
			City     FlexString `json:"cityname"`
			District FlexString `json:"adname"`
			Location FlexString `json:"location"`
			Type     FlexString `json:"type"`
			Distance FlexString `json:"distance"`
		} `json:"pois"`
	}

	if err := json.Unmarshal(body, &result); err != nil {
		return nil, 0, fmt.Errorf("parse response failed: %w", err)
	}

	if result.Status != "1" {
		return nil, 0, fmt.Errorf("amap error: %s", result.Info)
	}

	var total int
	fmt.Sscanf(result.Count, "%d", &total)

	var pois []POIResult
	for _, p := range result.POIs {
		var lng, lat float64
		fmt.Sscanf(p.Location.String(), "%f,%f", &lng, &lat)
		pois = append(pois, POIResult{
			Name:      p.Name.String(),
			Address:   p.Address.String(),
			Province:  p.Province.String(),
			City:      p.City.String(),
			District:  p.District.String(),
			Longitude: lng,
			Latitude:  lat,
			Type:      p.Type.String(),
			Distance:  p.Distance.String(),
		})
	}

	return pois, total, nil
}

// ============================================================
// 距离计算
// ============================================================

// CalculateDistance 计算两点间的直线距离（米）
func (s *AmapService) CalculateDistance(lng1, lat1, lng2, lat2 float64) (int, error) {
	if !s.IsEnabled() {
		return 0, fmt.Errorf("amap service not configured")
	}

	origins := fmt.Sprintf("%.6f,%.6f", lng1, lat1)
	destination := fmt.Sprintf("%.6f,%.6f", lng2, lat2)

	params := url.Values{}
	params.Set("key", s.apiKey)
	params.Set("origins", origins)
	params.Set("destination", destination)
	params.Set("type", "0") // 直线距离
	params.Set("output", "JSON")

	resp, err := s.client.Get("https://restapi.amap.com/v3/distance?" + params.Encode())
	if err != nil {
		return 0, fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return 0, fmt.Errorf("read response failed: %w", err)
	}

	var result struct {
		Status  string `json:"status"`
		Info    string `json:"info"`
		Results []struct {
			Distance string `json:"distance"`
		} `json:"results"`
	}

	if err := json.Unmarshal(body, &result); err != nil {
		return 0, fmt.Errorf("parse response failed: %w", err)
	}

	if result.Status != "1" {
		return 0, fmt.Errorf("amap error: %s", result.Info)
	}

	if len(result.Results) == 0 {
		return 0, fmt.Errorf("no distance result")
	}

	var distance int
	fmt.Sscanf(result.Results[0].Distance, "%d", &distance)
	return distance, nil
}
