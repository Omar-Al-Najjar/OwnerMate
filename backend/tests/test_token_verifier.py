from __future__ import annotations

import time
import unittest

import jwt
from jwt.exceptions import PyJWKClientError

from backend.app.core.config import Settings
from backend.app.services.token_verifier import SupabaseTokenVerifier


class FailingJwksClient:
    def get_signing_key_from_jwt(self, token: str):
        del token
        raise PyJWKClientError("jwks unavailable for test")


class CachingTokenVerifier(SupabaseTokenVerifier):
    def __init__(self) -> None:
        super().__init__(
            Settings(
                supabase_url="https://example.supabase.co",
                supabase_anon_key="anon-key",
            )
        )
        self.jwks_client = FailingJwksClient()
        self.fallback_calls = 0

    def _verify_via_supabase_user_endpoint(self, token: str) -> dict:
        self.fallback_calls += 1
        return {
            **self._decode_unverified_claims(token),
            "user_metadata": {"full_name": "Verifier Test"},
            "app_metadata": {"role": "owner"},
        }


class TokenVerifierTests(unittest.TestCase):
    def test_verifier_caches_verified_token_claims(self) -> None:
        verifier = CachingTokenVerifier()
        token = jwt.encode(
            {
                "sub": "user-123",
                "email": "owner@example.com",
                "iss": "https://example.supabase.co/auth/v1",
                "exp": int(time.time()) + 3600,
                "user_metadata": {"full_name": "Verifier Test"},
                "app_metadata": {"role": "owner"},
            },
            "not-used-for-verification",
            algorithm="HS256",
        )

        first_identity = verifier.verify_access_token(token)
        second_identity = verifier.verify_access_token(token)

        self.assertEqual(first_identity.email, "owner@example.com")
        self.assertEqual(second_identity.email, "owner@example.com")
        self.assertEqual(verifier.fallback_calls, 1)


if __name__ == "__main__":
    unittest.main()
