import paho.mqtt.client as mqtt
import json
import time

MQTT_HOST = "localhost"
MQTT_PORT = 1883
COMMAND_TOPIC = "ui/commands/get_offline_sessions"
RESPONSE_TOPIC = "ui/responses/get_offline_sessions"

# Configure the email you want to test with, or leave None to test fetching all/none depending on logic
USER_EMAIL = "danimad1990@gmail.com" # Replace with actual test email if needed

def on_connect(client, userdata, flags, rc):
    print(f"Connected with result code {rc}")
    client.subscribe(RESPONSE_TOPIC)
    print(f"Subscribed to {RESPONSE_TOPIC}")
    
    # Publish the request immediately after connecting
    payload = {
        "command": "get_offline_sessions",
        "params": {
            "userEmail": USER_EMAIL
        }
    }
    
    # Also test without email if needed
    # payload = { "command": "get_offline_sessions", "params": {} }
    
    print(f"Publishing to {COMMAND_TOPIC}: {json.dumps(payload)}")
    client.publish(COMMAND_TOPIC, json.dumps(payload))

def on_message(client, userdata, msg):
    print("\n--- Received Response ---")
    print(f"Topic: {msg.topic}")
    try:
        parsed_payload = json.loads(msg.payload.decode())
        print("Payload:")
        print(json.dumps(parsed_payload, indent=2))
    except json.JSONDecodeError:
        print(f"Raw Payload: {msg.payload.decode()}")
    print("-------------------------\n")
    
    # Disconnect after receiving the response
    client.disconnect()

if __name__ == "__main__":
    client = mqtt.Client(client_id="test_offline_sessions_script")
    client.on_connect = on_connect
    client.on_message = on_message

    try:
        client.connect(MQTT_HOST, MQTT_PORT, 60)
        # Process network traffic and dispatch callbacks, blocking until disconnected
        client.loop_forever()
    except KeyboardInterrupt:
        print("Exiting...")
        client.disconnect()
    except Exception as e:
        print(f"Error: {e}")
