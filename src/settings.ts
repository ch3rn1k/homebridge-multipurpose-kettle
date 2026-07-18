import type { AccessoryConfig } from 'homebridge';

export const ACCESSORY_NAME = 'MiMultipurposeKettle';

export const MANUFACTURER = 'Xiaomi';
export const MODEL = 'Multipurpose Kettle';
export const SERIAL_NUMBER = 'viomi.health_pot.v1';

export const MODE_SLOT = 8;
export const DEFAULT_INTERVAL = 5;
export const REQUEST_TIMEOUT = 2.5;
export const DISCOVER_RETRY_MS = 2 * 60 * 1000;

export type KettleMode = 'switch' | 'thermostat';

export interface KettleConfig extends AccessoryConfig {
  ip: string;
  token: string;
  mode: KettleMode;
  heat: number;
  sound?: boolean;
  temperature?: boolean;
  sensor?: boolean;
  interval?: number;
  debug?: boolean;
}
