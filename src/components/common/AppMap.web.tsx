import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const MapView = ({ children, style }: any) => (
  <View style={[styles.placeholder, style]}>
    <Text style={styles.text}>Mapa (Habilitado en móvil)</Text>
    {children}
  </View>
);

export const Marker = ({ children }: any) => <View>{children}</View>;
export const Polyline = () => null;
export const Circle = () => null;
export const Polygon = () => null;
export const Callout = ({ children }: any) => <View>{children}</View>;

const styles = StyleSheet.create({
  placeholder: {
    backgroundColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
  text: {
    color: '#6B7280',
    fontSize: 14,
    fontWeight: '600',
  },
});

export default MapView;
