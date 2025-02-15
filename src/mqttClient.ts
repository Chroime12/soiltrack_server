import mqtt from "mqtt";
import { EventEmitter } from "events";
import * as dotenv from "dotenv";

dotenv.config();

export const mqttClient = mqtt.connect(process.env.MQTT_BROKER as string, {
  username: process.env.MQTT_USERNAME,
  password: process.env.MQTT_PASSWORD,
});

const mqttEvents = new EventEmitter();
const subscribedTopics = new Set<string>();

mqttClient.on("connect", () => {
  console.log("✅ Connected to MQTT Broker");

  const initialTopics = [
    "soiltrack/moisture",
    "soiltrack/reset/status",
    "soiltrack/device/api-key/status",
    "soiltrack/device/+/soil",
  ];

  subscribeToTopics(initialTopics);
});

mqttClient.on("message", (topic, message) => {
  const messageStr = message.toString().trim();
  console.log(`📩 Received message on '${topic}': ${messageStr}`);

  mqttEvents.emit(topic, messageStr);

  if (topic.startsWith("soiltrack/device/") && topic.endsWith("/soil")) {
    const macAddress = topic.split("/")[2];
    try {
      const payload = JSON.parse(messageStr);
      console.log(`🌱 Soil data from MAC: ${macAddress}`, payload);

      const moistureLevels = [];
      if (typeof payload.moisture1 === "number") {
        moistureLevels.push(payload.moisture1);
      }

      if (typeof payload.moisture2 === "number") {
        moistureLevels.push(payload.moisture2);
      }

      if (moistureLevels.length > 0) {
        console.log(`🌱 Moisture levels from ${macAddress}:`, moistureLevels);
      } else {
        console.warn("⚠️ Invalid soil data payload:", payload);
      }
    } catch (err) {
      console.error("❌ Error processing soil data message:", err);
    }
  }
});

export const subscribeToTopics = (topics: string | string[]) => {
  const topicArray = Array.isArray(topics) ? topics : [topics];

  const newTopics = topicArray.filter((topic) => !subscribedTopics.has(topic));
  if (newTopics.length === 0) return;

  mqttClient.subscribe(newTopics, (err) => {
    if (err) console.error(`❌ Subscription error:`, err);
    else {
      newTopics.forEach((topic) => subscribedTopics.add(topic));
      console.log(`📡 Subscribed to new topics: ${newTopics.join(", ")}`);
    }
  });
};

export const publishMQTT = (topic: string, message: string) => {
  return new Promise<void>((resolve, reject) => {
    mqttClient.publish(topic, message, (err) => {
      if (err) {
        console.error(`❌ Error publishing to ${topic}:`, err);
        reject(err);
      } else {
        console.log(`📤 Sent message to ${topic}: ${message}`);
        resolve();
      }
    });
  });
};

export const waitForMQTTResponse = (
  topic: string,
  expectedMessage?: string,
  timeout: number = 10000
): Promise<string> => {
  return new Promise<string>((resolve, reject) => {
    console.log(
      `🕒 Waiting for MQTT response on topic: ${topic} (Timeout: ${timeout}ms)`
    );

    const timeoutHandle = setTimeout(() => {
      mqttEvents.removeListener(topic, listener);
      console.error(`⏳ Timeout: No response received on topic ${topic}`);
      reject(new Error(`Timeout waiting for response on ${topic}`));
    }, timeout);

    const listener = (message: string) => {
      console.log(`📩 Received MQTT message on '${topic}': ${message}`);

      if (expectedMessage && message !== expectedMessage) {
        console.warn(
          `⚠️ Unexpected response on '${topic}': ${message} (Expected: ${expectedMessage})`
        );
        return;
      }

      clearTimeout(timeoutHandle);
      mqttEvents.removeListener(topic, listener);
      resolve(message);
    };

    mqttEvents.on(topic, listener);
  });
};
