from pydantic import BaseModel, Field
from datetime import datetime, timezone
from typing import Dict, Any, Optional

class SessionPayload(BaseModel):
    session_id: str
    project_id: str
    start_time: str
    user: str
    notes: Optional[str] = None
    active: int = 1
    end_time: Optional[str] = None

class SensorData(BaseModel):
    device_id: str
    timestamp: datetime = Field(default_factory=datetime.now(timezone.utc))
    readings: Dict[str, Any]
    sensor_type: Optional[str] = None
    quality: Optional[str] = None

class DeviceStatus(BaseModel):
    device_id: str
    online: bool
    last_seen: datetime = Field(default_factory=datetime.now(timezone.utc))

class CommandPayload(BaseModel):
    command: str
    params: Optional[Dict[str, Any]] = None
