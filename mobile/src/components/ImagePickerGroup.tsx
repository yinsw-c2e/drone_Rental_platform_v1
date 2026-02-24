import React from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Image, Alert,
  Platform, ActionSheetIOS,
} from 'react-native';
import {launchCamera, launchImageLibrary, ImagePickerResponse} from 'react-native-image-picker';

interface ImagePickerProps {
  images: string[];
  onImagesChange: (images: string[]) => void;
  maxCount?: number;
  label?: string;
  hint?: string;
}

export default function ImagePickerGroup({
  images,
  onImagesChange,
  maxCount = 3,
  label,
  hint,
}: ImagePickerProps) {

  const handleAdd = () => {
    const options = ['拍照', '从相册选择', '取消'];
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {options, cancelButtonIndex: 2},
        (index) => {
          if (index === 0) pickImage('camera');
          else if (index === 1) pickImage('library');
        },
      );
    } else {
      Alert.alert('添加图片', '选择图片来源', [
        {text: '拍照', onPress: () => pickImage('camera')},
        {text: '从相册选择', onPress: () => pickImage('library')},
        {text: '取消', style: 'cancel'},
      ]);
    }
  };

  const pickImage = (source: 'camera' | 'library') => {
    const opts = {
      mediaType: 'photo' as const,
      maxWidth: 1280,
      maxHeight: 1280,
      quality: 0.8 as const,
    };

    const callback = (response: ImagePickerResponse) => {
      if (response.didCancel || response.errorCode) return;
      const asset = response.assets?.[0];
      if (!asset?.uri) return;
      onImagesChange([...images, asset.uri]);
    };

    if (source === 'camera') {
      launchCamera(opts, callback);
    } else {
      launchImageLibrary(opts, callback);
    }
  };

  const handleRemove = (index: number) => {
    Alert.alert('删除图片', '确定要删除这张图片吗？', [
      {text: '取消', style: 'cancel'},
      {
        text: '删除',
        style: 'destructive',
        onPress: () => {
          const updated = [...images];
          updated.splice(index, 1);
          onImagesChange(updated);
        },
      },
    ]);
  };

  return (
    <View style={styles.container}>
      {label && <Text style={styles.label}>{label}</Text>}
      {hint && <Text style={styles.hint}>{hint}</Text>}
      <View style={styles.grid}>
        {images.map((uri, index) => (
          <View key={index} style={styles.imageWrapper}>
            <Image source={{uri}} style={styles.image} />
            <TouchableOpacity
              style={styles.removeBtn}
              onPress={() => handleRemove(index)}>
              <Text style={styles.removeBtnText}>X</Text>
            </TouchableOpacity>
          </View>
        ))}
        {images.length < maxCount && (
          <TouchableOpacity style={styles.addBtn} onPress={handleAdd}>
            <Text style={styles.addIcon}>+</Text>
            <Text style={styles.addText}>添加图片</Text>
          </TouchableOpacity>
        )}
      </View>
      <Text style={styles.counter}>{images.length}/{maxCount}</Text>
    </View>
  );
}

const IMAGE_SIZE = 100;

const styles = StyleSheet.create({
  container: {marginBottom: 16},
  label: {fontSize: 14, fontWeight: '500', color: '#333', marginBottom: 4},
  hint: {fontSize: 12, color: '#999', marginBottom: 8},
  grid: {flexDirection: 'row', flexWrap: 'wrap', gap: 8},
  imageWrapper: {position: 'relative'},
  image: {
    width: IMAGE_SIZE, height: IMAGE_SIZE, borderRadius: 8,
    backgroundColor: '#f0f0f0',
  },
  removeBtn: {
    position: 'absolute', top: -6, right: -6,
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: '#ff4d4f', justifyContent: 'center', alignItems: 'center',
  },
  removeBtnText: {color: '#fff', fontSize: 11, fontWeight: 'bold'},
  addBtn: {
    width: IMAGE_SIZE, height: IMAGE_SIZE, borderRadius: 8,
    borderWidth: 1, borderColor: '#d9d9d9', borderStyle: 'dashed',
    justifyContent: 'center', alignItems: 'center',
    backgroundColor: '#fafafa',
  },
  addIcon: {fontSize: 24, color: '#999'},
  addText: {fontSize: 11, color: '#999', marginTop: 2},
  counter: {fontSize: 12, color: '#bbb', marginTop: 4, textAlign: 'right'},
});
