import unittest

from app.models import ReviewCandidate
from app.review_page_client import (
    _extract_place_id_from_link,
    _normalize_text,
    _resolve_reviews_place_id,
)


class ReviewPageClientTests(unittest.TestCase):
    def test_extract_place_id_prefers_hex_identifier_from_google_link(self) -> None:
        link = (
            "https://www.google.com/maps/place/Starbucks/"
            "data=!4m7!3m6!1s0x151ca0716b29e2d9:0x75335bd1a07d76ac!"
            "8m2!3d31.963812!4d35.9084461!16s%2Fg%2F11gxws6f_4!"
            "19sChIJ2eIpa3GgHBURrHZ9oNFbM3U?authuser=0&hl=en&rclk=1"
        )

        result = _extract_place_id_from_link(link)

        self.assertEqual(result, "0x151ca0716b29e2d9:0x75335bd1a07d76ac")

    def test_resolve_reviews_place_id_falls_back_to_candidate_place_id(self) -> None:
        candidate = ReviewCandidate(
            candidate_id="place-1",
            title="Starbucks",
            place_id="ChIJ2eIpa3GgHBURrHZ9oNFbM3U",
            link=None,
        )

        result = _resolve_reviews_place_id(candidate)

        self.assertEqual(result, "ChIJ2eIpa3GgHBURrHZ9oNFbM3U")

    def test_normalize_text_repairs_common_google_mojibake(self) -> None:
        text = "â­â­â­â­â­ Overall, Starbucks never disappointsâitâs great."

        result = _normalize_text(text)

        self.assertEqual(result, "⭐⭐⭐⭐⭐ Overall, Starbucks never disappoints—it’s great.")


if __name__ == "__main__":
    unittest.main()
