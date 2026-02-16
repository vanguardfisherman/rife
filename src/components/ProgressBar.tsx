import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

interface ProgressBarProps {
  progress: number;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({ progress }) => {
  const safeProgress = Math.max(0, Math.min(progress, 100));
  return (
    <View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${safeProgress}%` }]} />
      </View>
      <Text style={styles.label}>{safeProgress.toFixed(2)}% vendido</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  track: {
    width: '100%',
    height: 14,
    borderRadius: 999,
    backgroundColor: '#d1d5db',
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    backgroundColor: '#2563eb',
  },
  label: {
    marginTop: 6,
    fontWeight: '600',
  },
});
