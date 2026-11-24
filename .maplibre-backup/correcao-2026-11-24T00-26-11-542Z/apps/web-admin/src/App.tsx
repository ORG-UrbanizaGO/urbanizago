import { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { BrowserRouter, useLocation, useNavigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PieChart, Pie, Cell, Tooltip, Legend, LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from 'recharts';
import { Icon, Logo } from '@urbanizago/icons/web';
import { AuthProvider, UIProvider, LoginScreen, useAuth, rows, str, num, type MapProps, type PlatformUI } from '@urbanizago/app-ui/core';
import { AdminApp, type ChartsProps } from '@urbanizago/app-ui/admin';
const palette = ['#08783E', '#1481C1', '#F59E0B', '#E56B55', '#22A780', '#725AC1', '#64748B'];
function WebMap({ points, heat, onSelect }: MapProps) {
  const container = useRef<HTMLDivElement>(null);
  const instance = useRef<maplibregl.Map | null>(null);
  const callback = useRef(onSelect);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  callback.current = onSelect;

  useEffect(() => {
    if (!container.current) return;
    const map = new maplibregl.Map({
      container: container.current,
      style: import.meta.env.VITE_MAP_STYLE_URL || 'https://demotiles.maplibre.org/style.json',
      center: [-47.88, -15.79], zoom: 5
    });
    instance.current = map;
    map.addControl(new maplibregl.NavigationControl());
    map.once('load', () => setReady(true));
    map.on('error', () => setError('Nao foi possivel carregar o mapa. Verifique a rede e o provedor de tiles.'));
    return () => { instance.current = null; map.remove(); };
  }, []);

  useEffect(() => {
    const map = instance.current;
    if (!map || !ready) return;
    const markers: maplibregl.Marker[] = [];
    const bounds = new maplibregl.LngLatBounds();
    const valid = points.filter(p => Number.isFinite(p.latitude) && Number.isFinite(p.longitude));
    for (const p of valid) {
      const pos: [number, number] = [p.longitude, p.latitude];
      bounds.extend(pos);
      const element = document.createElement('div');
      element.style.width = heat ? '44px' : '18px';
      element.style.height = heat ? '44px' : '18px';
      element.style.borderRadius = '50%';
      if (heat) {
        element.style.background = 'radial-gradient(circle, rgba(249,115,22,.6), rgba(249,115,22,0))';
        element.style.pointerEvents = 'none';
      } else {
        element.style.background = p.category?.color ?? '#08783E';
        element.style.border = '2px solid white';
        element.style.cursor = 'pointer';
        element.title = p.protocol ?? p.category?.name ?? 'Ocorrencia';
        element.addEventListener('click', () => callback.current?.(p));
      }
      markers.push(new maplibregl.Marker({ element, anchor: 'center' }).setLngLat(pos).addTo(map));
    }
    if (!bounds.isEmpty()) {
      if (valid.length === 1) map.flyTo({ center: bounds.getCenter(), zoom: 15 });
      else map.fitBounds(bounds, { padding: 35, maxZoom: 15 });
    }
    return () => markers.forEach(marker => marker.remove());
  }, [ready, points, heat]);

  return <div className="map-wrap">
    {error && <div className="map-empty"><Icon name="map" size={38} color="#08783E"/><p>{error}</p></div>}
    <div ref={container} style={{ height: 300, width: '100%' }}/>
    {!ready && !error && <span>Carregando mapa...</span>}
  </div>;
}

function Charts({ data }: ChartsProps) { const formatted = (v: unknown) => rows(v).map(r => ({ name: str(r.name), total: num(r.total) })); const category = formatted(data.byCategory), timeline = formatted(data.timeline); return <div className="charts"><section className="chart-card"><h2>Ocorrências por categoria</h2>{category.length ? <ResponsiveContainer width="100%" height={270}><PieChart><Pie data={category} dataKey="total" nameKey="name" outerRadius={90}>{category.map((_, i) => <Cell key={i} fill={palette[i % palette.length] ?? "#08783E"}/>)}</Pie><Tooltip /><Legend /></PieChart></ResponsiveContainer> : <p>Nenhum registro encontrado.</p>}</section><section className="chart-card"><h2>Ocorrências ao longo do tempo</h2>{timeline.length ? <ResponsiveContainer width="100%" height={270}><LineChart data={timeline}><CartesianGrid strokeDasharray="3 3"/><XAxis dataKey="name"/><YAxis allowDecimals={false}/><Tooltip /><Line type="monotone" dataKey="total" stroke="#08783E" strokeWidth={3}/></LineChart></ResponsiveContainer> : <p>Nenhum registro encontrado.</p>}</section></div>; }
async function exportFile(path: string, token: string, filename: string) { const response = await fetch('/api/v1' + path, { headers: { Authorization: `Bearer ${token}` } }); if (!response.ok)
    throw Error(`Não foi possível exportar (${response.status}).`); const url = URL.createObjectURL(await response.blob()); const a = document.createElement('a'); a.href = url; a.download = filename; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
const ui: PlatformUI = { Icon, Logo, Map: WebMap, exportFile };
function Gate() { const { session, loading } = useAuth(); const navigate = useNavigate(), location = useLocation(); const page = location.pathname.replace(/^\/+|\/+$/g, '') || 'dashboard'; if (loading)
    return <div className="loading">Carregando UrbanizaGO…</div>; if (!session)
    return <LoginScreen />; return <AdminApp page={page} onPage={id => navigate('/' + id)} Charts={Charts}/>; }
export function App() { const [client] = useState(() => new QueryClient()); return <QueryClientProvider client={client}><UIProvider value={ui}><AuthProvider base="" client="web" role="ADMIN"><BrowserRouter><Gate /></BrowserRouter></AuthProvider></UIProvider></QueryClientProvider>; }

