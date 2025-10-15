import json
import os
import boto3
from decimal import Decimal
import time
import logging

logger = logging.getLogger()
logger.setLevel(logging.INFO)

dynamodb = boto3.resource("dynamodb")
TABLE_NAME = os.environ.get("DYNAMO_TABLE")

# Helper to convert floats in JSON to Decimal (for DynamoDB)
def convert_floats(obj):
    if isinstance(obj, dict):
        return {k: convert_floats(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [convert_floats(v) for v in obj]
    elif isinstance(obj, float):
        return Decimal(str(obj))
    else:
        return obj

def lambda_handler(event, context):
    """
    event example (wrapped by IoT Rule):
    {
      "topic": "microalgae/edge01/sensors",
      "timestamp": 169XXX,
      "device_id": "edge01",
      "temperature": 24.5,
      "ph": 7.1,
      "spectra": { ... }  # optional
    }
    """
    logger.info("Received event: %s", json.dumps(event))

    # Preprocess: for example compute derived fields, filter out bad data
    payload = event  
    
    # convert floats to Decimal for DynamoDB
    safe_payload = convert_floats(payload)

    # Add metadata
    safe_payload["ingested_at"] = Decimal(str(time.time()))
    safe_payload.setdefault("device_id", event.get("device_id", "unknown"))
    safe_payload.setdefault("topic", event.get("topic", ""))

    table = dynamodb.Table(TABLE_NAME)
    try:
        table.put_item(Item=safe_payload)
        logger.info("Wrote to DynamoDB: %s", safe_payload)
    except Exception as e:
        logger.exception("Error writing to DynamoDB: %s", e)
        raise e  
    return {
        "status": "success"
    }
