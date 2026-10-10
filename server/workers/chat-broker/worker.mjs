// Durable chat-event publication from persisted MongoDB messages.
// Realtime Socket.IO delivery remains in the API. This worker processes
// notification/audit events; it does not replace the websocket transport.
import amqp from "amqplib";
import { MongoClient, ObjectId } from "mongodb";

const mongoUri = process.env.MONGO_URI;
const rabbitUri = process.env.RABBITMQ_URL;
if (!mongoUri || !rabbitUri) throw new Error("MONGO_URI and RABBITMQ_URL are required");
const queueName = "bookflow.chat.events.v1";
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const mongo = new MongoClient(mongoUri, { maxPoolSize: 5 });
await mongo.connect();
const databaseName = new URL(mongoUri).pathname.replace(/^\//, "") || "booking_app";
const messages = mongo.db(databaseName).collection("messages");
let stopping = false;
process.on("SIGTERM", () => { stopping = true; });
process.on("SIGINT", () => { stopping = true; });

while (!stopping) {
  let conn;
  try {
    conn = await amqp.connect(rabbitUri);
    const channel = await conn.createConfirmChannel();
    await channel.assertQueue(queueName, { durable: true });
    await channel.prefetch(20);
    await channel.consume(queueName, async delivery => {
      if (!delivery) return;
      try {
        const event = JSON.parse(delivery.content.toString("utf8"));
        if (event.type !== "chat.message.created" || !ObjectId.isValid(event.messageId)) {
          channel.reject(delivery, false);
          return;
        }
        // Idempotent audit of broker processing. No private message body leaves MongoDB.
        await messages.updateOne({ _id: new ObjectId(event.messageId), queueProcessedAt: null },
          { $set: { queueProcessedAt: new Date() } });
        channel.ack(delivery);
      } catch (error) {
        console.error("RabbitMQ consumer error", error);
        channel.nack(delivery, false, true);
      }
    }, { noAck: false });

    while (!stopping) {
      const pending = await messages.find({ queuePending: true },
        { projection: { _id: 1, sender: 1, recipient: 1, createdAt: 1 } })
        .sort({ createdAt: 1 }).limit(100).toArray();
      for (const item of pending) {
        if (stopping) break;
        const event = JSON.stringify({
          type: "chat.message.created", messageId: String(item._id),
          senderId: String(item.sender), recipientId: String(item.recipient),
          createdAt: item.createdAt
        });
        // Publisher confirms + persistent queue; repeated publication is handled idempotently.
        await new Promise((resolve, reject) => {
          channel.sendToQueue(queueName, Buffer.from(event), {
            persistent: true, contentType: "application/json", messageId: String(item._id)
          }, error => error ? reject(error) : resolve());
        });
        await messages.updateOne({ _id: item._id, queuePending: true },
          { $set: { queuePending: false, queuePublishedAt: new Date() } });
      }
      if (!pending.length) await sleep(1000);
    }
    await channel.close();
  } catch (error) {
    console.error("Chat broker error; reconnecting", error);
    if (!stopping) await sleep(3000);
  } finally {
    if (conn) try { await conn.close(); } catch {}
  }
}
await mongo.close();
