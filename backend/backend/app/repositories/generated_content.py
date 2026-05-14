from ..models.generated_content import GeneratedContent
from .base import Repository


class GeneratedContentRepository(Repository):
    def get_by_id(self, content_id) -> GeneratedContent | None:
        return self.session.get(GeneratedContent, content_id)

    def add(self, generated_content: GeneratedContent) -> GeneratedContent:
        self.session.add(generated_content)
        self.session.flush()
        self.session.refresh(generated_content)
        return generated_content

    def refresh(self, generated_content: GeneratedContent) -> None:
        self.session.refresh(generated_content)

    def save(self) -> None:
        self.session.commit()

    def rollback(self) -> None:
        self.session.rollback()
