import { useCallback, useEffect, useRef, useState } from 'react';
import { locationService } from '../../services/location';
import { loadAMap, isAMapConfigured } from '../../utils/amap';
import { registerLocationPicker, type PickedLocation } from './bus';
import type { POIItem } from '../../types';
import './index.scss';

type Resolver = (value: PickedLocation | null) => void;

// 默认中心：深圳市中心（演示用，定位/搜索后会覆盖）。
const DEFAULT_CENTER = { longitude: 114.0579, latitude: 22.5431 };

export default function LocationPickerHost() {
  const [visible, setVisible] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [results, setResults] = useState<POIItem[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<PickedLocation | null>(null);
  const [mapEnabled, setMapEnabled] = useState(false);

  const resolverRef = useRef<Resolver | null>(null);
  const mapElRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const amapRef = useRef<any>(null);
  const moveTimerRef = useRef<any>(null);
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
      setVisible(true);
    }));
    return () => registerLocationPicker(null);
  }, []);

  // 逆地理：坐标 -> 地址，写入当前选择。
  const reverseToSelection = useCallback(async (lng: number, lat: number) => {
    try {
      const res: any = await locationService.reverseGeoCode(lng, lat);
      const data = res?.data || res;
      const address = data?.formatted_address || '';
      const name = data?.township || data?.street || data?.district || address || '地图选点';
      setSelected({ name, address: address || name, longitude: lng, latitude: lat });
    } catch {
      setSelected({ name: '地图选点', address: '', longitude: lng, latitude: lat });
    }
  }, []);

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
          moveTimerRef.current = setTimeout(() => reverseToSelection(c.lng, c.lat), 350);
        });
        // 初始定位到当前位置（失败则用默认中心）。
        try {
          const geolocation = new AMap.Geolocation({ timeout: 6000 });
          geolocation.getCurrentPosition((status: string, result: any) => {
            if (status === 'complete' && result?.position && mapRef.current) {
              mapRef.current.setCenter([result.position.lng, result.position.lat]);
            } else {
              reverseToSelection(DEFAULT_CENTER.longitude, DEFAULT_CENTER.latitude);
            }
          });
        } catch {
          reverseToSelection(DEFAULT_CENTER.longitude, DEFAULT_CENTER.latitude);
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
  }, [visible, reverseToSelection]);

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
          {!searching && keyword.trim() && results.length === 0 ? <div className="lp-tip">无匹配结果</div> : null}
          {results.map((poi, idx) => (
            <div className="lp-result-item" key={`${poi.name}-${idx}`} onClick={() => pickPOI(poi)}>
              <div className="lp-result-name">{poi.name}</div>
              <div className="lp-result-addr">{poi.address}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
