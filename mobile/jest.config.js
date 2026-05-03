module.exports = {
  preset: 'react-native',
  moduleNameMapper: {
    '^react-native-config$': '<rootDir>/src/utils/config.jest.ts',
    '^react-native-wechat-lib$': '<rootDir>/src/utils/wechat.jest.ts',
    '^@react-native-community/geolocation$': '<rootDir>/src/utils/geolocation.jest.ts',
    '^react-native-update$': '<rootDir>/src/utils/reactNativeUpdate.jest.tsx',
  },
  transformIgnorePatterns: [
    'node_modules/(?!(react-native|@react-native|@react-navigation|react-native-.*|@react-native-community|react-redux|@reduxjs|redux|immer|reselect|redux-thunk|use-sync-external-store)/)',
  ],
};
