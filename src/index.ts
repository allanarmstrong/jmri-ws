/**
 * jmri-ws — Type-safe Effect-based JMRI WebSocket client
 *
 * @example
 * ```typescript
 * import { JmriClientLive, makeConfig, JmriClient, TurnoutState } from "jmri-ws"
 * import { Effect, Stream, Layer } from "effect"
 *
 * const config = makeConfig({ host: "localhost", port: 12080 })
 *
 * const program = Effect.gen(function* () {
 *   const client = yield* JmriClient
 *
 *   // Subscribe to a turnout — fires immediately with current state
 *   // then streams all future changes
 *   const stream = client.subscribe("turnout", "IT1")
 *
 *   yield* Stream.runForEach(stream, (turnout) =>
 *     Effect.log(`IT1 state: ${turnout.state}`)
 *   )
 * })
 *
 * Effect.runFork(
 *   program.pipe(
 *     Effect.provide(JmriClientLive),
 *     Effect.provide(config),
 *   )
 * )
 * ```
 */

export {
  JmriClient,
  JmriClientLive,
  JmriConfig,
  makeConfig,
  subscribeEffect,
} from "./client.js"
export type { JmriClientError } from "./client.js"

export {
  JmriMessage,
  JmriFrame,
  JmriListResponse,
  TurnoutData,
  SensorData,
  PowerData,
  SignalMastData,
  SignalHeadData,
  BlockData,
  LightData,
  MemoryData,
  RouteData,
  ReporterData,
  TimeData,
  ThrottleData,
  RosterEntryData,
  PanelData,
  HelloData,
  ErrorData,
} from "./schema.js"
export type {
  JmriMessageData,
  JmriMessageOfType,
} from "./schema.js"

export {
  TurnoutState,
  SensorState,
  PowerState,
  LightState,
  BlockState,
  RouteState,
  ReporterState,
  TimeState,
  SignalHeadAppearance,
  TurnoutFeedbackMode,
} from "./states.js"

export * from "./requests.js"
