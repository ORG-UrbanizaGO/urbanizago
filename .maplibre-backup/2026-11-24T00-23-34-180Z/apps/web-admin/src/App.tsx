import { useEffect, useRef, useState } from 'react';
import { BrowserRouter, useLocation, useNavigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PieChart, Pie, Cell, Tooltip, Legend, LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from 'recharts';
import { Icon, Logo } from '@urbanizago/icons/web';
import { AuthProvider, UIProvider, LoginScreen, useAuth, rows, str, num, type MapProps, type PlatformUI } from '@urbanizago/app-ui/core';
import { AdminApp, type ChartsProps } from '@urbanizago/app-ui/admin';
const palette = ['#08783E', '#1481C1', '#F59E0B', '#E56B55', '#22A780', '#725AC1', '#64748B'];
let script: Promise<void> | undefined;
function loadMaps() { if (typeof google !== 'undefined' && google.maps?.Map)
    return Promise.resolve(); if (script)
    return script; const key = import.meta.env.VITE_GOOGLE_MAPS_API_KEY; if (!key)
    return Promise.reject(Error('Configure VITE_GOOGLE_MAPS_API_KEY.')); script = new Promise<void>((resolve, reject) => { const el = document.createElement('script'); el.src = 'https://maps.googleapis.com/maps/api/js?key=' + encodeURIComponent(key) + '&v=weekly'; el.async = true; el.onload = () => resolve(); el.onerror = () => { script = undefined; el.remove(); reject(Error('Não foi possível carregar o Google Maps.')); }; document.head.appendChild(el); }); return script; }
function WebMap({ points, heat, onSelect }: MapProps) {
    const el = useRef<HTMLDivElement>(null), [error, setError] = useState(''), [ready, setReady] = useState(false);
    const map = useRef<google.maps.Map | null>(null);
    const callback = useRef(onSelect);
    callback.current = onSelect;
    useEffect(() => { let active = true; void loadMaps().then(() => { if (active && el.current) {
        map.current = new google.maps.Map(el.current, { center: { lat: -15.79, lng: -47.88 }, zoom: 5, mapTypeControl: false, streetViewControl: false });
        setReady(true);
    } }).catch(e => { if (active)
        setError(e instanceof Error ? e.message : 'Mapa indisponível'); }); return () => { active = false; map.current = null; }; }, []);
    useEffect(() => { if (!ready || !map.current)
        return; const current = map.current; const bounds = new google.maps.LatLngBounds(); const layers: (google.maps.Marker | google.maps.Circle)[] = []; for (const p of points) {
        const center = { lat: p.latitude, lng: p.longitude };
        bounds.extend(center);
        if (heat) { /* sobreposição de círculos translúcidos: concentração espacial sem API HeatmapLayer descontinuada */
            for (const [radius, opacity] of [[180, .07], [110, .12], [55, .2]] as const) {
                layers.push(new google.maps.Circle({ map: current, center, radius, fillColor: '#F97316', fillOpacity: opacity, strokeOpacity: 0, clickable: false }));
            }
        }
        else {
            const marker = new google.maps.Marker({ map: current, position: center, title: p.protocol ?? p.category?.name, icon: { path: google.maps.SymbolPath.CIRCLE, scale: 8, fillColor: p.category?.color ?? '#08783E', fillOpacity: 1, strokeColor: '#fff', strokeWeight: 2 } });
            marker.addListener('click', () => callback.current?.(p));
            layers.push(marker);
        }
    } if (points.length === 1) {
        current.setCenter(bounds.getCenter());
        current.setZoom(15);
    }
    else if (points.length > 1)
        current.fitBounds(bounds, 35); return () => { layers.forEach(x => { google.maps.event.clearInstanceListeners(x); x.setMap(null); }); }; }, [ready, points, heat]);
    return <div className="map-wrap">{error ? <div className="map-empty"><Icon name="map" size={38} color="#08783E"/><p>{error}</p>{points[0] && <a href={`https://www.google.com/maps/search/?api=1&query=${points[0].latitude},${points[0].longitude}`} target="_blank" rel="noreferrer">Abrir primeiro ponto no Google Maps</a>}</div> : <><div ref={el} style={{ height: 300, width: '100%' }}/>{!ready && <span>Carregando mapa…</span>}</>}</div>;
}
function Charts({ data }: ChartsProps) { const formatted = (v: unknown) => rows(v).map(r => ({ name: str(r.name), total: num(r.total) })); const category = formatted(data.byCategory), timeline = formatted(data.timeline); return <div className="charts"><section className="chart-card"><h2>Ocorrências por categoria</h2>{category.length ? <ResponsiveContainer width="100%" height={270}><PieChart><Pie data={category} dataKey="total" nameKey="name" outerRadius={90}>{category.map((_, i) => <Cell key={i} fill={palette[i % palette.length] ?? "#08783E"}/>)}</Pie><Tooltip /><Legend /></PieChart></ResponsiveContainer> : <p>Nenhum registro encontrado.</p>}</section><section className="chart-card"><h2>Ocorrências ao longo do tempo</h2>{timeline.length ? <ResponsiveContainer width="100%" height={270}><LineChart data={timeline}><CartesianGrid strokeDasharray="3 3"/><XAxis dataKey="name"/><YAxis allowDecimals={false}/><Tooltip /><Line type="monotone" dataKey="total" stroke="#08783E" strokeWidth={3}/></LineChart></ResponsiveContainer> : <p>Nenhum registro encontrado.</p>}</section></div>; }
async function exportFile(path: string, token: string, filename: string) { const response = await fetch('/api/v1' + path, { headers: { Authorization: `Bearer ${token}` } }); if (!response.ok)
    throw Error(`Não foi possível exportar (${response.status}).`); const url = URL.createObjectURL(await response.blob()); const a = document.createElement('a'); a.href = url; a.download = filename; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
const ui: PlatformUI = { Icon, Logo, Map: WebMap, exportFile };
function Gate() { const { session, loading } = useAuth(); const navigate = useNavigate(), location = useLocation(); const page = location.pathname.replace(/^\/+|\/+$/g, '') || 'dashboard'; if (loading)
    return <div className="loading">Carregando UrbanizaGO…</div>; if (!session)
    return <LoginScreen />; return <AdminApp page={page} onPage={id => navigate('/' + id)} Charts={Charts}/>; }
export function App() { const [client] = useState(() => new QueryClient()); return <QueryClientProvider client={client}><UIProvider value={ui}><AuthProvider base="" client="web" role="ADMIN"><BrowserRouter><Gate /></BrowserRouter></AuthProvider></UIProvider></QueryClientProvider>; }

