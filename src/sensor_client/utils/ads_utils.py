import threading
try:
    import board
    import busio
    import adafruit_ads1x15.ads1115 as ADS

    # Initialize I2C bus
    i2c = busio.I2C(board.SCL, board.SDA)

    # Create the ADS object (default address is 0x48)
    try:
        ads = ADS.ADS1115(i2c)
    except Exception as e:
        from shared.utils.logger import logger
        logger.error(f"Failed to initialize ADS1115: {e}. Check hardware connections or enable simulation mode.")
        ads = None
    
    ads_lock = threading.Lock()

except ImportError as e:
    from shared.utils.logger import logger
    logger.warning(f"Hardware libraries missing ({e.name}). ADS1115 will be unavailable. Use simulation mode.")
    ads = None
    ads_lock = threading.Lock() # Provide a real lock even if ads is None to avoid context manager errors
except Exception as e:
    from shared.utils.logger import logger
    logger.error(f"Unexpected error initializing hardware: {e}")
    ads = None
    ads_lock = threading.Lock()


