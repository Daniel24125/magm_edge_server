import firebase_admin
from firebase_admin import credentials, firestore
import threading
import time
import os
import json
from datetime import datetime, timezone
from pathlib import Path
from dotenv import load_dotenv

from shared.utils.logger import logger
from edge_server.database.db_manager import DatabaseHelper

class FirebaseSyncService(threading.Thread):
    """
    Background service that synchronizes data from local SQLite to Firebase Firestore.
    """
    def __init__(self, db_helper: DatabaseHelper, interval: int = 5):
        super().__init__(daemon=True)
        self.db_helper = db_helper
        self.interval = interval
        self.stop_event = threading.Event()
        self.db_ref = None
        self._init_firebase()

    def _init_firebase(self):
        try:
            # Load env from .env file in the edge_server directory or parent
            env_path = Path(__file__).parent.parent / '.env'
            load_dotenv(dotenv_path=env_path)

            private_key = os.getenv("FIREBASE_PRIVATE_KEY")
            client_email = os.getenv("FIREBASE_CLIENT_EMAIL")
            project_id = os.getenv("FIREBASE_PROJECT_ID")

            if not private_key or not client_email or not project_id:
                logger.error("Firebase Sync: Missing credentials in .env")
                return

            # Handle newline characters in private key if they were escaped
            private_key = private_key.replace('\\n', '\n')

            cred = credentials.Certificate({
                "type": "service_account",
                "project_id": project_id,
                "private_key_id": "unknown", # Optional usually
                "private_key": private_key,
                "client_email": client_email,
                "client_id": "unknown", # Optional
                "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                "token_uri": "https://oauth2.googleapis.com/token",
                "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
                "client_x509_cert_url": f"https://www.googleapis.com/robot/v1/metadata/x509/{client_email}"
            })

            try:
                firebase_admin.get_app()
            except ValueError:
                firebase_admin.initialize_app(cred)
            
            self.db_ref = firestore.client()
            logger.info("Firebase Sync: Successfully initialized Firestore client.")

        except Exception as e:
            logger.error(f"Firebase Sync: Initialization failed: {e}")

    def run(self):
        logger.info("Firebase Sync Service started.")
        while not self.stop_event.is_set():
            if self.db_ref:
                try:
                    self._sync_sessions()
                    self._sync_measurements()
                    self._sync_alerts()
                except Exception as e:
                    logger.error(f"Firebase Sync: Error during sync cycle: {e}")
            
            # Use wait instead of sleep to allow immediate stop
            self.stop_event.wait(self.interval)

    def stop(self):
        self.stop_event.set()
        logger.info("Firebase Sync Service stopping...")

    def _sync_sessions(self):
        # Fetch unsynced sessions
        sessions = self.db_helper.get_unsynced_sessions(limit=5)
        if not sessions:
            return

        batch = self.db_ref.batch()
        synced_ids = []

        for session in sessions:
            doc_ref = self.db_ref.collection('sessions').document(session['id'])
            
            # Map SQLite columns (snake_case) to ISession (camelCase)
            firebase_payload = {
                "id": session['id'],
                "projectId": session['project_id'],
                "userId": session['user_id'],
                "createdAt": session['start_time'],
                "updatedAt": session['end_time'] if session['end_time'] else session['start_time'],
                "endTime": session['end_time'],
                "status": session['status'],
                "notes": session['notes'],
                "duration": session['duration'], 
                "target": session['target']
            }

            if session['start_time'] and session['end_time']:
                try:
                    start = datetime.fromisoformat(session['start_time'].replace('Z', '+00:00'))
                    end = datetime.fromisoformat(session['end_time'].replace('Z', '+00:00'))
                    firebase_payload['time'] = int((end - start).total_seconds())
                except Exception:
                    logger.warning(f"Could not calculate duration for session {session['id']}")
                    firebase_payload['time'] = 0
            else:
                 firebase_payload['time'] = 0

            # Parse JSON fields
            try:
                if session.get('session_details'):
                    firebase_payload['sessionDetails'] = json.loads(session['session_details'])
                else:
                    firebase_payload['sessionDetails'] = {}

                if session.get('settings'):
                    firebase_payload['settings'] = json.loads(session['settings'])
                else:
                    firebase_payload['settings'] = {}

                if session.get('alert_configuration'):
                    firebase_payload['alertConfiguration'] = json.loads(session['alert_configuration'])
                else:
                    firebase_payload['alertConfiguration'] = []

            except json.JSONDecodeError as e:
                logger.warning(f"JSON decode error for session {session['id']}: {e}")
                
            batch.set(doc_ref, firebase_payload, merge=True)
            synced_ids.append(session['id'])

        batch.commit()
        
        # Mark as synced locally
        for sid in synced_ids:
            self.db_helper.mark_session_synced(sid)
        
        logger.info(f"Firebase Sync: Synced {len(synced_ids)} sessions.")

    def _sync_measurements(self):
        # Fetch unsynced measurements
        measurements = self.db_helper.get_unsynced_measurements(limit=50) # Batch size 50
        if not measurements:
            return

        batch = self.db_ref.batch()
        synced_ids = []

        for m in measurements:
            # Structure: sessions/{session_id}/measurements/{measurement_id}
            # Or a top level measurements collection. The user mentioned "measured field in the schema" in previous tasks
            # but usually measurements are subcollections or arrays. 
            # Given the volume, subcollection is best.
            
            doc_ref = self.db_ref.collection('sessions').document(m['session_id'])\
                          .collection('measurements').document() 

            # Clean up data for upload
            payload = {
                'timestamp': m['timestamp'],
                'data': m['data'], 
                'status': m['status']
            }
            
            batch.set(doc_ref, payload)
            synced_ids.append(m['id'])

        batch.commit()

        # Mark as synced locally
        self.db_helper.mark_measurements_synced(synced_ids)
        logger.info(f"Firebase Sync: Synced {len(synced_ids)} measurements.")

    def _sync_alerts(self):
        # Fetch unsynced alerts
        alerts = self.db_helper.get_unsynced_alerts(limit=20)
        if not alerts:
            return

        batch = self.db_ref.batch()
        synced_ids = []

        for a in alerts:
            # Structure: sessions/{session_id}/alerts/{alert_id}
            doc_ref = self.db_ref.collection('sessions').document(a['session_id'])\
                          .collection('alerts').document() # auto-id

            # Clean up data for upload
            payload = {
                'id': doc_ref.id, # Include ID in the document as well
                'timestamp': a['timestamp'],
                'type': a['severity'], # Map severity to type
                'category': 'session',
                'message': a['message'],
                'details': {
                    'sensorType': a['sensor_type'],
                    'value': a['value']
                },
                'read': bool(a['acknowledged']) # Map acknowledged to read
            }
            
            batch.set(doc_ref, payload)
            synced_ids.append(a['id'])

        batch.commit()

        # Mark as synced locally
        self.db_helper.mark_alerts_synced(synced_ids)
        logger.info(f"Firebase Sync: Synced {len(synced_ids)} alerts.")
