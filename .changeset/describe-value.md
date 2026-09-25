---
'ts-extended-errors': patch
---

`describeValue` names a function, `'[Function: loadUser]'`, instead of printing its source, and
describes an object whose JSON is `{}` by its string tag when that says more: `'[object Map]'`
rather than `'{}'` for a `Map`, a `Set` or a `RegExp`. `toError` and `serializeError` use it for a
thrown value that is not an error, so those messages change the same way.
