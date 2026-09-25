---
'ts-extended-errors': patch
---

Define `code` and `context` on an instance only when there is a value. Both were own enumerable
properties on every instance, so Node's `console.log(error)` printed
`code: undefined, context: undefined` after the stack of every error that had neither. Reading an
absent one still gives `undefined`; `Object.keys(error)` no longer lists it.
