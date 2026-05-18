import React from 'react';
import {Image, Text, TouchableOpacity, StyleSheet, View} from 'react-native';
import type {ImageSourcePropType} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import {AddressData} from '../types';

interface AddressInputFieldProps {
  /** 当前选中的地址 */
  value?: AddressData | null;
  /** 占位文本 */
  placeholder?: string;
  /** 地址选中回调 */
  onSelect: (address: AddressData) => void;
  /** 自定义样式 */
  style?: object;
  /** 右侧箭头图标 */
  rightIcon?: ImageSourcePropType;
}

export default function AddressInputField({
  value,
  placeholder = '点击选择地址',
  onSelect,
  style,
  rightIcon,
}: AddressInputFieldProps) {
  const navigation = useNavigation<any>();

  const handlePress = () => {
    navigation.navigate('AddressPicker', {
      onSelect,
      selectionReturnDepth: 1,
    });
  };

  const displayText = value
    ? value.name || value.address
    : '';

  return (
    <TouchableOpacity
      style={[styles.container, style]}
      onPress={handlePress}
      activeOpacity={0.7}>
      {displayText ? (
        <View style={styles.valueWrap}>
          <Text style={styles.valueText} numberOfLines={1}>{displayText}</Text>
          {value?.district && (
            <Text style={styles.subText} numberOfLines={1}>{value.address}</Text>
          )}
        </View>
      ) : (
        <Text style={styles.placeholder}>{placeholder}</Text>
      )}
      {rightIcon ? (
        <Image source={rightIcon} style={styles.arrowIcon} resizeMode="contain" />
      ) : (
        <Text style={styles.arrow}>&#8250;</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderColor: '#ddd', borderRadius: 8,
    paddingHorizontal: 14, paddingVertical: 10,
    backgroundColor: '#fafafa', minHeight: 44,
  },
  valueWrap: {flex: 1},
  valueText: {fontSize: 15, color: '#333'},
  subText: {fontSize: 12, color: '#999', marginTop: 2},
  placeholder: {flex: 1, fontSize: 15, color: '#bbb'},
  arrow: {fontSize: 20, color: '#ccc', marginLeft: 8},
  arrowIcon: {width: 14, height: 14, marginLeft: 8, opacity: 0.75},
});
