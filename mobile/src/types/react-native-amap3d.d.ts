/**
 * react-native-amap3d 的本地类型声明
 * 原库 (v3.2.4) 的 package.json main 指向原始 .tsx 源码，
 * 与 React 19 + TS 5.x 存在类型兼容性问题。
 * 此文件提供干净的类型声明以绕过库内部的类型错误。
 */
declare module 'react-native-amap3d' {
  import * as React from 'react';
  import {ViewProps, NativeSyntheticEvent} from 'react-native';

  export interface LatLng {
    latitude: number;
    longitude: number;
  }

  export interface CameraPosition {
    target?: LatLng;
    zoom?: number;
    bearing?: number;
    tilt?: number;
  }

  export interface CameraEvent {
    cameraPosition: CameraPosition;
    latLngBounds: {
      southwest: LatLng;
      northeast: LatLng;
    };
  }

  export interface MapViewProps extends ViewProps {
    mapType?: number;
    initialCameraPosition?: CameraPosition;
    myLocationEnabled?: boolean;
    indoorViewEnabled?: boolean;
    buildingsEnabled?: boolean;
    labelsEnabled?: boolean;
    compassEnabled?: boolean;
    zoomControlsEnabled?: boolean;
    scaleControlsEnabled?: boolean;
    myLocationButtonEnabled?: boolean;
    trafficEnabled?: boolean;
    maxZoom?: number;
    minZoom?: number;
    zoomGesturesEnabled?: boolean;
    scrollGesturesEnabled?: boolean;
    rotateGesturesEnabled?: boolean;
    tiltGesturesEnabled?: boolean;
    onPress?: (event: NativeSyntheticEvent<LatLng>) => void;
    onLongPress?: (event: NativeSyntheticEvent<LatLng>) => void;
    onCameraMove?: (event: NativeSyntheticEvent<CameraEvent>) => void;
    onCameraIdle?: (event: NativeSyntheticEvent<CameraEvent>) => void;
    onLoad?: (event: NativeSyntheticEvent<void>) => void;
    children?: React.ReactNode;
  }

  export class MapView extends React.Component<MapViewProps> {
    moveCamera(cameraPosition: CameraPosition, duration?: number): void;
    getLatLng(point: {x: number; y: number}): Promise<LatLng>;
  }

  export interface MarkerProps {
    position: LatLng;
    icon?: any;
    opacity?: number;
    draggable?: boolean;
    flat?: boolean;
    zIndex?: number;
    children?: React.ReactNode;
    onPress?: () => void;
    onDragStart?: () => void;
    onDrag?: () => void;
    onDragEnd?: (event: NativeSyntheticEvent<LatLng>) => void;
  }

  export class Marker extends React.Component<MarkerProps> {}

  export namespace AMapSdk {
    function init(apiKey?: string): void;
    function getVersion(): Promise<string>;
  }
}

declare module 'react-native-amap3d/lib/src/map-view' {
  export type {CameraEvent, MapViewProps} from 'react-native-amap3d';
}
