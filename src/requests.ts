/**
 * Type-safe request builders for outbound JMRI JSON messages.
 *
 * All functions return plain objects — serialise with JSON.stringify.
 * The `method` field maps to HTTP verbs but is sent in the WS message body:
 *   omitted / "get"  → subscribe + return current state
 *   "post"           → modify existing object
 *   "put"            → create new object
 *   "delete"         → remove object
 */

import type { TurnoutState, SensorState, PowerState, LightState, RouteState, TimeState, SignalHeadAppearance } from "./states.js"

// ─── Envelope helpers ─────────────────────────────────────────────────────────

type Method = "get" | "post" | "put" | "delete"

type Msg<T extends string, D extends Record<string, unknown>> = {
  type: T
  method?: Method
  id?: number
  data: D
}

const msg = <T extends string, D extends Record<string, unknown>>(
  type: T,
  data: D,
  method?: Method,
  id?: number,
): Msg<T, D> =>
  method !== undefined
    ? { type, method, ...(id !== undefined ? { id } : {}), data }
    : { type, ...(id !== undefined ? { id } : {}), data }

// ─── Turnout ──────────────────────────────────────────────────────────────────

/** Subscribe to a turnout (returns current state and listens for changes). */
export const getTurnout = (name: string, id?: number) =>
  msg("turnout", { name }, undefined, id)

/** Set a turnout state. */
export const setTurnout = (
  name: string,
  state: TurnoutState,
  id?: number,
) => msg("turnout", { name, state }, "post", id)

/** Create a new internal turnout. */
export const createTurnout = (
  name: string,
  opts?: { userName?: string },
  id?: number,
) => msg("turnout", { name, ...opts }, "put", id)

// ─── Sensor ───────────────────────────────────────────────────────────────────

/** Subscribe to a sensor. */
export const getSensor = (name: string, id?: number) =>
  msg("sensor", { name }, undefined, id)

/**
 * Set sensor state.
 * Only works for JMRI internal sensors (IS prefix).
 * Hardware sensors are read-only.
 */
export const setSensor = (name: string, state: SensorState, id?: number) =>
  msg("sensor", { name, state }, "post", id)

// ─── Power ────────────────────────────────────────────────────────────────────

/** Get track power state. Omit name to use the default power manager. */
export const getPower = (name?: string, id?: number) =>
  msg("power", name ? { name } : {}, undefined, id)

/** Set track power state. */
export const setPower = (state: PowerState, name?: string, id?: number) =>
  msg("power", { state, ...(name ? { name } : {}) }, "post", id)

// ─── Signal Mast ──────────────────────────────────────────────────────────────

/** Subscribe to a signal mast. */
export const getSignalMast = (name: string, id?: number) =>
  msg("signalMast", { name }, undefined, id)

/** Set a signal mast aspect. */
export const setSignalMastAspect = (
  name: string,
  aspect: string,
  id?: number,
) => msg("signalMast", { name, aspect }, "post", id)

/** Hold or release a signal mast. */
export const setSignalMastHeld = (
  name: string,
  held: boolean,
  id?: number,
) => msg("signalMast", { name, held }, "post", id)

/** Dim or extinguish a signal mast. */
export const setSignalMastLit = (
  name: string,
  lit: boolean,
  id?: number,
) => msg("signalMast", { name, lit }, "post", id)

// ─── Signal Head ──────────────────────────────────────────────────────────────

/** Subscribe to a signal head. */
export const getSignalHead = (name: string, id?: number) =>
  msg("signalHead", { name }, undefined, id)

/** Set a signal head appearance. */
export const setSignalHeadAppearance = (
  name: string,
  appearance: SignalHeadAppearance,
  id?: number,
) => msg("signalHead", { name, appearance }, "post", id)

/** Hold or release a signal head. */
export const setSignalHeadHeld = (
  name: string,
  held: boolean,
  id?: number,
) => msg("signalHead", { name, held }, "post", id)

// ─── Block ────────────────────────────────────────────────────────────────────

/** Subscribe to a block. */
export const getBlock = (name: string, id?: number) =>
  msg("block", { name }, undefined, id)

/** Set a block's value (e.g. reporting mark of occupying loco). */
export const setBlockValue = (
  name: string,
  value: string | null,
  id?: number,
) => msg("block", { name, value }, "post", id)

// ─── Light ────────────────────────────────────────────────────────────────────

/** Subscribe to a light. */
export const getLight = (name: string, id?: number) =>
  msg("light", { name }, undefined, id)

/** Set light state. */
export const setLight = (name: string, state: LightState, id?: number) =>
  msg("light", { name, state }, "post", id)

/** Set light intensity (0.0–1.0). */
export const setLightIntensity = (
  name: string,
  intensity: number,
  id?: number,
) => msg("light", { name, intensity }, "post", id)

// ─── Memory ───────────────────────────────────────────────────────────────────

/** Subscribe to a memory variable. */
export const getMemory = (name: string, id?: number) =>
  msg("memory", { name }, undefined, id)

/** Set a memory variable's value. */
export const setMemory = (
  name: string,
  value: unknown,
  id?: number,
) => msg("memory", { name, value }, "post", id)

// ─── Route ────────────────────────────────────────────────────────────────────

/** Subscribe to a route. */
export const getRoute = (name: string, id?: number) =>
  msg("route", { name }, undefined, id)

/** Fire (activate) a route. */
export const fireRoute = (name: string, id?: number) =>
  msg("route", { name, state: 2 satisfies RouteState }, "post", id)

// ─── Reporter ─────────────────────────────────────────────────────────────────

/** Subscribe to a reporter. */
export const getReporter = (name: string, id?: number) =>
  msg("reporter", { name }, undefined, id)

// ─── Time (Fast Clock) ────────────────────────────────────────────────────────

/** Subscribe to the fast clock. */
export const getTime = (id?: number) =>
  msg("time", {}, undefined, id)

/** Set the fast clock state (running/stopped). */
export const setTimeState = (state: TimeState, id?: number) =>
  msg("time", { state }, "post", id)

/** Set the fast clock rate multiplier. */
export const setTimeRate = (rate: number, id?: number) =>
  msg("time", { rate }, "post", id)

/** Set the fast clock time. */
export const setTime = (isoTime: string, id?: number) =>
  msg("time", { time: isoTime }, "post", id)

// ─── Throttle ─────────────────────────────────────────────────────────────────

/** Acquire a throttle. `name` is your client-chosen handle. */
export const acquireThrottle = (
  name: string,
  address: number,
  id?: number,
) => msg("throttle", { name, address }, undefined, id)

/** Set throttle speed (0.0–1.0). */
export const setThrottleSpeed = (
  name: string,
  speed: number,
  id?: number,
) => msg("throttle", { name, speed }, undefined, id)

/** Set throttle direction. */
export const setThrottleForward = (
  name: string,
  forward: boolean,
  id?: number,
) => msg("throttle", { name, forward }, undefined, id)

/** Set a function key state (F0–F28). */
export const setThrottleFunction = (
  name: string,
  fn: `F${number}`,
  active: boolean,
  id?: number,
) => msg("throttle", { name, [fn]: active }, undefined, id)

/** Release a throttle. Must be called on disconnect to avoid ghost throttles. */
export const releaseThrottle = (name: string, id?: number) =>
  msg("throttle", { name, release: null }, undefined, id)

// ─── List requests ────────────────────────────────────────────────────────────

/**
 * Request all objects of a type.
 * Over WebSocket this also subscribes to list changes.
 */
export const listObjects = (type: string) => ({ list: type })

// ─── Protocol ─────────────────────────────────────────────────────────────────

/** Ping the server. Response is {"type":"pong"}. */
export const ping = (id?: number): { type: "ping"; id?: number } =>
  id !== undefined ? { type: "ping", id } : { type: "ping" }

/** Clean shutdown — server will echo goodbye then close. */
export const goodbye = (): { type: "goodbye" } => ({ type: "goodbye" })

/** Negotiate a specific protocol version. */
export const hello = (version?: string): { type: "hello"; data?: { version: string } } =>
  version ? { type: "hello", data: { version } } : { type: "hello" }
