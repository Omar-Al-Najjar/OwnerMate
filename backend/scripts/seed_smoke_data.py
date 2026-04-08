from __future__ import annotations

import os
from seed_helpers import DEMO_BUSINESS_NAME, ensure_seed_context, get_session, rollback_and_close


def main() -> None:
    session = get_session()
    try:
        context = ensure_seed_context(
            session,
            email=os.environ.get("SMOKE_USER_EMAIL", "smoke-test@ownermate.local"),
            full_name=os.environ.get("SMOKE_USER_FULL_NAME", "Smoke Test User"),
            business_name=os.environ.get("SMOKE_BUSINESS_NAME", DEMO_BUSINESS_NAME),
            role="owner",
            language_preference="en",
            theme_preference="light",
            supabase_user_id=os.environ.get("SMOKE_SUPABASE_USER_ID"),
        )
        session.commit()
        print(f"SMOKE_USER_ID={context.user.id}")
        print(f"SMOKE_USER_EMAIL={context.user.email}")
        print(f"SMOKE_BUSINESS_ID={context.business.id}")
        print(f"SMOKE_BUSINESS_NAME={context.business.name}")
        session.close()
    except Exception:
        rollback_and_close(session)
        raise


if __name__ == "__main__":
    main()
