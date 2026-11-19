import { z } from 'zod';
export const roleSchema = z.enum(['CITIZEN', 'ADMIN']);
export const statusSchema = z.enum(['ABERTO', 'EM_ANALISE', 'EM_ATENDIMENTO', 'RESOLVIDO']);
export const validationStatusSchema = z.enum(['PENDENTE', 'VALIDADA', 'REJEITADA']);
export const prioritySchema = z.enum(['BAIXA', 'MEDIA', 'ALTA', 'URGENTE']);
export const healthSchema = z.object({ status: z.literal('ok'), service: z.literal('urbanizago-api') });
export type Role = z.infer<typeof roleSchema>;
export type OccurrenceStatus = z.infer<typeof statusSchema>;
export type Health = z.infer<typeof healthSchema>;
export const statusLabels: Record<OccurrenceStatus, string> = {
    ABERTO: 'Aberto', EM_ANALISE: 'Em Análise', EM_ATENDIMENTO: 'Em Atendimento', RESOLVIDO: 'Resolvido',
};
export const categories = [
    { code: 'POTHOLE', name: 'Buracos em vias públicas', icon: 'pothole' },
    { code: 'LIGHTING', name: 'Falhas na iluminação pública', icon: 'bulb' },
    { code: 'WASTE', name: 'Descarte irregular de lixo', icon: 'trash' },
    { code: 'WATER', name: 'Vazamentos de água', icon: 'drop' },
    { code: 'TREE', name: 'Queda de árvores', icon: 'tree' },
    { code: 'SIGN', name: 'Problemas de sinalização', icon: 'sign' },
    { code: 'OTHER', name: 'Outros', icon: 'more' },
] as const;
/** Consulta a saúde da API. */
export async function getHealth(baseUrl: string, signal?: AbortSignal): Promise<Health> {
    const response = await fetch(`${baseUrl.replace(/\/$/, '')}/health`, { signal });
    if (!response.ok)
        throw new Error('API indisponível.');
    return healthSchema.parse(await response.json());
}
export interface ApiEnvelope<T> {
    data: T;
}
export interface ApiFailure {
    code: string;
    message: string;
    details?: unknown;
}
export class ApiError extends Error {
    constructor(public readonly status: number, public readonly payload: ApiFailure) {
        super(payload.message);
    }
}
/** Access token in memory; mobile refresh token must be stored in SecureStore. */
export function createApiClient(baseUrl: string, getAccessToken: () => string | null) {
    return async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
        const headers = new Headers(init.headers);
        const token = getAccessToken();
        if (token)
            headers.set('Authorization', `Bearer ${token}`);
        if (typeof init.body === 'string' && !headers.has('Content-Type'))
            headers.set('Content-Type', 'application/json');
        const response = await fetch(`${baseUrl.replace(/\/$/, '')}/api/v1${path}`, { ...init, headers, credentials: 'include' });
        const result: unknown = await response.json();
        if (!response.ok) {
            const parsed = z.object({ code: z.string(), message: z.string(), details: z.unknown().optional() }).safeParse(result);
            throw new ApiError(response.status, parsed.success ? parsed.data : { code: 'UNKNOWN', message: 'Falha na requisição.' });
        }
        // URLs assinadas relativas são resolvidas contra a mesma API (LAN, emulador ou proxy web).
        const resolveMedia = (value: unknown): unknown => { if (Array.isArray(value))
            return value.map(resolveMedia); if (value && typeof value === 'object')
            return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, k === 'url' && typeof v === 'string' && v.startsWith('/api/v1/media/') ? baseUrl.replace(/\/$/, '') + v : resolveMedia(v)])); return value; };
        return resolveMedia((result as ApiEnvelope<T>).data) as T;
    };
}

