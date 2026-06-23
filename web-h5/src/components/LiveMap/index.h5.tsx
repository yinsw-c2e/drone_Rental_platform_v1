import { useEffect, useRef, useState } from 'react';
import { loadAMap, isAMapConfigured } from '../../utils/amap';

export interface LiveMapPoint {
  latitude: number;
  longitude: number;
}

export interface LiveMapMarker extends LiveMapPoint {
  id?: number;
  iconPath?: string;
  width?: number;
  height?: number;
  label?: { content?: string; color?: string } | any;
}

export interface LiveMapPolyline {
  points: LiveMapPoint[];
  color?: string;
  width?: number;
  dottedLine?: boolean;
  arrowLine?: boolean;
}

export interface LiveMapProps {
  id?: string;
  className?: string;
  latitude: number;
  longitude: number;
  scale?: number;
  markers?: LiveMapMarker[];
  polyline?: LiveMapPolyline[];
  includePoints?: LiveMapPoint[];
  showLocation?: boolean;
}

export default function LiveMap(props: LiveMapProps) {
  const { latitude, longitude, scale = 14, markers = [], polyline = [], includePoints = [], className } = props;
  const elRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const amapRef = useRef<any>(null);
  const overlaysRef = useRef<any[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'unsupported'>(
    isAMapConfigured() ? 'loading' : 'unsupported',
  );

  // 初始化地图。
  useEffect(() => {
    if (!isAMapConfigured()) {
      setState('unsupported');
      return;
    }
    let cancelled = false;
    loadAMap()
      .then((AMap) => {
        if (cancelled || !elRef.current) return;
        amapRef.current = AMap;
        mapRef.current = new AMap.Map(elRef.current, {
          zoom: scale,
          center: [longitude, latitude],
          resizeEnable: true,
        });
        setState('ready');
      })
      .catch(() => {
        if (!cancelled) setState('unsupported');
      });
    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.destroy?.();
        mapRef.current = null;
      }
    };
    // 仅初始化一次；后续 center/marker 由下方 effect 同步。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 同步 markers / polyline / 视野。
  useEffect(() => {
    const AMap = amapRef.current;
    const map = mapRef.current;
    if (state !== 'ready' || !AMap || !map) return;

    // 清除旧覆盖物。
    if (overlaysRef.current.length) {
      map.remove(overlaysRef.current);
      overlaysRef.current = [];
    }

    const added: any[] = [];

    markers.forEach((m) => {
      if (!Number.isFinite(m.latitude) || !Number.isFinite(m.longitude)) return;
      const options: any = { position: [m.longitude, m.latitude], anchor: 'bottom-center' };
      if (m.iconPath) {
        const w = m.width || 32;
        const h = m.height || 32;
        options.icon = new AMap.Icon({
          image: m.iconPath,
          size: new AMap.Size(w, h),
          imageSize: new AMap.Size(w, h),
        });
      }
      const marker = new AMap.Marker(options);
      const labelContent = m.label?.content;
      if (labelContent) {
        marker.setLabel({ direction: 'top', content: `<div class="live-map-label">${labelContent}</div>` });
      }
      map.add(marker);
      added.push(marker);
    });

    polyline.forEach((line) => {
      const path = (line.points || [])
        .filter((p) => Number.isFinite(p.latitude) && Number.isFinite(p.longitude))
        .map((p) => [p.longitude, p.latitude]);
      if (path.length < 2) return;
      const pl = new AMap.Polyline({
        path,
        strokeColor: line.color || '#1677ff',
        strokeWeight: line.width || 4,
        strokeStyle: line.dottedLine ? 'dashed' : 'solid',
        showDir: Boolean(line.arrowLine),
        lineJoin: 'round',
      });
      map.add(pl);
      added.push(pl);
    });

    overlaysRef.current = added;

    // 自适应视野。
    const fitPoints = (includePoints.length ? includePoints : markers).filter(
      (p) => Number.isFinite(p.latitude) && Number.isFinite(p.longitude),
    );
    if (added.length && fitPoints.length > 1) {
      map.setFitView(added, true, [48, 48, 48, 48]);
    } else if (fitPoints.length === 1) {
      map.setZoomAndCenter(scale, [fitPoints[0].longitude, fitPoints[0].latitude]);
    } else {
      map.setCenter([longitude, latitude]);
    }
  }, [state, markers, polyline, includePoints, latitude, longitude, scale]);

  if (state === 'unsupported') {
    return (
      <div className={className} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#e9edf2', color: '#8a94a6', fontSize: '14px', textAlign: 'center', padding: '0 24px' }}>
        {isAMapConfigured() ? '地图加载失败，请稍后重试' : '地图需配置高德 Key 后显示实时轨迹'}
      </div>
    );
  }

  return <div ref={elRef} className={className} />;
}
