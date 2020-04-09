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
    let device = new Service.Switch(this.name);

    info.setCharacteristic(Characteristic.Manufacturer, 'Xiaomi').setCharacteristic(Characteristic.Model, 'Multipurpose Kettle');

    /** On */
    device.getCharacteristic(Characteristic.On)
    .on('get', this.getStatus.bind(this))
    .on('set', this.setWork.bind(this));

    /** Looking for accessory + saving data. */
    this.discover();
    this.services = [device, info];
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

      callback(null, result === 2 ? true : false);
    } catch (error) {
      this.log.error('getStatus', error);
      callback(error);
    }
  }

  async discover() {
    try {
      this.device = await miio.device({ address: this.ip, token: this.token });

      /** If custom properties presented by user in config. */
      if (this.heat && this.time) await this.setMode();
      if (this.sound) await this.setVoice(this.sound ? 1 : 0);
    } catch (error) {
      this.log.error('Failed to discover the device. Next try in 1 min!', error);
      setTimeout(() => { this.discover(); }, 60 * 1000);
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

  async setMode() {
    try {
      await this.device.call('delete_modes', [1]);
      const [result] = await this.device.call('set_mode', [1, this.heat, this.time]);

      if (result !== 'ok')
      throw new Error(result);
    } catch (error) {
      this.log.error('setMode', error);
    }
  }

  async setVoice(value) {
    try {
      const [result] = await this.device.call('set_voice', [value]);

      if (result !== 'ok')
      throw new Error(result);
    } catch (e) {
      this.log.error('setVoice', e);
    }
  }

  getServices() {
    return this.services;
  }
}