/**
 * JMRI state constants.
 *
 * JMRI reuses the same numeric values across types — 0/2/4/8 —
 * but the *meaning* differs per type. These branded const objects
 * give you type-safe access with named values.
 *
 * The shared numeric encoding is:
 *   0 = UNKNOWN
 *   2 = the "active/on/positive" state
 *   4 = the "inactive/off/negative" state
 *   8 = INCONSISTENT (object in mid-transition)
 */

// ─── Turnout ──────────────────────────────────────────────────────────────────

export const TurnoutState = {
  UNKNOWN: 0,
  CLOSED: 2,
  THROWN: 4,
  INCONSISTENT: 8,
} as const

export type TurnoutState = (typeof TurnoutState)[keyof typeof TurnoutState]

// ─── Sensor ───────────────────────────────────────────────────────────────────

export const SensorState = {
  UNKNOWN: 0,
  ACTIVE: 2,
  INACTIVE: 4,
  INCONSISTENT: 8,
} as const

export type SensorState = (typeof SensorState)[keyof typeof SensorState]

// ─── Power ────────────────────────────────────────────────────────────────────

export const PowerState = {
  UNKNOWN: 0,
  ON: 2,
  OFF: 4,
} as const

export type PowerState = (typeof PowerState)[keyof typeof PowerState]

// ─── Light ────────────────────────────────────────────────────────────────────

export const LightState = {
  UNKNOWN: 0,
  ON: 2,
  OFF: 4,
} as const

export type LightState = (typeof LightState)[keyof typeof LightState]

// ─── Block ────────────────────────────────────────────────────────────────────

export const BlockState = {
  UNKNOWN: 0,
  OCCUPIED: 2,
  UNOCCUPIED: 4,
} as const

export type BlockState = (typeof BlockState)[keyof typeof BlockState]

// ─── Route ────────────────────────────────────────────────────────────────────

export const RouteState = {
  UNKNOWN: 0,
  ACTIVE: 2, // fires the route
  INACTIVE: 4,
} as const

export type RouteState = (typeof RouteState)[keyof typeof RouteState]

// ─── Reporter ─────────────────────────────────────────────────────────────────

export const ReporterState = {
  UNKNOWN: 0,
  ACTIVE: 2,
  INACTIVE: 4,
} as const

export type ReporterState = (typeof ReporterState)[keyof typeof ReporterState]

// ─── Fast Clock ───────────────────────────────────────────────────────────────

export const TimeState = {
  UNKNOWN: 0,
  RUNNING: 2,
  STOPPED: 4,
} as const

export type TimeState = (typeof TimeState)[keyof typeof TimeState]

// ─── Signal Head Appearance ───────────────────────────────────────────────────

export const SignalHeadAppearance = {
  DARK: 0,
  RED: 1,
  FLASHRED: 2,
  YELLOW: 4,
  FLASHYELLOW: 8,
  GREEN: 16,
  FLASHGREEN: 32,
  LUNAR: 64,
  FLASHLUNAR: 128,
} as const

export type SignalHeadAppearance =
  (typeof SignalHeadAppearance)[keyof typeof SignalHeadAppearance]

// ─── Turnout Feedback Mode Bitmask ────────────────────────────────────────────

export const TurnoutFeedbackMode = {
  DIRECT: 1,
  ONESENSOR: 2,
  TWOSENSOR: 4,
  DELAYED: 8,
  MONITORING: 16,
  LNPOLL: 32,
  INDIRECT: 128,
} as const

export type TurnoutFeedbackMode =
  (typeof TurnoutFeedbackMode)[keyof typeof TurnoutFeedbackMode]
