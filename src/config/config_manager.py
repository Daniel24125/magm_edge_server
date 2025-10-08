import json
from pathlib import Path
from typing import Dict, Any

# --- Constants ---
CONFIG_PATH = Path(__file__).parent / "config.json"


def load_config() -> Dict[str, Any]:
    """Loads the application configuration from the JSON file."""
    try:
        with open(CONFIG_PATH, 'r') as f:
            return json.load(f)
    except FileNotFoundError:
        print(f"ERROR: Configuration file not found at {CONFIG_PATH}")
        exit(1)
    except json.JSONDecodeError:
        print(f"ERROR: Could not decode JSON from {CONFIG_PATH}")
        exit(1)

config = load_config()


if __name__ == "__main__":
    print("Configuration loaded successfully.")
    print(json.dumps(config, indent=4))