import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ActivityIndicator, Alert, TextInput, Platform
} from 'react-native';
import MapView, { Marker } from '../../components/common/AppMap';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { SIZES, SHADOWS } from '../../constants/theme';

export interface PickedLocation {
  latitude: number;
  longitude: number;
  address: string;
}

interface Props {
  onLocationPicked: (loc: PickedLocation) => void;
  onCancel: () => void;
  initialLatitude?: number;
  initialLongitude?: number;
}

export default function MapPickerScreen({
  onLocationPicked,
  onCancel,
  initialLatitude,
  initialLongitude,
}: Props) {
  const { colors, isDark } = useTheme();
  const mapRef = useRef<MapView>(null);
  const [loading, setLoading] = useState(true);
  const [resolving, setResolving] = useState(false);
  const [markerCoord, setMarkerCoord] = useState({
    latitude: initialLatitude || 4.7110,
    longitude: initialLongitude || -74.0721,
  });
  const [address, setAddress] = useState('');
  const [search, setSearch] = useState('');

  const styles = makeStyles(colors, isDark);

  useEffect(() => {
    (async () => {
      if (initialLatitude && initialLongitude) {
        await reverseGeocode(initialLatitude, initialLongitude);
        setLoading(false);
        return;
      }
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
        const coord = {
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
        };
        setMarkerCoord(coord);
        await reverseGeocode(coord.latitude, coord.longitude);
        mapRef.current?.animateToRegion({
          ...coord,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        }, 1000);
      } else {
        Alert.alert('Permiso de ubicación', 'Se usará ubicación por defecto (Bogotá)');
        await reverseGeocode(4.7110, -74.0721);
      }
      setLoading(false);
    })();
  }, []);

  const reverseGeocode = async (lat: number, lng: number) => {
    setResolving(true);
    try {
      const results = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
      if (results.length > 0) {
        const r = results[0];
        const parts = [r.street, r.name, r.city, r.country].filter(Boolean);
        setAddress(parts.join(', '));
      }
    } catch {
      setAddress(`${lat.toFixed(5)}, ${lng.toFixed(5)}`);
    } finally {
      setResolving(false);
    }
  };

  const handleMapPress = async (e: any) => {
    const { latitude, longitude } = e.nativeEvent.coordinate;
    setMarkerCoord({ latitude, longitude });
    await reverseGeocode(latitude, longitude);
  };

  const handleSearch = async () => {
    if (!search.trim()) return;
    setResolving(true);
    try {
      const results = await Location.geocodeAsync(search);
      if (results.length > 0) {
        const { latitude, longitude } = results[0];
        const coord = { latitude, longitude };
        setMarkerCoord(coord);
        await reverseGeocode(latitude, longitude);
        mapRef.current?.animateToRegion(
          { ...coord, latitudeDelta: 0.01, longitudeDelta: 0.01 },
          800
        );
      } else {
        Alert.alert('No encontrado', 'No se encontró esa dirección');
      }
    } catch {
      Alert.alert('Error', 'No se pudo buscar la dirección');
    } finally {
      setResolving(false);
    }
  };

  const handleConfirm = () => {
    onLocationPicked({
      latitude: markerCoord.latitude,
      longitude: markerCoord.longitude,
      address,
    });
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Obteniendo ubicación...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.searchBar}>
        <TextInput
          style={[styles.searchInput, { color: colors.text }]}
          placeholder="Buscar dirección..."
          placeholderTextColor={colors.textLight}
          value={search}
          onChangeText={setSearch}
          onSubmitEditing={handleSearch}
          returnKeyType="search"
        />
        <TouchableOpacity style={styles.searchBtn} onPress={handleSearch}>
          <Ionicons name="search" size={20} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      <MapView
        ref={mapRef}
        style={styles.map}
        provider="google"
        userInterfaceStyle={isDark ? 'dark' : 'light'}
        initialRegion={{
          ...markerCoord,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        }}
        onPress={handleMapPress}
        showsUserLocation
        showsMyLocationButton
      >
        <Marker coordinate={markerCoord} pinColor={colors.primary} />
      </MapView>

      <View style={styles.footer}>
        <View style={styles.addressRow}>
          <Ionicons name="location" size={20} color={colors.primary} />
          {resolving ? (
            <ActivityIndicator style={{ marginLeft: SIZES.sm }} color={colors.primary} />
          ) : (
            <Text style={styles.addressText} numberOfLines={2}>{address || 'Toca el mapa para seleccionar'}</Text>
          )}
        </View>
        <View style={styles.footerButtons}>
          <TouchableOpacity style={styles.cancelBtn} onPress={onCancel}>
            <Text style={styles.cancelText}>Cancelar</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.confirmBtn, (!address || resolving) && styles.disabledBtn]}
            onPress={handleConfirm}
            disabled={!address || resolving}
          >
            <Text style={styles.confirmText}>Confirmar Ubicación</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const makeStyles = (colors: any, isDark: boolean) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, backgroundColor: colors.background },
  loadingText: { color: colors.textLight, fontSize: 14 },
  searchBar: {
    position: 'absolute', top: 12, left: 12, right: 12, zIndex: 10,
    flexDirection: 'row', gap: 8,
  },
  searchInput: {
    flex: 1, backgroundColor: colors.card, borderRadius: SIZES.radius,
    paddingHorizontal: SIZES.md, paddingVertical: SIZES.sm,
    fontSize: 14, color: colors.text,
    borderWidth: isDark ? 1 : 0, borderColor: colors.border,
    ...(isDark ? {} : SHADOWS.medium),
  },
  searchBtn: {
    backgroundColor: colors.primary, borderRadius: SIZES.radius,
    width: 44, alignItems: 'center', justifyContent: 'center',
    ...(isDark ? {} : SHADOWS.light),
  },
  map: { flex: 1 },
  footer: {
    backgroundColor: colors.card, padding: SIZES.lg,
    borderTopLeftRadius: SIZES.radius_lg, borderTopRightRadius: SIZES.radius_lg,
    borderWidth: isDark ? 1 : 0, borderColor: colors.border,
    ...(isDark ? {} : SHADOWS.medium),
  },
  addressRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: SIZES.md },
  addressText: { flex: 1, fontSize: 14, color: colors.text, fontWeight: '500' },
  footerButtons: { flexDirection: 'row', gap: 12 },
  cancelBtn: {
    flex: 1, padding: SIZES.md, borderRadius: SIZES.radius_lg,
    borderWidth: 1, borderColor: colors.border, alignItems: 'center',
  },
  cancelText: { color: colors.textLight, fontWeight: '600' },
  confirmBtn: {
    flex: 2, padding: SIZES.md, borderRadius: SIZES.radius_lg,
    backgroundColor: colors.primary, alignItems: 'center',
  },
  disabledBtn: { backgroundColor: colors.border },
  confirmText: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 15 },
});
