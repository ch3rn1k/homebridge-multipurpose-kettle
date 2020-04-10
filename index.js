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

    this.log = log;
    this.ip = config.ip;
    this.token = config.token;
    this.name = config.name || 'Mi Multipurpose Kettle';
    if (config.sound) this.sound = config.sound;
    if (config.heat && config.time) {
      this.heat = config.heat;
      this.time = config.time;
    }

    let info = new Service.AccessoryInformation();
    info.setCharacteristic(Characteristic.Manufacturer, 'Xiaomi').setCharacteristic(Characteristic.Model, 'Multipurpose Kettle');

    /** Switch + On */
    let device = new Service.Switch(this.name);
    device.getCharacteristic(Characteristic.On)
    .on('get', this.getStatus.bind(this))
    .on('set', this.setWork.bind(this));

    this.services = [device, info];

    /** TemperatureSensor + CurrentTemperature */
    if (config.temperature) {
      let temperature = new Service.TemperatureSensor();
      temperature.getCharacteristic(Characteristic.CurrentTemperature)
      .on('get', this.getTemperature.bind(this));

      this.services.push(temperature);
    }

    /** Looking for accessory. */
    this.discover();
  }

  async getStatus(callback) {
    try {
      const [result] = await this.device.call('get_prop', ['work_status']);

      /**
       *    1: Reservation
       *    2: Cooking
       *    3: Paused
       *    4: Keeping
       *    5: Stop
      **/

      callback(null, result === 2 || result === 3 || result === 4 ? true : false);
    } catch (error) {
      this.log.error('getStatus', error);
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
      this.device = await miio.device({ address: this.ip, token: this.token });

      /** If custom properties presented by user in config. */
      if (this.heat && this.time) await this.setMode([1, this.heat, this.time]);
      if (this.sound) await this.setVoice(this.sound ? 0 : 1);
    } catch (error) {
      this.log.error('Failed to discover the device. Next try in 2 min!', error);
      setTimeout(() => { this.discover(); }, 60 * 2 * 1000);
    }
  }

  async setWork(state, callback) {
    try {
      let code;

      if (state && this.heat && this.time) {
        /** When custom properties set and device state OFF. */
        code = [2, 1, 0, 0, 0];
      } else if (state) {
        /** When device state OFF. */
        code = [2, 18, 80, 0, 0];
      } else {
        /** When device state ON. */
        code = [0, 18, 0, 0, 0];
      }

      const [result] = await this.device.call('set_work', code);

      if (result !== 'ok')
      throw new Error(result);

      callback();
    } catch (error) {
      this.log.error('setWork', error);
      callback(error);
    }
  }

  async setMode(array) {
    try {
      await this.device.call('delete_modes', [1]);
      const [result] = await this.device.call('set_mode', array);

      if (result !== 'ok')
      throw new Error(result);

      this.log.info(`Successfully created custom mode with ${this.heat} HEAT and ${this.time} MIN!`);
    } catch (error) {
      this.log.error('setMode', error);
    }
  }

  async setVoice(value) {
    try {
      const [result] = await this.device.call('set_voice', [value]);

      if (result !== 'ok')
      throw new Error(result);

      this.log.info(`Successfully set sound to "${this.sound.toString().toUpperCase()}" state!`);
    } catch (e) {
      this.log.error('setVoice', e);
    }
  }

  getServices() {
    return this.services;
  }
}