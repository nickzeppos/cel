import { Lazy } from 'fp-ts/lib/function'
import * as TE from 'fp-ts/lib/TaskEither'
import * as E from 'fp-ts/lib/Either'

export function errorIdentity(err: unknown): Error {
  return err instanceof Error ? err : new Error(`${err}`)
}

export function TETry<T>(f: Lazy<Promise<T>>) {
  return TE.tryCatch(f, errorIdentity)
}

export function ETry<T>(f: Lazy<T>) {
  return E.tryCatch(f, errorIdentity)
}
