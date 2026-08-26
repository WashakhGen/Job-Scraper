from datetime import datetime

from pydantic import BaseModel, ConfigDict


class CVOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    filename: str
    keywords: list[str]
    is_active: bool
    uploaded_at: datetime


class CVKeywordsUpdate(BaseModel):
    keywords: list[str]
