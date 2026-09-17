/** The result of reading a property whose getter or proxy trap may throw. */
export type ReadResult =
  { readonly ok: true; readonly value: unknown } | { readonly ok: false; readonly value?: never }

/** Reads a property without letting a getter or proxy trap replace the error being handled. */
export const tryRead = (value: object, key: PropertyKey): ReadResult => {
  try {
    return { ok: true, value: Reflect.get(value, key) }
  } catch {
    return { ok: false }
  }
}

/** Reads a property, treating an inaccessible one as absent. */
export const read = (value: object, key: PropertyKey): unknown => tryRead(value, key).value

/** Reads a string property, treating an inaccessible or differently typed one as absent. */
export const readString = (value: object, key: PropertyKey): string | undefined => {
  const property = read(value, key)
  return typeof property === 'string' ? property : undefined
}

/** Checks for a property without letting a proxy's `has` trap escape. */
export const has = (value: object, key: PropertyKey): boolean => {
  try {
    return Reflect.has(value, key)
  } catch {
    return false
  }
}

/** Lists enumerable own keys, or none when a proxy refuses inspection. */
export const keys = (value: object): string[] => {
  try {
    return Object.keys(value)
  } catch {
    return []
  }
}

/** Tests a prototype chain without letting a proxy or custom `Symbol.hasInstance` escape. */
export const isInstanceOf = <Instance>(
  value: unknown,
  constructor: abstract new (...args: never[]) => Instance,
): value is Instance => {
  try {
    return value instanceof constructor
  } catch {
    return false
  }
}

/** Returns an object's string tag when even that operation is available. */
export const objectTag = (value: object): string | undefined => {
  try {
    return Object.prototype.toString.call(value)
  } catch {
    return undefined
  }
}

/** Snapshots an array before walking it, or treats an inaccessible proxy as absent. */
export const arrayItems = (value: unknown): unknown[] | undefined => {
  try {
    return Array.isArray(value) ? Array.from(value as readonly unknown[]) : undefined
  } catch {
    return undefined
  }
}
