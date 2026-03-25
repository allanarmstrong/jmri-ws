/**
 * Effect Schema definitions for all JMRI JSON protocol message types.
 *
 * These schemas serve dual purpose:
 *  1. Runtime validation of messages arriving over the WebSocket
 *  2. Static TypeScript types via Schema.Schema.Type<>
 *
 * All fields marked optional in the protocol use Schema.optional so
 * partial update messages (e.g. only state changed) still decode correctly.
 */

import { Schema } from "effect"

// ─── Primitives ───────────────────────────────────────────────────────────────

const NullableString = Schema.NullOr(Schema.String)
const OptionalNullableString = Schema.optional(Schema.NullOr(Schema.String))
const OptionalBoolean = Schema.optional(Schema.Boolean)
const OptionalNumber = Schema.optional(Schema.Number)
const PropertiesArray = Schema.optional(Schema.Array(Schema.Unknown))

// ─── Turnout ──────────────────────────────────────────────────────────────────

export const TurnoutData = Schema.Struct({
  name: Schema.String,
  userName: OptionalNullableString,
  comment: OptionalNullableString,
  state: OptionalNumber,
  inverted: OptionalBoolean,
  feedbackMode: OptionalNumber,
  feedbackModes: Schema.optional(Schema.Array(Schema.Number)),
  sensor: Schema.optional(Schema.Tuple(NullableString, NullableString)),
  properties: PropertiesArray,
})
export type TurnoutData = Schema.Schema.Type<typeof TurnoutData>

// ─── Sensor ───────────────────────────────────────────────────────────────────

export const SensorData = Schema.Struct({
  name: Schema.String,
  userName: OptionalNullableString,
  comment: OptionalNullableString,
  state: OptionalNumber,
  inverted: OptionalBoolean,
  properties: PropertiesArray,
})
export type SensorData = Schema.Schema.Type<typeof SensorData>

// ─── Power ────────────────────────────────────────────────────────────────────

export const PowerData = Schema.Struct({
  name: Schema.optional(Schema.String),
  state: OptionalNumber,
  default: OptionalBoolean,
})
export type PowerData = Schema.Schema.Type<typeof PowerData>

// ─── Signal Mast ──────────────────────────────────────────────────────────────

export const SignalMastData = Schema.Struct({
  name: Schema.String,
  userName: OptionalNullableString,
  comment: OptionalNullableString,
  aspect: Schema.optional(Schema.NullOr(Schema.String)),
  aspects: Schema.optional(Schema.Array(Schema.String)),
  held: OptionalBoolean,
  lit: OptionalBoolean,
})
export type SignalMastData = Schema.Schema.Type<typeof SignalMastData>

// ─── Signal Head ──────────────────────────────────────────────────────────────

export const SignalHeadData = Schema.Struct({
  name: Schema.String,
  userName: OptionalNullableString,
  comment: OptionalNullableString,
  appearance: OptionalNumber,
  appearanceName: Schema.optional(Schema.String),
  appearances: Schema.optional(Schema.Array(Schema.Number)),
  held: OptionalBoolean,
  lit: OptionalBoolean,
})
export type SignalHeadData = Schema.Schema.Type<typeof SignalHeadData>

// ─── Block ────────────────────────────────────────────────────────────────────

export const BlockData = Schema.Struct({
  name: Schema.String,
  userName: OptionalNullableString,
  comment: OptionalNullableString,
  state: OptionalNumber,
  value: Schema.optional(Schema.NullOr(Schema.String)),
})
export type BlockData = Schema.Schema.Type<typeof BlockData>

// ─── Light ────────────────────────────────────────────────────────────────────

export const LightData = Schema.Struct({
  name: Schema.String,
  userName: OptionalNullableString,
  comment: OptionalNullableString,
  state: OptionalNumber,
  intensity: OptionalNumber,
  properties: PropertiesArray,
})
export type LightData = Schema.Schema.Type<typeof LightData>

// ─── Memory ───────────────────────────────────────────────────────────────────

export const MemoryData = Schema.Struct({
  name: Schema.String,
  userName: OptionalNullableString,
  comment: OptionalNullableString,
  value: Schema.optional(Schema.Unknown),
})
export type MemoryData = Schema.Schema.Type<typeof MemoryData>

// ─── Route ────────────────────────────────────────────────────────────────────

export const RouteData = Schema.Struct({
  name: Schema.String,
  userName: OptionalNullableString,
  comment: OptionalNullableString,
  state: OptionalNumber,
  enabled: OptionalBoolean,
})
export type RouteData = Schema.Schema.Type<typeof RouteData>

// ─── Reporter ─────────────────────────────────────────────────────────────────

export const ReporterData = Schema.Struct({
  name: Schema.String,
  userName: OptionalNullableString,
  comment: OptionalNullableString,
  state: OptionalNumber,
  report: Schema.optional(Schema.NullOr(Schema.String)),
  lastReport: Schema.optional(Schema.NullOr(Schema.String)),
})
export type ReporterData = Schema.Schema.Type<typeof ReporterData>

// ─── Time (Fast Clock) ────────────────────────────────────────────────────────

export const TimeData = Schema.Struct({
  name: Schema.optional(Schema.String),
  time: Schema.optional(Schema.String), // ISO-8601
  rate: OptionalNumber,
  state: OptionalNumber,
})
export type TimeData = Schema.Schema.Type<typeof TimeData>

// ─── Throttle ─────────────────────────────────────────────────────────────────

// F0–F28 as a record
const FunctionKeys = Schema.optional(
  Schema.Record({ key: Schema.String, value: Schema.Boolean }),
)

export const ThrottleData = Schema.Struct({
  name: Schema.String,
  address: OptionalNumber,
  speed: OptionalNumber,
  forward: OptionalBoolean,
  release: Schema.optional(Schema.Null),
  throttle: Schema.optional(Schema.String),
  // F0-F28 — decoded dynamically in the client
  F0: OptionalBoolean, F1: OptionalBoolean, F2: OptionalBoolean,
  F3: OptionalBoolean, F4: OptionalBoolean, F5: OptionalBoolean,
  F6: OptionalBoolean, F7: OptionalBoolean, F8: OptionalBoolean,
  F9: OptionalBoolean, F10: OptionalBoolean, F11: OptionalBoolean,
  F12: OptionalBoolean, F13: OptionalBoolean, F14: OptionalBoolean,
  F15: OptionalBoolean, F16: OptionalBoolean, F17: OptionalBoolean,
  F18: OptionalBoolean, F19: OptionalBoolean, F20: OptionalBoolean,
  F21: OptionalBoolean, F22: OptionalBoolean, F23: OptionalBoolean,
  F24: OptionalBoolean, F25: OptionalBoolean, F26: OptionalBoolean,
  F27: OptionalBoolean, F28: OptionalBoolean,
})
export type ThrottleData = Schema.Schema.Type<typeof ThrottleData>

// ─── Roster Entry ─────────────────────────────────────────────────────────────

export const FunctionKey = Schema.Struct({
  name: Schema.optional(Schema.String),
  label: Schema.optional(Schema.String),
  lockable: Schema.optional(Schema.Boolean),
  functionNumber: Schema.optional(Schema.Number),
})

export const RosterEntryData = Schema.Struct({
  name: Schema.String,
  userName: Schema.optional(Schema.String),
  address: OptionalNumber,
  isLongAddress: OptionalBoolean,
  decoderModel: Schema.optional(Schema.String),
  decoderFamily: Schema.optional(Schema.String),
  imageFileName: OptionalNullableString,
  iconFileName: OptionalNullableString,
  functionKeys: Schema.optional(Schema.Array(FunctionKey)),
})
export type RosterEntryData = Schema.Schema.Type<typeof RosterEntryData>

// ─── Panel ────────────────────────────────────────────────────────────────────

export const PanelData = Schema.Struct({
  name: Schema.String,
  userName: Schema.optional(Schema.String),
  URL: Schema.optional(Schema.String),
  type: Schema.optional(Schema.String),
})
export type PanelData = Schema.Schema.Type<typeof PanelData>

// ─── Hello ────────────────────────────────────────────────────────────────────

export const HelloData = Schema.Struct({
  jmri: Schema.optional(Schema.String),
  jmriVersion: Schema.optional(Schema.String),
  version: Schema.optional(Schema.String),
  railroad: Schema.optional(Schema.String),
  activeProfile: Schema.optional(Schema.String),
  locale: Schema.optional(Schema.String),
})
export type HelloData = Schema.Schema.Type<typeof HelloData>

// ─── Error ────────────────────────────────────────────────────────────────────

export const ErrorData = Schema.Struct({
  code: Schema.Number,
  message: Schema.String,
})
export type ErrorData = Schema.Schema.Type<typeof ErrorData>

// ─── Inbound Message (discriminated union) ────────────────────────────────────

const mkMsg = <T extends string, D extends Schema.Schema.Any>(
  type: T,
  data: D,
) =>
  Schema.Struct({
    type: Schema.Literal(type),
    id: Schema.optional(Schema.Number),
    data,
  })

const mkMsgNoData = <T extends string>(type: T) =>
  Schema.Struct({ type: Schema.Literal(type), id: Schema.optional(Schema.Number) })

export const JmriMessage = Schema.Union(
  mkMsg("turnout",     TurnoutData),
  mkMsg("sensor",      SensorData),
  mkMsg("power",       PowerData),
  mkMsg("signalMast",  SignalMastData),
  mkMsg("signalHead",  SignalHeadData),
  mkMsg("block",       BlockData),
  mkMsg("light",       LightData),
  mkMsg("memory",      MemoryData),
  mkMsg("route",       RouteData),
  mkMsg("reporter",    ReporterData),
  mkMsg("time",        TimeData),
  mkMsg("throttle",    ThrottleData),
  mkMsg("rosterEntry", RosterEntryData),
  mkMsg("panel",       PanelData),
  mkMsg("hello",       HelloData),
  mkMsg("error",       ErrorData),
  mkMsgNoData("pong"),
  mkMsgNoData("goodbye"),
)

export type JmriMessage = Schema.Schema.Type<typeof JmriMessage>

// ─── Convenience: extract data type per message type ─────────────────────────

export type JmriMessageOfType<T extends JmriMessage["type"]> = Extract<
  JmriMessage,
  { type: T }
>

export type JmriMessageData<T extends JmriMessage["type"]> =
  JmriMessageOfType<T> extends { data: infer D } ? D : never

// ─── List response ────────────────────────────────────────────────────────────
// A list response is an array of JmriMessages

export const JmriListResponse = Schema.Array(JmriMessage)
export type JmriListResponse = Schema.Schema.Type<typeof JmriListResponse>

// ─── Top-level inbound frame (message or list) ────────────────────────────────

export const JmriFrame = Schema.Union(JmriMessage, JmriListResponse)
export type JmriFrame = Schema.Schema.Type<typeof JmriFrame>
