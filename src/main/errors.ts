import type { ErrCode, ErrorInfo } from '../shared/types.ts'

/**
 * The only error type business logic throws.
 *
 * Nothing upstream catches: `handle()` in ipc.ts is the single boundary that
 * turns a throw into a `Result`, and it maps anything that isn't an `AppError`
 * to `UNKNOWN`. So modules can just throw and stay readable.
 */
export class AppError extends Error {
  code: ErrCode

  constructor(code: ErrCode, message: string) {
    super(message)
    this.name = 'AppError'
    this.code = code
  }
}

/**
 * The one place a thrown value becomes something the renderer can display.
 * Used both by the IPC boundary and by background work that has no caller.
 */
export function toErrorInfo(error: unknown): ErrorInfo {
  if (error instanceof AppError) return { code: error.code, message: error.message }
  if (error instanceof Error) return { code: 'UNKNOWN', message: error.message }
  return { code: 'UNKNOWN', message: String(error) }
}
