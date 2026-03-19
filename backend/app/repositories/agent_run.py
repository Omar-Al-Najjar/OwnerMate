from ..models.agent_run import AgentRun
from ..models.base import utc_now
from .base import Repository


class AgentRunRepository(Repository):
    def get_by_id(self, agent_run_id) -> AgentRun | None:
        return self.session.get(AgentRun, agent_run_id)

    def add(self, agent_run: AgentRun) -> AgentRun:
        self.session.add(agent_run)
        self.session.flush()
        self.session.refresh(agent_run)
        return agent_run

    def save(self) -> None:
        self.session.commit()

    def rollback(self) -> None:
        self.session.rollback()

    def refresh(self, agent_run: AgentRun) -> None:
        self.session.refresh(agent_run)

    def mark_success(self, agent_run: AgentRun, *, output_reference: dict) -> AgentRun:
        agent_run.status = "success"
        agent_run.output_reference = output_reference
        agent_run.finished_at = utc_now()
        self.session.flush()
        self.session.refresh(agent_run)
        return agent_run

    def mark_failed(self, agent_run: AgentRun, *, error_message: str) -> AgentRun:
        agent_run.status = "failed"
        agent_run.error_message = error_message
        agent_run.finished_at = utc_now()
        self.session.flush()
        self.session.refresh(agent_run)
        return agent_run
