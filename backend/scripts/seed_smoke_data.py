from __future__ import annotations

import os
from uuid import uuid4

from sqlalchemy import create_engine, text


def main() -> None:
    database_url = os.environ["DATABASE_URL"]
    engine = create_engine(database_url, pool_pre_ping=True)

    user_id = str(uuid4())
    business_id = str(uuid4())

    with engine.begin() as connection:
        connection.execute(
            text(
                """
                INSERT INTO users (
                    id,
                    email,
                    full_name,
                    role,
                    language_preference,
                    theme_preference,
                    created_at,
                    updated_at
                ) VALUES (
                    :id,
                    :email,
                    :full_name,
                    :role,
                    :language_preference,
                    :theme_preference,
                    now(),
                    now()
                )
                """
            ),
            {
                "id": user_id,
                "email": f"smoke-{user_id[:8]}@example.com",
                "full_name": "Smoke Test User",
                "role": "owner",
                "language_preference": "en",
                "theme_preference": "light",
            },
        )
        connection.execute(
            text(
                """
                INSERT INTO businesses (
                    id,
                    owner_user_id,
                    name,
                    industry,
                    country_code,
                    default_language,
                    created_at,
                    updated_at
                ) VALUES (
                    :id,
                    :owner_user_id,
                    :name,
                    :industry,
                    :country_code,
                    :default_language,
                    now(),
                    now()
                )
                """
            ),
            {
                "id": business_id,
                "owner_user_id": user_id,
                "name": "Smoke Test Cafe",
                "industry": "food_beverage",
                "country_code": "JO",
                "default_language": "en",
            },
        )

    print(f"SMOKE_USER_ID={user_id}")
    print(f"SMOKE_BUSINESS_ID={business_id}")


if __name__ == "__main__":
    main()
