import React, { createContext, useContext, useEffect, useMemo, useRef, useState, type ComponentType, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View, StyleSheet, Image, useWindowDimensions } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ApiError, createApiClient, statusLabels, type Role, type OccurrenceStatus } from '@urbanizago/shared';
import { colors, radius, spacing } from '@urbanizago/ui-tokens';
import type { IconProps } from '@urbanizago/icons/paths';
export type Row = Record<string, unknown>;
export type Api = <T>(path: string, init?: RequestInit) => Promise<T>;
export type User = {
    id: string;
    name: string;
    email: string;
    role: Role;
    status: string;
    neighborhood?: string | null;
};
export type Session = {
    user: User;
    accessToken: string;
    refreshToken?: string;
    restricted: boolean;
};
export type Storage = {
    get: () => Promise<string | null>;
    set: (v: string) => Promise<void>;
    clear: () => Promise<void>;
};
export type Point = {
    id?: string;
    protocol?: string;
    latitude: number;
    longitude: number;
    category?: {
        name: string;
        color: string;
    };
    weight?: number;
};
export type MapProps = {
    points: Point[];
    heat?: boolean;
    selected?: Point;
    onSelect?: (p: Point) => void;
    onPoint?: (p: Point) => void;
};
export type PlatformUI = {
    Icon: ComponentType<IconProps>;
    Logo: ComponentType<{
        size?: number;
    }>;
    Map: ComponentType<MapProps>;
    exportFile: (path: string, token: string, filename: string) => Promise<void>;
};
const UI = createContext<PlatformUI | null>(null);
export const useUI = () => { const c = useContext(UI); if (!c)
    throw Error('Interface não configurada'); return c; };
export const UIProvider = UI.Provider;
const Auth = createContext<{
    session: Session | null;
    api: Api;
    logout: () => Promise<void>;
    login: (email: string, password: string) => Promise<void>;
    loading: boolean;
    refresh: () => Promise<Session | null>;
} | null>(null);
export const useAuth = () => { const c = useContext(Auth); if (!c)
    throw Error('Autenticação não configurada'); return c; };
/** Access em memória; refresh por cookie httpOnly (web) ou SecureStore (mobile). */
export function AuthProvider({ base, client, role, storage, children }: {
    base: string;
    client: 'web' | 'mobile';
    role: Role;
    storage?: Storage;
    children: ReactNode;
}) {
    const [session, setSession] = useState<Session | null>(null), [loading, setLoading] = useState(true);
    const ref = useRef<Session | null>(null);
    const inFlight = useRef<Promise<Session | null> | null>(null);
    const qc = useQueryClient();
    const raw = useMemo(() => createApiClient(base, () => ref.current?.accessToken ?? null), [base]);
    const apply = async (s: Session | null) => { if (s && s.user.role !== role)
        throw Error('Conta sem permissão para este aplicativo.'); if (storage) {
        if (s?.refreshToken)
            await storage.set(s.refreshToken);
        else if (!s)
            await storage.clear();
    } ref.current = s; setSession(s); };
    const refresh = () => { if (inFlight.current)
        return inFlight.current; const task = (async () => { try {
        const token = client === 'mobile' ? await storage?.get() : undefined;
        if (client === 'mobile' && !token)
            return null;
        const s = await raw<Session>('/auth/refresh', json('POST', { client, refreshToken: token ?? undefined }));
        await apply(s);
        return s;
    }
    catch (e) {
        if (e instanceof ApiError && [401, 403].includes(e.status)) {
            await apply(null);
            qc.clear();
        }
        return null;
    } })(); inFlight.current = task; void task.finally(() => { inFlight.current = null; }); return task; };
    useEffect(() => { void refresh().finally(() => setLoading(false)); }, [raw]);
    const api: Api = async <T,>(path: string, init?: RequestInit) => { try {
        return await raw<T>(path, init);
    }
    catch (e) {
        if (e instanceof ApiError && e.status === 401 && !path.startsWith('/auth/')) {
            if (await refresh())
                return raw<T>(path, init);
        }
        else if (e instanceof ApiError && e.payload.code === 'BANNED') {
            await refresh();
        }
        throw e;
    } };
    const login = async (email: string, password: string) => { const s = await raw<Session>('/auth/login', json('POST', { email, password, client })); if (s.user.role !== role) {
        await createApiClient(base, () => s.accessToken)('/auth/logout', json('POST', { client, refreshToken: s.refreshToken })).catch(() => null);
        throw Error('Conta sem permissão para este aplicativo.');
    } qc.clear(); await apply(s); };
    const logout = async () => { try {
        await api('/auth/logout', json('POST', { client, refreshToken: ref.current?.refreshToken }));
    }
    finally {
        await apply(null);
        qc.clear();
    } };
    return <Auth.Provider value={{ session, api, login, logout, loading, refresh }}>{children}</Auth.Provider>;
}
export const json = (method: string, body?: unknown): RequestInit => ({ method, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
export const str = (v: unknown, fallback = '—') => typeof v === 'string' && v.length ? v : typeof v === 'number' ? String(v) : fallback;
export const num = (v: unknown) => typeof v === 'number' ? v : 0;
export const obj = (v: unknown): Row => v && typeof v === 'object' && !Array.isArray(v) ? v as Row : {};
export const rows = (v: unknown): Row[] => Array.isArray(v) ? v.map(obj) : Array.isArray(obj(v).items) ? (obj(v).items as unknown[]).map(obj) : [];
export const date = (v: unknown) => typeof v === 'string' ? new Date(v).toLocaleString('pt-BR') : '—';
const labels: Record<string, string> = { PENDENTE: 'Pendente', VALIDADA: 'Validada', REJEITADA: 'Rejeitada', BAIXA: 'Baixa', MEDIA: 'Média', ALTA: 'Alta', URGENTE: 'Urgente', ACTIVE: 'Ativo', BLOCKED: 'Bloqueado', DELETED: 'Excluído', CITIZEN: 'Cidadão', ADMIN: 'Administrador', ADVERTENCIA: 'Advertência', SUSPENSAO: 'Suspensão', BANIMENTO: 'Banimento', ATIVA: 'Ativa', EXPIRADA: 'Expirada', REVERTIDA: 'Revertida', ACEITO: 'Aceito', NEGADO: 'Negado', PENDING: 'Pendente', PROCESSING: 'Enviando', SENT: 'Enviado', FAILED: 'Falha', BRONZE: 'Bronze', PRATA: 'Prata', OURO: 'Ouro' };
export const status = (v: unknown) => statusLabels[str(v) as OccurrenceStatus] ?? labels[str(v)] ?? str(v).replaceAll('_', ' ');
export const qs = (v: Record<string, string | number | undefined>) => { const p = new URLSearchParams(); Object.entries(v).forEach(([k, x]) => { if (x !== undefined && x !== '')
    p.set(k, String(x)); }); return p.size ? '?' + p.toString() : ''; };
export const asPoints = (v: unknown): Point[] => rows(v).filter(r => typeof r.latitude === 'number' && typeof r.longitude === 'number').map(r => ({ id: typeof r.id === 'string' ? r.id : undefined, protocol: str(r.protocol, ''), latitude: num(r.latitude), longitude: num(r.longitude), category: r.category ? { name: str(obj(r.category).name), color: str(obj(r.category).color, colors.primary) } : undefined, weight: num(r.weight) || 1 }));
export function useData(path: string, enabled = true) { const { api } = useAuth(); return useQuery({ queryKey: [path], queryFn: () => api<unknown>(path), enabled, staleTime: 15000, retry: false }); }
export function useAction() { const { api } = useAuth(), qc = useQueryClient(); const [busy, setBusy] = useState(false), [message, setMessage] = useState(''), [error, setError] = useState(''); const lock = useRef(false); async function run(path: string, init: RequestInit, after?: (v: unknown) => void) { if (lock.current)
    return; lock.current = true; setBusy(true); setMessage(''); setError(''); try {
    const result = await api(path, init);
    setMessage('Operação realizada com sucesso.');
    await qc.invalidateQueries();
    after?.(result);
}
catch (e) {
    setError(e instanceof Error ? e.message : 'Falha na operação.');
}
finally {
    lock.current = false;
    setBusy(false);
} } return { run, busy, message, error }; }
export function Notice({ message, error = false }: {
    message: string;
    error?: boolean;
}) { return message ? <Text accessibilityRole="alert" style={[s.notice, { color: error ? colors.danger : colors.primaryDark, backgroundColor: error ? '#FDECEA' : colors.primaryLight }]}>{message}</Text> : null; }
export function ActionNotice({ action }: {
    action: ReturnType<typeof useAction>;
}) { return <><Notice message={action.error} error/><Notice message={action.message}/>{action.busy && <ActivityIndicator color={colors.primary}/>}</>; }
export function Heading({ children }: {
    children: ReactNode;
}) { return <Text accessibilityRole="header" style={s.heading}>{children}</Text>; }
export function Caption({ children }: {
    children: ReactNode;
}) { return <Text style={s.caption}>{children}</Text>; }
export function Body({ children }: {
    children: ReactNode;
}) { return <Text style={s.body}>{children}</Text>; }
export function Card({ children }: {
    children: ReactNode;
}) { return <View style={s.card}>{children}</View>; }
export function HStack({ children }: {
    children: ReactNode;
}) { return <View style={s.row}>{children}</View>; }
export function Button({ label, onPress, secondary = false, danger = false, disabled = false, icon }: {
    label: string;
    onPress: () => void;
    secondary?: boolean;
    danger?: boolean;
    disabled?: boolean;
    icon?: IconProps['name'];
}) { const { Icon } = useUI(); return <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={disabled} onPress={onPress} style={({ pressed }) => [s.button, secondary && s.outline, danger && { backgroundColor: colors.danger, borderColor: colors.danger }, disabled && { opacity: .5 }, pressed && { opacity: .75 }]}>{icon && <Icon name={icon} color={secondary ? colors.primary : '#fff'} size={19}/>}<Text style={[s.buttonText, secondary && !danger && { color: colors.primary }]}>{label}</Text></Pressable>; }
export function Field({ label, value, onChange, secret = false, multiline = false, keyboard = 'default' }: {
    label: string;
    value: string;
    onChange: (v: string) => void;
    secret?: boolean;
    multiline?: boolean;
    keyboard?: 'default' | 'email-address' | 'numeric';
}) { return <View style={{ gap: 4 }}><Text style={s.label}>{label}</Text><TextInput accessibilityLabel={label} value={value} onChangeText={onChange} secureTextEntry={secret} multiline={multiline} keyboardType={keyboard} autoCapitalize={secret || keyboard === 'email-address' ? 'none' : 'sentences'} style={[s.input, multiline && { minHeight: 86, textAlignVertical: 'top' }]}/></View>; }
export function Choices({ label, value, onChange, options }: {
    label: string;
    value: string;
    onChange: (v: string) => void;
    options: {
        value: string;
        label: string;
    }[];
}) { return <View style={{ gap: 6 }}><Text style={s.label}>{label}</Text><HStack>{options.map(o => <Pressable key={o.value} accessibilityRole="button" accessibilityState={{ selected: o.value === value }} onPress={() => onChange(o.value)} style={[s.chip, o.value === value && s.chipActive]}><Text style={{ color: o.value === value ? 'white' : colors.text, fontWeight: '500' }}>{o.label}</Text></Pressable>)}</HStack></View>; }
export function MultiChoices({ label, value, onChange, options }: {
    label: string;
    value: string[];
    onChange: (v: string[]) => void;
    options: {
        value: string;
        label: string;
    }[];
}) { return <View style={{ gap: 6 }}><Text style={s.label}>{label}</Text><HStack>{options.map(o => <Pressable key={o.value} accessibilityRole="checkbox" accessibilityState={{ checked: value.includes(o.value) }} onPress={() => onChange(value.includes(o.value) ? value.filter(v => v !== o.value) : [...value, o.value])} style={[s.chip, value.includes(o.value) && s.chipActive]}><Text style={{ color: value.includes(o.value) ? 'white' : colors.text }}>{o.label}</Text></Pressable>)}</HStack></View>; }
export function DataState({ query, children }: {
    query: ReturnType<typeof useData>;
    children: (data: unknown) => ReactNode;
}) { if (query.isPending)
    return <ActivityIndicator size="large" color={colors.primary}/>; if (query.isError)
    return <Card><Notice error message={query.error instanceof Error ? query.error.message : 'Falha ao carregar.'}/><Button label="Tentar novamente" onPress={() => void query.refetch()}/></Card>; return <>{children(query.data)}</>; }
export function List({ items, render }: {
    items: Row[];
    render: (r: Row, i: number) => ReactNode;
}) { return items.length ? <>{items.map((r, i) => <React.Fragment key={str(r.id, String(i))}>{render(r, i)}</React.Fragment>)}</> : <Card><Caption>Nenhum registro encontrado.</Caption></Card>; }
export function Pager({ data, page, onPage }: {
    data: unknown;
    page: number;
    onPage: (p: number) => void;
}) { const r = obj(data); return <HStack><Button secondary disabled={page <= 1} label="Anterior" onPress={() => onPage(page - 1)}/><Body>Página {page} · {num(r.total)} registros</Body><Button secondary disabled={page * num(r.limit) >= num(r.total)} label="Próxima" onPress={() => onPage(page + 1)}/></HStack>; }
export function Item({ title, subtitle, meta, onPress, image }: {
    title: string;
    subtitle?: string;
    meta?: string;
    onPress?: () => void;
    image?: string;
}) { return <Pressable accessibilityRole={onPress ? 'button' : undefined} onPress={onPress} style={s.item}>{image && <Image source={{ uri: image }} style={s.thumb} accessibilityLabel="Foto da ocorrência"/>}<View style={{ flex: 1, gap: 4 }}><Text style={s.label}>{title}</Text>{subtitle && <Caption>{subtitle}</Caption>}{meta && <Text style={{ color: colors.primary, fontWeight: '600' }}>{meta}</Text>}</View>{onPress && <Text style={{ color: colors.muted, fontSize: 24 }}>›</Text>}</Pressable>; }
export function Page({ children }: {
    children: ReactNode;
}) { return <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={{ padding: spacing.md, gap: 12, paddingBottom: 32 }} keyboardShouldPersistTaps="handled">{children}</ScrollView>; }
const loginSchema = z.object({ email: z.string().email('Informe um e-mail válido.'), password: z.string().min(8, 'Mínimo de 8 caracteres.') });
export function LoginScreen({ citizen = false }: {
    citizen?: boolean;
}) {
    const { login, api } = useAuth(), { Logo } = useUI();
    const [mode, setMode] = useState('login'), [name, setName] = useState(''), [neighborhood, setNeighborhood] = useState(''), [token, setToken] = useState(''), [message, setMessage] = useState(''), [error, setError] = useState(''), [busy, setBusy] = useState(false);
    const { control, handleSubmit, formState } = useForm<z.infer<typeof loginSchema>>({ resolver: zodResolver(loginSchema), defaultValues: { email: '', password: '' } });
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    async function submit(fn: () => Promise<void>) { setBusy(true); setError(''); setMessage(''); try {
        await fn();
    }
    catch (e) {
        setError(e instanceof Error ? e.message : 'Falha na operação.');
    }
    finally {
        setBusy(false);
    } }
    return <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: 20, backgroundColor: colors.background }} keyboardShouldPersistTaps="handled"><View style={{ width: '100%', maxWidth: 450, gap: 16 }}><HStack><Logo size={52}/><Heading>UrbanizaGO</Heading></HStack><Caption>Cidades melhores começam com você!</Caption><Card><Heading>{mode === 'login' ? 'Entrar' : mode === 'register' ? 'Criar conta' : mode === 'forgot' ? 'Recuperar senha' : 'Redefinir senha'}</Heading>{mode === 'login' ? <><Controller control={control} name="email" render={({ field }) => <Field label="E-mail" value={field.value} onChange={field.onChange} keyboard="email-address"/>}/><Controller control={control} name="password" render={({ field }) => <Field label="Senha" value={field.value} onChange={field.onChange} secret/>}/><Notice error message={formState.errors.email?.message ?? formState.errors.password?.message ?? ''}/><Button label="Entrar" disabled={busy} onPress={() => void handleSubmit(v => submit(() => login(v.email, v.password)))()}/><Button secondary label="Esqueci minha senha" onPress={() => setMode('forgot')}/>{citizen && <Button secondary label="Criar conta" onPress={() => setMode('register')}/>}</> : <>{mode === 'register' && <><Field label="Nome completo" value={name} onChange={setName}/><Field label="Bairro" value={neighborhood} onChange={setNeighborhood}/></>}{mode !== 'reset' && <Field label="E-mail" value={email} onChange={setEmail} keyboard="email-address"/>}{mode === 'reset' && <Field label="Código recebido por e-mail" value={token} onChange={setToken}/>}{mode !== 'forgot' && <Field label="Senha" value={password} onChange={setPassword} secret/>}<Button disabled={busy} label={mode === 'forgot' ? 'Enviar instruções' : mode === 'reset' ? 'Redefinir' : 'Cadastrar'} onPress={() => void submit(async () => { if (mode === 'register') {
        await api('/auth/register', json('POST', { name, email, password, neighborhood: neighborhood || undefined }));
        setMode('login');
        setMessage('Cadastro realizado. Faça login.');
    }
    else if (mode === 'forgot') {
        await api('/auth/forgot-password', json('POST', { email }));
        setMode('reset');
        setMessage('Se o e-mail existir, enviaremos instruções.');
    }
    else {
        await api('/auth/verify-reset', json('POST', { token: token.trim() }));
        await api('/auth/reset-password', json('POST', { token: token.trim(), password }));
        setMode('login');
        setMessage('Senha redefinida. Faça login.');
    } })}/><Button secondary label="Voltar ao login" onPress={() => setMode('login')}/></>}<Notice error message={error}/><Notice message={message}/>{busy && <ActivityIndicator color={colors.primary}/>}</Card></View></ScrollView>;
}
export function Notifications() { const q = useData('/notifications?limit=100'), a = useAction(); return <><Heading>Notificações</Heading><Button label="Marcar todas como lidas" onPress={() => void a.run('/notifications/read-all', json('PATCH'))}/><ActionNotice action={a}/><DataState query={q}>{d => <List items={rows(d)} render={r => <Card><Item title={str(r.title)} subtitle={str(r.message)} meta={date(r.createdAt)}/>{!r.readAt && <Button secondary label="Marcar como lida" onPress={() => void a.run(`/notifications/${r.id}/read`, json('PATCH'))}/>}</Card>}/>}</DataState></>; }
export function Profile({ citizen = false, onPenalties, onMedals }: {
    citizen?: boolean;
    onPenalties?: () => void;
    onMedals?: () => void;
}) { const q = useData('/users/me'); return <DataState query={q}>{d => <ProfileForm key={str(obj(d).id)} data={obj(d)} citizen={citizen} onPenalties={onPenalties} onMedals={onMedals}/>}</DataState>; }
function ProfileForm({ data: d, citizen, onPenalties, onMedals }: {
    data: Row;
    citizen: boolean;
    onPenalties?: () => void;
    onMedals?: () => void;
}) { const { logout } = useAuth(); const a = useAction(); const [name, setName] = useState(str(d.name, '')), [phone, setPhone] = useState(str(d.phone, '')), [neighborhood, setNeighborhood] = useState(str(d.neighborhood, '')), [hide, setHide] = useState(d.hideFromRanking ? 'true' : 'false'), [push, setPush] = useState(d.pushEnabled ? 'true' : 'false'), [current, setCurrent] = useState(''), [next, setNext] = useState(''), [del, setDel] = useState(''), [confirm, setConfirm] = useState(''), [code, setCode] = useState(''), [requested, setRequested] = useState(false); return <><Heading>Meu perfil</Heading><Card><Heading>{str(d.name)}</Heading><Caption>{str(d.email)}</Caption>{citizen && <HStack><Metric label="Registradas" value={num(d.registered)}/><Metric label="Resolvidas" value={num(d.resolved)}/><Metric label="Pontos" value={num(d.points)}/></HStack>}</Card><Card><Heading>Meus dados</Heading><Field label="Nome" value={name} onChange={setName}/><Field label="Telefone" value={phone} onChange={setPhone}/><Field label="Bairro" value={neighborhood} onChange={setNeighborhood}/><Choices label="Ocultar nome no ranking" value={hide} onChange={setHide} options={yesNo}/><Choices label="Notificações push" value={push} onChange={setPush} options={yesNo}/><Button label="Salvar preferências" onPress={() => void a.run('/users/me', json('PATCH', { name, phone: phone || null, neighborhood: neighborhood || null, hideFromRanking: hide === 'true', pushEnabled: push === 'true' }))}/></Card>{citizen && <Card><Button secondary label="Medalhas" onPress={() => onMedals?.()}/><Button secondary label="Penalidades e recursos" onPress={() => onPenalties?.()}/></Card>}<Card><Heading>Alterar senha</Heading><Field label="Senha atual" value={current} onChange={setCurrent} secret/><Field label="Nova senha" value={next} onChange={setNext} secret/><Button label="Alterar senha" onPress={() => void a.run('/users/me/password', json('POST', { currentPassword: current, newPassword: next }), () => void logout().catch(() => { }))}/></Card>{citizen && <Card><Heading>Excluir minha conta</Heading><Body>Seus dados pessoais serão anonimizados. Ocorrências permanecem para fins históricos. Esta ação é irreversível.</Body><Field label="Senha" value={del} onChange={setDel} secret/><Button secondary label="Enviar código de confirmação por e-mail" disabled={!del || a.busy} onPress={() => void a.run('/account/delete/request', json('POST', { password: del }), () => setRequested(true))}/>{requested && <><Field label="Código recebido por e-mail" value={code} onChange={setCode}/><Field label="Digite EXCLUIR para confirmar" value={confirm} onChange={setConfirm}/><Button danger label="Excluir conta" disabled={confirm !== 'EXCLUIR' || !del || code.trim().length !== 64} onPress={() => void a.run('/account/delete', json('POST', { password: del, token: code.trim() }), () => void logout().catch(() => { }))}/></>}</Card>}<ActionNotice action={a}/><Button danger label="Sair da conta" onPress={() => void logout().catch(() => { })}/></>; }
export const yesNo = [{ value: 'true', label: 'Sim' }, { value: 'false', label: 'Não' }];
export function Metric({ label, value }: {
    label: string;
    value: number | string;
}) { return <View style={{ minWidth: 115, flexGrow: 1, backgroundColor: colors.surface, borderRadius: radius.md, padding: 13, borderWidth: 1, borderColor: colors.border, gap: 4 }}><Caption>{label}</Caption><Text style={{ fontSize: 25, fontWeight: '700', color: colors.primaryDark }}>{value}</Text></View>; }
export function Bars({ data }: {
    data: unknown;
}) { const r = rows(data), max = Math.max(1, ...r.map(x => num(x.total))); return <List items={r} render={x => <View style={{ gap: 5 }}><HStack><Body>{str(x.name)}</Body><Caption>{num(x.total)}</Caption></HStack><View style={{ height: 9, backgroundColor: colors.primaryLight, borderRadius: 5 }}><View style={{ height: 9, width: `${num(x.total) / max * 100}%`, backgroundColor: colors.primary, borderRadius: 5 }}/></View></View>}/>; }
export function Shell({ title, pages, page, onPage, children, logout, bottom = false }: {
    title: string;
    pages: {
        id: string;
        name: string;
        icon: IconProps['name'];
    }[];
    page: string;
    onPage: (id: string) => void;
    children: ReactNode;
    logout?: () => void;
    bottom?: boolean;
}) { const { width } = useWindowDimensions(), { Logo, Icon } = useUI(), wide = width >= 900 && !bottom; const [menu, setMenu] = useState(false); return <View style={{ flex: 1, flexDirection: wide ? 'row' : 'column', backgroundColor: colors.background }}>{wide && <View style={{ width: 235, backgroundColor: colors.sidebar, padding: 18, gap: 12 }}><HStack><Logo size={32}/><Text style={{ fontSize: 21, color: '#fff', fontWeight: '700' }}>UrbanizaGO</Text></HStack>{pages.map(p => <Pressable accessibilityRole="button" key={p.id} onPress={() => onPage(p.id)} style={[s.nav, page === p.id && { backgroundColor: colors.primary }]}><Icon name={p.icon} color="#fff" size={19}/><Text style={{ color: '#fff' }}>{p.name}</Text></Pressable>)}{logout && <Pressable onPress={logout} style={s.nav}><Icon name="logout" color="#fff"/><Text style={{ color: '#fff' }}>Sair</Text></Pressable>}</View>}<View style={{ flex: 1 }}><View style={[s.header, wide && { backgroundColor: '#fff', borderBottomWidth: 1, borderColor: colors.border }]}><Text style={{ color: wide ? colors.text : '#fff', fontSize: 20, fontWeight: '700', flex: 1 }}>{title}</Text>{!wide && !bottom && <Pressable accessibilityLabel="Menu" onPress={() => setMenu(!menu)}><Icon name="menu" color="#fff"/></Pressable>}{bottom && <Pressable accessibilityLabel="Notificações" onPress={() => onPage('notifications')}><Icon name="bell" color="#fff"/></Pressable>}</View>{!wide && !bottom && menu && <ScrollView style={{ maxHeight: 370, backgroundColor: colors.sidebar }}>{pages.map(p => <Pressable key={p.id} style={s.nav} onPress={() => { onPage(p.id); setMenu(false); }}><Icon name={p.icon} color="#fff"/><Text style={{ color: '#fff' }}>{p.name}</Text></Pressable>)}</ScrollView>}{children}{bottom && <View style={s.bottom}>{pages.map(p => <Pressable key={p.id} accessibilityRole="button" accessibilityLabel={p.name} onPress={() => onPage(p.id)} style={{ flex: 1, alignItems: 'center', gap: 3, paddingVertical: 8 }}><Icon name={p.icon} size={23} color={p.id === page ? colors.primary : colors.muted}/><Text style={{ fontSize: 11, color: p.id === page ? colors.primary : colors.muted }}>{p.name}</Text></Pressable>)}</View>}</View></View>; }
export const s = StyleSheet.create({ heading: { fontSize: 22, fontWeight: '700', color: colors.text }, body: { fontSize: 15, color: colors.text, lineHeight: 21 }, caption: { fontSize: 13, color: colors.muted, lineHeight: 18 }, label: { fontSize: 15, fontWeight: '600', color: colors.text }, card: { padding: 16, gap: 12, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }, row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 }, button: { backgroundColor: colors.primary, borderWidth: 1, borderColor: colors.primary, borderRadius: 8, minHeight: 44, paddingVertical: 11, paddingHorizontal: 15, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6 }, outline: { backgroundColor: 'white' }, buttonText: { color: '#fff', fontWeight: '600', fontSize: 14, textAlign: 'center' }, input: { borderWidth: 1, borderColor: colors.border, borderRadius: 8, backgroundColor: '#fff', minHeight: 46, padding: 12, fontSize: 15, color: colors.text }, chip: { borderWidth: 1, borderColor: colors.border, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 8, backgroundColor: '#fff' }, chipActive: { backgroundColor: colors.primary, borderColor: colors.primary }, notice: { padding: 10, borderRadius: 8, fontSize: 14 }, item: { padding: 12, borderWidth: 1, borderColor: colors.border, borderRadius: 9, backgroundColor: '#fff', flexDirection: 'row', alignItems: 'center', gap: 12 }, thumb: { width: 78, height: 70, borderRadius: 8, backgroundColor: colors.primaryLight }, nav: { padding: 10, flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 8 }, header: { backgroundColor: colors.primary, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 8 }, bottom: { flexDirection: 'row', backgroundColor: 'white', borderTopWidth: 1, borderColor: colors.border, paddingHorizontal: 3 } });

