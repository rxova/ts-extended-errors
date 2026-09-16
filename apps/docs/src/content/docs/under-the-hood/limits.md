---
title: Limits and trust
description: The depth and width limits on serialization, how cycles terminate, what happens across realms, and what deserializing an untrusted payload actually does.
---

Everything here runs on a path that is already handling a failure. The bounds below exist so that a
serializer cannot become the incident.

## Depth

`serializeError` walks the `cause` chain to `maxDepth`, 8 by default. Below that limit the cause is
simply not included.

Chains are influenced by input more often than they look — a parse error wrapping a network error
wrapping a retry wrapper — so an unbounded walk in a log path is a liability. `deserializeError` has
the same limit on the way back; below it, causes are left as they arrived.

## Width

An `AggregateError` carries a list. `Promise.any` over a thousand requests rejects with a thousand
errors, each of which may have a chain of its own, so `maxAggregatedErrors` (10 by default) bounds
the total _across the whole output_ rather than per error — a per-error limit would multiply through
nesting instead of capping anything.

What the budget cuts is counted in `errorsOmitted`. That count is read back by `deserializeError`
and carried forward by the next `serializeError`, so a payload that has been through two hops still
says how many are missing rather than implying that was all of them.

## Cycles

`causeChain` stops when it reaches a value already on the chain, so `a.cause = b; b.cause = a`
yields `[a, b]`.

`serializeError` tracks the errors on the _current path_ rather than the whole traversal. The
distinction matters: the same error appearing under two different branches is legitimate and should
be serialized twice, while the same error appearing above itself is a cycle and must stop. An error
that is its own cause therefore stops immediately.

A cycle inside `context` or inside an own property is handled differently — that value simply cannot
go through `JSON.stringify`, so it is described by its string tag instead of costing the whole log
line.

## Detachment

`context` is copied field by field through a JSON round trip taken at serialization time, not held
by reference. Three consequences:

- The result shares nothing with the error, so a redactor can edit the payload without mutating the
  error, and a later mutation of the error cannot change what was logged.
- `JSON.stringify` on the result cannot throw.
- Types are lost. A `Date` becomes an ISO string, a `BigInt` becomes `'10n'`, a `Map` becomes `{}`.

One field that JSON cannot write is described on its own rather than costing the rest of the
context.

## Across realms

A worker, a `vm` context, or a second bundled copy of a library all produce errors for which
`instanceof Error` is false in your realm.

`serializeError` and `isErrorLike` work on them anyway — the test is a string `message`, plus a
string-tag check where distinguishing a real error from error-shaped data matters.
`isExtendedError` does not, and should not: two copies of the package are two distinct classes, and
saying otherwise would be a lie with consequences.

The path that works across a realm boundary is to serialize on one side and deserialize on the
other, with `classes` naming the local classes.

## Trusting a payload

`deserializeError` chooses a class by the payload's `name` and constructs it. Two things follow:

- **List only classes you are willing to have constructed from that input.** A name matching nothing
  in `classes` or the built-ins becomes an `ExtendedError` keeping the name, which is the safe
  default; an entry in `classes` is an explicit permission.
- **A deserialized error's `code` and `context` are attacker-controlled** if the payload was. Treat
  them like any other parsed input that reaches a branch — the same care you would give `JSON.parse`
  output used in control flow.

`includeOwnProperties` is the mirror image on the way out: it copies whatever else the error class
put on the instance, which may be a request, a token or a user record. It is off by default for that
reason, and it belongs in a log you control rather than in a response body.

## What is not bounded

The `message` of a single error, the size of one `context` field, and the number of own properties
under `includeOwnProperties`. If any of those can be large in your system, cap them before they
reach the serializer — this package will faithfully write what it was given.
