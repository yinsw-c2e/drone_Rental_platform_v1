import { useCallback, useEffect, useRef, useState } from 'react';
import { locationService } from '../../services/location';
import { loadAMap, isAMapConfigured } from '../../utils/amap';
import { registerLocationPicker, type PickedLocation } from './bus';
import type { POIItem } from '../../types';
import './index.scss';

type Resolver = (value: PickedLocation | null) => void;

// 默认中心：深圳市中心（演示用，定位/搜索后会覆盖）。
const DEFAULT_CENTER = { longitude: 114.0579, latitude: 22.5431 };
const NEARBY_RADIUS = 800;
const NEARBY_PAGE_SIZE = 12;

const readLngLat = (location: any) => {
  const lng = Number(location?.lng ?? location?.getLng?.() ?? location?.[0]);
  const lat = Number(location?.lat ?? location?.getLat?.() ?? location?.[1]);
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null;
  return { longitude: lng, latitude: lat };
};

const normalizeAmapPOI = (poi: any): POIItem | null => {
  const point = readLngLat(poi?.location);
  if (!point) return null;
  const name = String(poi?.name || '').trim();
  if (!name) return null;
  const address = String(poi?.address || poi?.district || name).trim();
  return {
    name,
    address,
    province: poi?.pname,
    city: poi?.cityname,
    district: poi?.adname || poi?.district,
    longitude: point.longitude,
    latitude: point.latitude,
    type: poi?.type,
    distance: poi?.distance != null ? String(poi.distance) : undefined,
  };
};

export default function LocationPickerHost() {
  const [visible, setVisible] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [results, setResults] = useState<POIItem[]>([]);
  const [searching, setSearching] = useState(false);
  const [nearbyLoading, setNearbyLoading] = useState(false);
  const [selected, setSelected] = useState<PickedLocation | null>(null);
  const [mapEnabled, setMapEnabled] = useState(false);

  const resolverRef = useRef<Resolver | null>(null);
  const mapElRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const amapRef = useRef<any>(null);
  const geocoderRef = useRef<any>(null);
  const placeSearchRef = useRef<any>(null);
  const moveTimerRef = useRef<any>(null);
  const nearbySeqRef = useRef(0);
  const searchTimerRef = useRef<any>(null);
  const suppressMoveRef = useRef(false);

  const settle = useCallback((value: PickedLocation | null) => {
    const resolver = resolverRef.current;
    resolverRef.current = null;
    setVisible(false);
    if (resolver) resolver(value);
  }, []);

  // 注册到 bus：chooseLocationCompat() 会调用它打开弹层。
  useEffect(() => {
    registerLocationPicker(() => new Promise<PickedLocation | null>((resolve) => {
      resolverRef.current = resolve;
      setKeyword('');
      setResults([]);
      setSelected(null);
      setNearbyLoading(false);
      setVisible(true);
    }));
    return () => registerLocationPicker(null);
  }, []);

  const searchNearbyWithAMap = useCallback((lng: number, lat: number) => {
    const AMap = amapRef.current;
    if (!AMap?.PlaceSearch) return Promise.resolve([] as POIItem[]);
    if (!placeSearchRef.current) {
      placeSearchRef.current = new AMap.PlaceSearch({
        pageSize: NEARBY_PAGE_SIZE,
        pageIndex: 1,
        extensions: 'base',
        type: '生活服务|商务住宅|交通设施服务|地名地址信息|购物服务|餐饮服务|公司企业',
        autoFitView: false,
      });
    }
    return new Promise<POIItem[]>((resolve) => {
      placeSearchRef.current.searchNearBy('', [lng, lat], NEARBY_RADIUS, (status: string, result: any) => {
        if (status !== 'complete') {
          resolve([]);
          return;
        }
        const pois = (result?.poiList?.pois || [])
          .map(normalizeAmapPOI)
          .filter(Boolean) as POIItem[];
        resolve(pois);
      });
    });
  }, []);

  const refreshNearbyPois = useCallback(async (lng: number, lat: number) => {
    const seq = nearbySeqRef.current + 1;
    nearbySeqRef.current = seq;
    setNearbyLoading(true);
    try {
      let list = await searchNearbyWithAMap(lng, lat);
      if (nearbySeqRef.current !== seq) return;
      if (list.length === 0) {
        const res: any = await locationService.searchNearby({
          lng,
          lat,
          radius: NEARBY_RADIUS,
          page: 1,
          page_size: NEARBY_PAGE_SIZE,
        }).catch(() => null);
        if (nearbySeqRef.current !== seq) return;
        list = res?.data?.list || res?.list || [];
      }
      setResults(list);
    } finally {
      if (nearbySeqRef.current === seq) setNearbyLoading(false);
    }
  }, [searchNearbyWithAMap]);

  const reverseWithAMap = useCallback((lng: number, lat: number) => {
    const AMap = amapRef.current;
    if (!AMap?.Geocoder) return Promise.resolve(null as PickedLocation | null);
    if (!geocoderRef.current) {
      geocoderRef.current = new AMap.Geocoder({ extensions: 'all' });
    }
    return new Promise<PickedLocation | null>((resolve) => {
      geocoderRef.current.getAddress([lng, lat], (status: string, result: any) => {
        const regeocode = result?.regeocode;
        if (status !== 'complete' || !regeocode) {
          resolve(null);
          return;
        }
        const component = regeocode.addressComponent || {};
        const address = String(regeocode.formattedAddress || '').trim();
        const name = String(
          component.township ||
          component.street ||
          component.district ||
          address ||
          '地图选点',
        ).trim();
        resolve({ name, address: address || name, longitude: lng, latitude: lat });
      });
    });
  }, []);

  // 逆地理：坐标 -> 地址，写入当前选择。
  const reverseToSelection = useCallback(async (lng: number, lat: number) => {
    try {
      const amapPicked = await reverseWithAMap(lng, lat);
      if (amapPicked) {
        setSelected(amapPicked);
        return;
      }
      const res: any = await locationService.reverseGeoCode(lng, lat);
      const data = res?.data || res;
      const address = data?.formatted_address || '';
      const name = data?.township || data?.street || data?.district || address || '地图选点';
      setSelected({ name, address: address || name, longitude: lng, latitude: lat });
    } catch {
      setSelected({
        name: '地图选点',
        address: `经度 ${lng.toFixed(6)}，纬度 ${lat.toFixed(6)}`,
        longitude: lng,
        latitude: lat,
      });
    }
  }, [reverseWithAMap]);

  const updateCenterSelection = useCallback((lng: number, lat: number) => {
    setKeyword('');
    reverseToSelection(lng, lat);
    refreshNearbyPois(lng, lat);
  }, [refreshNearbyPois, reverseToSelection]);

  // 弹层打开后初始化地图。
  useEffect(() => {
    if (!visible) return;
    if (!isAMapConfigured()) {
      setMapEnabled(false);
      return;
    }
    let cancelled = false;
    loadAMap()
      .then((AMap) => {
        if (cancelled || !mapElRef.current) return;
        amapRef.current = AMap;
        const map = new AMap.Map(mapElRef.current, {
          zoom: 15,
          center: [DEFAULT_CENTER.longitude, DEFAULT_CENTER.latitude],
          resizeEnable: true,
        });
        mapRef.current = map;
        setMapEnabled(true);
        // 地图停止移动 -> 用中心点逆地理。
        map.on('moveend', () => {
          if (suppressMoveRef.current) {
            suppressMoveRef.current = false;
            return;
          }
          const c = map.getCenter();
          if (moveTimerRef.current) clearTimeout(moveTimerRef.current);
          moveTimerRef.current = setTimeout(() => updateCenterSelection(c.lng, c.lat), 350);
        });
        // 初始定位到当前位置（失败则用默认中心）。
        try {
          const geolocation = new AMap.Geolocation({ timeout: 6000 });
          geolocation.getCurrentPosition((status: string, result: any) => {
            if (status === 'complete' && result?.position && mapRef.current) {
              mapRef.current.setCenter([result.position.lng, result.position.lat]);
            } else {
              updateCenterSelection(DEFAULT_CENTER.longitude, DEFAULT_CENTER.latitude);
            }
          });
        } catch {
          updateCenterSelection(DEFAULT_CENTER.longitude, DEFAULT_CENTER.latitude);
        }
      })
      .catch(() => {
        if (!cancelled) setMapEnabled(false);
      });

    return () => {
      cancelled = true;
      if (moveTimerRef.current) clearTimeout(moveTimerRef.current);
      if (mapRef.current) {
        mapRef.current.destroy?.();
        mapRef.current = null;
      }
    };
  }, [visible, updateCenterSelection]);

  // 关键词搜索（防抖）。
  useEffect(() => {
    if (!visible) return;
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    const kw = keyword.trim();
    if (!kw) {
      setResults([]);
      return;
    }
    searchTimerRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res: any = await locationService.searchPOI({ keyword: kw, page: 1, page_size: 20 });
        const list: POIItem[] = res?.data?.list || res?.list || [];
        setResults(list);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 350);
  }, [keyword, visible]);

  const pickPOI = (poi: POIItem) => {
    const picked: PickedLocation = {
      name: poi.name,
      address: poi.address || poi.name,
      longitude: Number(poi.longitude),
      latitude: Number(poi.latitude),
    };
    setSelected(picked);
    setResults([]);
    setKeyword('');
    if (mapRef.current) {
      suppressMoveRef.current = true;
      mapRef.current.setZoomAndCenter(16, [picked.longitude, picked.latitude]);
    }
  };

  if (!visible) return null;

  return (
    <div className="lp-mask">
      <div className="lp-sheet">
        <div className="lp-header">
          <div className="lp-btn lp-cancel" onClick={() => settle(null)}>取消</div>
          <div className="lp-title">选择地点</div>
          <div
            className={`lp-btn lp-confirm ${selected ? '' : 'lp-confirm-disabled'}`}
            onClick={() => selected && settle(selected)}
          >
            确定
          </div>
        </div>

        <div className="lp-search">
          <input
            className="lp-search-input"
            placeholder="搜索地点、地址"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
          />
        </div>

        <div className="lp-map-wrap">
          {mapEnabled ? <div className="lp-center-pin">📍</div> : null}
          <div ref={mapElRef} className={`lp-map ${mapEnabled ? '' : 'lp-map-hidden'}`} />
          {!mapEnabled ? (
            <div className="lp-map-fallback">
              {isAMapConfigured() ? '地图加载中…' : '未配置高德 Key，请直接搜索选择地点'}
            </div>
          ) : null}
        </div>

        {selected ? (
          <div className="lp-selected">
            <div className="lp-selected-name">{selected.name}</div>
            {selected.address ? <div className="lp-selected-addr">{selected.address}</div> : null}
          </div>
        ) : null}

        <div className="lp-results">
          {searching ? <div className="lp-tip">搜索中…</div> : null}
          {!searching && nearbyLoading ? <div className="lp-tip">正在加载附近地点…</div> : null}
          {!searching && keyword.trim() && results.length === 0 ? <div className="lp-tip">无匹配结果</div> : null}
          {!searching && !nearbyLoading && !keyword.trim() && mapEnabled && results.length === 0 ? (
            <div className="lp-tip">拖动地图后显示附近地点</div>
          ) : null}
          {results.map((poi, idx) => (
            <div className="lp-result-item" key={`${poi.name}-${idx}`} onClick={() => pickPOI(poi)}>
              <div className="lp-result-name">
                <span>{poi.name}</span>
                {poi.distance ? <span className="lp-result-distance">{poi.distance}m</span> : null}
              </div>
              <div className="lp-result-addr">{poi.address}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
