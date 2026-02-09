from pydantic import BaseModel, Field
from datetime import datetime, timezone
from typing import Dict, Any, Optional

class SessionPayload(BaseModel):
    id: str
    projectId: str
    userId: str
    createdAt: str
    updatedAt: Optional[str] = None
    status: str = "running"
    sessionDetails: Dict[str, Any]
    settings: Dict[str, Any]
    alertConfiguration: list[Dict[str, Any]]
    notes: Optional[str] = None
    time: Optional[int] = None # Duration so far? Backend tracks this as time_elapsed?
    duration: Optional[int] = None
    target: Optional[float] = None
    userEmail: Optional[str] = None
    
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
