# CLAUDE.md

Context for AI assistants working on this codebase.

---

## What this is

`jmri-ws` is a typed Effect-based WebSocket client for the [JMRI JSON protocol](https://www.jmri.org/JavaDoc/doc/jmri/server/json/package-summary.html). Used by a virtual railway control panel for Maryborough station (Victorian Railways prototype) to communicate with JMRI for turnout control, sensor monitoring, signal mast management, and route setting.

---

## Tech stack

- **TypeScript** strict mode, `exactOptionalPropertyTypes: true`
- **Effect** `^3.10.0` — all async logic, error handling, streaming
- **Effect Schema** — runtime validation of inbound WebSocket messages
- **Native WebSocket** — `globalThis.WebSocket`. Available in all modern browsers and Node 21+. For Node 18/20, users inject the `ws` package via `WebSocketConstructor` in config.

No React, no server framework. Pure library.

---

## Architecture

```
states.ts      Const enums for JMRI state integers (0/2/4/8)
schema.ts      Effect Schema definitions -> TypeScript types + runtime decode
requests.ts    Pure functions returning plain request objects (no side effects)
client.ts      Effect Layer: JmriConfig + JmriClient service
index.ts       Barrel exports
```

### Key decisions

**Native WebSocket only — no `ws` dependency in source.** The `ws` npm package is Node-only and breaks browser bundlers. We use `globalThis.WebSocket` throughout. The `WebSocketConstructor` config field lets Node 18/20 users inject `ws` themselves. Never import `ws` directly in source files.

**Standard `addEventListener` API, not Node EventEmitter.** Use `addEventListener('message', handler)` etc. Do not use `ws.on()` / `ws.once()` — those are Node-only. `send()` is synchronous in the native API (no callback), wrapped in `Effect.try`.

**`subscribe()` returns a Stream, not a Promise.** JMRI GET both returns current state and registers a server-side listener. The Stream models "current state + all future pushes". Do not use `Stream.runHead` unless you only want the current state.

**PubSub broadcast hub.** All inbound messages go through `PubSub.unbounded<JmriMessage>()`. Each `subscribe()` creates a scoped subscriber. JMRI deduplicates listeners server-side.

**Outbound queue + sender fiber.** `send()` enqueues to `Queue.unbounded<string>()`. A fiber drains it, decoupling callers from WebSocket write timing.

**Reconnection.** `Schedule.exponential` + `Schedule.union(Schedule.spaced(maxMs))`. Server does not remember listeners on reconnect — clients must re-send GET messages.

**Schema is permissive.** JMRI sends partial update messages (only changed fields). Every field except `name` is `Schema.optional`. Decoded types have lots of `T | undefined` — handle with `?? default` at call sites.

---

## JMRI protocol quirks

- **State integers:** `0`=UNKNOWN, `2`=active/on/closed, `4`=inactive/off/thrown, `8`=inconsistent. Meaning differs per type — always use named constants from `states.ts`.
- **`method` in WS messages:** omitted or `"get"` subscribes+returns. `"post"` modifies. `"put"` creates. `"delete"` removes.
- **List responses are bare JSON arrays**, not wrapped. Decoder handles via `JmriFrame = Schema.Union(JmriMessage, JmriListResponse)`.
- **Throttles need a persistent socket.** JMRI releases the throttle if the socket closes. Always call `releaseThrottle()` before disconnecting.
- **Signal masts use aspect strings** ("Clear", "Approach", "Stop"). Signal heads use integer appearance constants.
- **Internal sensors** (prefix `IS`) accept POST to set state. Hardware sensors are read-only.

---

## Conventions

- Functional, no classes
- No mutation — state lives in Effect primitives (PubSub, Queue)
- Errors are typed ADTs — use `Effect.catchTag` to handle specific cases
- `requests.ts` is pure — no imports from `client.ts` or `effect`
- Do not add `any` — use `Schema.Unknown` for opaque values
- Do not import `ws` directly in any source file

---

## Common tasks

### Add a new JMRI type
1. Add state constants to `states.ts` if needed
2. Add `Schema.Struct` to `schema.ts`
3. Add to `JmriMessage` union in `schema.ts`
4. Add request builders to `requests.ts`
5. Export from `index.ts`

### Debug raw messages
```typescript
yield* Stream.runForEach(client.messages, (msg) =>
  Effect.log(JSON.stringify(msg))
)
```

### Mock client for tests
```typescript
const MockJmriClient = Layer.succeed(JmriClient, {
  messages: Stream.never,
  send: (_) => Effect.void,
  subscribe: (_type, _name) => Stream.never,
  list: (_type) => Stream.never,
  ping: () => Effect.void,
})
```

---

## Out of scope

- HTTP REST (use `fetch`)
- Panel rendering (this is transport only)
- Route intelligence (panel app owns this; JMRI is the actuator)
- WiThrottle or DCC-EX