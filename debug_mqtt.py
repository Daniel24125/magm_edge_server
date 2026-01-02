import paho.mqtt.client as mqtt
import json
import time
import threading

def on_ws_connect(client, userdata, flags, rc, properties=None):
    print(f"✅ [WS-9001] Connected (rc={rc})")
    client.subscribe("#")

def on_ws_message(client, userdata, msg):
    print(f"✅ [WS-9001] 📩 Received: {msg.topic}")

def start_ws_listener():
    ws_client = mqtt.Client(transport="websockets", callback_api_version=mqtt.CallbackAPIVersion.VERSION2)
    ws_client.on_connect = on_ws_connect
    ws_client.on_message = on_ws_message
    
    print("⏳ [WS-9001] Connecting...")
    try:
        ws_client.connect("localhost", 9001, 60)
        ws_client.loop_forever()
    except Exception as e:
        print(f"❌ [WS-9001] Connection Failed: {e}")

# Start WebSocket listener in background
t = threading.Thread(target=start_ws_listener, daemon=True)
t.start()

# Give it a moment to connect
time.sleep(2)

# Start TCP Publisher
tcp_client = mqtt.Client(callback_api_version=mqtt.CallbackAPIVersion.VERSION2)
print("⏳ [TCP-1883] Connecting...")
tcp_client.connect("localhost", 1883, 60)
tcp_client.loop_start()

while True:
    time.sleep(2)
    print(f"📤 [TCP-1883] Publishing Heartbeat...")
    tcp_client.publish("system/notifications", "Heartbeat", retain=False)

