import miio, { type MiioDevice } from 'miio';
import type { Logging } from 'homebridge';

import { REQUEST_TIMEOUT } from './settings.js';

// run_status: 0 on base, 16 no kettle, 32 dry-cooking protection, 48 both.
export type RunStatus = number;

// work_status: 0 stopped, 1 reservation, 2 cooking, 3 paused, 4 keeping, 5 stop.
export type WorkStatus = number;

export interface KettleTransport {
  connect(): Promise<void>;
  isReady(): boolean;
  getRunStatus(): Promise<RunStatus>;
  getWorkStatus(): Promise<WorkStatus>;
  getTemperature(): Promise<number>;
  setWork(on: boolean, mode: number): Promise<void>;
  setMode(slot: number, heat: number, duration: number): Promise<void>;
  setVoice(enabled: boolean): Promise<void>;
  destroy(): void;
}

export class MiioTransport implements KettleTransport {
  private device?: MiioDevice;

  constructor(
    private readonly address: string,
    private readonly token: string,
    private readonly log: Logging,
    private readonly debug = false,
  ) {}

  async connect(): Promise<void> {
    this.device = await miio.device({
      address: this.address,
      token: this.token,
    });
  }

  isReady(): boolean {
    return this.device !== undefined;
  }

  destroy(): void {
    this.device?.destroy?.();
    this.device = undefined;
  }

  async getRunStatus(): Promise<RunStatus> {
    const [value] = await this.getProp<number>('run_status');
    return value;
  }

  async getWorkStatus(): Promise<WorkStatus> {
    const [value] = await this.getProp<number>('work_status');
    return value;
  }

  async getTemperature(): Promise<number> {
    const [value] = await this.getProp<number>('curr_tempe');
    return value >= 0 ? value : Math.abs(value);
  }

  async setWork(on: boolean, mode: number): Promise<void> {
    await this.expectOk('set_work', on ? [2, mode, 0, 0, 0] : [0, 18, 0, 0, 0]);
  }

  async setMode(slot: number, heat: number, duration: number): Promise<void> {
    await this.call('delete_modes', [slot]);
    await this.expectOk('set_mode', [slot, heat, duration]);
  }

  async setVoice(enabled: boolean): Promise<void> {
    await this.expectOk('set_voice', [enabled ? 0 : 1]);
  }

  private async getProp<T>(prop: string): Promise<T[]> {
    return this.call<T[]>('get_prop', [prop]);
  }

  private async expectOk(method: string, args: unknown[]): Promise<void> {
    const [result] = await this.call<string[]>(method, args);
    if (result !== 'ok') {
      throw new Error(`${method} returned "${result}"`);
    }
  }

  // The device often drops the first packet, so retry once on timeout/error.
  private async call<T>(method: string, args: unknown[]): Promise<T> {
    if (!this.device) {
      throw new Error('Kettle device is not connected');
    }

    this.trace(`-> ${method} ${JSON.stringify(args)}`);

    try {
      const value = await this.withTimeout(this.device.call<T>(method, args));
      this.trace(`<- ${method} ${JSON.stringify(value)}`);
      return value;
    } catch (error) {
      this.trace(`retry ${method}: ${(error as Error).message}`);
      const value = await this.device.call<T>(method, args);
      this.trace(`<- (retry) ${method} ${JSON.stringify(value)}`);
      return value;
    }
  }

  private withTimeout<T>(promise: Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error('miIO request timed out')),
        REQUEST_TIMEOUT * 1000,
      );

      promise.then(
        (value) => {
          clearTimeout(timer);
          if ((value as unknown) === 'error') {
            reject(new Error('miIO request returned "error"'));
          } else {
            resolve(value);
          }
        },
        (error) => {
          clearTimeout(timer);
          reject(error);
        },
      );
    });
  }

  private trace(message: string): void {
    if (this.debug) {
      this.log.info(`[miIO] ${message}`);
    } else {
      this.log.debug(`[miIO] ${message}`);
    }
  }
}
