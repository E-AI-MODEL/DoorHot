import { randomUUID } from "node:crypto";
import { PostgresRealtimeBroker } from "@door010/realtime";

const connectionString = process.env.ACCEPTANCE_DATABASE_URL ??
  process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("ACCEPTANCE_DATABASE_URL is required.");
}

const publisher = new PostgresRealtimeBroker({
  connectionString
});
const subscriber = new PostgresRealtimeBroker({
  connectionString
});

const channel = `acceptance:${randomUUID()}`;
const expected = JSON.stringify({
  type: "acceptance",
  id: randomUUID()
});

const received = new Promise((resolve, reject) => {
  const timeout = setTimeout(
    () => reject(new Error("LISTEN/NOTIFY timeout")),
    10_000
  );

  void subscriber.subscribe(channel, (payload) => {
    clearTimeout(timeout);
    resolve(payload);
  });
});

try {
  await new Promise((resolve) => setTimeout(resolve, 250));
  await publisher.publish(channel, expected);

  const actual = await received;
  if (actual !== expected) {
    throw new Error("LISTEN/NOTIFY payload mismatch.");
  }

  console.log("PostgreSQL LISTEN/NOTIFY acceptance passed.");
} finally {
  await Promise.allSettled([
    publisher.close(),
    subscriber.close()
  ]);
}
