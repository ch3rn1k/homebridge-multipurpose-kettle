declare module 'miio' {
  export interface MiioDevice {
    call<T = unknown>(method: string, args?: unknown[]): Promise<T>;
    destroy?(): void;
  }

  export interface MiioConnectOptions {
    address: string;
    token: string;
  }

  export function device(options: MiioConnectOptions): Promise<MiioDevice>;

  const _default: { device: typeof device };
  export default _default;
}
