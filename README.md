# jmri-ws

Type-safe, Effect-based JMRI WebSocket client for browser and Node.js.

Provides a typed interface to the [JMRI JSON WebSocket protocol](https://www.jmri.org/JavaDoc/doc/jmri/server/json/package-summary.html) — covering turnouts, sensors, signal masts, blocks, power, throttles, the fast clock, and more.

Uses the native browser `WebSocket` global — no Node-only dependencies.

---

## Install

```bash
npm install effect
npm install --save-dev typescript
```

**Node 18/20 only:** install `ws` as a polyfill (Node 21+ has native WebSocket):

```bash
npm install ws
npm install --save-dev @types/ws
```

---

## Quick start

```typescript
import { JmriClientLive, makeConfig, JmriClient, TurnoutState, setTurnout } from "./src/index.js"
import { Effect, Stream, Layer } from "effect"

const config = makeConfig({ host: "localhost", port: 12080 })

const program = Effect.gen(function* () {
  const client = yield* JmriClient

  // Subscribe to a turnout — returns current state immediately,
  // then streams all future changes pushed from the layout
  const stream = client.subscribe("turnout", "IT1")

  yield* Stream.runForEach(stream, (turnout) =>
    Effect.log(`IT1: state=${turnout.state}`)
  )
})

Effect.runFork(
  program.pipe(
    Effect.provide(JmriClientLive),
    Effect.provide(config),
  )
)
```

### Node 18/20: inject `ws`

```typescript
import { WebSocket } from "ws"

const config = makeConfig({
  host: "localhost",
  port: 12080,
  WebSocketConstructor: WebSocket,
})
```

---

## Core concepts

### subscribe() does two things

Sending a GET message over JMRI WebSocket both returns the current state **and** registers a server-side listener. Every future state change is pushed automatically — no polling.

`client.subscribe(type, name)` models this as a `Stream`: the first emission is the current state, subsequent emissions are server-pushed updates. The stream runs until the connection closes or the scope ends.

```typescript
// Current state + all future changes as a Stream
const stream = client.subscribe("turnout", "IT1")

// One-shot: just get the current state
const current = yield* Stream.runHead(client.subscribe("turnout", "IT1"))
```

### Commanding state

Use `client.send()` with a request builder from `requests.ts`:

```typescript
// Throw a turnout
yield* client.send(setTurnout("IT1", TurnoutState.THROWN))

// Turn track power on
yield* client.send(setPower(PowerState.ON))

// Hold a signal mast
yield* client.send(setSignalMastHeld("IF$shsm:AAR-2:approach(IT1)", true))

// Fire a JMRI route
yield* client.send(fireRoute("IR:AUTO:0001"))
```

### Multiple subscriptions in parallel

```typescript
const fibers = yield* Effect.forEach(
  ["IT1", "IT2", "IT3"],
  (name) => Effect.fork(
    Stream.runForEach(client.subscribe("turnout", name), (data) =>
      Effect.log(`${name}: ${data.state}`)
    )
  ),
  { concurrency: "unbounded" },
)
yield* Fiber.joinAll(fibers)
```

---

## Config

```typescript
const config = makeConfig({
  host: "localhost",              // JMRI web server host
  port: 12080,                    // default JMRI web server port
  path: "/json/v5",               // optional, defaults to "/json/v5"
  version: "5.3.1",               // optional, negotiated in hello message
  reconnectBaseMs: 500,           // optional, exponential backoff base
  reconnectMaxMs: 30_000,         // optional, reconnect backoff cap
  WebSocketConstructor: WebSocket // optional, only needed for Node 18/20
})
```

The client reconnects automatically with exponential backoff if the connection drops.

---

## State constants

JMRI reuses the same integer values (0/2/4/8) across all types. Named constants are provided per type so the meaning is clear:

```typescript
import {
  TurnoutState,   // UNKNOWN=0, CLOSED=2, THROWN=4, INCONSISTENT=8
  SensorState,    // UNKNOWN=0, ACTIVE=2,  INACTIVE=4, INCONSISTENT=8
  PowerState,     // UNKNOWN=0, ON=2,      OFF=4
  LightState,     // UNKNOWN=0, ON=2,      OFF=4
  BlockState,     // UNKNOWN=0, OCCUPIED=2, UNOCCUPIED=4
  RouteState,     // UNKNOWN=0, ACTIVE=2,  INACTIVE=4
  TimeState,      // UNKNOWN=0, RUNNING=2, STOPPED=4
  SignalHeadAppearance, // DARK=0, RED=1, YELLOW=4, GREEN=16, ...
} from "./src/index.js"
```

---

## Supported object types

| Type | GET/subscribe | POST/modify | PUT/create | DELETE |
|---|---|---|---|---|
| `turnout` | ✓ | ✓ | ✓ | ✓ |
| `sensor` | ✓ | ✓ (internal only) | ✓ | ✓ |
| `power` | ✓ | ✓ | — | — |
| `signalMast` | ✓ | ✓ | — | — |
| `signalHead` | ✓ | ✓ | — | — |
| `block` | ✓ | ✓ | — | — |
| `light` | ✓ | ✓ | ✓ | ✓ |
| `memory` | ✓ | ✓ | — | — |
| `route` | ✓ | ✓ (fire) | — | — |
| `reporter` | ✓ | — | — | — |
| `time` | ✓ | ✓ | — | — |
| `throttle` | ✓ (WS only) | ✓ | — | — |
| `rosterEntry` | ✓ | — | — | — |
| `panel` | ✓ | — | — | — |

---

## Throttle control

Throttles require a persistent WebSocket connection. Always release before disconnecting.

```typescript
const handle = "loco-1234"

// Acquire
yield* client.send(acquireThrottle(handle, 1234))

// Control
yield* client.send(setThrottleForward(handle, true))
yield* client.send(setThrottleFunction(handle, "F0", true)) // headlight
yield* client.send(setThrottleSpeed(handle, 0.25))          // 25%

// Release (important!)
yield* client.send(releaseThrottle(handle))
```

---

## Error handling

All errors are typed as `JmriClientError`:

```typescript
type JmriClientError =
  | { _tag: "ConnectionError"; message: string; cause?: unknown }
  | { _tag: "ParseError";      message: string; raw: string }
  | { _tag: "SendError";       message: string }
  | { _tag: "ProtocolError";   message: string; code: number }
```

Handle with Effect's `catchTag` or `catchAll`:

```typescript
program.pipe(
  Effect.catchTag("ConnectionError", (e) =>
    Effect.logError(`Connection failed: ${e.message}`)
  ),
  Effect.catchTag("ProtocolError", (e) =>
    Effect.logError(`JMRI error ${e.code}: ${e.message}`)
  ),
)
```

---

## File structure

```
src/
├── states.ts     State constants (TurnoutState, SensorState, etc.)
├── schema.ts     Effect Schema definitions for all JMRI message 
├── requests.ts   Typed request builder functions
├── client.ts     JmriClient Effect service + Layer
├── index.ts      Barrel exports
└── examples.ts   Usage patterns and examples
```

---

## Requirements

- Modern browser with native WebSocket **or** Node.js 21+
- Node.js 18/20: install `ws` and pass `WebSocketConstructor` in config
- `effect` ^3.10.0
- TypeScript 5.x with `strict: true`