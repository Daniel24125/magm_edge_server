import json
from typing import Dict, Any


def load_config(path: str) -> Dict[str, Any]:
    """Loads the application configuration from the JSON file."""
    try:
        with open(path, 'r') as f:
            return json.load(f)
    except FileNotFoundError:
        print(f"ERROR: Configuration file not found at {path}")
        exit(1)
    except json.JSONDecodeError:
        print(f"ERROR: Could not decode JSON from {path}")
        exit(1)

def save_config(path, payload):
    try:
        with open(path, "w") as f:
            json.dump(payload, f, indent=2)
    except FileNotFoundError:
        print(f"ERROR: Configuration file not found at {path}")
        exit(1)
    except json.JSONEncoder:
        print(f"ERROR: Could not encode JSON from {path}")
        exit(1)
