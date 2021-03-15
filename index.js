const miio = require('miio');

const temperatureInterval = 5;
const modeNumber = 8;
const requestTimeout = 2.5;

let Service, Characteristic;

module.exports = (api) => {
  Service = api.hap.Service;
  Characteristic = api.hap.Characteristic;

  api.registerAccessory('MiMultipurposeKettle', MiMultipurposeKettle);
};

class MiMultipurposeKettle {
  constructor(log, config, api) {
    if (!config.ip) throw new Error('Your must provide IP address of the Multipurpose Kettle!');
    if (!config.token) throw new Error('Your must provide token of the Multipurpose Kettle!');
    if (!config.mode) throw new Error('Your must provide mode to use this plugin!');
    if (!config.heat) throw new Error('Your must provide default heat value to use this plugin!');

    this.log = log;
    this.config = config;
    this.api = api;
    this.services = Array();

    /** Main info about the device. */
    this.deviceInfo = new Service.AccessoryInformation();
    this.deviceInfo.setCharacteristic(Characteristic.Manufacturer, 'Xiaomi').setCharacteristic(Characteristic.Model, 'Multipurpose Kettle').setCharacteristic(Characteristic.SerialNumber, 'viomi.health_pot.v1');
    this.services.push(this.deviceInfo);

    /** Mode handling. */
    if (config.mode === 'switch') {
      this.switch = new Service.Switch(this.config.name || 'Smart Kettle');
      this.switch.getCharacteristic(Characteristic.On)
      .onGet(this.getWorkStatus.bind(this))
      .onSet(this.setWork.bind(this));

      this.services.push(this.switch);

      /** Tempertaure Sensor. */
      if (config.temperature) {
        this.temperature = new Service.TemperatureSensor();
        this.temperature.getCharacteristic(Characteristic.CurrentTemperature)
        .onGet(this.getTemperature.bind(this));

        this.services.push(this.temperature);
      }
    } else if (config.mode === 'thermostat') {
      this.thermostat = new Service.Thermostat(this.config.name || 'Smart Kettle');

      /** Metric System Defaults (only celsius). */
      this.thermostat.getCharacteristic(Characteristic.TemperatureDisplayUnits).setProps({ maxValue: 0, minValue: 0, validValues: [0] }).updateValue(0);

      /** Current Temperature + Target Temperature. */
      this.thermostat.getCharacteristic(Characteristic.CurrentTemperature).onGet(this.getTemperature.bind(this));
      this.thermostat.getCharacteristic(Characteristic.TargetTemperature).setProps({ maxValue: 99, minValue: 1, minStep: 1}).onSet(this.setTemperature.bind(this));
      this.thermostat.getCharacteristic(Characteristic.TargetTemperature).updateValue(this.config.heat);

      /** Current Mode + Target Mode. */
      this.thermostat.getCharacteristic(Characteristic.CurrentHeatingCoolingState).setProps({ maxValue: 1, minValue: 0, validValues: [0, 1] }).onGet(this.getWorkStatus.bind(this));
      this.thermostat.getCharacteristic(Characteristic.TargetHeatingCoolingState).setProps({ maxValue: 1, minValue: 0, validValues: [0, 1] }).onSet(this.setWork.bind(this));

      this.services.push(this.thermostat);
    }

    /** If there is sensor active state. */
    if (config.sensor) {
      this.sensor = new Service.OccupancySensor('Occupancy Sensor');
      this.sensor.getCharacteristic(Characteristic.OccupancyDetected)
      .onGet(this.getBaseStatus.bind(this));

      this.services.push(this.sensor);
    }

    /** Looking for accessory. */
    this.discover();
  }

  async getBaseStatus(callback) {
    if (!this.checkDevice()) return;

    try {
      const [result] = this.doMIIO('get_prop', ['run_status']);
      /** 0 - On base, 16 - No kettle placed, 32 - Drycooking protection, 48 - Both */

      callback(null, result === 0 ? 1 : 0);
    } catch (error) {
      this.log.error('getBaseStatus', error);
      callback(error);
    }
  }

  async getWorkStatus(callback) {
    if (!this.checkDevice()) return;

    try {
      const [result] = this.doMIIO('get_prop', ['work_status']);
      /** 0: Stopped   1: Reservation   2: Cooking   3: Paused   4: Keeping   5: Stop */

      callback(null, result === 1 || result === 2 || result === 3 || result === 4 ? (this.config.mode === 'switch' ? true : 1) : (this.config.mode === 'switch' ? false : 0));
    } catch (error) {
      this.log.error('getWorkStatus', error);
      callback(error);
    }
  }

  async getTemperature(callback) {
    if (!this.checkDevice()) return;

    try {
      const [result] = this.doMIIO('get_prop', ['curr_tempe']);

      callback(null, result >= 0 ? result : Math.abs(result));
    } catch (error) {
      this.log.error('getTemperature', error);
      callback(error);
    }
  }

  async discover() {
    try {
      this.device = await miio.device({ address: this.config.ip, token: this.config.token });

      /** If properties presented by user in config. */
      await this.createMode([modeNumber, this.config.heat, 240]);
      if (this.config.sound) await this.setVoice(this.config.sound ? 0 : 1);
    } catch (error) {
      this.log.warn('Failed to discover the device. Next try in 2 min!', error);
      setTimeout(() => { this.discover(); }, 60 * 2 * 1000);
    }
  }

  async setWork(state, callback) {
    if (!this.checkDevice()) return;

    clearInterval(this.timer);

    try {
      /** First of all checking for kettle base status. */
      const [base] = this.doMIIO('get_prop', ['run_status']);
      if (base !== 0) {
        if (this.config.mode === 'switch') {
          this.switch.getCharacteristic(Characteristic.On).updateValue(false);
        } else if (this.config.mode === 'thermostat') {
          this.thermostat.getCharacteristic(Characteristic.TargetHeatingCoolingState).updateValue(0);
          this.thermostat.getCharacteristic(Characteristic.CurrentHeatingCoolingState).updateValue(0);
        }

        return;
      }

      /** Setting work (ON/OFF). */
      const [result] = this.doMIIO('set_work', state ? [2, modeNumber, 0, 0, 0] : [0, 18, 0, 0, 0]);
      if (result !== 'ok') throw new Error(result);

      /** Checking for temperature. */
      this.timer = setInterval(async () => {
        if (!state) { clearInterval(this.timer); return; }

        const [tempatureNow] = this.doMIIO('get_prop', ['curr_tempe']);
        if (this.config.temperature && this.config.mode === 'switch') this.temperature.getCharacteristic(Characteristic.CurrentTemperature).updateValue(tempatureNow);
        else if (this.config.mode === 'thermostat') this.thermostat.getCharacteristic(Characteristic.CurrentTemperature).updateValue(tempatureNow);

        this.log.info(`Work in progress! [TEMP ${tempatureNow}, HEAT ${this.config.heat}]`);

        /** When saved temperature is more as needed or same - stop work. */
        if (tempatureNow >= this.config.heat) {
          clearInterval(this.timer);

          this.doMIIO('set_work', [0, 18, 0, 0, 0]);

          if (this.config.mode === 'switch') this.switch.getCharacteristic(Characteristic.On).updateValue(false);
          else if (this.config.mode === 'thermostat') {
            this.thermostat.getCharacteristic(Characteristic.TargetHeatingCoolingState).updateValue(0);
            this.thermostat.getCharacteristic(Characteristic.CurrentHeatingCoolingState).updateValue(0);
          }

          this.log.info(`Work ended! [TEMP ${tempatureNow}, HEAT ${this.config.heat}]`);
        }
      }, (this.config.interval || temperatureInterval) * 1000);

      callback();
    } catch (error) {
      this.log.error('setWork', error);
      callback(error);
    }
  }

  async setTemperature(value, callback) {
    if (!this.checkDevice()) return;

    clearInterval(this.timer);

    try {
      let convertedHeat = this.heatConverter(value);

      /** First of all checking for kettle base status. */
      const [base] = this.doMIIO('get_prop', ['run_status']);
      if (base !== 0) {
        this.thermostat.getCharacteristic(Characteristic.TargetHeatingCoolingState).updateValue(0);
        this.thermostat.getCharacteristic(Characteristic.CurrentHeatingCoolingState).updateValue(0);

        return;
      }

      /** Creating new mode if degree changed, stoping and starting again. */
      await this.createMode([modeNumber, convertedHeat, 240]);
      this.doMIIO('set_work', [0, 18, 0, 0, 0]);

      const [result] = this.doMIIO('set_work', [2, modeNumber, 0, 0, 0]);
      if (result !== 'ok') throw new Error(result);

      this.timer = setInterval(async () => {
        const [tempatureNow] = this.doMIIO('get_prop', ['curr_tempe']);
        this.thermostat.getCharacteristic(Characteristic.CurrentTemperature).updateValue(tempatureNow);

        this.log.info(`Work in progress! [TEMP ${tempatureNow}, HEAT ${this.config.heat}]`);

        /** When water temperature is more as needed or same - stop work. */
        if (tempatureNow >= convertedHeat) {
          clearInterval(this.timer);

          this.doMIIO('set_work', [0, 18, 0, 0, 0]);
          this.thermostat.getCharacteristic(Characteristic.TargetHeatingCoolingState).updateValue(0);
          this.thermostat.getCharacteristic(Characteristic.CurrentHeatingCoolingState).updateValue(0);

          this.log.info(`Work ended! [TEMP ${tempatureNow}, HEAT ${convertedHeat}]`);
        }
      }, (this.config.interval || temperatureInterval) * 1000);
    
      callback(null, convertedHeat);
    } catch (error) {
      this.log.error('setTemperature', error);
      callback(error);
    }
  }

  async createMode(array) {
    if (!this.checkDevice()) return;

    try {
      this.doMIIO('delete_modes', [modeNumber]);

      const [result] = this.doMIIO('set_mode', array);
      if (result !== 'ok') throw new Error(result);

      this.config.heat = array[1];

      this.log.info(`Successfully created custom mode with ${array[1]}°C!`);
    } catch (error) {
      this.log.error('createMode', error);
    }
  }

  async setVoice(value) {
    if (!this.checkDevice()) return;

    try {
      const [result] = this.doMIIO('set_voice', [value]);
      if (result !== 'ok') throw new Error(result);

      this.log.info(`Successfully set sound to "${this.config.sound.toString().toUpperCase()}" state!`);
    } catch (e) {
      this.log.error('setVoice', e);
    }
  }

  async doMIIO(type, command) {
    if (!this.checkDevice()) return;

    if (this.config.debug) this.log.info(`Received new command, working... [${type} -> ${command.toString()}]`);
    else this.log.debug(`Received new command, working... [${type} -> ${command.toString()}]`);

    let isFinished = false;

    const miioPromise = new Promise((resolve, reject) => {
      this.device.call(type, command)
      .then((value) => {
        if (this.config.debug) this.log.info(`DONE - "${[value]}"! [${type} -> ${command.toString()} ... miioPromise]`);
        else this.log.debug(`DONE - "${[value]}"! [${type} -> ${command.toString()} ... miioPromise]`);

        if (value === 'error') miioDelayPromise();

        isFinished = true;
        resolve(value);
      })
    });

    const miioDelayPromise = new Promise((resolve, reject) => {
      this.sleep(requestTimeout * 1000)
      .then(() => {
        if (!isFinished) {
          this.device.call(type, command)
          .then((value) => {
            if (this.config.debug) this.log.info(`DONE - "${[value]}"! [${type} -> ${command.toString()} ... miioDelayPromise]`);
            else this.log.debug(`DONE - "${[value]}"! [${type} -> ${command.toString()} ... miioDelayPromise]`);

            if (value === 'error') throw new Error();

            isFinished = true;
            resolve(value);
          })
          .catch((error) => {
            if (this.config.debug) this.log.info(`ERROR - "${[error]}"! [${type} -> ${command.toString()} ... miioDelayPromise]`);
            else this.log.debug(`ERROR - "${[error]}"! [${type} -> ${command.toString()} ... miioDelayPromise]`);

            this.sleep(200)
            .then(() => miioDelayPromise());

            reject(error);
          });
        }
      });
    });
    
    return await Promise.race([miioPromise, miioDelayPromise]);
  }
  
  /** HELPERS */
  heatConverter(num) {
    if (num <= 0) return 1;
    else if (num >= 100) return 99;

    return num;
  }

  checkDevice() {
    if (!this.device) {
      this.log.error('No kettle was found...');
      return false;
    }

    return true;
  }

  getServices() {
    return this.services;
  }

  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}