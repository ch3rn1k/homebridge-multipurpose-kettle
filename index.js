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

    let device = new Service.Switch(options.name);

    this.log = log;
    this.ip = config.ip;
    this.token = config.token;

    /** On */
    device.getCharacteristic(Characteristic.On)
    .on('set', this.setOn.bind(this))
  }

  getServices() {
    return this.services;
  }

  async discover() {
    try {
      this.device = await miio.device({ address: this.ip, token: this.token });
    } catch (error) {
      this.log.error('Failed to discover the device. Next try in 1 minute!', error);
      setTimeout(() => { this.discover(); }, 60 * 1000);
    }
  }

  async setOn(state, callback) {
    try {
      const [result] = await this.device.call('set_work', [2,18,80,6,0]);

      if (result !== 'ok')
      throw new Error(result);

      callback();
    } catch (e) {
      this.log.error('setOn', e);
      callback(e);
    }
  }
}