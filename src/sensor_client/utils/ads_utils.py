import board
import busio
import adafruit_ads1x15.ads1115 as ADS

# Initialize I2C bus
i2c = busio.I2C(board.SCL, board.SDA)

# Create the ADS object (default address is 0x48)
ads = ADS.ADS1115(i2c)
