// Re-export everything from react-native-web, then patch missing Android-only APIs
// so that Vite/Rollup can resolve the named imports at build time.
// @ts-expect-error react-native-web has no type declarations
export * from 'react-native-web';
// @ts-expect-error react-native-web has no type declarations
import * as RNW from 'react-native-web';
import React from 'react';

type WebTouchableOpacityProps = {
  activeOpacity?: number;
  accessibilityRole?: string;
  children?: React.ReactNode;
  disabled?: boolean;
  hitSlop?: unknown;
  onClick?: (event: unknown) => void;
  onKeyDown?: (event: any) => void;
  onPress?: (event: unknown) => void;
  style?: unknown;
  tabIndex?: number;
  role?: string;
  [key: string]: unknown;
};

const flattenWebStyle = (value: unknown): Record<string, unknown> => {
  const flattened = (RNW.StyleSheet as any)?.flatten
    ? (RNW.StyleSheet as any).flatten(value)
    : value;
  if (Array.isArray(flattened)) {
    return flattened.reduce(
      (acc, item) => ({...acc, ...flattenWebStyle(item)}),
      {} as Record<string, unknown>,
    );
  }
  if (flattened && typeof flattened === 'object') {
    return Object.entries(flattened as Record<string, unknown>).reduce(
      (acc, [key, item]) => {
        if (!/^\d+$/.test(key) && item !== undefined) {
          acc[key] = item;
        }
        return acc;
      },
      {} as Record<string, unknown>,
    );
  }
  return {};
};

export const TouchableOpacity = React.forwardRef<any, WebTouchableOpacityProps>(
  (
    {
      activeOpacity: _activeOpacity,
      accessibilityRole,
      children,
      disabled,
      hitSlop: _hitSlop,
      onClick,
      onKeyDown,
      onPress,
      role,
      style,
      tabIndex,
      ...rest
    },
    ref,
  ) => {
    const handleClick = (event: unknown) => {
      if (disabled) {
        return;
      }
      const clickHandler = onClick as undefined | ((value: unknown) => void);
      const pressHandler = onPress as undefined | ((value: unknown) => void);
      clickHandler?.(event);
      pressHandler?.(event);
    };

    const handleKeyDown = (event: any) => {
      const keyDownHandler = onKeyDown as undefined | ((value: unknown) => void);
      const pressHandler = onPress as undefined | ((value: unknown) => void);
      keyDownHandler?.(event);
      if (disabled || event?.defaultPrevented) {
        return;
      }
      if (event?.key === 'Enter' || event?.key === ' ') {
        event.preventDefault?.();
        pressHandler?.(event);
      }
    };

    const flatStyle = flattenWebStyle(style);
    const domStyle: Record<string, unknown> = {
      ...flatStyle,
      cursor: disabled ? 'default' : 'pointer',
    };
    if (disabled && domStyle.opacity === undefined) {
      domStyle.opacity = 0.55;
    }

    return React.createElement(
      'div',
      {
        ...rest,
        ref,
        'aria-disabled': disabled || undefined,
        'aria-label': rest.accessibilityLabel,
        onClick: handleClick,
        onKeyDown: handleKeyDown,
        role: role || accessibilityRole || 'button',
        style: domStyle,
        tabIndex: disabled ? -1 : tabIndex ?? 0,
      },
      children as React.ReactNode,
    );
  },
);

export function codegenNativeComponent(_name: string) {
  return React.forwardRef<any, any>((props, ref) =>
    React.createElement(RNW.View as any, {...props, ref}),
  );
}

export function codegenNativeCommands<T = Record<string, never>>() {
  return {} as T;
}

export const TurboModuleRegistry = {
  get: () => null,
  getEnforcing: () => ({}),
};

// PermissionsAndroid is Android-only; provide a no-op stub for web builds.
export const PermissionsAndroid = {
  PERMISSIONS: {
    CAMERA: 'android.permission.CAMERA',
    ACCESS_FINE_LOCATION: 'android.permission.ACCESS_FINE_LOCATION',
    ACCESS_COARSE_LOCATION: 'android.permission.ACCESS_COARSE_LOCATION',
    READ_EXTERNAL_STORAGE: 'android.permission.READ_EXTERNAL_STORAGE',
    WRITE_EXTERNAL_STORAGE: 'android.permission.WRITE_EXTERNAL_STORAGE',
  },
  RESULTS: {
    GRANTED: 'granted' as const,
    DENIED: 'denied' as const,
    NEVER_ASK_AGAIN: 'never_ask_again' as const,
  },
  request: async () => 'denied' as const,
  requestMultiple: async () => ({} as Record<string, string>),
  check: async () => false,
};
