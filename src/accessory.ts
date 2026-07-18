import type {
  AccessoryConfig,
  AccessoryPlugin,
  API,
  CharacteristicValue,
  HAP,
  Logging,
  Service,
} from 'homebridge';

import { KettleTransport, MiioTransport } from './transport.js';
import {
  DEFAULT_INTERVAL,
  DISCOVER_RETRY_MS,
  KettleConfig,
  MANUFACTURER,
  MODE_SLOT,
  MODEL,
  SERIAL_NUMBER,
} from './settings.js';

const ACTIVE_WORK_STATES = new Set([1, 2, 3, 4]);
const MODE_DURATION = 240;

export class MiMultipurposeKettle implements AccessoryPlugin {
  private readonly hap: HAP;
  private readonly Service: typeof Service;
  private readonly Characteristic: HAP['Characteristic'];

  private readonly name: string;
  private readonly config: KettleConfig;
  private readonly transport: KettleTransport;
  private readonly services: Service[] = [];

  private currentHeat: number;
  private timer?: NodeJS.Timeout;

  private switchService?: Service;
  private temperatureService?: Service;
  private thermostatService?: Service;

  constructor(
    private readonly log: Logging,
    rawConfig: AccessoryConfig,
    api: API,
  ) {
    const config = rawConfig as KettleConfig;
    this.assertConfig(config);

    this.hap = api.hap;
    this.Service = api.hap.Service;
    this.Characteristic = api.hap.Characteristic;

    this.config = config;
    this.name = config.name || 'Smart Kettle';
    this.currentHeat = this.clampHeat(config.heat);

    this.transport = new MiioTransport(config.ip, config.token, log, config.debug);

    this.buildInformationService();
    this.buildModeServices();
    this.buildOptionalServices();

    void this.discover();

    api.on('shutdown', () => this.shutdown());
  }

  getServices(): Service[] {
    return this.services;
  }

  private buildInformationService(): void {
    const info = new this.Service.AccessoryInformation()
      .setCharacteristic(this.Characteristic.Manufacturer, MANUFACTURER)
      .setCharacteristic(this.Characteristic.Model, MODEL)
      .setCharacteristic(this.Characteristic.SerialNumber, SERIAL_NUMBER);

    this.services.push(info);
  }

  private buildModeServices(): void {
    if (this.config.mode === 'switch') {
      this.buildSwitchService();
    } else {
      this.buildThermostatService();
    }
  }

  private buildSwitchService(): void {
    const service = new this.Service.Switch(this.name);

    service
      .getCharacteristic(this.Characteristic.On)
      .onGet(() => this.handleGetOn())
      .onSet((value) => this.handleSetOn(value));

    this.switchService = service;
    this.services.push(service);

    if (this.config.temperature) {
      const temperature = new this.Service.TemperatureSensor();
      temperature
        .getCharacteristic(this.Characteristic.CurrentTemperature)
        .onGet(() => this.handleGetTemperature());

      this.temperatureService = temperature;
      this.services.push(temperature);
    }
  }

  private buildThermostatService(): void {
    const service = new this.Service.Thermostat(this.name);
    const C = this.Characteristic;

    service
      .getCharacteristic(C.TemperatureDisplayUnits)
      .setProps({ maxValue: 0, minValue: 0, validValues: [0] })
      .updateValue(0);

    service.getCharacteristic(C.CurrentTemperature).onGet(() => this.handleGetTemperature());

    service
      .getCharacteristic(C.TargetTemperature)
      .setProps({ maxValue: 99, minValue: 1, minStep: 1 })
      .onGet(() => this.currentHeat)
      .onSet((value) => this.handleSetTargetTemperature(value));
    service.getCharacteristic(C.TargetTemperature).updateValue(this.currentHeat);

    service
      .getCharacteristic(C.CurrentHeatingCoolingState)
      .setProps({ maxValue: 1, minValue: 0, validValues: [0, 1] })
      .onGet(() => this.handleGetHeatingState());

    service
      .getCharacteristic(C.TargetHeatingCoolingState)
      .setProps({ maxValue: 1, minValue: 0, validValues: [0, 1] })
      .onGet(() => this.handleGetHeatingState())
      .onSet((value) => this.handleSetOn(value));

    this.thermostatService = service;
    this.services.push(service);
  }

  private buildOptionalServices(): void {
    if (!this.config.sensor) {
      return;
    }

    const sensor = new this.Service.OccupancySensor('Occupancy Sensor');
    sensor
      .getCharacteristic(this.Characteristic.OccupancyDetected)
      .onGet(() => this.handleGetOccupancy());

    this.services.push(sensor);
  }

  private async discover(): Promise<void> {
    try {
      await this.transport.connect();
      await this.transport.setMode(MODE_SLOT, this.currentHeat, MODE_DURATION);
      this.log.info(`Created custom mode at ${this.currentHeat}°C.`);

      if (this.config.sound !== undefined) {
        await this.transport.setVoice(this.config.sound);
        this.log.info(`Interaction sounds set to "${this.config.sound ? 'ON' : 'OFF'}".`);
      }

      this.log.info('Kettle is ready.');
    } catch (error) {
      this.log.warn('Failed to discover the kettle, retrying in 2 min.', error as Error);
      setTimeout(() => void this.discover(), DISCOVER_RETRY_MS);
    }
  }

  private shutdown(): void {
    this.stopHeating();
    this.transport.destroy();
  }

  private async handleGetOn(): Promise<CharacteristicValue> {
    this.ensureReady();
    const work = await this.transport.getWorkStatus();
    return ACTIVE_WORK_STATES.has(work);
  }

  private async handleGetHeatingState(): Promise<CharacteristicValue> {
    this.ensureReady();
    const work = await this.transport.getWorkStatus();
    return ACTIVE_WORK_STATES.has(work) ? 1 : 0;
  }

  private async handleGetTemperature(): Promise<CharacteristicValue> {
    this.ensureReady();
    return this.transport.getTemperature();
  }

  private async handleGetOccupancy(): Promise<CharacteristicValue> {
    this.ensureReady();
    const run = await this.transport.getRunStatus();
    return run === 0 ? 1 : 0;
  }

  private async handleSetOn(value: CharacteristicValue): Promise<void> {
    this.ensureReady();
    this.stopHeating();

    const on = Boolean(value);

    if (on && !(await this.isKettleOnBase())) {
      this.reflectStopped();
      return;
    }

    await this.transport.setWork(on, MODE_SLOT);

    if (on) {
      this.startHeating(this.currentHeat);
    }
  }

  private async handleSetTargetTemperature(value: CharacteristicValue): Promise<void> {
    this.ensureReady();
    this.stopHeating();

    const target = this.clampHeat(Number(value));

    if (!(await this.isKettleOnBase())) {
      this.reflectStopped();
      return;
    }

    await this.transport.setMode(MODE_SLOT, target, MODE_DURATION);
    this.currentHeat = target;

    await this.transport.setWork(false, MODE_SLOT);
    await this.transport.setWork(true, MODE_SLOT);

    this.startHeating(target);
  }

  private startHeating(target: number): void {
    const intervalMs = (this.config.interval || DEFAULT_INTERVAL) * 1000;

    this.timer = setInterval(() => void this.pollHeating(target), intervalMs);
  }

  private async pollHeating(target: number): Promise<void> {
    try {
      const temperature = await this.transport.getTemperature();
      this.publishTemperature(temperature);
      this.log.info(`Heating… [temp ${temperature}°C, target ${target}°C]`);

      if (temperature >= target) {
        this.stopHeating();
        await this.transport.setWork(false, MODE_SLOT);
        this.reflectStopped();
        this.log.info(`Heating finished. [temp ${temperature}°C, target ${target}°C]`);
      }
    } catch (error) {
      this.log.error('Heating poll failed.', error as Error);
    }
  }

  private stopHeating(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
  }

  private publishTemperature(temperature: number): void {
    if (this.config.mode === 'switch') {
      this.temperatureService
        ?.getCharacteristic(this.Characteristic.CurrentTemperature)
        .updateValue(temperature);
    } else {
      this.thermostatService
        ?.getCharacteristic(this.Characteristic.CurrentTemperature)
        .updateValue(temperature);
    }
  }

  private reflectStopped(): void {
    if (this.switchService) {
      this.switchService.getCharacteristic(this.Characteristic.On).updateValue(false);
    }

    if (this.thermostatService) {
      this.thermostatService
        .getCharacteristic(this.Characteristic.TargetHeatingCoolingState)
        .updateValue(0);
      this.thermostatService
        .getCharacteristic(this.Characteristic.CurrentHeatingCoolingState)
        .updateValue(0);
    }
  }

  private async isKettleOnBase(): Promise<boolean> {
    return (await this.transport.getRunStatus()) === 0;
  }

  private ensureReady(): void {
    if (!this.transport.isReady()) {
      this.log.error('No kettle was found yet.');
      throw new this.hap.HapStatusError(this.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE);
    }
  }

  private assertConfig(config: KettleConfig): void {
    if (!config.ip) {
      throw new Error('You must provide the IP address of the Multipurpose Kettle!');
    }
    if (!config.token) {
      throw new Error('You must provide the token of the Multipurpose Kettle!');
    }
    if (config.mode !== 'switch' && config.mode !== 'thermostat') {
      throw new Error('You must provide a valid "mode" ("switch" or "thermostat")!');
    }
    if (config.heat === undefined || config.heat === null) {
      throw new Error('You must provide a default "heat" value to use this plugin!');
    }
  }

  private clampHeat(value: number): number {
    if (value <= 0) {
      return 1;
    }
    if (value >= 100) {
      return 99;
    }
    return Math.round(value);
  }
}
