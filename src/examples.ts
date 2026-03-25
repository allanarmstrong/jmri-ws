/**
 * jmri-ws usage examples
 *
 * These patterns cover everything the Maryborough virtual panel needs:
 * subscribing to turnouts/sensors, commanding state, working with
 * signal masts, and handling the fast clock.
 */

import {
  JmriClientLive,
  makeConfig,
  JmriClient,
  TurnoutState,
  SensorState,
  PowerState,
  TimeState,
  setTurnout,
  fireRoute,
  setPower,
  setSignalMastHeld,
  releaseThrottle,
  acquireThrottle,
  setThrottleSpeed,
  setThrottleForward,
  setThrottleFunction,
} from "./index.js"
import { Effect, Stream, Layer, Schedule, Fiber } from "effect"

// ─── Config ───────────────────────────────────────────────────────────────────

const config = makeConfig({
  host: "localhost",
  port: 12080,
  version: "5.3.1",
  reconnectBaseMs: 500,
  reconnectMaxMs: 30_000,
})

// ─── Example 1: Subscribe to a turnout ───────────────────────────────────────
//
// subscribe() sends a GET message which:
//   1. Immediately returns current state
//   2. Registers a server-side listener for all future changes
//
// The Stream never ends — it runs until the connection drops or scope ends.

const watchTurnout = Effect.gen(function* () {
  const client = yield* JmriClient

  const stream = client.subscribe("turnout", "IT1")

  yield* Stream.runForEach(stream, (turnout) =>
    Effect.gen(function* () {
      const stateLabel =
        turnout.state === TurnoutState.CLOSED ? "CLOSED"
        : turnout.state === TurnoutState.THROWN ? "THROWN"
        : turnout.state === TurnoutState.INCONSISTENT ? "MOVING"
        : "UNKNOWN"

      yield* Effect.log(`IT1 (${turnout.userName ?? "unnamed"}): ${stateLabel}`)
    }),
  )
})

// ─── Example 2: Subscribe to multiple objects in parallel ────────────────────

const watchPanel = Effect.gen(function* () {
  const client = yield* JmriClient

  // Watch all turnouts for a route simultaneously
  const turnoutNames = ["IT1", "IT2", "IT3", "IT4"]

  const fibers = yield* Effect.forEach(
    turnoutNames,
    (name) =>
      Effect.fork(
        Stream.runForEach(client.subscribe("turnout", name), (data) =>
          Effect.log(`${name}: state=${data.state}`),
        ),
      ),
    { concurrency: "unbounded" },
  )

  // Watch block occupancy
  const blockFiber = yield* Effect.fork(
    Stream.runForEach(client.subscribe("block", "IB1"), (data) =>
      Effect.log(`Block IB1 value: ${data.value ?? "empty"}`),
    ),
  )

  // Watch track power
  const powerFiber = yield* Effect.fork(
    Stream.runForEach(client.subscribe("power", "LocoNet"), (data) => {
      const label = data.state === PowerState.ON ? "ON" : "OFF"
      return Effect.log(`Track power: ${label}`)
    }),
  )

  yield* Fiber.joinAll([...fibers, blockFiber, powerFiber])
})

// ─── Example 3: Command a turnout ─────────────────────────────────────────────

const throwTurnout = (name: string) =>
  Effect.gen(function* () {
    const client = yield* JmriClient
    yield* client.send(setTurnout(name, TurnoutState.THROWN))
    yield* Effect.log(`Commanded ${name} to THROWN`)
  })

const closeTurnout = (name: string) =>
  Effect.gen(function* () {
    const client = yield* JmriClient
    yield* client.send(setTurnout(name, TurnoutState.CLOSED))
    yield* Effect.log(`Commanded ${name} to CLOSED`)
  })

// ─── Example 4: Set a route (fire a JMRI route) ───────────────────────────────

const activateRoute = (routeName: string) =>
  Effect.gen(function* () {
    const client = yield* JmriClient
    yield* client.send(fireRoute(routeName))
    yield* Effect.log(`Fired route: ${routeName}`)
  })

// ─── Example 5: React to sensor, then command turnout ─────────────────────────
//
// This is the core NX panel pattern:
//   Sensor IS1 activates → set IT1 THROWN + IT2 CLOSED

const nxRouteHandler = Effect.gen(function* () {
  const client = yield* JmriClient

  const entrySensorStream = client.subscribe("sensor", "IS1")

  yield* Stream.runForEach(
    Stream.filter(
      entrySensorStream,
      (s) => s.state === SensorState.ACTIVE,
    ),
    (_sensor) =>
      Effect.all([
        client.send(setTurnout("IT1", TurnoutState.THROWN)),
        client.send(setTurnout("IT2", TurnoutState.CLOSED)),
      ]),
  )
})

// ─── Example 6: Signal mast management ───────────────────────────────────────

const holdAllSignals = (mastNames: string[]) =>
  Effect.gen(function* () {
    const client = yield* JmriClient
    yield* Effect.forEach(
      mastNames,
      (name) => client.send(setSignalMastHeld(name, true)),
      { concurrency: "unbounded" },
    )
    yield* Effect.log(`Held ${mastNames.length} signal masts`)
  })

// ─── Example 7: Throttle control ──────────────────────────────────────────────
//
// Important: Throttles require a persistent WebSocket connection.
// Always release before disconnect.

const runLoco = (address: number) =>
  Effect.gen(function* () {
    const client = yield* JmriClient
    const handle = `loco-${address}`

    // Acquire throttle
    yield* client.send(acquireThrottle(handle, address))

    // Ramp up to 50% forward
    yield* client.send(setThrottleForward(handle, true))
    yield* client.send(setThrottleFunction(handle, "F0", true)) // headlight on
    yield* client.send(setThrottleSpeed(handle, 0.5))

    // After 10 seconds, stop and release
    yield* Effect.sleep("10 seconds")
    yield* client.send(setThrottleSpeed(handle, 0))
    yield* client.send(setThrottleFunction(handle, "F0", false))
    yield* client.send(releaseThrottle(handle))
  })

// ─── Example 8: Fast clock subscription ──────────────────────────────────────

const watchFastClock = Effect.gen(function* () {
  const client = yield* JmriClient

  yield* Stream.runForEach(client.subscribe("time", "JMRI"), (t) =>
    Effect.log(`Fast clock: ${t.time} @ ${t.rate}x (${t.state === TimeState.RUNNING ? "running" : "stopped"})`),
  )
})

// ─── Example 9: One-shot GET (take first value from stream) ───────────────────

const getCurrentTurnoutState = (name: string) =>
  Effect.gen(function* () {
    const client = yield* JmriClient

    // subscribe() includes the current state as the first emission
    const state = yield* Stream.runHead(client.subscribe("turnout", name))

    return state // Option<TurnoutData>
  })

// ─── Example 10: List all turnouts ────────────────────────────────────────────

const listAllTurnouts = Effect.gen(function* () {
  const client = yield* JmriClient

  // list() returns a Stream — take the first batch then stop
  const turnouts = yield* Stream.take(
    Stream.filter(client.list("turnout"), (msg) => msg.type === "turnout"),
    100, // cap at 100 to avoid running forever
  ).pipe(Stream.runCollect)

  yield* Effect.log(`Found ${turnouts.length} turnouts`)
  return turnouts
})

// ─── Example 11: Ping-based health check ─────────────────────────────────────

const healthCheck = Effect.gen(function* () {
  const client = yield* JmriClient

  yield* client.ping()
  yield* Effect.log("JMRI is reachable")
}).pipe(
  Effect.timeout("5 seconds"),
  Effect.catchTag("TimeoutException", () =>
    Effect.logError("JMRI ping timeout — connection may be lost"),
  ),
)

// ─── Entry point ──────────────────────────────────────────────────────────────

const program = Effect.gen(function* () {
  yield* Effect.log("Connecting to JMRI...")
  yield* healthCheck
  yield* watchPanel
})

const appLayer = Layer.provide(JmriClientLive, config)

Effect.runFork(
  program.pipe(
    Effect.provide(appLayer),
    Effect.catchAll((err) => Effect.logError(`Fatal: ${JSON.stringify(err)}`)),
  ),
)
