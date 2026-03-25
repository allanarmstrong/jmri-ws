/**
 * Effect-based JMRI WebSocket client.
 *
 * Transport:
 *   Uses the native WebSocket global — available in all modern browsers and
 *   Node.js 21+. For Node 18/20, pass a WebSocketConstructor in config:
 *
 *     import { WebSocket } from "ws"
 *     makeConfig({ host: "localhost", port: 12080, WebSocketConstructor: WebSocket })
 *
 * Architecture:
 *   - WebSocket connection is managed inside a scoped Effect
 *   - Incoming messages are broadcast through a PubSub<JmriMessage>
 *   - subscribe() returns a Stream that filters the PubSub for a specific type+name
 *   - Reconnection is handled automatically with exponential backoff
 *   - send() queues messages and the sender fiber drains them
 *
 * The key JMRI WebSocket behaviour:
 *   Sending {"type":"turnout","data":{"name":"IT1"}} does TWO things:
 *     1. Returns the current state immediately
 *     2. Registers a server-side listener that pushes future changes
 *   This maps naturally onto Stream — subscribe() gives you both.
 */

import {
  Effect,
  Stream,
  PubSub,
  Queue,
  Fiber,
  Schedule,
  Schema,
  ParseResult,
  Context,
  Layer,
  Scope,
} from "effect";
import { JmriFrame, JmriMessage } from "./schema.js";
import type { JmriMessageData, JmriMessageOfType } from "./schema.js";

// ─── Config ───────────────────────────────────────────────────────────────────

export interface JmriConfig {
  readonly host: string;
  readonly port: number;
  /** WebSocket path, defaults to "/json/v5" */
  readonly path?: string;
  /** Protocol version to negotiate in hello, defaults to no preference */
  readonly version?: string;
  /** Reconnect backoff: base delay in ms, defaults to 500 */
  readonly reconnectBaseMs?: number;
  /** Reconnect backoff: max delay in ms, defaults to 30_000 */
  readonly reconnectMaxMs?: number;
  /**
   * WebSocket constructor to use. Defaults to globalThis.WebSocket.
   *
   * Node.js 21+ has WebSocket built-in. For Node 18/20, install `ws` and pass:
   *   import { WebSocket } from "ws"
   *   { WebSocketConstructor: WebSocket }
   */
  readonly WebSocketConstructor?: typeof globalThis.WebSocket;
}

export const JmriConfig = Context.GenericTag<JmriConfig>("JmriConfig");

export const makeConfig = (config: JmriConfig): Layer.Layer<JmriConfig> =>
  Layer.succeed(JmriConfig, config);

// ─── Client Service Interface ─────────────────────────────────────────────────

export interface JmriClient {
  /**
   * Raw stream of every validated inbound message.
   * Useful for debugging or building custom subscriptions.
   */
  readonly messages: Stream.Stream<JmriMessage, JmriClientError>;

  /**
   * Send any serialisable message to JMRI.
   * Fire-and-forget — errors are propagated as JmriClientError.
   */
  readonly send: (
    payload: Record<string, unknown>,
  ) => Effect.Effect<void, JmriClientError>;

  /**
   * Subscribe to a specific named object.
   * Sends a GET (subscribe) message, then returns a Stream of all
   * subsequent messages for that type+name, including the initial state.
   *
   * The stream runs until the connection is closed or the scope ends.
   */
  readonly subscribe: <T extends JmriMessage["type"]>(
    type: T,
    name: string,
    id?: number,
  ) => Stream.Stream<JmriMessageData<T>, JmriClientError>;

  /**
   * List all objects of a type.
   * Over WebSocket this also subscribes to future list changes.
   * Returns a Stream of individual messages from the list response.
   */
  readonly list: (type: string) => Stream.Stream<JmriMessage, JmriClientError>;

  /**
   * Ping and wait for pong.
   */
  readonly ping: () => Effect.Effect<void, JmriClientError>;
}

export const JmriClient = Context.GenericTag<JmriClient>("JmriClient");

// ─── Errors ───────────────────────────────────────────────────────────────────

export type JmriClientError =
  | {
      readonly _tag: "ConnectionError";
      readonly message: string;
      readonly cause?: unknown;
    }
  | {
      readonly _tag: "ParseError";
      readonly message: string;
      readonly raw: string;
    }
  | { readonly _tag: "SendError"; readonly message: string }
  | {
      readonly _tag: "ProtocolError";
      readonly message: string;
      readonly code: number;
    };

const ConnectionError = (
  message: string,
  cause?: unknown,
): JmriClientError => ({ _tag: "ConnectionError", message, cause });

const ParseError = (message: string, raw: string): JmriClientError => ({
  _tag: "ParseError",
  message,
  raw,
});

const SendError = (message: string): JmriClientError => ({
  _tag: "SendError",
  message,
});

const ProtocolError = (message: string, code: number): JmriClientError => ({
  _tag: "ProtocolError",
  message,
  code,
});

// ─── Decode helpers ───────────────────────────────────────────────────────────

const decodeFrame = Schema.decodeUnknown(JmriFrame);

const decodeJSON = (raw: string): Effect.Effect<unknown, JmriClientError> =>
  Effect.try({
    try: () => JSON.parse(raw) as unknown,
    catch: (e) => ParseError(`Invalid JSON: ${String(e)}`, raw),
  });

const parseFrame = (raw: string): Effect.Effect<JmriFrame, JmriClientError> =>
  Effect.flatMap(decodeJSON(raw), (parsed) =>
    Effect.mapError(decodeFrame(parsed), (e) =>
      ParseError(
        `Schema validation failed: ${ParseResult.TreeFormatter.formatErrorSync(e)}`,
        raw,
      ),
    ),
  );

// ─── WebSocket connection ─────────────────────────────────────────────────────

const makeConnection = (
  config: JmriConfig,
  inbound: PubSub.PubSub<JmriMessage>,
  outbound: Queue.Queue<string>,
): Effect.Effect<void, JmriClientError, Scope.Scope> => {
  const WS = config.WebSocketConstructor ?? globalThis.WebSocket;

  return Effect.acquireRelease(
    // Open the socket
    Effect.async<WebSocket, JmriClientError>((resume) => {
      const url = `ws://${config.host}:${config.port}${config.path ?? "/json/v5"}`;
      const ws = new WS(url);

      const onOpen = () => {
        ws.removeEventListener("error", onOpenError);
        resume(Effect.succeed(ws));
      };
      const onOpenError = (event: Event) => {
        ws.removeEventListener("open", onOpen);
        resume(Effect.fail(ConnectionError(`WebSocket open failed`, event)));
      };

      ws.addEventListener("open", onOpen, { once: true });
      ws.addEventListener("error", onOpenError, { once: true });
    }),
    // Cleanup: close the socket
    (ws) => Effect.sync(() => ws.close()),
  ).pipe(
    Effect.flatMap((ws) =>
      Effect.gen(function* () {
        // Sender fiber: drain outbound queue → ws.send
        // Native WebSocket.send() is synchronous — no callback.
        const senderFiber = yield* Effect.fork(
          Effect.forever(
            Effect.flatMap(Queue.take(outbound), (msg) =>
              Effect.try({
                try: () => ws.send(msg),
                catch: (e) => SendError(`ws.send failed: ${String(e)}`),
              }),
            ),
          ),
        );

        // Receiver: listen for messages and publish to PubSub
        const receiverEffect = Effect.async<void, JmriClientError>((resume) => {
          ws.addEventListener("message", (event: MessageEvent) => {
            // event.data is always a string when JMRI sends JSON
            const raw =
              typeof event.data === "string"
                ? event.data
                : JSON.stringify(event.data);

            Effect.runFork(
              Effect.flatMap(parseFrame(raw), (frame) => {
                if (Array.isArray(frame)) {
                  // List response — publish each item individually
                  return Effect.forEach(
                    frame as JmriMessage[],
                    (item) => PubSub.publish(inbound, item),
                    { discard: true },
                  );
                }
                return Effect.asVoid(
                  PubSub.publish(inbound, frame as JmriMessage),
                );
              }),
            );
          });

          ws.addEventListener(
            "close",
            (event: CloseEvent) => {
              resume(
                Effect.fail(
                  ConnectionError(
                    `WebSocket closed: ${event.code} ${event.reason}`,
                  ),
                ),
              );
            },
            { once: true },
          );

          ws.addEventListener(
            "error",
            (event: Event) => {
              resume(Effect.fail(ConnectionError(`WebSocket error`, event)));
            },
            { once: true },
          );
        });

        // Negotiate version if configured
        if (config.version) {
          yield* Queue.offer(
            outbound,
            JSON.stringify({
              type: "hello",
              data: { version: config.version },
            }),
          );
        }

        yield* receiverEffect;
        yield* Fiber.interrupt(senderFiber);
      }),
    ),
  );
};

// ─── Client Layer ─────────────────────────────────────────────────────────────

export const JmriClientLive: Layer.Layer<
  JmriClient,
  JmriClientError,
  JmriConfig
> = Layer.scoped(
  JmriClient,
  Effect.gen(function* () {
    const config = yield* JmriConfig;

    // PubSub broadcasts every inbound message to all active subscribers
    const inbound = yield* PubSub.unbounded<JmriMessage>();

    // Queue for outbound messages — sender fiber drains this
    const outbound = yield* Queue.unbounded<string>();

    // Connection fiber with exponential backoff reconnection
    const reconnectSchedule = Schedule.exponential(
      config.reconnectBaseMs ?? 500,
    ).pipe(Schedule.union(Schedule.spaced(config.reconnectMaxMs ?? 30_000)));

    const connectionLoop = Effect.scoped(
      makeConnection(config, inbound, outbound),
    ).pipe(
      Effect.catchAll((err) =>
        Effect.logWarning(
          `JMRI connection lost (${err.message}), reconnecting...`,
        ).pipe(Effect.map(() => err)),
      ),
      Effect.retry(reconnectSchedule),
    );

    yield* Effect.fork(connectionLoop);

    // ── Public API ─────────────────────────────────────────────────────────

    const send = (
      payload: Record<string, unknown>,
    ): Effect.Effect<void, JmriClientError> =>
      Effect.flatMap(
        Effect.try({
          try: () => JSON.stringify(payload),
          catch: (e) => SendError(`JSON serialisation failed: ${String(e)}`),
        }),
        (json) => Queue.offer(outbound, json),
      );

    const messages: Stream.Stream<JmriMessage, JmriClientError> =
      Stream.fromPubSub(inbound).pipe(
        Stream.mapEffect((msg) =>
          msg.type === "error" && "data" in msg
            ? Effect.fail(
                ProtocolError(
                  (msg.data as { message: string }).message,
                  (msg.data as { code: number }).code,
                ),
              )
            : Effect.succeed(msg),
        ),
      );

    const subscribe = <T extends JmriMessage["type"]>(
      type: T,
      name: string,
      id?: number,
    ): Stream.Stream<JmriMessageData<T>, JmriClientError> =>
      Stream.fromEffect(
        send({ type, data: { name }, ...(id !== undefined ? { id } : {}) }),
      ).pipe(
        Stream.flatMap(() => messages),
        Stream.filter(
          (msg): msg is JmriMessageOfType<T> =>
            msg.type === type &&
            "data" in msg &&
            (msg.data as { name?: string }).name === name,
        ),
        Stream.map(
          (msg) =>
            (msg as JmriMessageOfType<T> & { data: JmriMessageData<T> }).data,
        ),
      );

    const list = (type: string): Stream.Stream<JmriMessage, JmriClientError> =>
      Stream.fromEffect(send({ list: type })).pipe(
        Stream.flatMap(() => messages),
        Stream.filter((msg) => msg.type === type),
      );

    const pingImpl = (): Effect.Effect<void, JmriClientError> =>
      Effect.flatMap(send({ type: "ping" }), () =>
        Stream.take(
          Stream.filter(messages, (msg) => msg.type === "pong"),
          1,
        ).pipe(Stream.runDrain),
      );

    return JmriClient.of({
      messages,
      send,
      subscribe,
      list,
      ping: pingImpl,
    });
  }),
);

// ─── Convenience accessor ─────────────────────────────────────────────────────

export const getClient = JmriClient;

/**
 * Subscribe helper for use in Effect.gen.
 *
 * @example
 * const turnoutStream = yield* subscribeEffect("turnout", "IT1")
 * yield* Stream.runForEach(turnoutStream, (data) =>
 *   Effect.log(`Turnout IT1 state: ${data.state}`)
 * )
 */
export const subscribeEffect = <T extends JmriMessage["type"]>(
  type: T,
  name: string,
  id?: number,
): Effect.Effect<
  Stream.Stream<JmriMessageData<T>, JmriClientError>,
  never,
  JmriClient
> => Effect.map(JmriClient, (client) => client.subscribe(type, name, id));
