import React, {useState, useCallback, useRef, useEffect} from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  SafeAreaView, FlatList, ActivityIndicator, Keyboard,
} from 'react-native';
import addressHistoryService from '../../services/addressHistory';
import {locationService} from '../../services/location';
import {POIItem, AddressData} from '../../types';
import {useTheme} from '../../theme/ThemeContext';
import type {AppTheme} from '../../theme/index';

export default function AddressSearchScreen({navigation, route}: any) {
  const {theme} = useTheme();
  const styles = getStyles(theme);
  const onSelect: ((addr: AddressData) => void) | undefined = route.params?.onSelect;
  const city: string = route.params?.city || '';
  const returnSteps = Math.max(Number(route.params?.returnSteps || 1), 1);

  const [keyword, setKeyword] = useState('');
  const [results, setResults] = useState<POIItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [recentAddresses, setRecentAddresses] = useState<AddressData[]>([]);
  const [loadingRecent, setLoadingRecent] = useState(true);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;
    addressHistoryService.loadAddressHistory()
      .then(items => {
        if (!cancelled) {
          setRecentAddresses(items);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingRecent(false);
        }
      });
    return () => {
      cancelled = true;
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

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

  const selectAddress = async (addr: AddressData) => {
    Keyboard.dismiss();
    const nextHistory = await addressHistoryService.addAddressHistory(addr).catch(() => null);
    if (nextHistory) {
      setRecentAddresses(nextHistory);
    }
    if (onSelect) {
      onSelect(addr);
    }
    if (returnSteps > 1 && typeof navigation.pop === 'function') {
      navigation.pop(returnSteps);
      return;
    }
    navigation.goBack();
  };

  const handleSelect = (poi: POIItem) => {
    const addr: AddressData = {
      name: poi.name,
      address: poi.address || poi.name,
      province: poi.province,
      city: poi.city,
      district: poi.district,
      latitude: poi.latitude,
      longitude: poi.longitude,
    };
    selectAddress(addr).catch(() => null);
  };

  const handleClearHistory = useCallback(async () => {
    await addressHistoryService.clearAddressHistory().catch(() => null);
    setRecentAddresses([]);
  }, []);

  const renderItem = ({item}: {item: POIItem}) => (
    <TouchableOpacity style={styles.item} onPress={() => handleSelect(item)} activeOpacity={0.6}>
      <Text style={styles.itemName} numberOfLines={1}>{item.name}</Text>
      <Text style={styles.itemAddr} numberOfLines={1}>
        {[item.district, item.address].filter(Boolean).join(' ')}
      </Text>
    </TouchableOpacity>
  );

  const renderHistoryItem = ({item}: {item: AddressData}) => (
    <TouchableOpacity style={styles.item} onPress={() => { selectAddress(item).catch(() => null); }} activeOpacity={0.6}>
      <Text style={styles.itemName} numberOfLines={1}>{item.name || item.address}</Text>
      <Text style={styles.itemAddr} numberOfLines={1}>
        {[item.district, item.address].filter(Boolean).join(' ')}
      </Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={[styles.container, {backgroundColor: theme.bg}]}>
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
        <ActivityIndicator size="large" color={theme.primary} style={styles.loadingIndicator} />
      ) : results.length > 0 ? (
        <FlatList
          data={results}
          keyExtractor={(_, i) => String(i)}
          renderItem={renderItem}
          keyboardShouldPersistTaps="handled"
        />
      ) : !keyword.trim() && recentAddresses.length > 0 ? (
        <FlatList
          data={recentAddresses}
          keyExtractor={(_, i) => `history-${i}`}
          renderItem={renderHistoryItem}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={
            <View style={styles.historyHeader}>
              <Text style={styles.historyTitle}>最近搜索</Text>
              <TouchableOpacity onPress={() => { handleClearHistory().catch(() => null); }}>
                <Text style={styles.historyClear}>清空</Text>
              </TouchableOpacity>
            </View>
          }
        />
      ) : searched ? (
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyText}>未找到相关地址</Text>
        </View>
      ) : (
        <View style={styles.emptyWrap}>
          <Text style={styles.hintText}>
            {loadingRecent ? '正在加载最近搜索...' : '输入关键词搜索地址'}
          </Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const getStyles = (theme: AppTheme) => StyleSheet.create({
  container: {flex: 1, backgroundColor: theme.card},
  searchBar: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.divider,
  },
  inputWrap: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    backgroundColor: theme.bgSecondary, borderRadius: 8, paddingHorizontal: 10, height: 40,
  },
  searchIcon: {fontSize: 16, marginRight: 6, color: theme.textSub},
  input: {flex: 1, fontSize: 15, padding: 0, color: theme.text},
  clearBtn: {fontSize: 14, color: theme.textSub, paddingLeft: 8},
  cancelBtn: {paddingLeft: 12},
  cancelText: {fontSize: 15, color: theme.primaryText},
  historyHeader: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.divider,
  },
  historyTitle: {
    fontSize: 13,
    color: theme.textSub,
    fontWeight: '600',
  },
  historyClear: {
    fontSize: 13,
    color: theme.primaryText,
    fontWeight: '500',
  },
  loadingIndicator: {marginTop: 60},
  item: {
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.divider,
  },
  itemName: {fontSize: 15, color: theme.text, fontWeight: '500'},
  itemAddr: {fontSize: 13, color: theme.textSub, marginTop: 4},
  emptyWrap: {alignItems: 'center', paddingTop: 80},
  emptyText: {fontSize: 14, color: theme.textSub},
  hintText: {fontSize: 14, color: theme.textHint},
});
