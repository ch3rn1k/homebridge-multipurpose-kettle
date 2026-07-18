import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Logging } from 'homebridge';

const device = vi.hoisted(() => ({
  call: vi.fn(),
  destroy: vi.fn(),
}));

vi.mock('miio', () => ({
  default: { device: vi.fn(async () => device) },
}));

import { MiioTransport } from '../src/transport.js';

const log = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
} as unknown as Logging;

async function makeTransport(): Promise<MiioTransport> {
  const transport = new MiioTransport('1.2.3.4', 'token', log);
  await transport.connect();
  return transport;
}

describe('MiioTransport', () => {
  beforeEach(() => {
    device.call.mockReset();
  });

  it('reports readiness only after connect', async () => {
    const transport = new MiioTransport('1.2.3.4', 'token', log);
    expect(transport.isReady()).toBe(false);
    await transport.connect();
    expect(transport.isReady()).toBe(true);
  });

  it('returns the absolute temperature value', async () => {
    const transport = await makeTransport();
    device.call.mockResolvedValueOnce([-42]);
    await expect(transport.getTemperature()).resolves.toBe(42);
    expect(device.call).toHaveBeenCalledWith('get_prop', ['curr_tempe']);
  });

  it('sends the correct set_work payload', async () => {
    const transport = await makeTransport();
    device.call.mockResolvedValueOnce(['ok']);
    await transport.setWork(true, 8);
    expect(device.call).toHaveBeenCalledWith('set_work', [2, 8, 0, 0, 0]);

    device.call.mockResolvedValueOnce(['ok']);
    await transport.setWork(false, 8);
    expect(device.call).toHaveBeenCalledWith('set_work', [0, 18, 0, 0, 0]);
  });

  it('deletes the slot before creating a mode', async () => {
    const transport = await makeTransport();
    device.call.mockResolvedValueOnce(['deleted']).mockResolvedValueOnce(['ok']);
    await transport.setMode(8, 60, 240);
    expect(device.call).toHaveBeenNthCalledWith(1, 'delete_modes', [8]);
    expect(device.call).toHaveBeenNthCalledWith(2, 'set_mode', [8, 60, 240]);
  });

  it('throws when the device does not answer "ok"', async () => {
    const transport = await makeTransport();
    device.call.mockResolvedValueOnce(['fail']);
    await expect(transport.setVoice(true)).rejects.toThrow(/set_voice/);
  });

  it('retries once when the first attempt fails', async () => {
    const transport = await makeTransport();
    device.call.mockRejectedValueOnce(new Error('dropped')).mockResolvedValueOnce(['ok']);
    await transport.setVoice(true);
    expect(device.call).toHaveBeenCalledTimes(2);
  });
});
