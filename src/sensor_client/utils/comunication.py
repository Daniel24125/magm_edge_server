import numpy as np 
from scipy import stats
import sys
import os 
try:
    from adafruit_ads1x15.analog_in import AnalogIn
    import adafruit_ads1x15.ads1115 as ADS
    import busio
    import board
    i2c = busio.I2C(board.SCL, board.SDA)
    ads = ADS.ADS1115(i2c, address=0x48)
    port_map = [ADS.P0, ADS.P1, ADS.P2, ADS.P3]
except ImportError as err: 
    print("Error trying to import I2C libraries: ", err)


PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '../..'))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from shared.utils.logger import logger
try:
    from shared.utils.config_loader import load_config
except ImportError as e:
    print(f"Configuration import failed. Please ensure the 'config' package is set up correctly. Error: {e}")
    sys.exit(1)

class AnalogCommunication:
    """
        This class is responsible for establishing an analog connection with de ADS1115 converter.
    """
    analog_read = 0
    listen = False
    error = False
    converted_read=False
    ready = True

    def __init__(self, calibration_config_path):
        self.sensor_config = load_config(os.path.join(PROJECT_ROOT, "sensor_client/sensors", calibration_config_path))

    def get_regression_params(self):
        try:
            x = np.array([self.sensor_config.get("acidic_value"), self.sensor_config.get("alkaline_value")]).astype(np.float64)
            y = np.array([4,7]).astype(np.float64)
            cal = stats.linregress(x,y)
            return (cal.slope, cal.intercept)
        except Exception as err:
            self.error= True
            print("Error while getting regression params",err)

    # This method is responsible for getting an analog read of the sensors. The read value corresponds to an average of 20 reads (i.e., 20 by default)
    def get_read(self, NUM_MEAS_FOR_AVG=20):
        analog_avg = self.get_analog_read(NUM_MEAS_FOR_AVG)
        return self.convert_analog(analog_avg)

    def get_analog_read(self, NUM_MEAS_FOR_AVG=20): 
        self.ready=False
        analog_values = np.zeros(NUM_MEAS_FOR_AVG)
        for i in range(NUM_MEAS_FOR_AVG):

            try:
                probe = self.sensor_config.get(probe)
                an_read = AnalogIn(ads, port_map[probe]).value
                analog_values[i] = an_read
            except Exception as err:
                print(err)
                pass

        mask = np.ma.masked_equal(analog_values,0).compressed()
        analog_avg = np.average(mask)
        self.ready=True
        return analog_avg

    # This method is responsible for converting the analog read to the pH value according to the sensors' calibration curve
    def convert_analog(self, analog_read):
        m,b=self.get_regression_params()
        return round(analog_read*m+b, 2)

    # this method is responsible for updating the classes' current values for the pH sensor
    def update_current_values(self):
        try:
            while True:
                for i in range(len(self.sensor_list)):
                    m,b=self.get_regression_params(self.sensor_list[i])
                    analog_read = self.get_read(self.port)
                    self.analog_read = analog_read
                    self.converted_read = round((analog_read-b)/m, 2)
        except Exception as err:
            print(err)
            self.error=True

