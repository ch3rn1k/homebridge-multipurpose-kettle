const miio = require('miio');

const temperatureInterval = 5;
const modeNumber = 8;

let Service, Characteristic;

module.exports = homebridge => {
  Service = homebridge.hap.Service;
  Characteristic = homebridge.hap.Characteristic;

  homebridge.registerAccessory('homebridge-multipurpose-kettle', 'MiMultipurposeKettle', MiMultipurposeKettle);
}

class MiMultipurposeKettle {
  constructor(log, config) {
    if (!config.ip) throw new Error('Your must provide IP address of the Multipurpose Kettle!');
    if (!config.token) throw new Error('Your must provide token of the Multipurpose Kettle!');
    if (!config.mode) throw new Error('Your must provide mode to use this plugin!');
    if (!config.heat) throw new Error('Your must provide default heat value to use this plugin!');

    this.log = log;
    this.config = config;
    this.services = Array();

    /** Main info about device. */
    this.deviceInfo = new Service.AccessoryInformation();
    this.deviceInfo.setCharacteristic(Characteristic.Manufacturer, 'Xiaomi').setCharacteristic(Characteristic.Model, 'Multipurpose Kettle').setCharacteristic(Characteristic.SerialNumber, 'viomi.health_pot.v1');
    this.services.push(this.deviceInfo);

    /** Mode handling. */
    if (config.mode === 'switch') {
      this.switch = new Service.Switch(this.config.name || 'Smart Kettle');
      this.switch.getCharacteristic(Characteristic.On)
      .on('get', this.getWorkStatus.bind(this))
      .on('set', this.setWork.bind(this));

      this.services.push(this.switch);

      /** Tempertaure Sensor. */
      if (config.temperature) {
        this.temperature = new Service.TemperatureSensor();
        this.temperature.getCharacteristic(Characteristic.CurrentTemperature)
        .on('get', this.getTemperature.bind(this));

        this.services.push(this.temperature);
      }
    } else if (config.mode === 'thermostat') {
      this.thermostat = new Service.Thermostat(this.config.name || 'Smart Kettle');

      /** Metric System Defaults (only celsius). */
      this.thermostat.getCharacteristic(Characteristic.TemperatureDisplayUnits).setProps({ maxValue: 0, minValue: 0, validValues: [0] });
      this.thermostat.updateCharacteristic(Characteristic.TemperatureDisplayUnits, 0);

      /** Current Temperature + Target Temperature. */
      this.thermostat.getCharacteristic(Characteristic.CurrentTemperature).on('get', this.getTemperature.bind(this));
      this.thermostat.getCharacteristic(Characteristic.TargetTemperature).setProps({ maxValue: 99, minValue: 1, minStep: 1}).on('set', this.setTemperature.bind(this));
      this.thermostat.updateCharacteristic(Characteristic.TargetTemperature, this.config.heat);

      /** Current Mode + Target Mode. */
      this.thermostat.getCharacteristic(Characteristic.CurrentHeatingCoolingState).setProps({ maxValue: 1, minValue: 0, validValues: [0, 1] }).on('get', this.getWorkStatus.bind(this));
      this.thermostat.getCharacteristic(Characteristic.TargetHeatingCoolingState).setProps({ maxValue: 1, minValue: 0, validValues: [0, 1] }).on('set', this.setWork.bind(this));

      this.services.push(this.thermostat);
    }

    /** Looking for accessory. */
    this.discover();
  }

  async getWorkStatus(callback) {
    if (!this.checkDevice()) return;

    try {
      const [result] = await this.doMIIO('get_prop', ['work_status']);
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
      const [result] = await this.doMIIO('get_prop', ['curr_tempe']);

      callback(null, result);
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
      const [base] = await this.doMIIO('get_prop', ['run_status']);
      if (base !== 0) throw new Error(base);

      /** Setting work (ON/OFF). */
      const [result] = await this.doMIIO('set_work', state ? [2, modeNumber, 0, 0, 0] : [0, 18, 0, 0, 0]);
      if (result !== 'ok') throw new Error(result);

      /** Checking for temperature. */
      this.timer = setInterval(async () => {
        if (!state) { clearInterval(this.timer); return; }

        const [tempatureNow] = await this.doMIIO('get_prop', ['curr_tempe']);
        if (this.config.temperature && this.config.mode === 'switch') {
          this.temperature.updateCharacteristic(Characteristic.CurrentTemperature, tempatureNow);
        } else if (this.config.mode === 'thermostat') {
          this.thermostat.updateCharacteristic(Characteristic.CurrentTemperature, tempatureNow);
        }

        this.log.info(`Work in progress! [TEMP ${tempatureNow}, HEAT ${this.config.heat}]`);

        /** When saved temperature is more as needed or same - stop work. */
        if (tempatureNow >= this.config.heat) {
          clearInterval(this.timer);

          await this.doMIIO('set_work', [0, 18, 0, 0, 0]);

          if (this.config.mode === 'switch') {
            this.switch.updateCharacteristic(Characteristic.On, false);
          } else if (this.config.mode === 'thermostat') {
            this.thermostat.updateCharacteristic(Characteristic.TargetHeatingCoolingState, 0);
            this.thermostat.updateCharacteristic(Characteristic.CurrentHeatingCoolingState, 0);
          }

          this.log.info(`Work ended! [TEMP ${tempatureNow}, HEAT ${this.config.heat}]`);
        }
      }, temperatureInterval * 1000);

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

      /** Creating new mode if degree changed, stoping and starting again. */
      await this.createMode([modeNumber, convertedHeat, 240]);
      await this.doMIIO('set_work', [0, 18, 0, 0, 0]);

      const [result] = await this.doMIIO('set_work', [2, modeNumber, 0, 0, 0]);
      if (result !== 'ok') throw new Error(result);

      this.timer = setInterval(async () => {
        const [tempatureNow] = await this.doMIIO('get_prop', ['curr_tempe']);
        this.thermostat.updateCharacteristic(Characteristic.CurrentTemperature, tempatureNow);

        this.log.info(`Work in progress! [TEMP ${tempatureNow}, HEAT ${this.config.heat}]`);

        /** When water temperature is more as needed or same - stop work. */
        if (tempatureNow >= convertedHeat) {
          clearInterval(this.timer);

          await this.doMIIO('set_work', [0, 18, 0, 0, 0]);
          this.thermostat.updateCharacteristic(Characteristic.TargetHeatingCoolingState, 0);
          this.thermostat.updateCharacteristic(Characteristic.CurrentHeatingCoolingState, 0);

          this.log.info(`Work ended! [TEMP ${tempatureNow}, HEAT ${convertedHeat}]`);
        }
      }, temperatureInterval * 1000);
    
      callback(null, convertedHeat);
    } catch (error) {
      this.log.error('setTemperature', error);
      callback(error);
    }
  }

  async createMode(array) {
    if (!this.checkDevice()) return;

    try {
      await this.doMIIO('delete_modes', [modeNumber]);

      const [result] = await this.doMIIO('set_mode', array);
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
      const [result] = await this.doMIIO('set_voice', [value]);
      if (result !== 'ok') throw new Error(result);

      this.log.info(`Successfully set sound to "${this.config.sound.toString().toUpperCase()}" state!`);
    } catch (e) {
      this.log.error('setVoice', e);
    }
  }

  heatConverter(num) {
    if (num <= 0) return 1;
    else if (num >= 100) return 99;

    return num;
  }

  async doMIIO(type, command) {
    if (!this.checkDevice()) return;

    this.log.debug(`Recieved new command, working... [${type} -> ${command.toString()}]`);

    let isFinished = false;

    const miioPromise = new Promise((resolve) => {
      this.device.call(type, command)
      .then((value) => {
        this.log.debug(`DONE - "${[value]}"! [${type} -> ${command.toString()}]`);

        isFinished = true;
        resolve(value);
      });
    });

    const miioDelayPromise = new Promise((resolve, reject) => {
      this.sleep(5000)
      .then(() => {
        if (!isFinished) {
          this.device.call(type, command)
          .then((value) => {
            this.log.debug(`DONE - "${[value]}"! [${type} -> ${command.toString()}]`);

            isFinished = true;
            resolve(value);
          })
          .catch((error) => {
            this.log.debug(`ERROR - "${[error]}"! [${type} -> ${command.toString()}]`);

            this.sleep(200)
            .then(() => miioDelayPromise());

            reject(error);
        });
        }
      });
    });
    
    return await Promise.race([miioPromise, miioDelayPromise]);
  }

  checkDevice() {
    if (!this.device) {
      this.log.error('No kettle was found...');
      return false;
    }

    return true;
  }
  
  /** HELPERS */
  getServices() {
    return this.services;
  }

  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}