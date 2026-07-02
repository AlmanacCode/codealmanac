from codealmanac.core.models import CodeAlmanacModel


class EnsureControlSchemaRequest(CodeAlmanacModel):
    pass


class ReadControlSchemaStatusRequest(CodeAlmanacModel):
    ensure: bool = True
