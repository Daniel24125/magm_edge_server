import firebase_admin
from firebase_admin import credentials, firestore
import threading
import time
import os
import json
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
            
            # Convert JSON strings back to objects for Firestore if needed, or store as is.
            # Usually Firestore wants dicts.
            try:
                if session.get('session_details'):
                    session['session_details'] = json.loads(session['session_details'])
                if session.get('settings'):
                    session['settings'] = json.loads(session['settings'])
                if session.get('alert_configuration'):
                    session['alert_configuration'] = json.loads(session['alert_configuration'])
            except json.JSONDecodeError:
                pass # Keep as string if parsing fails
            
            # Add implicit timestamps for Firestore if desired, but we have our own start_time
            # session['uploadedAt'] = firestore.SERVER_TIMESTAMP

            batch.set(doc_ref, session, merge=True)
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
                          .collection('measurements').document(str(m['id'])) # Using local ID as doc ID or use auto-id

            # Clean up data for upload
            payload = {
                'timestamp': m['timestamp'],
                'source': m['source'],
                'data': m['data'], # JSON string from sensor
                'processed_value': m['processed_value'],
                'calibration_id': m['calibration_id'],
                'status': m['status']
            }
            
            batch.set(doc_ref, payload)
            synced_ids.append(m['id'])

        batch.commit()

        # Mark as synced locally
        self.db_helper.mark_measurements_synced(synced_ids)
        logger.info(f"Firebase Sync: Synced {len(synced_ids)} measurements.")
