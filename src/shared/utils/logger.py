import logging


# Define a new log level between INFO (20) and WARNING (30)
STATE_LEVEL_NUM = 25
logging.addLevelName(STATE_LEVEL_NUM, "STATE")

def state(self, message, *args, **kwargs):
    """Custom log method for system state changes."""
    if self.isEnabledFor(STATE_LEVEL_NUM):
        self._log(STATE_LEVEL_NUM, message, args, **kwargs)

# Add the new method to the Logger class
logging.Logger.state = state

logging.basicConfig(
    level=logging.INFO,
    format="%(module)s %(asctime)s [%(levelname)s] %(message)s",
    handlers=[logging.StreamHandler(), logging.FileHandler("src/logs/system.log")]
)
logger = logging.getLogger(__name__)
