import "server-only";

import { createHmac, timingSafeEqual } from "crypto";

type CachedBusinessContext = {
  businessId: string;
  expiresAt: number;
};

type BackendAuthSession = {
  businesses?: Array<{
    id?: string | null;
  }>;
};

type BackendEnvelope<T> = {
  success?: boolean;
  data?: T;
  error?: {
    code?: string;
    message?: string;
  };
};

type ResolvedBusinessContext = {
  businessId: string | null;
  userId: string;
};

export const BUSINESS_CONTEXT_COOKIE_NAME = "ownermate-business-context";

const DEFAULT_CACHE_TTL_MS = 5 * 60 * 1000;

declare global {
  var __ownermateBusinessContextCache:
    | Map<string, CachedBusinessContext>
    | undefined;
  var __ownermateBusinessContextInflight:
    | Map<string, Promise<ResolvedBusinessContext | null>>
    | undefined;
}

function getBackendBaseUrl() {
  return process.env.BACKEND_API_BASE_URL ?? "http://127.0.0.1:8000";
}

function getBusinessContextSecret() {
  return (
    process.env.OWNERMATE_SESSION_SIGNING_SECRET ??
    process.env.SUPABASE_JWT_SECRET ??
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    null
  );
}

function getBusinessContextCache() {
  globalThis.__ownermateBusinessContextCache ??= new Map();
  return globalThis.__ownermateBusinessContextCache;
}

function getBusinessContextInflightMap() {
  globalThis.__ownermateBusinessContextInflight ??= new Map();
  return globalThis.__ownermateBusinessContextInflight;
}

function signBusinessContextPayload(encodedPayload: string) {
  const secret = getBusinessContextSecret();
  if (!secret) {
    return null;
  }

  return createHmac("sha256", secret).update(encodedPayload).digest("base64url");
}

export function createSignedBusinessContextCookie(
  userId: string,
  businessId: string
) {
  if (!userId || !businessId) {
    return null;
  }

  const payload = JSON.stringify({
    businessId,
    userId,
  });
  const encodedPayload = Buffer.from(payload, "utf-8").toString("base64url");
  const signature = signBusinessContextPayload(encodedPayload);

  if (!signature) {
    return null;
  }

  return `${encodedPayload}.${signature}`;
}

export function parseSignedBusinessContextCookie(
  cookieValue: string,
  expectedUserId: string
) {
  const [encodedPayload, encodedSignature] = cookieValue.split(".");
  if (!encodedPayload || !encodedSignature) {
    return null;
  }

  const expectedSignature = signBusinessContextPayload(encodedPayload);
  if (!expectedSignature) {
    return null;
  }

  const receivedSignatureBuffer = Buffer.from(encodedSignature, "utf-8");
  const expectedSignatureBuffer = Buffer.from(expectedSignature, "utf-8");

  if (
    receivedSignatureBuffer.length !== expectedSignatureBuffer.length ||
    !timingSafeEqual(receivedSignatureBuffer, expectedSignatureBuffer)
  ) {
    return null;
  }

  try {
    const payload = JSON.parse(
      Buffer.from(encodedPayload, "base64url").toString("utf-8")
    ) as {
      businessId?: unknown;
      userId?: unknown;
    };

    if (
      payload.userId !== expectedUserId ||
      typeof payload.businessId !== "string" ||
      !payload.businessId
    ) {
      return null;
    }

    return payload.businessId;
  } catch {
    return null;
  }
}

export function getCachedBusinessId(userId: string) {
  const cached = getBusinessContextCache().get(userId);
  if (!cached) {
    return null;
  }

  if (cached.expiresAt <= Date.now()) {
    getBusinessContextCache().delete(userId);
    return null;
  }

  return cached.businessId;
}

export function seedBusinessContextCache(
  userId: string,
  businessId: string,
  ttlMs = DEFAULT_CACHE_TTL_MS
) {
  if (!userId || !businessId) {
    return;
  }

  getBusinessContextCache().set(userId, {
    businessId,
    expiresAt: Date.now() + ttlMs,
  });
}

export function clearBusinessContextCache(userId: string) {
  if (!userId) {
    return;
  }

  getBusinessContextCache().delete(userId);
  getBusinessContextInflightMap().delete(userId);
}

export async function resolveBusinessContext(
  accessToken: string,
  userId: string
) {
  const cachedBusinessId = getCachedBusinessId(userId);
  if (cachedBusinessId) {
    return cachedBusinessId;
  }

  const inflightMap = getBusinessContextInflightMap();
  const inflightResolution = inflightMap.get(userId);
  if (inflightResolution) {
    const resolved = await inflightResolution;
    return resolved?.businessId ?? null;
  }

  const resolutionPromise = (async () => {
    const response = await fetch(`${getBackendBaseUrl()}/auth/me`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      cache: "no-store",
    });

    const body = (await response.json().catch(() => null)) as
      | BackendEnvelope<BackendAuthSession>
      | null;

    if (!response.ok || !body?.success || !body.data) {
      return null;
    }

    const businessId = body.data.businesses?.[0]?.id ?? null;

    if (businessId) {
      seedBusinessContextCache(userId, businessId);
    }

    return {
      businessId,
      userId,
    };
  })();

  inflightMap.set(userId, resolutionPromise);

  try {
    const resolved = await resolutionPromise;
    return resolved?.businessId ?? null;
  } finally {
    inflightMap.delete(userId);
  }
}
