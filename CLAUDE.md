# CLAUDE.md

Context for AI assistants working on this codebase.

---

## What this is

`jmri-ws` is a typed Effect-based WebSocket client for the [JMRI JSON protocol](https://www.jmri.org/JavaDoc/doc/jmri/server/json/package-summary.html). It is used by a virtual railway control panel application for Maryborough station (Victorian Railways prototype) to communicate with JMRI for turnout control, sensor monitoring, signal mast management, and route setting.

---

## Tech stack

- **TypeScript** — strict mode, `exactOptionalPropertyTypes: true`
- **Effect** (`effect` ^3.10.0) — all async logic, error handling, streaming
- **Effect Schema** — runtime validation of inbound WebSocket messages
- **ws** — Node.js WebSocket client

No React, no server framework. This is a pure library.

---

## Architecture

```
states.ts      Branded const enums for JMRI state integers (0/2/4/8)
schema.ts      Effect Schema definitions → TypeScript types + runtime decode
requests.ts    Pure functions returning plain request objects (no side effects)
client.ts      Effect Layer: JmriConfig + JmriClient service
index.ts       Barrel exports
```

### Key architectural decisions

**`subscribe()` returns a Stream, not a Promise.** This reflects the JMRI protocol: a GET message both returns current state and registers a server-side listener. The Stream models "current state + all future changes". Never use `Stream.runHead` on it unless you genuinely only want the current state.

**PubSub as the broadcast hub.** All inbound messages go through a `PubSub.unbounded<JmriMessage>()`. Each `subscribe()` call creates a scoped subscriber. This means multiple callers can subscribe to the same object without sending duplicate GET requests — though currently each `subscribe()` does re-send a GET. This is intentional: JMRI deduplicates listeners server-side.

**Outbound queue + sender fiber.** `send()` enqueues to a `Queue.unbounded<string>()`. A dedicated fiber drains it. This decouples callers from the WebSocket write timing.

**Reconnection loop.** `Schedule.exponential` with a `Schedule.union(Schedule.spaced(maxMs))` cap. On reconnect, existing `subscribe()` Streams will resume when the connection is re-established, but clients must re-send their GET messages — the server does not remember listeners across connections. The panel application handles this by re-subscribing at the Stream level.

**Schema is permissive on optional fields.** JMRI sends partial update messages (e.g. only `{name, state}` when a turnout changes). Every field except `name` is `Schema.optional`. This means decoded types have lots of `T | undefined` — use Option or `?? default` at call sites.

---

## JMRI protocol quirks to know

- **State values are shared integers:** `0`=UNKNOWN, `2`=active/on/closed, `4`=inactive/off/thrown, `8`=inconsistent. The meaning differs per type — always use the named constants from `states.ts`.
- **`method` field in WebSocket messages:** omitted or `"get"` subscribes + returns state. `"post"` modifies. `"put"` creates. `"delete"` removes. In HTTP these map to verbs.
- **List responses are bare JSON arrays**, not wrapped objects. The decoder handles this via `JmriFrame = Schema.Union(JmriMessage, JmriListResponse)`.
- **Throttles are WebSocket-only.** They require a persistent connection — JMRI will release the throttle if the socket closes. Always call `releaseThrottle()` before disconnecting.
- **Signal masts use aspect strings** ("Clear", "Approach", "Stop") not integers. Signal heads use integer appearance constants.
- **Internal sensors** (prefix `IS`) can have state written via POST. Hardware sensors are read-only.
- **`IMCURRENTTIME` memory** contains the fast clock time as a formatted string. The `time` type gives structured access with rate and running state.

---

## Coding conventions

- **Functional, no classes.** Services are plain objects returned from Effect generators.
- **No mutation.** All state lives in Effect primitives (PubSub, Queue, Ref).
- **Errors are typed ADTs.** `JmriClientError` is a discriminated union. Use `Effect.catchTag` to handle specific cases.
- **Request builders in `requests.ts` are pure.** They return plain objects with no side effects. Keep it that way — no imports from `client.ts` or `effect`.
- **Schema fields should stay optional where JMRI sends partial updates.** Do not add `Schema.required` to fields that only appear in full responses unless you are certain JMRI always sends them.
- **Do not add `any`.** Use `Schema.Unknown` for truly opaque values (memory value, properties array).

---

## Common tasks

### Add a new JMRI object type

1. Add state constants to `states.ts` if needed
2. Add a `Schema.Struct` to `schema.ts`
3. Add it to the `JmriMessage` union in `schema.ts`
4. Add request builder functions to `requests.ts`
5. Export from `index.ts`

### Change the reconnect behaviour

Edit `reconnectSchedule` in `client.ts`. Currently:
```typescript
Schedule.exponential(config.reconnectBaseMs ?? 500).pipe(
  Schedule.union(Schedule.spaced(config.reconnectMaxMs ?? 30_000))
)
```

### Debug raw messages

```typescript
const client = yield* JmriClient
yield* Stream.runForEach(client.messages, (msg) =>
  Effect.log(JSON.stringify(msg))
)
```

### Test without a running JMRI instance

The connection loop uses `Schedule.retry` — if JMRI isn't running it will keep retrying with backoff. For unit tests, provide a mock `JmriClient` layer that returns controlled Streams and ignores `send()` calls.

---

## What this does NOT do

- No HTTP REST client — only WebSocket. For one-off HTTP requests use `fetch`.
- No panel rendering — this is the transport layer only.
- No JMRI route intelligence — routes are defined outside JMRI in the panel application, with JMRI used purely as an actuator (sending individual turnout commands).
- No WiThrottle or DCC-EX protocol support.