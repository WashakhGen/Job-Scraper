from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class ScheduleConfigUpdate(BaseModel):
    enabled: bool
    frequency: Literal["daily", "weekly", "monthly"]
    hour: int = Field(ge=0, le=23)
    minute: int = Field(ge=0, le=59)
    day_of_week: int | None = Field(default=None, ge=0, le=6)  # 0=Mon..6=Sun, weekly only
    day_of_month: int | None = Field(default=None, ge=1, le=28)  # monthly only
    limit: int = Field(ge=1, le=100)


class ScheduleConfigOut(ScheduleConfigUpdate):
    last_run_at: datetime | None
    next_run_at: datetime | None
