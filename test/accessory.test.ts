import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { API, Logging } from 'homebridge';

import { createFakeApi, findService, HapStatusError } from './helpers/hap.js';

const state = vi.hoisted(() => ({
  ready: true,
  run: 0,
  work: 0,
  temp: 0,
  setWork: vi.fn(),
  setMode: vi.fn(),
  setVoice: vi.fn(),
  destroy: vi.fn(),
}));

vi.mock('../src/transport.js', () => ({
  MiioTransport: class {
    connect = vi.fn().mockResolvedValue(undefined);
    isReady = () => state.ready;
    getRunStatus = async () => state.run;
    getWorkStatus = async () => state.work;
    getTemperature = async () => state.temp;
    setWork = state.setWork.mockResolvedValue(undefined);
    setMode = state.setMode.mockResolvedValue(undefined);
    setVoice = state.setVoice.mockResolvedValue(undefined);
    destroy = state.destroy;
  },
}));

import { MiMultipurposeKettle } from '../src/accessory.js';

const log = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
} as unknown as Logging;

function build(config: Record<string, unknown>) {
  const api = createFakeApi();
  const accessory = new MiMultipurposeKettle(log, config as never, api as unknown as API);
  return { accessory, api };
}

const baseSwitch = { name: 'Kettle', ip: '1.2.3.4', token: 't', mode: 'switch', heat: 60 };
const baseThermostat = { ...baseSwitch, mode: 'thermostat' };

describe('MiMultipurposeKettle config validation', () => {
  it('throws when ip is missing', () => {
    expect(() => build({ ...baseSwitch, ip: undefined })).toThrow(/IP address/);
  });

  it('throws when token is missing', () => {
    expect(() => build({ ...baseSwitch, token: undefined })).toThrow(/token/);
  });

  it('throws on an invalid mode', () => {
    expect(() => build({ ...baseSwitch, mode: 'banana' })).toThrow(/mode/);
  });

  it('throws when heat is missing', () => {
    expect(() => build({ ...baseSwitch, heat: undefined })).toThrow(/heat/);
  });
});

describe('MiMultipurposeKettle services', () => {
  beforeEach(() => {
    state.ready = true;
    state.work = 0;
    state.run = 0;
  });

  it('exposes a Switch in switch mode', () => {
    const { accessory } = build(baseSwitch);
    const services = accessory.getServices();
    expect(findService(services, 'Switch')).toBeDefined();
    expect(findService(services, 'AccessoryInformation')).toBeDefined();
    expect(findService(services, 'TemperatureSensor')).toBeUndefined();
  });

  it('adds a TemperatureSensor when enabled', () => {
    const { accessory } = build({ ...baseSwitch, temperature: true });
    expect(findService(accessory.getServices(), 'TemperatureSensor')).toBeDefined();
  });

  it('exposes a Thermostat in thermostat mode', () => {
    const { accessory } = build(baseThermostat);
    expect(findService(accessory.getServices(), 'Thermostat')).toBeDefined();
  });

  it('adds an OccupancySensor when enabled', () => {
    const { accessory } = build({ ...baseSwitch, sensor: true });
    expect(findService(accessory.getServices(), 'OccupancySensor')).toBeDefined();
  });
});

describe('MiMultipurposeKettle behaviour', () => {
  beforeEach(() => {
    state.ready = true;
    state.work = 0;
    state.run = 0;
    state.setWork.mockClear();
  });

  it('reports On=true while the kettle is cooking', async () => {
    const { accessory } = build(baseSwitch);
    const on = findService(accessory.getServices(), 'Switch')!.getCharacteristic('On');

    state.work = 2;
    await expect(on.getHandler!()).resolves.toBe(true);

    state.work = 0;
    await expect(on.getHandler!()).resolves.toBe(false);
  });

  it('does not start work when the kettle is off its base', async () => {
    const { accessory } = build(baseSwitch);
    const on = findService(accessory.getServices(), 'Switch')!.getCharacteristic('On');

    state.run = 16;
    await on.setHandler!(true);
    expect(state.setWork).not.toHaveBeenCalled();
  });

  it('rejects reads before the device is ready', async () => {
    const { accessory } = build(baseSwitch);
    const on = findService(accessory.getServices(), 'Switch')!.getCharacteristic('On');

    state.ready = false;
    await expect(on.getHandler!()).rejects.toBeInstanceOf(HapStatusError);
  });
});
