declare module 'text-encoding' {
  export class TextEncoder {
    constructor();
    encode(input?: string): Uint8Array;
  }
  export class TextDecoder {
    constructor(label?: string, options?: { fatal?: boolean; ignoreBOM?: boolean });
    decode(input?: ArrayBuffer | Uint8Array, options?: { stream?: boolean }): string;
  }
}
