import os
import json
import logging
import requests

logger = logging.getLogger(__name__)

_firebase_app_initialized = False

def send_fcm_push_notification(fcm_token, title, body, data_payload=None):
    """
    Sends a high-priority FCM push notification to a worker's registered device token.
    Supports FIREBASE_SERVICE_ACCOUNT_JSON env var or direct FCM HTTP v1 / Legacy trigger.
    """
    if not fcm_token:
        logger.info("FCM Push skipped: No FCM token registered for worker.")
        return False

    service_account_json = os.environ.get("FIREBASE_SERVICE_ACCOUNT_JSON")
    
    # If not in env, check worker-app/.env or backend/.env or firebase-service-account.json
    if not service_account_json:
        base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
        possible_paths = [
            os.path.join(base_dir, "worker-app", ".env"),
            os.path.join(base_dir, "backend", ".env"),
            os.path.join(base_dir, "backend", "firebase-service-account.json"),
            os.path.join(base_dir, "firebase-service-account.json"),
        ]
        for path in possible_paths:
            if os.path.exists(path):
                try:
                    with open(path, "r", encoding="utf-8") as f:
                        content = f.read()
                        if path.endswith(".json"):
                            service_account_json = content
                            break
                        import re
                        match = re.search(r"FIREBASE_SERVICE_ACCOUNT_JSON=\s*['\"]?(\{[\s\S]*?\})['\"]?\s*(?:\n|$)", content)
                        if match:
                            service_account_json = match.group(1).strip()
                            break
                except Exception:
                    pass

    # Check if firebase-admin package is available
    try:
        import firebase_admin
        from firebase_admin import credentials, messaging
        global _firebase_app_initialized

        if not _firebase_app_initialized:
            cred = None
            if service_account_json:
                try:
                    cred_dict = json.loads(service_account_json)
                    cred = credentials.Certificate(cred_dict)
                except Exception as e:
                    logger.warning(f"Failed to parse FIREBASE_SERVICE_ACCOUNT_JSON: {e}")

            if cred and not firebase_admin._apps:
                firebase_admin.initialize_app(cred)
                _firebase_app_initialized = True
            elif firebase_admin._apps:
                _firebase_app_initialized = True

        if _firebase_app_initialized:
            message = messaging.Message(
                notification=messaging.Notification(
                    title=title,
                    body=body,
                ),
                data={str(k): str(v) for k, v in (data_payload or {}).items()},
                token=fcm_token,
                android=messaging.AndroidConfig(
                    priority="high",
                    notification=messaging.AndroidNotification(
                        sound="default",
                        channel_id="sanitrax_tasks",
                    ),
                ),
            )
            response = messaging.send(message)
            logger.info(f"FCM Push sent successfully. Message ID: {response}")
            return True
    except ImportError:
        logger.info("firebase-admin SDK not installed. Falling back to HTTP payload logging.")
    except Exception as err:
        logger.error(f"FCM Push send error: {type(err).__name__}: {err}")
        return False

    # Fallback / Dry Run Logging for testing without server key
    logger.info(
        f"[FCM PUSH TRIGGERED]\n"
        f"Token: {fcm_token[:20]}...\n"
        f"Title: {title}\n"
        f"Body: {body}\n"
        f"Data: {data_payload}"
    )
    return True
