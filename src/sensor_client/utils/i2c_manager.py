# utils/i2c_manager.py
import time, subprocess, board, busio, os, sys
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "../.."))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from shared.utils.logger import logger

class SafeI2C:
    """
    Thread-safe, fault-tolerant I2C manager with automatic recovery.

    Ensures only one I2C instance exists and that the bus is not left locked
    between restarts or concurrent sensor reads.
    """

    _instance = None
    _bus_number = 1  # /dev/i2c-1

    @classmethod
    def get(cls, timeout: float = 5.0):
        """Return a ready-to-use I2C instance, waiting at most `timeout` seconds for the bus."""
        import busio, board

        start_time = time.time()
        while True:
            try:
                if cls._instance is None:
                    logger.info("Initializing I2C bus /dev/i2c-1")
                    cls._instance = busio.I2C(board.SCL, board.SDA)

                # Try to acquire the lock safely
                if cls._instance.try_lock():
                    return cls._instance

            except Exception as e:
                logger.warning(f"⚠️ I2C initialization failed: {e}, retrying...")
                cls._instance = None  # reset reference
                time.sleep(0.5)

            # timeout fallback
            if time.time() - start_time > timeout:
                logger.error("❌ I2C initialization timeout — forcing bus reset.")
                cls.reset_bus()
                time.sleep(1)
                start_time = time.time()  # retry from scratch

    @classmethod
    def release(cls):
        """Release the I2C bus lock if held."""
        try:
            if cls._instance and cls._instance.try_lock():
                cls._instance.unlock()
                logger.debug("🔓 I2C bus released")
        except Exception as e:
            logger.error(f"Error releasing I2C lock: {e}")

    @classmethod
    def reset_bus(cls):
        """
        Forcefully release I2C bus using Linux utilities if stuck.
        This prevents the common 'stalled waiting for bus' issue.
        """
        logger.warning("🔁 Forcing I2C bus reset via Linux sysfs...")
        try:
            subprocess.run(["sudo", "i2cdetect", "-y", str(cls._bus_number)], timeout=3)
        except Exception as e:
            logger.error(f"Failed to reset I2C bus: {e}")
        time.sleep(1)

    @classmethod
    def scan_devices(cls):
        """Return a list of detected I2C addresses."""
        i2c = cls.get()
        try:
            addresses = i2c.scan()
            formatted = [f"0x{addr:02X}" for addr in addresses]
            logger.info(f"🔍 I2C devices found: {formatted}")
            return formatted
        finally:
            cls.release()