import logging
import os
from logging.handlers import RotatingFileHandler


# Base log directory (placed at project root)
BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "../.."))
LOG_DIR = os.path.join(BASE_DIR, "logs")
os.makedirs(LOG_DIR, exist_ok=True)

# File path for warnings and errors
LOG_FILE_PATH = os.path.join(LOG_DIR, "system_warnings.log")


# ----------------------------
# HANDLERS
# ----------------------------

# Console handler — INFO and above
console_handler = logging.StreamHandler()
console_handler.setLevel(logging.DEBUG)
console_formatter = logging.Formatter(
    "%(module)s %(asctime)s [%(levelname)s] %(message)s", "%Y-%m-%d %H:%M:%S"
)
console_handler.setFormatter(console_formatter)

# File handler — only WARNING and above
file_handler = RotatingFileHandler(
    LOG_FILE_PATH,
    maxBytes=5_000_000,  # 5 MB per file
    backupCount=5        # Keep last 5 log files
)
file_handler.setLevel(logging.WARNING)
file_formatter = logging.Formatter(
    "%(module)s %(asctime)s [%(levelname)s] %(name)s: %(message)s", "%Y-%m-%d %H:%M:%S"
)
file_handler.setFormatter(file_formatter)

# ----------------------------
# ROOT LOGGER
# ----------------------------
root_logger = logging.getLogger()
root_logger.setLevel(logging.DEBUG)
root_logger.addHandler(console_handler)
# root_logger.addHandler(file_handler)


# ----------------------------
# HELPER FUNCTION
# ----------------------------
def get_logger(name: str = None) -> logging.Logger:
    """
    Returns a module-specific logger that inherits the global configuration.
    Usage:
        from shared.utils.logger import get_logger
        logger = get_logger(__name__)
    """
    return logging.getLogger(name)


# ----------------------------
# DEFAULT LOGGER (OPTIONAL)
# ----------------------------
logger = get_logger(__name__)