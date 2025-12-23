import numpy as np 
import sys
import os 
import time
from .ads_utils import ads, ads_lock
from adafruit_ads1x15.analog_in import AnalogIn
port_map = [0,1,2,3]

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "../.."))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

try:
    from edge_server.database.db_manager import DatabaseHelper
    from shared.utils.logger import logger

except ImportError as e:
    logger.error(f"Configuration import failed. Please ensure the 'config' package is set up correctly. Error: {e}")
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
    db = DatabaseHelper("src/edge_server/database/models/sessions.db")


    def __init__(self, sensor_config):
        self.sensor_config = sensor_config
        self.cal_data = self.db.get_last_calibration("pH")
        self.probe = self.sensor_config.get("probe")
        self.analog = AnalogIn(ads, port_map[self.probe])

    # This method is responsible for getting an analog read of the sensors. The read value corresponds to an average of 20 reads (i.e., 20 by default)
    def get_read(self, NUM_MEAS_FOR_AVG=20):
        analog_avg = self.get_analog_read(NUM_MEAS_FOR_AVG)

        return self.convert_analog(analog_avg)
    
    def get_analog_read(self, NUM_MEAS_FOR_AVG=20): 
        self.ready=False
        analog_values = np.zeros(NUM_MEAS_FOR_AVG)
        

        with ads_lock:
            for i in range(NUM_MEAS_FOR_AVG):
                try:
                    an_read = self.analog.value
                    analog_values[i] = an_read
                    time.sleep(0.01) # Wait for next sample (assuming <100SPS)
                    # logger.debug(f"Sample {i}: {an_read}") 
                except Exception as err:
                    logger.error(f"Error while retrieving analog signal: {err}")
                    pass
        
        mask = np.ma.masked_equal(analog_values,0).compressed()
        if len(mask) == 0:
            logger.warning("All analog reads were 0 or failed!")
            return 0
            
        analog_avg = np.average(mask)
        self.ready=True
        return analog_avg

    # This method is responsible for converting the analog read to the pH value according to the sensors' calibration curve
    def convert_analog(self, analog_read):
        _,m, b, _, _, _ = self.cal_data
        return round(m*analog_read+b, 2)

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


