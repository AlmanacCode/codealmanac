from pathlib import Path

from yoke import Agent, Collection

from codealmanac.services.harnesses.models import HarnessAgentKind

AGENTS_ROOT = Path(__file__).parent


def agent_collection() -> Collection:
    """Load CodeAlmanac's packaged Yoke agent collection."""

    return Collection.from_folder(AGENTS_ROOT)


def load_agent(kind: HarnessAgentKind) -> Agent:
    """Load one packaged lifecycle agent by its product identity."""

    return agent_collection().agent(kind.value)
