from typing import Protocol

from ...schemas.content import ContentProviderRequest, ContentProviderResult


class ContentGenerationProvider(Protocol):
    provider_name: str

    def generate(self, payload: ContentProviderRequest) -> ContentProviderResult:
        ...


class MockContentGenerationProvider:
    provider_name = "mock_content"

    def generate(self, payload: ContentProviderRequest) -> ContentProviderResult:
        if payload.content_type == "review_reply":
            generated_text = self._generate_review_reply(payload)
        else:
            generated_text = self._generate_marketing_copy(payload)

        prompt_context = {
            "provider": self.provider_name,
            "content_type": payload.content_type,
            "language": payload.language,
            "tone": payload.tone,
        }
        if payload.prompt_context:
            prompt_context["input_context"] = payload.prompt_context

        return ContentProviderResult(
            generated_text=generated_text,
            model_name=self.provider_name,
            prompt_context=prompt_context,
        )

    def _generate_review_reply(self, payload: ContentProviderRequest) -> str:
        tone = payload.tone or "professional"
        reviewer = payload.reviewer_name or "there"
        review_text = payload.review_text or "your feedback"
        if payload.language == "ar":
            return (
                f"شكرا لك يا {reviewer}. نقدر ملاحظتك حول \"{review_text}\" "
                f"وسنعمل على المتابعة بنبرة {tone}."
            )
        return (
            f"Thank you, {reviewer}. We appreciate your feedback about "
            f"\"{review_text}\" and will follow up with a {tone} response."
        )

    def _generate_marketing_copy(self, payload: ContentProviderRequest) -> str:
        tone = payload.tone or "friendly"
        context = payload.business_context or "your business"
        if payload.language == "ar":
            return f"اكتشف تجربة {context} برسالة {tone} مستوحاة من آراء العملاء الحقيقية."
        return f"Discover {context} with a {tone} message inspired by real customer feedback."
