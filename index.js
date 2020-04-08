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

    let info = new Service.AccessoryInformation();
    let device = new Service.Switch(config.name);

    this.log = log;
    this.ip = config.ip;
    this.token = config.token;
    this.services = [device, info];

    info
    .setCharacteristic(Characteristic.Manufacturer, 'Xiaomi')
    .setCharacteristic(Characteristic.Model, 'Kettle')
    .setCharacteristic(Characteristic.SerialNumber, 'Undefined')

    /** On */
    device.getCharacteristic(Characteristic.On)
    .on('get', this.getStatus.bind(this))
    .on('set', this.setWork.bind(this));

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

  async discover() {
    try {
      this.device = await miio.device({ address: this.ip, token: this.token });
    } catch (error) {
      this.log.error('Failed to discover the device. Next try in 1 min!', error);
      setTimeout(() => { this.discover(); }, 60 * 1000);
    }
  }

  async setWork(state, callback) {
    try {
      const [result] = await this.device.call('set_work', state ? [2, 18, 60, 0, 0] : [0, 18, 0, 0, 0]);

      if (result !== 'ok')
      throw new Error(result);

      callback();
    } catch (error) {
      this.log.error('setWork', error);
      callback(error);
    }
  }

  async setVoice() {
    try {
      const [result] = await this.device.call('set_voice', [1]);

      if (result !== 'ok')
      throw new Error(result);

      callback();
    } catch (e) {
      this.log.error('setVoice', e);
      callback(e);
    }
  }

  getServices() {
    return this.services;
  }
}