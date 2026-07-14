from codealmanac.core.models import CodeAlmanacModel


class CheckUpdateRequest(CodeAlmanacModel):
    pass


class RunUpdateRequest(CodeAlmanacModel):
    scheduled: bool = False
