/** Typed engine errors so route handlers can map them to clean HTTP statuses
 *  without leaking internals. */
export type EngineErrorCode = 'UNKNOWN_CITY' | 'INVALID_INPUT';

export class EngineError extends Error {
  constructor(
    public readonly code: EngineErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'EngineError';
  }
}
