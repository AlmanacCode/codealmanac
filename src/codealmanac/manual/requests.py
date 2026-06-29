from codealmanac.core.models import CodeAlmanacModel
from codealmanac.manual.models import ManualDocumentName


class ManualReadRequest(CodeAlmanacModel):
    document: ManualDocumentName
