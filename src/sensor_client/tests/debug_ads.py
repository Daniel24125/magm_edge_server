import time
import board
import busio
import adafruit_ads1x15.ads1115 as ADS
from adafruit_ads1x15.analog_in import AnalogIn

def test_ads():
    print("Initializing I2C and ADS1115...")
    i2c = busio.I2C(board.SCL, board.SDA)
    ads = ADS.ADS1115(i2c)
    
    # Check default gain/rate
    print(f"ADS Gain: {ads.gain}")
    print(f"ADS Data Rate: {ads.data_rate}")
    print(f"ADS Mode: {ads.mode}")

    # Read Channel 0 (assuming probe is there, port_map[0]=0)
    chan = AnalogIn(ads, ADS.P0)
    
    print("\nStarting 20 reads with 100ms delay:")
    for i in range(20):
        val = chan.value
        volts = chan.voltage
        print(f"Sample {i}: Raw={val}, Voltage={volts:.4f}")
        time.sleep(0.1)

if __name__ == "__main__":
    test_ads()
