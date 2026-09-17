---
'ts-extended-errors': patch
---

Treat getters, proxy traps and prototype checks that throw while inspecting an unknown value as
unavailable metadata. Serialization, normalization, cause traversal, type guards and
deserialization now keep handling the original failure; a value that refuses every form of
inspection is described as `'<uninspectable object>'`. Exceptions from caller-provided predicates
and error constructors still propagate.
