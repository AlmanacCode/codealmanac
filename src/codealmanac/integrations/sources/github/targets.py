from codealmanac.core.errors import ExecutionFailed
from codealmanac.engine.sources.models import SourceRef


def github_target_args(ref: SourceRef) -> tuple[str, ...]:
    if ref.url is not None:
        return (ref.url,)
    if ref.number is None:
        raise ExecutionFailed(f"GitHub source missing number: {ref.identity}")
    if ref.repository is None:
        return (str(ref.number),)
    return (str(ref.number), "--repo", ref.repository)
