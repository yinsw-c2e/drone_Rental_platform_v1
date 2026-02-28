import React, {useState, useCallback, useRef} from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  SafeAreaView, FlatList, ActivityIndicator, Keyboard,
} from 'react-native';
import {locationService} from '../../services/location';
import {POIItem, AddressData} from '../../types';

export default function AddressSearchScreen({navigation, route}: any) {
  const onSelect: ((addr: AddressData) => void) | undefined = route.params?.onSelect;
  const city: string = route.params?.city || '';

  const [keyword, setKeyword] = useState('');
  const [results, setResults] = useState<POIItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const doSearch = useCallback(async (text: string) => {
    if (!text.trim()) {
      setResults([]);
      setSearched(false);
      return;
    }
    setLoading(true);
    setSearched(true);
    try {
      const res = await locationService.searchPOI({keyword: text.trim(), city, page_size: 20});
      setResults(res.data?.list || []);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [city]);

  const onChangeText = useCallback((text: string) => {
    setKeyword(text);
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    timerRef.current = setTimeout(() => doSearch(text), 400);
  }, [doSearch]);

  const handleSelect = (poi: POIItem) => {
    Keyboard.dismiss();
    const addr: AddressData = {
      name: poi.name,
      address: poi.address || poi.name,
      province: poi.province,
      city: poi.city,
      district: poi.district,
      latitude: poi.latitude,
      longitude: poi.longitude,
    };
    if (onSelect) {
      onSelect(addr);
    }
    navigation.goBack();
  };

  const renderItem = ({item}: {item: POIItem}) => (
    <TouchableOpacity style={styles.item} onPress={() => handleSelect(item)} activeOpacity={0.6}>
      <Text style={styles.itemName} numberOfLines={1}>{item.name}</Text>
      <Text style={styles.itemAddr} numberOfLines={1}>
        {[item.district, item.address].filter(Boolean).join(' ')}
      </Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.searchBar}>
        <View style={styles.inputWrap}>
          <Text style={styles.searchIcon}>&#128269;</Text>
          <TextInput
            style={styles.input}
            placeholder="搜索地址、小区、写字楼"
            value={keyword}
            onChangeText={onChangeText}
            autoFocus
            returnKeyType="search"
            onSubmitEditing={() => doSearch(keyword)}
          />
          {keyword.length > 0 && (
            <TouchableOpacity onPress={() => { setKeyword(''); setResults([]); setSearched(false); }}>
              <Text style={styles.clearBtn}>&#10005;</Text>
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.cancelBtn}>
          <Text style={styles.cancelText}>取消</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#1890ff" style={{marginTop: 60}} />
      ) : results.length > 0 ? (
        <FlatList
          data={results}
          keyExtractor={(_, i) => String(i)}
          renderItem={renderItem}
          keyboardShouldPersistTaps="handled"
        />
      ) : searched ? (
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyText}>未找到相关地址</Text>
        </View>
      ) : (
        <View style={styles.emptyWrap}>
          <Text style={styles.hintText}>输入关键词搜索地址</Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#fff'},
  searchBar: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#e8e8e8',
  },
  inputWrap: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#f5f5f5', borderRadius: 8, paddingHorizontal: 10, height: 40,
  },
  searchIcon: {fontSize: 16, marginRight: 6, color: '#999'},
  input: {flex: 1, fontSize: 15, padding: 0, color: '#333'},
  clearBtn: {fontSize: 14, color: '#999', paddingLeft: 8},
  cancelBtn: {paddingLeft: 12},
  cancelText: {fontSize: 15, color: '#1890ff'},
  item: {
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#f0f0f0',
  },
  itemName: {fontSize: 15, color: '#333', fontWeight: '500'},
  itemAddr: {fontSize: 13, color: '#999', marginTop: 4},
  emptyWrap: {alignItems: 'center', paddingTop: 80},
  emptyText: {fontSize: 14, color: '#999'},
  hintText: {fontSize: 14, color: '#bbb'},
});
