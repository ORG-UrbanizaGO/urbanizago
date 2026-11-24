import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Platform, View } from 'react-native';
import { Map, Camera, GeoJSONSource, Layer, ViewAnnotation } from '@maplibre/maplibre-react-native';
import * as SecureStore from 'expo-secure-store';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { Icon, Logo } from '@urbanizago/icons/native';
import { colors } from '@urbanizago/ui-tokens';
import { AuthProvider, UIProvider, LoginScreen, useAuth, Notice, json, type Storage, type MapProps, type PlatformUI } from './core';
import type { Role } from '@urbanizago/shared';
export function NativeMap({ points, heat, selected, onPoint, onSelect }: MapProps) {
  const camera = useRef<React.ElementRef<typeof Camera>>(null);
  const valid = points.filter(p => Number.isFinite(p.latitude) && Number.isFinite(p.longitude));
  const first = selected ?? valid[0];
  const center: [number, number] = [first?.longitude ?? -47.88, first?.latitude ?? -15.79];
  useEffect(() => {
    if (selected) {
      camera.current?.easeTo({ center: [selected.longitude, selected.latitude], zoom: 15, duration: 250 });
    } else if (valid.length > 1) {
      const west = Math.min(...valid.map(p => p.longitude));
      const south = Math.min(...valid.map(p => p.latitude));
      const east = Math.max(...valid.map(p => p.longitude));
      const north = Math.max(...valid.map(p => p.latitude));
      camera.current?.fitBounds([west, south, east, north], { padding: { top: 40, right: 40, bottom: 40, left: 40 }, duration: 250 });
    } else if (valid.length === 1) {
      camera.current?.easeTo({ center: [valid[0].longitude, valid[0].latitude], zoom: 14, duration: 250 });
    }
  }, [selected?.latitude, selected?.longitude, points]);

  const features = valid.map((p, i) => ({
    type: 'Feature' as const,
    geometry: { type: 'Point' as const, coordinates: [p.longitude, p.latitude] },
    properties: { weight: p.weight ?? 1, color: p.category?.color ?? colors.primary, index: i }
  }));
  return <View style={{ height: 300, borderRadius: 10, overflow: 'hidden' }}>
    <Map
      mapStyle={process.env.EXPO_PUBLIC_MAP_STYLE_URL || 'https://demotiles.maplibre.org/style.json'}
      style={{ flex: 1 }}
      onPress={event => {
        const [longitude, latitude] = event.nativeEvent.lngLat;
        onPoint?.({ latitude, longitude });
      }}>
      <Camera ref={camera} initialViewState={{ center, zoom: first ? 12 : 4 }} />
      {heat ? (
        <GeoJSONSource id="occurrence-heat-source" data={{ type: 'FeatureCollection', features }}>
          <Layer id="occurrence-heat" source="occurrence-heat-source" type="heatmap" paint={{
            'heatmap-weight': ['get', 'weight'],
            'heatmap-intensity': 1,
            'heatmap-radius': 35,
            'heatmap-opacity': 0.85
          }} />
        </GeoJSONSource>
      ) : valid.map((p, i) => (
        <ViewAnnotation key={p.id ?? String(i)} id={`occurrence-${p.id ?? i}`}
          lngLat={[p.longitude, p.latitude]} title={p.protocol ?? p.category?.name ?? 'Ocorrencia'}
          onPress={event => { event.stopPropagation(); onSelect?.(p); }}>
          <View style={{ width: 20, height: 20, borderRadius: 10,
            backgroundColor: p.category?.color ?? colors.primary,
            borderWidth: 2, borderColor: '#FFFFFF' }} />
        </ViewAnnotation>
      ))}
      {selected && (
        <ViewAnnotation id="selected-location" lngLat={[selected.longitude, selected.latitude]}
          draggable title="Local selecionado"
          onDragEnd={event => {
            const [longitude, latitude] = event.nativeEvent.lngLat;
            onPoint?.({ latitude, longitude });
          }}>
          <View style={{ width: 24, height: 24, borderRadius: 12,
            backgroundColor: '#F97316', borderWidth: 3, borderColor: '#FFFFFF' }} />
        </ViewAnnotation>
      )}
    </Map>
  </View>;
}

const base = (process.env.EXPO_PUBLIC_API_URL || 'http://10.0.2.2:3000').replace(/\/$/, '');
async function exportFile(path: string, token: string, filename: string) { if (!FileSystem.cacheDirectory)
    throw Error('Armazenamento indisponível.'); const result = await FileSystem.downloadAsync(base + '/api/v1' + path, FileSystem.cacheDirectory + filename, { headers: { Authorization: `Bearer ${token}` } }); if (result.status !== 200) {
    await FileSystem.deleteAsync(result.uri, { idempotent: true });
    throw Error(`Falha na exportação (${result.status}).`);
} if (!await Sharing.isAvailableAsync())
    throw Error('Compartilhamento indisponível.'); await Sharing.shareAsync(result.uri, { mimeType: filename.endsWith('.pdf') ? 'application/pdf' : 'text/csv' }); }
const ui: PlatformUI = { Icon, Logo, Map: NativeMap, exportFile };
function PushRegistration() { const { session, api } = useAuth(); const [warning, setWarning] = useState(''); useEffect(() => { if (!session || session.restricted || !Device.isDevice)
    return; let active = true; const userId = session.user.id; async function register() { try {
    const projectId = process.env.EXPO_PUBLIC_EAS_PROJECT_ID || Constants.easConfig?.projectId;
    if (!projectId)
        return;
    if (Platform.OS === 'android')
        await Notifications.setNotificationChannelAsync('default', { name: 'UrbanizaGO', importance: Notifications.AndroidImportance.DEFAULT });
    let { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted')
        ({ status } = await Notifications.requestPermissionsAsync());
    if (status !== 'granted')
        return;
    const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    if (active && userId)
        await api('/users/me/device', json('POST', { token, platform: Platform.OS === 'ios' ? 'ios' : 'android' }));
}
catch {
    if (active)
        setWarning('Push indisponível; as notificações internas continuam funcionando.');
} } void register(); return () => { active = false; }; }, [session?.user.id, session?.restricted]); return warning ? <Notice message={warning}/> : null; }
export function NativeRoot({ role, children }: {
    role: Role;
    children: React.ReactNode;
}) { const [client] = useState(() => new QueryClient()); const key = `urbanizago-${role}-refresh`; const storage: Storage = { get: () => SecureStore.getItemAsync(key), set: v => SecureStore.setItemAsync(key, v), clear: () => SecureStore.deleteItemAsync(key) }; return <SafeAreaProvider><QueryClientProvider client={client}><UIProvider value={ui}><AuthProvider role={role} client="mobile" base={base} storage={storage}><SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }}><NativeGate role={role}>{children}</NativeGate></SafeAreaView></AuthProvider></UIProvider></QueryClientProvider></SafeAreaProvider>; }
function NativeGate({ role, children }: {
    role: Role;
    children: React.ReactNode;
}) { const { session, loading } = useAuth(); if (loading)
    return <View style={{ flex: 1, justifyContent: 'center' }}><ActivityIndicator color={colors.primary} size="large"/></View>; if (!session)
    return <LoginScreen citizen={role === 'CITIZEN'}/>; return <><PushRegistration />{children}</>; }

