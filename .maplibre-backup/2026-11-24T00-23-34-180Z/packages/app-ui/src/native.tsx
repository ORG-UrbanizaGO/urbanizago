import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Linking, Platform, View } from 'react-native';
import MapView, { Marker, Heatmap, PROVIDER_GOOGLE } from 'react-native-maps';
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
import { AuthProvider, UIProvider, LoginScreen, useAuth, Button, Caption, Notice, json, type Storage, type MapProps, type PlatformUI } from './core';
import type { Role } from '@urbanizago/shared';
export function NativeMap({ points, heat, selected, onPoint, onSelect }: MapProps) {
    const map = useRef<MapView>(null);
    const key = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
    const first = selected ?? points[0];
    useEffect(() => { if (!key)
        return; if (selected)
        map.current?.animateToRegion({ ...selected, latitudeDelta: .012, longitudeDelta: .012 }, 250);
    else if (points.length > 1)
        map.current?.fitToCoordinates(points.map(p => ({ latitude: p.latitude, longitude: p.longitude })), { edgePadding: { top: 40, left: 40, right: 40, bottom: 40 }, animated: false });
    else if (points[0])
        map.current?.animateToRegion({ ...points[0], latitudeDelta: .035, longitudeDelta: .035 }, 250); }, [key, selected?.latitude, selected?.longitude, points.length, points[0]?.latitude, points[0]?.longitude]);
    if (!key)
        return <View style={{ height: 210, backgroundColor: colors.primaryLight, padding: 18, justifyContent: 'center', gap: 8 }}><Icon name="map" size={40} color={colors.primary}/><Caption>Configure EXPO_PUBLIC_GOOGLE_MAPS_API_KEY e gere um build de desenvolvimento para exibir o mapa. A lista e as coordenadas continuam disponíveis.</Caption>{first && <Button secondary label="Abrir no Google Maps" onPress={() => void Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${first.latitude},${first.longitude}`)}/>}</View>;
    return <View style={{ height: 300, borderRadius: 10, overflow: 'hidden' }}><MapView ref={map} provider={PROVIDER_GOOGLE} style={{ flex: 1 }} initialRegion={{ latitude: first?.latitude ?? -15.79, longitude: first?.longitude ?? -47.88, latitudeDelta: first ? .04 : 12, longitudeDelta: first ? .04 : 12 }} onPress={e => onPoint?.(e.nativeEvent.coordinate)}>{heat && points.length > 0 ? <Heatmap points={points.map(p => ({ latitude: p.latitude, longitude: p.longitude, weight: p.weight ?? 1 }))} radius={35} opacity={.85}/> : points.map((p, i) => <Marker key={p.id ?? String(i)} coordinate={p} pinColor={p.category?.color ?? colors.primary} title={p.protocol ?? p.category?.name ?? 'Ocorrência'} onCalloutPress={() => onSelect?.(p)} onPress={() => onSelect?.(p)}/>)}{selected && <Marker coordinate={selected} draggable onDragEnd={e => onPoint?.(e.nativeEvent.coordinate)} title="Local selecionado"/>}</MapView></View>;
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

