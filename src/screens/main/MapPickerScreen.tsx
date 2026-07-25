import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ActivityIndicator, Alert, TextInput,
} from 'react-native';
import MapView, { Marker } from '../../components/common/AppMap';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { SIZES, SHADOWS, type } from '../../constants/theme';
import { PressScale } from '../../components/common/Animated';

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
  onLocationPicked, onCancel, initialLatitude, initialLongitude,
}: Props) {
  const { colors, isDark } = useTheme();
  const mapRef = useRef<MapView>(null);
  const [loading, setLoading] = useState(true);
  const [resolving, setResolving] = useState(false);
  const [locationGranted, setLocationGranted] = useState(false);
  const [markerCoord, setMarkerCoord] = useState({
    latitude: initialLatitude || 4.7110,
    longitude: initialLongitude || -74.0721,
  });
  const [address, setAddress] = useState('');
  const [search, setSearch] = useState('');

  const styles = makeStyles(colors, isDark);

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      const granted = status === 'granted';
      setLocationGranted(granted);

      if (initialLatitude && initialLongitude) {
        await reverseGeocode(initialLatitude, initialLongitude);
        setLoading(false);
        return;
      }
      
      if (granted) {
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
        const coord = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
        setMarkerCoord(coord);
        await reverseGeocode(coord.latitude, coord.longitude);
        mapRef.current?.animateToRegion({ ...coord, latitudeDelta: 0.01, longitudeDelta: 0.01 }, 1000);
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
        mapRef.current?.animateToRegion({ ...coord, latitudeDelta: 0.01, longitudeDelta: 0.01 }, 800);
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
        <Text style={styles.loadingText}>Obteniendo tu ubicación…</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.searchBar}>
        <View style={styles.searchInputWrap}>
          <Ionicons name="search-outline" size={18} color={colors.textLight} />
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar dirección o lugar"
            placeholderTextColor={colors.textLight}
            value={search}
            onChangeText={setSearch}
            onSubmitEditing={handleSearch}
            returnKeyType="search"
          />
        </View>
        <PressScale style={styles.searchBtn} onPress={handleSearch}>
          <Ionicons name="arrow-forward" size={20} color={colors.onPrimary} />
        </PressScale>
      </View>

      <MapView
        ref={mapRef}
        style={styles.map}
        userInterfaceStyle={isDark ? 'dark' : 'light'}
        initialRegion={{ ...markerCoord, latitudeDelta: 0.01, longitudeDelta: 0.01 }}
        onPress={handleMapPress}
        showsUserLocation={locationGranted}
        showsMyLocationButton={locationGranted}
      >
        <Marker coordinate={markerCoord} pinColor={colors.primary} />
      </MapView>

      <View style={styles.footer}>
        <View style={styles.handleBar} />

        <View style={styles.addressRow}>
          <View style={styles.addrIcon}>
            <Ionicons name="location" size={18} color={colors.primary} />
          </View>
          {resolving ? (
            <ActivityIndicator color={colors.primary} />
          ) : (
            <Text style={styles.addressText} numberOfLines={2}>
              {address || 'Toca el mapa para seleccionar'}
            </Text>
          )}
        </View>

        <View style={styles.footerButtons}>
          <TouchableOpacity style={styles.cancelBtn} onPress={onCancel}>
            <Text style={styles.cancelText}>Cancelar</Text>
          </TouchableOpacity>
          <PressScale
            style={[styles.confirmBtn, (!address || resolving) && styles.disabledBtn]}
            onPress={handleConfirm}
            disabled={!address || resolving}
          >
            <Ionicons name="checkmark" size={18} color={colors.onPrimary} />
            <Text style={styles.confirmText}>Confirmar ubicación</Text>
          </PressScale>
        </View>
      </View>
    </View>
  );
}

const makeStyles = (colors: any, isDark: boolean) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 14, backgroundColor: colors.background },
  loadingText: { ...type.body, color: colors.textLight },

  searchBar: {
    position: 'absolute', top: 16, left: 14, right: 14, zIndex: 10,
    flexDirection: 'row', gap: 8,
  },
  searchInputWrap: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: colors.card, borderRadius: SIZES.radius_full,
    paddingHorizontal: SIZES.md, paddingVertical: 10,
    borderWidth: 1, borderColor: colors.border,
    ...(isDark ? {} : SHADOWS.medium),
  },
  searchInput: { flex: 1, ...type.body, color: colors.text, padding: 0 },
  searchBtn: {
    backgroundColor: colors.primary, borderRadius: SIZES.radius_full,
    width: 46, height: 46, alignItems: 'center', justifyContent: 'center',
    ...(isDark ? {} : SHADOWS.light),
  },

  map: { flex: 1 },

  footer: {
    backgroundColor: colors.card, padding: SIZES.lg, paddingTop: 10,
    borderTopLeftRadius: SIZES.radius_xl, borderTopRightRadius: SIZES.radius_xl,
    borderTopWidth: 1, borderColor: colors.border,
    ...(isDark ? {} : SHADOWS.medium),
  },
  handleBar: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: colors.border, alignSelf: 'center', marginBottom: SIZES.md,
  },
  addressRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: SIZES.lg },
  addrIcon: {
    width: 38, height: 38, borderRadius: 19,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: isDark ? 'rgba(232,197,108,0.10)' : 'rgba(10,10,10,0.05)',
  },
  addressText: { flex: 1, ...type.bodyMd, color: colors.text },

  footerButtons: { flexDirection: 'row', gap: 12 },
  cancelBtn: {
    flex: 1, paddingVertical: 14, borderRadius: SIZES.radius_full,
    borderWidth: 1, borderColor: colors.border, alignItems: 'center',
  },
  cancelText: { ...type.button, color: colors.textLight },
  confirmBtn: {
    flex: 2, flexDirection: 'row', gap: 8,
    paddingVertical: 14, borderRadius: SIZES.radius_full,
    backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center',
  },
  disabledBtn: { opacity: 0.4 },
  confirmText: { ...type.button, color: colors.onPrimary },
});
