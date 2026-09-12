export interface GreetOptions {
  /** Ends the greeting with an exclamation mark instead of a full stop. */
  readonly excited?: boolean
}

/** Greets `name`. Replace this with the package's real code. */
export const greet = (name: string, { excited = false }: GreetOptions = {}): string => {
  const who = name.trim()
  if (who === '') throw new TypeError('greet: name must not be empty')
  return `Hello, ${who}${excited ? '!' : '.'}`
}
