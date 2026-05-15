import React from 'react';
import {View} from 'react-native';

export default function codegenNativeComponent(_name: string) {
  return React.forwardRef<any, any>((props, ref) => <View ref={ref} {...props} />);
}
