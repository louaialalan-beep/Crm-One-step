import { auth } from '../firebase';

export const VITE_API_URL: string = (import.meta.env.VITE_API_URL || '').trim().replace(/\/+$/, '');

const JWT_STORAGE_KEY = 'crm_one_step_jwt';
const ORG_UUID_STORAGE_KEY = 'crm_one_step_org_uuid';

export function isRestApiEnabled(): boolean {
  return Boolean(VITE_API_URL);
}

export function getWebSocketBaseUrl(): string | null {
  if (!VITE_API_URL) return null;
  if (VITE_API_URL.startsWith('https://')) {
    return VITE_API_URL.replace(/^https:\/\//, 'wss://').replace(/\/api\/v1$/, '');
  }
  if (VITE_API_URL.startsWith('http://')) {
    return VITE_API_URL.replace(/^http:\/\//, 'ws://').replace(/\/api\/v1$/, '');
  }
  if (VITE_API_URL.startsWith('/') && typeof window !== 'undefined') {
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${proto}//${window.location.host}`;
  }
  return null;
}

export function setJwtSessionToken(token: string, orgId?: string): void {
  sessionStorage.setItem(JWT_STORAGE_KEY, token);
  localStorage.setItem(JWT_STORAGE_KEY, token);
  if (orgId) {
    sessionStorage.setItem(ORG_UUID_STORAGE_KEY, orgId);
    localStorage.setItem(ORG_UUID_STORAGE_KEY, orgId);
  }
}

export function clearJwtSessionToken(): void {
  sessionStorage.removeItem(JWT_STORAGE_KEY);
  localStorage.removeItem(JWT_STORAGE_KEY);
  sessionStorage.removeItem(ORG_UUID_STORAGE_KEY);
  localStorage.removeItem(ORG_UUID_STORAGE_KEY);
}

export async function getAuthBearerToken(): Promise<string | null> {
  const storedJwt = sessionStorage.getItem(JWT_STORAGE_KEY) || localStorage.getItem(JWT_STORAGE_KEY);
  if (storedJwt) {
    return storedJwt;
  }
  try {
    const currentUser = auth.currentUser;
    if (currentUser) {
      return await currentUser.getIdToken();
    }
  } catch {
    // Fallback to session/local token if stored
  }
  return null;
}

export interface ApiRequestOptions extends Omit<RequestInit, 'body'> {
  orgId?: string;
  body?: unknown;
}

export async function apiRequest<T>(endpoint: string, options: ApiRequestOptions = {}): Promise<T> {
  if (!VITE_API_URL) {
    throw new Error('VITE_API_URL is not configured; using local Preview/Firestore adapter.');
  }

  const token = await getAuthBearerToken();
  const headers = new Headers(options.headers || {});
  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;

  if (!headers.has('Content-Type') && options.body !== undefined && !isFormData) {
    headers.set('Content-Type', 'application/json');
  }
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  const activeOrgId =
    options.orgId ||
    sessionStorage.getItem(ORG_UUID_STORAGE_KEY) ||
    localStorage.getItem(ORG_UUID_STORAGE_KEY);
  if (activeOrgId) {
    headers.set('X-Organization-Id', activeOrgId);
  }

  const normalizedPath = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const finalUrl =
    VITE_API_URL.endsWith('/api/v1') && normalizedPath.startsWith('/api/v1')
      ? `${VITE_API_URL.slice(0, -'/api/v1'.length)}${normalizedPath}`
      : `${VITE_API_URL}${normalizedPath}`;
  const response = await fetch(finalUrl, {
    ...options,
    headers,
    body:
      options.body === undefined
        ? undefined
        : isFormData
          ? (options.body as FormData)
          : JSON.stringify(options.body),
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => response.statusText);
    throw new Error(`API Error (${response.status}): ${errText}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export interface WhatsAppRealtimePayload {
  id: string;
  org_id: string;
  lead_uid: string;
  phone_number: string;
  contact_name?: string | null;
  direction: 'inbound' | 'outbound';
  message_type: string;
  body: string;
  media_url?: string | null;
  wamid?: string | null;
  status: string;
  created_at: string;
}

export interface WhatsAppSocketEnvelope {
  event:
    | 'whatsapp:connected'
    | 'whatsapp:message_received'
    | 'whatsapp:message_sent'
    | 'pong'
    | 'ack';
  org_id: string;
  timestamp?: string;
  data?: WhatsAppRealtimePayload;
  recent_messages?: WhatsAppRealtimePayload[];
}

/**
 * Connects to FastAPI `/ws/whatsapp/{org_id}` WebSocket when `VITE_API_URL` is configured.
 * Returns a cleanup function that closes the socket and cancels auto-reconnect.
 */
export function connectWhatsAppWebSocket(params: {
  orgId: string;
  onEvent: (envelope: WhatsAppSocketEnvelope) => void;
}): () => void {
  const wsBase = getWebSocketBaseUrl();
  if (!wsBase || !params.orgId) {
    return () => {};
  }

  let ws: WebSocket | null = null;
  let closedByClient = false;
  let reconnectTimer: number | undefined;

  const connect = () => {
    if (closedByClient) return;
    try {
      const encodedOrg = encodeURIComponent(params.orgId);
      ws = new WebSocket(`${wsBase}/ws/whatsapp/${encodedOrg}`);

      ws.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data) as WhatsAppSocketEnvelope;
          params.onEvent(parsed);
        } catch {
          // Ignore malformed frame
        }
      };

      ws.onclose = () => {
        if (!closedByClient) {
          reconnectTimer = window.setTimeout(connect, 4000);
        }
      };
    } catch {
      // Safe no-op in Preview mode
    }
  };

  connect();

  return () => {
    closedByClient = true;
    if (reconnectTimer !== undefined) {
      window.clearTimeout(reconnectTimer);
    }
    if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
      ws.close();
    }
  };
}

export interface FastApiAuthResponse {
  access_token: string;
  token_type: string;
  org_id: string;
  user: {
    id: string;
    org_id: string;
    email: string;
    full_name: string;
    role_id?: string | null;
    profile_id?: string | null;
    status: string;
    is_superadmin: boolean;
  };
  organization?: {
    id: string;
    name: string;
    slug: string;
    vat_number: string;
    base_currency: string;
    plan_tier: string;
    seat_limit: number;
  };
}

export async function loginFastApiBackend(params: {
  email: string;
  password: string;
  orgSlug?: string;
}): Promise<FastApiAuthResponse> {
  const result = await apiRequest<FastApiAuthResponse>('/api/v1/auth/login', {
    method: 'POST',
    body: {
      email: params.email,
      password: params.password,
      org_slug: params.orgSlug,
    },
  });
  setJwtSessionToken(result.access_token, result.org_id);
  return result;
}

export async function registerFastApiBackend(params: {
  fullName: string;
  email: string;
  password: string;
  organizationName: string;
  organizationSlug?: string;
  vatNumber?: string;
  baseCurrency?: string;
}): Promise<FastApiAuthResponse> {
  const result = await apiRequest<FastApiAuthResponse>('/api/v1/auth/register', {
    method: 'POST',
    body: {
      full_name: params.fullName,
      email: params.email,
      password: params.password,
      organization_name: params.organizationName,
      organization_slug: params.organizationSlug,
      vat_number: params.vatNumber || '310122393500003',
      base_currency: params.baseCurrency || 'SAR',
    },
  });
  setJwtSessionToken(result.access_token, result.org_id);
  return result;
}

export async function executeWithAdapter<T>(params: {
  endpoint: string;
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  orgId?: string;
  payload?: unknown;
  fallback: () => Promise<T> | T;
}): Promise<T> {
  if (isRestApiEnabled()) {
    try {
      return await apiRequest<T>(params.endpoint, {
        method: params.method || 'POST',
        orgId: params.orgId,
        body: params.payload,
      });
    } catch (err) {
      console.warn(`[Crm-One-step Adapter] REST call to ${params.endpoint} failed, falling back:`, err);
      return await params.fallback();
    }
  }
  return await params.fallback();
}

export function stripUndefinedFields<T extends object>(obj: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(obj).filter(([, value]) => value !== undefined)
  ) as Partial<T>;
}
