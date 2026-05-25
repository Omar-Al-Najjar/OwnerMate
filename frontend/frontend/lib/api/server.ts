import "server-only";

import { getAppSession } from "@/lib/auth/session";

type BackendEnvelope<T> = {
  success?: boolean;
  data?: T;
  error?: {
    code?: string;
    message?: string;
  };
};

type BackendAuthSession = {
  user: {
    id: string;
    email: string;
    full_name: string | null;
    role: string;
    language_preference: "en" | "ar" | null;
    theme_preference: "light" | "dark" | "system" | null;
  };
  businesses: Array<{
    id: string;
    name: string;
    owner_user_id: string;
    default_language: "en" | "ar" | null;
  }>;
};

const BACKEND_GET_CACHE_TTL_MS = 60_000;
const backendGetCache = new Map<
  string,
  {
    expiresAt: number;
    value: unknown;
  }
>();

function getBackendBaseUrl() {
  return process.env.BACKEND_API_BASE_URL ?? "http://127.0.0.1:8000";
}

function getBackendCacheKey(path: string, init?: RequestInit) {
  const method = init?.method ?? "GET";
  if (method.toUpperCase() !== "GET") {
    backendGetCache.clear();
    return null;
  }

  const headers = init?.headers instanceof Headers ? init.headers : null;
  const authorization = headers?.get("Authorization") ?? "";
  return `${authorization}:${path}`;
}

export class BackendRouteError extends Error {
  code: string;
  status: number;

  constructor(code: string, message: string, status = 500) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

export async function getAuthenticatedBackendHeaders() {
  const session = await getAppSession();
  if (!session?.accessToken) {
    throw new BackendRouteError(
      "AUTHENTICATION_REQUIRED",
      "Authentication required.",
      401
    );
  }

  return new Headers({
    Authorization: `Bearer ${session.accessToken}`,
    "Content-Type": "application/json",
  });
}

export async function fetchBackendJson<T>(path: string, init?: RequestInit) {
  const cacheKey = getBackendCacheKey(path, init);
  if (cacheKey) {
    const cached = backendGetCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.value as T;
    }
  }

  const response = await fetch(`${getBackendBaseUrl()}${path}`, {
    ...init,
    headers: init?.headers,
    cache: "no-store",
  });

  const body = (await response.json().catch(() => null)) as BackendEnvelope<T> | null;

  if (!response.ok || !body?.success) {
    throw new BackendRouteError(
      body?.error?.code ?? "BACKEND_REQUEST_FAILED",
      body?.error?.message ?? "Backend request failed.",
      response.status || 500
    );
  }

  if (cacheKey) {
    backendGetCache.set(cacheKey, {
      expiresAt: Date.now() + BACKEND_GET_CACHE_TTL_MS,
      value: body.data as T,
    });
  }

  return body.data as T;
}

export async function getBackendAuthContext() {
  const headers = await getAuthenticatedBackendHeaders();
  const session = await getAppSession();

  if (session?.businessId) {
    return {
      headers,
      authSession: null,
      businessId: session.businessId,
    };
  }

  const authSession = await fetchBackendJson<BackendAuthSession>("/auth/me", {
    headers,
  });

  return {
    headers,
    authSession,
    businessId: authSession.businesses[0]?.id ?? null,
  };
}
