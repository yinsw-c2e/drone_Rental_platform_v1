import React from 'react';
import {StyleSheet, Text, TouchableOpacity, View} from 'react-native';
import {haulTokens} from '../../theme/haulTokens';

type RoleAwareTabOption<T extends string> = {
  key: T;
  label: string;
};

type RoleAwareTabBarProps<T extends string> = {
  value: T;
  options: RoleAwareTabOption<T>[];
  onChange: (value: T) => void;
};

export default function RoleAwareTabBar<T extends string>({
  value,
  options,
  onChange,
}: RoleAwareTabBarProps<T>) {
  return (
    <View style={styles.wrap}>
      {options.map(option => {
        const active = option.key === value;
        return (
          <TouchableOpacity
            key={option.key}
            activeOpacity={0.84}
            onPress={() => onChange(option.key)}
            style={[styles.item, active && styles.itemActive]}>
            <Text style={[styles.text, active && styles.textActive]}>
              {option.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    minHeight: 40,
    padding: 4,
    borderRadius: 20,
    backgroundColor: '#EEF4FB',
    flexDirection: 'row',
    gap: 4,
  },
  item: {
    flex: 1,
    minHeight: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: haulTokens.shadow.color,
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 2,
  },
  text: {
    color: haulTokens.colors.textSub,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '800',
  },
  textActive: {
    color: haulTokens.colors.text,
  },
});
