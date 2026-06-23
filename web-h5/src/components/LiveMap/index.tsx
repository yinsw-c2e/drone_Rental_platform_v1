import { Map } from '@tarojs/components';

export interface LiveMapPoint {
  latitude: number;
  longitude: number;
}

export interface LiveMapMarker extends LiveMapPoint {
  id?: number;
  iconPath?: string;
  width?: number;
  height?: number;
  label?: any;
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

/**
 * 实时轨迹地图。微信小程序直接渲染 Taro <Map>（保留 id 供 createMapContext 调用）。
 * H5 实现见 index.h5.tsx（高德 JS API）。
 */
export default function LiveMap(props: LiveMapProps) {
  return (
    <Map
      id={props.id}
      className={props.className}
      latitude={props.latitude}
      longitude={props.longitude}
      scale={props.scale}
      markers={props.markers as any}
      polyline={props.polyline as any}
      includePoints={props.includePoints as any}
      showLocation={props.showLocation}
    />
  );
}
