import { vi } from 'vitest';

export class FakeCharacteristic {
  props?: Record<string, unknown>;
  value: unknown;
  getHandler?: () => unknown;
  setHandler?: (value: unknown) => unknown;

  setProps(props: Record<string, unknown>): this {
    this.props = props;
    return this;
  }

  onGet(fn: () => unknown): this {
    this.getHandler = fn;
    return this;
  }

  onSet(fn: (value: unknown) => unknown): this {
    this.setHandler = fn;
    return this;
  }

  updateValue(value: unknown): this {
    this.value = value;
    return this;
  }
}

export class FakeService {
  readonly characteristics = new Map<string, FakeCharacteristic>();

  constructor(
    public readonly type: string,
    public readonly name?: string,
  ) {}

  getCharacteristic(id: string): FakeCharacteristic {
    let characteristic = this.characteristics.get(id);
    if (!characteristic) {
      characteristic = new FakeCharacteristic();
      this.characteristics.set(id, characteristic);
    }
    return characteristic;
  }

  setCharacteristic(id: string, value: unknown): this {
    this.getCharacteristic(id).updateValue(value);
    return this;
  }
}

function serviceCtor(type: string) {
  return class extends FakeService {
    constructor(name?: string) {
      super(type, name);
    }
  };
}

const Service = {
  AccessoryInformation: serviceCtor('AccessoryInformation'),
  Switch: serviceCtor('Switch'),
  TemperatureSensor: serviceCtor('TemperatureSensor'),
  Thermostat: serviceCtor('Thermostat'),
  OccupancySensor: serviceCtor('OccupancySensor'),
};

const Characteristic = new Proxy(
  {},
  { get: (_target, prop) => prop },
) as Record<string, string>;

export class HapStatusError extends Error {
  constructor(public readonly hapStatus: number) {
    super(`HapStatusError ${hapStatus}`);
  }
}

const HAPStatus = { SERVICE_COMMUNICATION_FAILURE: -70402 };

export function createFakeApi() {
  return {
    hap: { Service, Characteristic, HapStatusError, HAPStatus },
    on: vi.fn(),
    registerAccessory: vi.fn(),
  };
}

export function findService(services: unknown[], type: string): FakeService | undefined {
  return services.find((s): s is FakeService => s instanceof FakeService && s.type === type);
}
