import { describe, expect, expectTypeOf, it } from 'vitest'
import * as api from '../index'
import type {
  DefineErrorOptions,
  DeserializeErrorOptions,
  ErrorClass,
  ErrorContext,
  ExtendedErrorConstructor,
  ExtendedErrorMembers,
  ExtendedErrorOptions,
  SerializedError,
  SerializedErrorWithProperties,
  SerializeErrorOptions,
} from '../index'

// The barrel is excluded from coverage, so nothing else notices an export that
// goes missing from it — or one that leaks into it.
describe('the package entry point', () => {
  it('exports the documented runtime API, and nothing else', () => {
    expect(new Set(Object.keys(api))).toEqual(
      new Set([
        'ExtendedError',
        'isExtendedError',
        'defineError',
        'causeChain',
        'rootCause',
        'findCause',
        'findCauseOf',
        'hasCauseOf',
        'serializeError',
        'deserializeError',
        'isErrorLike',
        'describeValue',
        'toError',
      ]),
    )
  })

  it('exports the documented types', () => {
    expectTypeOf<SerializedErrorWithProperties>().toExtend<SerializedError>()
    expectTypeOf<ExtendedErrorOptions>().toHaveProperty('context')
    expectTypeOf<ExtendedErrorConstructor>().toHaveProperty('code')
    expectTypeOf<DefineErrorOptions>().toHaveProperty('base')
    expectTypeOf<typeof RangeError>().toExtend<ErrorClass<RangeError>>()
    expectTypeOf<ExtendedErrorMembers>().toHaveProperty('toJSON')
    expectTypeOf<SerializeErrorOptions>().toHaveProperty('includeOwnProperties')
    expectTypeOf<DeserializeErrorOptions>().toHaveProperty('classes')
    expectTypeOf<ErrorContext>().toEqualTypeOf<Readonly<Record<string, unknown>>>()
  })
})
