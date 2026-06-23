import Taro, { useDidShow } from '@tarojs/taro';
import React, { useState } from 'react';
import { View, Text, ScrollView } from '@tarojs/components';
import { creditService, getScoreLevelText, getScoreLevelColor } from '../../../services/credit';
import './index.scss';

export default function CreditScorePage() {
  const [score, setScore] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useDidShow(() => {
    setLoading(true);
    creditService.getMyCreditScore().then(res => {
      setScore(res.data || res);
    }).catch(() => {}).finally(() => setLoading(false));
  });

  if (loading) return <View className="page-wrap"><Text className="loading">加载中...</Text></View>;
  if (!score) return <View className="page-wrap"><Text className="loading">暂无信用数据</Text></View>;

  const levelColor = getScoreLevelColor(score.score_level);

  return (
    <ScrollView scrollY className="page-wrap">
      <View className="score-hero" style={{ backgroundColor: levelColor }}>
        <View className="score-circle">
          <Text className="score-num">{score.total_score}</Text>
          <Text className="score-lvl">{getScoreLevelText(score.score_level)}</Text>
        </View>
        <View className="score-stats">
          <View className="stat"><Text className="stat-v">{score.total_orders}</Text><Text className="stat-l">总单数</Text></View>
          <View className="stat"><Text className="stat-v">{score.average_rating ? score.average_rating.toFixed(1) : '5.0'}</Text><Text className="stat-l">评分</Text></View>
          <View className="stat"><Text className="stat-v">{score.violation_count}</Text><Text className="stat-l">违规数</Text></View>
        </View>
      </View>

      <View className="menu-list">
        <View className="menu-item" onClick={() => Taro.navigateTo({ url: '/pages/credit/violation/index' })}>
          <Text className="menu-title">违规记录</Text>
          <View className="menu-right">
            {score.violation_count > 0 && <View className="badge"><Text className="badge-text">{score.violation_count}</Text></View>}
            <Text className="arrow">{'>'}</Text>
          </View>
        </View>
        <View className="menu-item border-none" onClick={() => Taro.navigateTo({ url: '/pages/credit/deposit/index' })}>
          <Text className="menu-title">我的保证金</Text>
          <Text className="arrow">{'>'}</Text>
        </View>
      </View>
    </ScrollView>
  );
}
