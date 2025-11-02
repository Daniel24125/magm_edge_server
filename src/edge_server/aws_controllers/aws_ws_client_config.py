# src/edge_server/utils/aws_ws_client_config.py
import boto3, time, threading
from datetime import datetime, timedelta, timezone

import os, sys

project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "../.."))
if project_root not in sys.path:
    sys.path.insert(0, project_root)
from shared.utils.logger import logger

class AWSWSClientConfig:
    def __init__(self, profile_name: str, role_arn: str, region: str):
        self.profile_name = profile_name
        self.role_arn = role_arn
        self.region = region
        self._lock = threading.Lock()
        self._creds = None
        self._expiry = None
        self._session = boto3.Session(profile_name=profile_name)
        self._sts = self._session.client("sts")

    def _get_expiration(self, creds):
        expiration = creds["Expiration"]
        if isinstance(expiration, datetime):
            expiry_dt = expiration.astimezone(timezone.utc)
        else:
            expiry_dt = datetime.strptime(expiration, "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=timezone.utc)
        return expiry_dt

    def _assume_role(self):
        resp = self._sts.assume_role(RoleArn=self.role_arn, RoleSessionName="edge-session")
        creds = resp["Credentials"]
        expiry_dt = self._get_expiration(creds)
        with self._lock:
            self._creds = creds
            self._expiry = expiry_dt
        logger.info(f"New STS credentials valid until {self._expiry.isoformat()}")
        return creds

    def get_credentials(self):
        with self._lock:
            if self._creds and datetime.now(timezone.utc) + timedelta(minutes=5) < self._expiry:
                return self._creds
        return self._assume_role()

    def auto_refresh_loop(self, interval=300):
        def loop():
            while True:
                self.get_credentials()
                time.sleep(interval)
        t = threading.Thread(target=loop, daemon=True)
        t.start()
