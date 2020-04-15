const miio = require('miio');

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
    let info = new Service.AccessoryInformation();
    info.setCharacteristic(Characteristic.Manufacturer, 'Xiaomi').setCharacteristic(Characteristic.Model, 'Multipurpose Kettle');
    this.services.push(info);

    /** Mode handling. */
    if (config.mode === 'switch') {
      let device = new Service.Switch(this.config.name || 'Smart Kettle');
      device.getCharacteristic(Characteristic.On)
      .on('get', this.getWorkStatus.bind(this))
      .on('set', this.setWork.bind(this));

      this.services.push(device);

      /** Tempertaure Sensor. */
      if (config.temperature) {
        let temperature = new Service.TemperatureSensor();
        temperature.getCharacteristic(Characteristic.CurrentTemperature)
        .on('get', this.getTemperature.bind(this));

        this.services.push(temperature);
      }
    } else if (config.mode === 'thermostat') {
      let device = new Service.Thermostat(this.config.name || 'Smart Kettle');

      /** Current Temperature + Target Temperature. */
      device.getCharacteristic(Characteristic.CurrentTemperature).on('get', this.getTemperature.bind(this));
      device.getCharacteristic(Characteristic.TargetTemperature).setProps({ maxValue: 99, minValue: 1, minStep: 1})
      .on('set', this.setTemperature.bind(this));
      /** Default value. */
      device.getCharacteristic(Characteristic.TargetTemperature).value = this.config.heat;

      /** Current Mode + Target Mode. */
      device.getCharacteristic(Characteristic.CurrentHeatingCoolingState).setProps({ maxValue: 1, minValue: 0, validValues: [0, 1] })
      .on('get', this.getWorkStatus.bind(this));

      device.getCharacteristic(Characteristic.TargetHeatingCoolingState).setProps({ maxValue: 1, minValue: 0, validValues: [0, 1] })
      .on('set', this.setWork.bind(this));

      this.services.push(device);
    }

    /** Looking for accessory. */
    this.discover();
  }

  async getWorkStatus(callback) {
    try {
      const [result] = await this.device.call('get_prop', ['work_status']);
      /** 1: Reservation   2: Cooking   3: Paused   4: Keeping   5: Stop */

      if (result !== 1 && result !== 2 && result !== 3 && result !== 4 && result !== 5)
      throw new Error(result);

      callback(null, result === 1 || result === 2 || result === 3 || result === 4 ? true : false);
    } catch (error) {
      this.log.error('getWorkStatus', error);
      callback(error);
    }
  }

  async getTemperature(callback) {
    try {
      const [result] = await this.device.call('get_prop', ['curr_tempe']);

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
      await this.setMode([1, this.config.heat, 240]);
      if (this.config.sound) await this.setVoice(this.config.sound ? 0 : 1);
    } catch (error) {
      this.log.error('Failed to discover the device. Next try in 2 min!', error);
      setTimeout(() => { this.discover(); }, 60 * 2 * 1000);
    }
  }

  async setWork(state, callback) {
    try {
      clearInterval(this.timer);

      /** First of all checking for kettle base status. */
      const [base] = await this.device.call('get_prop', ['run_status']);
      if (base !== 0)
      throw new Error(base);

      /** Setting work (ON/OFF). */
      const [result] = await this.device.call('set_work', state ? [2, 1, 0, 0, 0] : [0, 18, 0, 0, 0]);
      if (result !== 'ok')
      throw new Error(result);

      /** Checking for temperature. */
      this.timer = setInterval(async () => {
        const [temp] = await this.device.call('get_prop', ['curr_tempe']);

        /** When saved temperature is more as needed or same - stop work. */
        if (temp >= this.config.heat) {
          await this.device.call('set_work', [0, 18, 0, 0, 0]);

          clearInterval(this.timer);
        }
      }, 2000);

      callback();
    } catch (error) {
      this.log.error('setWork', error);
      callback(error);
    }
  }

  async setTemperature(value, callback) {
    try {
      clearInterval(this.timer);

      /** Creating new mode if degree changed, stoping and starting again. */
      await this.setMode([1, value, 240]);
      await this.device.call('set_work', [0, 18, 0, 0, 0]);
      const [result] = await this.device.call('set_work', [2, 1, 0, 0, 0]);

      if (result !== 'ok')
      throw new Error(result);

      this.timer = setInterval(async () => {
        const [temp] = await this.device.call('get_prop', ['curr_tempe']);
        /** When water temperature is more as needed or same - stop work. */
        if (temp >= value) {
          await this.device.call('set_work', [0, 18, 0, 0, 0]);

          clearInterval(this.timer);
        }
      }, 2000);
    
      callback(null, value);
    } catch (error) {
      this.log.error('setTemperature', error);
      callback(error);
    }
  }

  async setMode(array) {
    try {
      await this.device.call('delete_modes', [1]);
      const [result] = await this.device.call('set_mode', array);

      if (result !== 'ok')
      throw new Error(result);

      this.log.info(`Successfully created custom mode with ${array[1]} HEAT!`);
    } catch (error) {
      this.log.error('setMode', error);
    }
  }

  async setVoice(value) {
    try {
      const [result] = await this.device.call('set_voice', [value]);

      if (result !== 'ok')
      throw new Error(result);

      this.log.info(`Successfully set sound to "${this.config.sound.toString().toUpperCase()}" state!`);
    } catch (e) {
      this.log.error('setVoice', e);
    }
  }

  getServices() {
    return this.services;
  }
}