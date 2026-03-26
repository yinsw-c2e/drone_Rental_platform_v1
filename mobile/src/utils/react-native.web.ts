// Re-export everything from react-native-web, then patch missing Android-only APIs
// so that Vite/Rollup can resolve the named imports at build time.
// @ts-expect-error react-native-web has no type declarations
export * from 'react-native-web';

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
