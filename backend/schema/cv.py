from datetime import datetime

from pydantic import BaseModel, ConfigDict


class CVOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    filename: str
    is_active: bool
    uploaded_at: datetime
