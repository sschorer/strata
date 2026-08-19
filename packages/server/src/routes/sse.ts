import type { FastifyReply, FastifyRequest } from 'fastify';

/** How often a stream that has nothing to say says nothing, in milliseconds. */
const HEARTBEAT_MS = 15_000;

/** A server-sent event stream, once the reply has been taken over. */
export interface EventStream {
  /** Write one named event. Ignored once the stream is closed. */
  send(event: string, data: unknown): void;
  /** Finish the stream. Safe to call twice. */
  close(): void;
  /** Run when the reader goes away — a closed tab, a dropped connection. */
  onClose(listener: () => void): void;
}

/**
 * Turn a reply into a server-sent event stream.
 *
 * Fastify is told to stand back (`hijack`), because from here on the response
 * is written a frame at a time over minutes rather than serialised once. A
 * heartbeat comment keeps proxies and browsers from timing out a stream that is
 * quiet because the work is slow, not because it is over.
 */
export function openEventStream(
  req: FastifyRequest,
  reply: FastifyReply,
): EventStream {
  reply.hijack();
  const raw = reply.raw;
  raw.writeHead(200, {
    'content-type': 'text/event-stream',
    'cache-control': 'no-cache, no-transform',
    connection: 'keep-alive',
    // Nginx and friends buffer a response by default, and a buffered progress
    // stream arrives all at once at the end, which is no progress at all.
    'x-accel-buffering': 'no',
  });

  let open = true;
  const heartbeat = setInterval(() => {
    if (open) raw.write(': keep-alive\n\n');
  }, HEARTBEAT_MS);
  // Nothing here should hold the process up on shutdown.
  heartbeat.unref?.();

  const stream: EventStream = {
    send(event, data) {
      if (!open) return;
      raw.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    },
    close() {
      if (!open) return;
      open = false;
      clearInterval(heartbeat);
      raw.end();
    },
    onClose(listener) {
      req.raw.on('close', listener);
    },
  };

  // A reader that leaves takes its stream with it, whatever the writer thinks.
  stream.onClose(() => {
    open = false;
    clearInterval(heartbeat);
  });
  return stream;
}
