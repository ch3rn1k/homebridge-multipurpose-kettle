import type { API } from 'homebridge';

import { MiMultipurposeKettle } from './accessory.js';
import { ACCESSORY_NAME } from './settings.js';

export default (api: API): void => {
  api.registerAccessory(ACCESSORY_NAME, MiMultipurposeKettle);
};
