import { EventEmitter } from "node:events";
import { Client, type ClientConfig } from "pg";

export type RealtimeMessageHandler = (payload: string) => void;

export interface RealtimeBroker {
  publish(channel: string, payload: string): Promise<void>;
  subscribe(
    channel: string,
    handler: RealtimeMessageHandler
  ): Promise<() => Promise<void>>;
  close(): Promise<void>;
}

function validateChannel(channel: string): string {
  if (!/^[a-zA-Z0-9:_-]{1,200}$/.test(channel)) {
    throw new Error("invalid_realtime_channel");
  }
  return channel;
}

export class InMemoryRealtimeBroker implements RealtimeBroker {
  private readonly events = new EventEmitter();

  constructor() {
    this.events.setMaxListeners(1_000);
  }

  async publish(channel: string, payload: string): Promise<void> {
    this.events.emit(validateChannel(channel), payload);
  }

  async subscribe(
    channel: string,
    handler: RealtimeMessageHandler
  ): Promise<() => Promise<void>> {
    const safeChannel = validateChannel(channel);
    this.events.on(safeChannel, handler);

    return async () => {
      this.events.off(safeChannel, handler);
    };
  }

  async close(): Promise<void> {
    this.events.removeAllListeners();
  }
}

export class PostgresRealtimeBroker implements RealtimeBroker {
  private readonly publisher: Client;
  private readonly subscriber: Client;
  private readonly handlers =
    new Map<string, Set<RealtimeMessageHandler>>();
  private started = false;

  constructor(config: ClientConfig) {
    this.publisher = new Client(config);
    this.subscriber = new Client(config);
  }

  async start(): Promise<void> {
    if (this.started) return;

    await Promise.all([
      this.publisher.connect(),
      this.subscriber.connect()
    ]);

    this.subscriber.on("notification", (notification) => {
      if (!notification.channel || notification.payload === undefined) {
        return;
      }

      for (
        const handler of
        this.handlers.get(notification.channel) ?? []
      ) {
        handler(notification.payload);
      }
    });

    this.started = true;
  }

  async publish(channel: string, payload: string): Promise<void> {
    await this.start();
    const safeChannel = validateChannel(channel);

    await this.publisher.query(
      "SELECT pg_notify($1, $2)",
      [safeChannel, payload]
    );
  }

  async subscribe(
    channel: string,
    handler: RealtimeMessageHandler
  ): Promise<() => Promise<void>> {
    await this.start();
    const safeChannel = validateChannel(channel);
    const handlers =
      this.handlers.get(safeChannel) ??
      new Set<RealtimeMessageHandler>();
    const firstHandler = handlers.size === 0;

    handlers.add(handler);
    this.handlers.set(safeChannel, handlers);

    if (firstHandler) {
      await this.subscriber.query(
        `LISTEN "${safeChannel.replaceAll('"', '""')}"`
      );
    }

    return async () => {
      const current = this.handlers.get(safeChannel);
      current?.delete(handler);

      if (!current || current.size === 0) {
        this.handlers.delete(safeChannel);
        await this.subscriber.query(
          `UNLISTEN "${safeChannel.replaceAll('"', '""')}"`
        );
      }
    };
  }

  async close(): Promise<void> {
    if (!this.started) return;

    await Promise.allSettled([
      this.publisher.end(),
      this.subscriber.end()
    ]);
    this.handlers.clear();
    this.started = false;
  }
}

export function createPostgresRealtimeBrokerFromEnvironment():
  PostgresRealtimeBroker {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is required for PostgreSQL realtime."
    );
  }

  return new PostgresRealtimeBroker({
    connectionString,
    ssl: process.env.DATABASE_SSL === "true"
      ? { rejectUnauthorized: false }
      : undefined
  });
}
