from __future__ import annotations

from dataclasses import dataclass
import json
import logging
from urllib import error as urlerror
from urllib import request as urlrequest

import jwt
from fastapi import status
from jwt import ExpiredSignatureError, InvalidTokenError, PyJWKClient
from jwt.exceptions import PyJWKClientError

from ..core.config import Settings
from ..core.exceptions import AppError

logger = logging.getLogger(__name__)


@dataclass(slots=True)
class VerifiedIdentity:
    subject: str
    email: str
    full_name: str | None
    role: str | None
    language_preference: str | None
    theme_preference: str | None


class SupabaseTokenVerifier:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        if not settings.supabase_url:
            raise AppError(
                code="AUTH_PROVIDER_NOT_CONFIGURED",
                message="Supabase auth is not configured on the backend.",
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        issuer_base = settings.supabase_url.rstrip("/")
        self.issuer = f"{issuer_base}/auth/v1"
        self.jwks_client = PyJWKClient(f"{self.issuer}/.well-known/jwks.json")

    def verify_access_token(self, token: str) -> VerifiedIdentity:
        try:
            signing_key = self.jwks_client.get_signing_key_from_jwt(token)
            claims = jwt.decode(
                token,
                signing_key.key,
                algorithms=["RS256", "ES256"],
                issuer=self.issuer,
                options={"require": ["exp", "iss", "sub"]},
            )
            logger.info(
                "supabase token verified via jwks",
                extra=self._token_log_context(token, claims),
            )
            return self._identity_from_claims(claims)
        except ExpiredSignatureError as exc:
            logger.warning(
                "supabase token expired",
                extra=self._token_log_context(token),
            )
            raise AppError(
                code="AUTHENTICATION_TOKEN_EXPIRED",
                message="Authentication token has expired.",
                status_code=status.HTTP_401_UNAUTHORIZED,
            ) from exc
        except (InvalidTokenError, PyJWKClientError) as exc:
            logger.info(
                "supabase jwks verification failed, falling back to user endpoint",
                extra={
                    "auth_error": type(exc).__name__,
                    **self._token_log_context(token),
                },
            )
            claims = self._verify_via_supabase_user_endpoint(token)
            return self._identity_from_claims(claims)

    def _verify_via_supabase_user_endpoint(self, token: str) -> dict:
        if not self.settings.supabase_anon_key:
            raise AppError(
                code="AUTHENTICATION_FAILED",
                message="Authentication token could not be verified.",
                status_code=status.HTTP_401_UNAUTHORIZED,
            )

        request = urlrequest.Request(
            f"{self.issuer}/user",
            headers={
                "Authorization": f"Bearer {token}",
                "apikey": self.settings.supabase_anon_key,
            },
            method="GET",
        )

        try:
            with urlrequest.urlopen(request, timeout=10) as response:
                payload = json.loads(response.read().decode("utf-8"))
                logger.info(
                    "supabase token verified via user endpoint",
                    extra={
                        "token_sub_prefix": str(payload.get("id", ""))[:8] or None,
                        "token_email_present": isinstance(payload.get("email"), str),
                        "token_role": payload.get("role"),
                    },
                )
        except urlerror.HTTPError as exc:
            response_body = exc.read().decode("utf-8", errors="ignore")
            logger.warning(
                "supabase user endpoint verification failed",
                extra={
                    "auth_error": "HTTPError",
                    "http_status": exc.code,
                    "response_preview": response_body[:200] or None,
                    **self._token_log_context(token),
                },
            )
            if exc.code == status.HTTP_401_UNAUTHORIZED:
                raise AppError(
                    code="AUTHENTICATION_FAILED",
                    message="Authentication token could not be verified.",
                    status_code=status.HTTP_401_UNAUTHORIZED,
                ) from exc
            raise AppError(
                code="AUTH_PROVIDER_UNAVAILABLE",
                message="Supabase auth provider is currently unavailable.",
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            ) from exc
        except (urlerror.URLError, TimeoutError, json.JSONDecodeError) as exc:
            logger.warning(
                "supabase user endpoint verification unavailable",
                extra={
                    "auth_error": type(exc).__name__,
                    **self._token_log_context(token),
                },
            )
            raise AppError(
                code="AUTH_PROVIDER_UNAVAILABLE",
                message="Supabase auth provider is currently unavailable.",
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            ) from exc

        return {
            "sub": payload.get("id"),
            "email": payload.get("email"),
            "iss": self.issuer,
            "role": payload.get("role"),
            "user_metadata": payload.get("user_metadata") or {},
            "app_metadata": payload.get("app_metadata") or {},
            "exp": 1,
        }

    def _identity_from_claims(self, claims: dict) -> VerifiedIdentity:
        email = claims.get("email")
        if not isinstance(email, str) or not email:
            logger.warning(
                "supabase token missing usable email claim",
                extra={
                    "token_sub_prefix": str(claims.get("sub", ""))[:8] or None,
                    "token_iss": claims.get("iss"),
                    "token_role": claims.get("role"),
                    "token_keys": sorted(str(key) for key in claims.keys()),
                },
            )
            raise AppError(
                code="AUTHENTICATION_FAILED",
                message="Authentication token is missing a usable email claim.",
                status_code=status.HTTP_401_UNAUTHORIZED,
            )

        user_metadata = claims.get("user_metadata") if isinstance(claims.get("user_metadata"), dict) else {}
        app_metadata = claims.get("app_metadata") if isinstance(claims.get("app_metadata"), dict) else {}

        full_name = user_metadata.get("full_name")
        if not isinstance(full_name, str):
            full_name = user_metadata.get("name")
        if not isinstance(full_name, str):
            full_name = None

        language_preference = user_metadata.get("language_preference")
        if not isinstance(language_preference, str):
            language_preference = None

        theme_preference = user_metadata.get("theme_preference")
        if not isinstance(theme_preference, str):
            theme_preference = None

        role = app_metadata.get("role")
        if not isinstance(role, str):
            role = claims.get("role") if isinstance(claims.get("role"), str) else None

        return VerifiedIdentity(
            subject=str(claims["sub"]),
            email=email,
            full_name=full_name,
            role=role,
            language_preference=language_preference,
            theme_preference=theme_preference,
        )

    def _token_log_context(self, token: str, claims: dict | None = None) -> dict:
        context: dict[str, object | None] = {
            "token_preview": f"{token[:12]}..." if token else None,
        }
        if claims is not None:
            context.update(
                {
                    "token_sub_prefix": str(claims.get("sub", ""))[:8] or None,
                    "token_iss": claims.get("iss"),
                    "token_role": claims.get("role"),
                    "token_email_present": isinstance(claims.get("email"), str),
                }
            )
            return context

        try:
            parts = token.split(".")
            if len(parts) >= 2:
                header = json.loads(
                    jwt.utils.base64url_decode(parts[0].encode("utf-8")).decode("utf-8")
                )
                payload = json.loads(
                    jwt.utils.base64url_decode(parts[1].encode("utf-8")).decode("utf-8")
                )
                context.update(
                    {
                        "token_alg": header.get("alg"),
                        "token_iss": payload.get("iss"),
                        "token_sub_prefix": str(payload.get("sub", ""))[:8] or None,
                        "token_role": payload.get("role"),
                        "token_email_present": isinstance(payload.get("email"), str),
                    }
                )
        except Exception:
            logger.debug("failed to decode token context for logging")
        return context
