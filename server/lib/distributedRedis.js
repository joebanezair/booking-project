// Optional Redis integration shared by API response caching and Socket.IO.
// Install the optional packages with: cd server && npm install redis @socket.io/redis-adapter
let cacheClient;
let publisher;
let subscriber;

export function getRedisCacheClient() { return cacheClient; }

export async function startRedis(io) {
  if (!process.env.REDIS_URL) return false;
  let createClient, createAdapter;
  try {
    ({ createClient } = await import("redis"));
    ({ createAdapter } = await import("@socket.io/redis-adapter"));
  } catch {
    throw new Error("REDIS_URL requires the redis and @socket.io/redis-adapter packages. Install them in server/ first.");
  }
  publisher = createClient({ url: process.env.REDIS_URL });
  publisher.on("error", error => console.error("Redis publisher:", error.message));
  await publisher.connect();
  try {
    subscriber = publisher.duplicate();
    subscriber.on("error", error => console.error("Redis subscriber:", error.message));
    await subscriber.connect();
    cacheClient = publisher;
    io.adapter(createAdapter(publisher, subscriber));
  } catch (error) {
    await Promise.allSettled([subscriber?.quit(), publisher?.quit()]);
    publisher = subscriber = cacheClient = undefined;
    throw error;
  }
  return true;
}

export async function stopRedis() {
  const clients = [subscriber, publisher].filter(Boolean);
  cacheClient = publisher = subscriber = undefined;
  await Promise.allSettled(clients.map(client => client.quit()));
}
