import { useState } from 'react';
import { View, Text, Image, Pressable } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { File } from 'expo-file-system';
import * as Location from 'expo-location';
import { colors } from '@urbanizago/ui-tokens';
import { paths, type IconProps } from '@urbanizago/icons/paths';
import { Ranking, OccurrenceInfo } from './admin';
import { ActionNotice, Body, Button, Caption, Card, Choices, DataState, Field, Heading, HStack, Item, List, Metric, Notice, Page, Pager, Profile, Notifications, Shell, asPoints, date, json, num, obj, qs, rows, status, str, useAction, useAuth, useData, useUI, type Point, type Row } from './core';
const pages: {
    id: string;
    name: string;
    icon: IconProps['name'];
}[] = [{ id: 'home', name: 'Início', icon: 'home' }, { id: 'map', name: 'Mapa', icon: 'map' }, { id: 'new', name: 'Nova', icon: 'plus' }, { id: 'requests', name: 'Atividades', icon: 'clipboard' }, { id: 'profile', name: 'Perfil', icon: 'user' }];
const titles: Record<string, string> = { home: 'UrbanizaGO', new: 'Nova ocorrência', map: 'Mapa de ocorrências', requests: 'Minhas solicitações', detail: 'Detalhes da ocorrência', ranking: 'Ranking cidadão', profile: 'Meu perfil', medals: 'Medalhas', notifications: 'Notificações', penalties: 'Penalidades e recursos', news: 'Notícias e avisos' };
export function CitizenApp({ page, onPage }: {
    page: string;
    onPage: (v: string) => void;
}) {
    const { session, logout, refresh } = useAuth(); const [section, id] = page.split('/'); if (session?.restricted)
        return <Page><Heading>Conta com acesso restrito</Heading><Notice error message="Sua conta está banida. Você pode consultar o motivo e enviar uma contestação." /><Penalties /><Button secondary label="Verificar situação da conta" onPress={() => void refresh()} /><Button danger label="Sair" onPress={() => void logout().catch(() => { })} /></Page>; return <Shell title={titles[section ?? 'home'] ?? 'UrbanizaGO'} page={section ?? 'home'} pages={pages} onPage={onPage} bottom><Page key={page}>{section === 'new' ? <NewOccurrence done={onPage} /> : section === 'map' ? <CitizenMap open={id => onPage('detail/' + id)} /> : section === 'requests' ? <Requests open={id => onPage('detail/' + id)} /> : section === 'detail' && id ? <Detail id={id} back={() => onPage('requests')} /> : section === 'ranking' ? <Ranking /> : section === 'profile' ? <Profile citizen onMedals={() => onPage('medals')} onPenalties={() => onPage('penalties')} /> : section === 'medals' ? <Medals /> : section === 'notifications' ? <Notifications /> : section === 'penalties' ? <Penalties /> : section === 'news' ? <News /> : <Home go={onPage} />}</Page></Shell>;
}
function Home({ go }: {
    go: (p: string) => void;
}) { const { session } = useAuth(), { Icon } = useUI(), q = useData('/moderation/me'); return <><View style={{ padding: 22, borderRadius: 14, backgroundColor: '#D8EFDF', gap: 10 }}><Heading>Olá, {session?.user.name.split(' ')[0] ?? 'cidadão'}!</Heading><Body>Como podemos melhorar sua cidade hoje?</Body><HStack><Icon name="tree" color={colors.primary} size={42} /><Icon name="home" size={55} color={colors.primaryDark} /><Icon name="tree" color={colors.primary} size={42} /></HStack></View><Button label="Nova ocorrência" icon="camera" onPress={() => go('new')} />{rows(q.data).some(r => r.status === 'ATIVA' && (!r.endsAt || new Date(str(r.endsAt)) > new Date())) && <Card><Notice error message="Você possui uma penalidade ativa." /><Button secondary label="Consultar penalidade" onPress={() => go('penalties')} /></Card>}<View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>{[{ p: 'map', t: 'Mapa de ocorrências', i: 'pin' }, { p: 'requests', t: 'Minhas solicitações', i: 'clipboard' }, { p: 'ranking', t: 'Ranking cidadão', i: 'trophy' }, { p: 'news', t: 'Notícias e avisos', i: 'news' }].map((r, i) => <Pressable key={r.p} accessibilityRole="button" onPress={() => go(r.p)} style={{ flexBasis: '46%', flexGrow: 1, backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: colors.border, padding: 16, gap: 9 }}><Icon name={r.i as IconProps['name']} color={i === 2 ? '#B98600' : colors.primary} size={28} /><Text style={{ fontWeight: '600', color: colors.text }}>{r.t}</Text></Pressable>)}</View><Card><Heading>Cidades melhores começam com você!</Heading><Body>Registre ocorrências, acompanhe o atendimento e ajude a transformar sua cidade.</Body></Card></>; }
function News() { const q = useData('/announcements'); return <><Heading>Notícias e avisos</Heading><DataState query={q}>{d => <List items={rows(d)} render={r => <Card><Heading>{str(r.title)}</Heading><Caption>{date(r.createdAt)}</Caption><Body>{str(r.body)}</Body></Card>} />}</DataState></>; }
function NewOccurrence({ done }: {
    done: (v: string) => void;
}) {
    const { Map, Icon } = useUI(), q = useData('/categories'), a = useAction();
    const [step, setStep] = useState(1), [photos, setPhotos] = useState<ImagePicker.ImagePickerAsset[]>([]), [description, setDescription] = useState(''), [category, setCategory] = useState(''), [point, setPoint] = useState<Point | undefined>(), [address, setAddress] = useState(''), [neighborhood, setNeighborhood] = useState(''), [city, setCity] = useState(''), [error, setError] = useState(''), [locBusy, setLocBusy] = useState(false), [protocol, setProtocol] = useState(''), [lat, setLat] = useState(''), [lng, setLng] = useState('');
    async function pick(camera: boolean) {
        setError(''); try {
            if (camera && (await ImagePicker.requestCameraPermissionsAsync()).status !== 'granted')
                throw Error('Permita acesso à câmera.');
            const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: .7, allowsEditing: false };
            const result = camera ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync({ ...opts, allowsMultipleSelection: true, selectionLimit: Math.max(1, 3 - photos.length) });
            if (!result.canceled)
                setPhotos(old => [...old, ...result.assets].slice(0, 3));
        }
            catch (e) {
                setError(e instanceof Error ? e.message : 'Falha ao abrir imagem.');
            }
    }
    async function locate(p?: Point) {
        setLocBusy(true); setError(''); try {
            let next = p;
            if (!next) {
                const permission = await Location.requestForegroundPermissionsAsync();
                if (permission.status !== 'granted')
                    throw Error('Autorize a localização ou informe coordenadas manualmente.');
                const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
                next = { latitude: position.coords.latitude, longitude: position.coords.longitude };
            }
            setPoint(next);
            setLat(String(next.latitude));
            setLng(String(next.longitude));
            try {
                const [geo] = await Location.reverseGeocodeAsync(next);
                if (geo) {
                    setAddress([geo.street || geo.name, geo.streetNumber].filter(Boolean).join(', '));
                    setNeighborhood(geo.district || geo.subregion || '');
                    setCity(geo.city || geo.subregion || '');
                }
            }
            catch {
                setError('Não foi possível identificar o endereço. Preencha os campos manualmente.');
            }
        }
            catch (e) {
                setError(e instanceof Error ? e.message : 'Localização indisponível.');
            }
            finally {
            setLocBusy(false);
        }
    }
    function submit() {
        if (!point || !address.trim() || !neighborhood.trim() || !city.trim()) {
            setError('Confirme a localização e preencha endereço, bairro e cidade.');
            return;
        } setError(''); const data = new FormData(); Object.entries({ description, categoryId: category, latitude: String(point.latitude), longitude: String(point.longitude), address, neighborhood, city }).forEach(([k, v]) => data.append(k, v)); for (const photo of photos) {
            const mime = photo.mimeType ?? (photo.uri.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg');
            if (!['image/jpeg', 'image/png', 'image/webp'].includes(mime)) {
                setError('Selecione fotos JPEG, PNG ou WebP.');
                return;
            }
            const file = new File(photo.uri);
            data.append('photos', file, photo.fileName ?? `foto.${mime.split('/')[1]}`);
        } void a.run('/occurrences', { method: 'POST', body: data }, d => { setProtocol(str(obj(d).protocol)); setStep(4); });
    }
    if (step === 4)
        return <Card><View style={{ alignItems: 'center', gap: 18, paddingVertical: 20 }}><Icon name="check" size={78} color={colors.primary} /><Heading>Ocorrência registrada com sucesso!</Heading><Caption>Número do protocolo</Caption><Text style={{ color: colors.primary, fontSize: 25, fontWeight: '700' }}>{protocol}</Text><Body>Pendente de validação · 0 pontos até a análise.</Body></View><Button label="Ver minhas solicitações" onPress={() => done('requests')} /><Button secondary label="Registrar outra ocorrência" onPress={() => { setStep(1); setPhotos([]); setDescription(''); setCategory(''); setPoint(undefined); setAddress(''); setNeighborhood(''); setCity(''); }} /></Card>;
    return <><HStack>{[1, 2, 3].map(i => <View key={i} style={{ flex: 1, backgroundColor: i <= step ? colors.primary : colors.border, borderRadius: 8, padding: 9, alignItems: 'center' }}><Text style={{ color: i <= step ? '#fff' : colors.muted, fontWeight: '700' }}>{i}</Text></View>)}</HStack>{step === 1 ? <Card><Heading>Foto e descrição</Heading><HStack>{photos.map((p, i) => <View key={p.uri} style={{ gap: 5 }}><Image source={{ uri: p.uri }} style={{ width: 100, height: 100, borderRadius: 8 }} /><Button secondary label="Remover" onPress={() => setPhotos(v => v.filter((_, j) => j !== i))} /></View>)}</HStack><HStack><Button secondary label="Câmera" icon="camera" disabled={photos.length >= 3} onPress={() => void pick(true)} /><Button secondary label="Galeria" disabled={photos.length >= 3} onPress={() => void pick(false)} /></HStack><Field label="Descreva o problema (até 500 caracteres)" value={description} onChange={v => setDescription(v.slice(0, 500))} multiline /><Caption>{description.length}/500</Caption><Button label="Próximo" disabled={!description.trim() || !photos.length} onPress={() => setStep(2)} /></Card> : step === 2 ? <Card><Heading>Selecione a categoria</Heading><DataState query={q}>{d => <List items={rows(d)} render={r => { const icon = str(r.icon, 'more'); return <Pressable accessibilityRole="button" onPress={() => setCategory(str(r.id))} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderColor: category === r.id ? colors.primary : colors.border, backgroundColor: category === r.id ? colors.primaryLight : '#fff', padding: 14, borderRadius: 8 }}><Icon name={icon in paths ? icon as IconProps['name'] : 'more'} color={str(r.color, colors.primary)} /><View style={{ flex: 1 }}><Body>{str(r.name)}</Body></View>{category === r.id && <Icon name="check" color={colors.primary} />}</Pressable>; }} />}</DataState><Button label="Próximo" disabled={!category} onPress={() => { setStep(3); void locate(); }} /><Button secondary label="Voltar" onPress={() => setStep(1)} /></Card> : <Card><Heading>Confirme a localização</Heading><Map points={[]} selected={point} onPoint={p => void locate(p)} /><Button secondary icon="pin" label={locBusy ? 'Localizando…' : 'Usar meu GPS'} disabled={locBusy} onPress={() => void locate()} /><HStack><View style={{ flex: 1, minWidth: 130 }}><Field label="Latitude" value={lat} onChange={setLat} /></View><View style={{ flex: 1, minWidth: 130 }}><Field label="Longitude" value={lng} onChange={setLng} /></View></HStack><Button secondary label="Confirmar coordenadas" onPress={() => {
        const la = Number(lat.replace(',', '.')), lo = Number(lng.replace(',', '.')); if (lat.trim() && lng.trim() && Number.isFinite(la) && Number.isFinite(lo) && Math.abs(la) <= 90 && Math.abs(lo) <= 180) {
            void locate({ latitude: la, longitude: lo });
        }
        else
            setError('Coordenadas inválidas.');
    }} /><Field label="Endereço" value={address} onChange={setAddress} /><Field label="Bairro" value={neighborhood} onChange={setNeighborhood} /><Field label="Cidade" value={city} onChange={setCity} /><Button label="Confirmar e registrar" disabled={a.busy || locBusy || !point} onPress={submit} /><Button secondary label="Voltar" onPress={() => setStep(2)} /></Card>}<Notice error message={error} /><ActionNotice action={a} /></>;
}
function CitizenMap({ open }: {
    open: (id: string) => void;
}) { const [category, setCategory] = useState(''), [search, setSearch] = useState(''), [applied, setApplied] = useState(''), [view, setView] = useState('markers'); const cats = useData('/categories'), q = useData('/occurrences/map' + qs({ categoryId: category, q: applied })), { Map } = useUI(); return <><Field label="Buscar endereço ou bairro" value={search} onChange={setSearch} /><Button label="Buscar" icon="search" onPress={() => setApplied(search)} /><Choices label="Categorias" value={category} onChange={setCategory} options={[{ value: '', label: 'Todas' }, ...rows(cats.data).map(r => ({ value: str(r.id), label: str(r.name) }))]} /><Choices label="Visualização" value={view} onChange={setView} options={[{ value: 'markers', label: 'Marcadores' }, { value: 'heat', label: 'Mapa de calor' }]} /><DataState query={q}>{d => <><Card><Map points={asPoints(obj(d).items)} heat={view === 'heat'} onSelect={p => p.id && open(p.id)} /></Card><List items={rows(obj(d).items)} render={r => <Item title={str(r.protocol)} subtitle={str(obj(r.category).name)} meta={status(r.status)} onPress={() => open(str(r.id))} />} /></>}</DataState></>; }
function Requests({ open }: {
    open: (id: string) => void;
}) { const [group, setGroup] = useState(''), [page, setPage] = useState(1); const q = useData('/occurrences' + qs({ mine: 'true', group, page, limit: 20 })); return <><Heading>Minhas solicitações</Heading><Choices label="Exibir" value={group} onChange={v => { setGroup(v); setPage(1); }} options={[{ value: '', label: 'Todas' }, { value: 'open', label: 'Abertas' }, { value: 'resolved', label: 'Resolvidas' }]} /><DataState query={q}>{d => <><List items={rows(d)} render={r => <Item title={str(r.protocol)} subtitle={str(obj(r.category).name)} meta={`${status(r.status)} · ${status(r.validationStatus)}`} image={str(rows(r.photos)[0]?.url, '') || undefined} onPress={() => open(str(r.id))} />} /><Pager data={d} page={page} onPage={setPage} /></>}</DataState></>; }
function Detail({ id, back }: {
    id: string;
    back: () => void;
}) { const q = useData(`/occurrences/${id}`), { session } = useAuth(); const a = useAction(), [score, setScore] = useState('5'), [comment, setComment] = useState(''); return <><Button secondary label="Voltar" onPress={back} /><DataState query={q}>{d => { const r = obj(d); return <><OccurrenceInfo data={r} />{r.userId === session?.user.id && <Card><Heading>Pontos desta ocorrência</Heading><Metric label="Pontos por validação e resolução" value={r.validationStatus === 'VALIDADA' && !r.duplicateOfId ? (r.status === 'RESOLVIDO' ? 30 : 10) : 0} /><Caption>Não inclui bônus mensais ou estornos por penalidades. Consulte o extrato.</Caption></Card>}{r.userId === session?.user.id && r.status === 'RESOLVIDO' && r.validationStatus === 'VALIDADA' && <Card><Heading>Avalie o atendimento</Heading>{r.rating ? <Body>Nota: {num(obj(r.rating).score)} de 5</Body> : <><Choices label="Nota" value={score} onChange={setScore} options={[1, 2, 3, 4, 5].map(n => ({ value: String(n), label: String(n) }))} /><Field label="Comentário (opcional)" value={comment} onChange={setComment} multiline /><Button label="Enviar avaliação" onPress={() => void a.run(`/occurrences/${id}/rating`, json('POST', { score: Number(score), comment }))} /></>}</Card>}</>; }}</DataState><ActionNotice action={a} /></>; }
function Medals() { const q = useData('/gamification/medals'), p = useData('/gamification/points?limit=100'), { Icon } = useUI(); return <><Heading>Minhas medalhas</Heading><DataState query={q}>{d => <List items={rows(d)} render={r => { const kind = r.code === 'CITY' ? 'Fiscal' : r.code === 'NEIGHBORHOOD' ? 'Guardian' : 'Environmental', tier = r.level === 'OURO' ? 'Gold' : r.level === 'PRATA' ? 'Silver' : 'Bronze'; return <Card><HStack><Icon name={`medal${kind}${tier}` as IconProps['name']} size={54} /><View style={{ flex: 1 }}><Heading>{str(r.name)}</Heading><Caption>{r.level ? status(r.level) : 'Ainda não conquistada'}</Caption></View></HStack><Body>{str(r.description)}</Body><Caption>{num(r.count)} registros · {r.nextGoal ? `Próxima meta: ${num(r.nextGoal)}` : 'Nível máximo'}</Caption><View style={{ height: 8, borderRadius: 5, backgroundColor: colors.primaryLight }}><View style={{ height: 8, borderRadius: 5, backgroundColor: colors.primary, width: `${Math.min(100, num(r.count) / Math.max(1, num(r.nextGoal) || num(r.count)) * 100)}%` }} /></View></Card>; }} />}</DataState><Heading>Extrato de pontos</Heading><DataState query={p}>{d => <List items={rows(d)} render={r => <Item title={`${num(r.points) > 0 ? '+' : ''}${num(r.points)} pontos`} subtitle={str(r.reason)} meta={date(r.createdAt)} />} />}</DataState></>; }
export function Penalties() { const q = useData('/moderation/me'); return <><Heading>Penalidades e contestações</Heading><DataState query={q}>{d => <List items={rows(d)} render={r => <PenaltyCard key={str(r.id)} item={r} />} />}</DataState></>; }
function PenaltyCard({ item: r }: {
    item: Row;
}) {
    const a = useAction(), [text, setText] = useState(''), [photos, setPhotos] = useState<ImagePicker.ImagePickerAsset[]>([]), [error, setError] = useState(''); async function pick() {
        setError(''); try {
            const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: .7, allowsMultipleSelection: true, selectionLimit: Math.max(1, 3 - photos.length) });
            if (!result.canceled)
                setPhotos(v => [...v, ...result.assets].slice(0, 3));
        }
            catch {
                setError('Não foi possível selecionar imagens.');
            }
    } function send() {
        if (!photos.length) {
            void a.run('/appeals', json('POST', { sanctionId: r.id, text }));
            return;
        } const body = new FormData(); body.append('sanctionId', str(r.id)); body.append('text', text); for (const p of photos) {
            const mime = p.mimeType ?? (p.uri.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg');
            if (!['image/jpeg', 'image/png', 'image/webp'].includes(mime)) {
                setError('Envie JPEG, PNG ou WebP.');
                return;
            }
            const file = new File(p.uri);
            body.append('attachments', file, p.fileName ?? `evidencia.${mime.split('/')[1]}`);
        } void a.run('/appeals', { method: 'POST', body });
    } return <Card><Heading>{status(r.type)}</Heading><Caption>{status(r.status)} · {date(r.startsAt)}</Caption><Body>{str(r.reason)}</Body>{Boolean(r.endsAt) && <Caption>Término: {date(r.endsAt)}</Caption>}{r.appeal ? <><Heading>Contestação: {status(obj(r.appeal).status)}</Heading><Body>{str(obj(r.appeal).text)}</Body><Caption>{str(obj(r.appeal).response, 'Aguardando decisão.')}</Caption>{rows(obj(r.appeal).attachments).map(p => <Image key={str(p.id)} source={{ uri: str(p.url) }} style={{ height: 170, width: '100%', borderRadius: 8 }} />)}</> : r.status !== 'REVERTIDA' && <><Field label="Explique sua contestação" value={text} onChange={setText} multiline /><Button secondary label="Anexar fotos (opcional)" disabled={photos.length >= 3} onPress={() => void pick()} />{photos.map((p, i) => <HStack key={p.uri}><Image source={{ uri: p.uri }} style={{ width: 70, height: 70, borderRadius: 8 }} /><Button secondary label="Remover" onPress={() => setPhotos(v => v.filter((_, j) => i !== j))} /></HStack>)}<Button label="Contestar penalidade" disabled={!text.trim() || a.busy} onPress={send} /></>}<Notice error message={error} /><ActionNotice action={a} /></Card>;
}

