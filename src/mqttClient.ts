import mqtt from "mqtt";
import { CONFIG } from "./config";
import { EventEmitter } from "events";

export const mqttClient = mqtt.connect(CONFIG.MQTT_BROKER, {
  username: CONFIG.MQTT_USERNAME,
  password: CONFIG.MQTT_PASSWORD,
});
const mqttEvents = new EventEmitter();

mqttClient.on("connect", () => {
  console.log("✅ Connected to MQTT Broker");
  const topics = [
    "soiltrack/moisture",
    "soiltrack/reset/status",
    "soiltrack/device/api-key/status",
  ];
  mqttClient.subscribe(topics, (err) => {
    if (err) console.error("❌ Subscription error:", err);
    else console.log(`📡 Subscribed to topics: ${topics.join(", ")}`);
  });
});

mqttClient.on("message", (topic, message) => {
  const messageStr = message.toString().trim();
  console.log(`📩 Received message on '${topic}': ${messageStr}`);

  mqttEvents.emit(topic, messageStr);
});

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
) => {
  return new Promise<string>((resolve, reject) => {
    const timeoutHandle = setTimeout(() => {
      mqttEvents.removeListener(topic, listener);
      reject(new Error(`Timeout waiting for response on ${topic}`));
    }, timeout);

    const listener = (message: string) => {
      clearTimeout(timeoutHandle);
      mqttEvents.removeListener(topic, listener);

      console.log(`📩 ESP32 Response on '${topic}': ${message}`);

      if (expectedMessage && message !== expectedMessage) {
        reject(new Error(`Unexpected response: ${message}`));
      }

      resolve(message);
    };

    mqttEvents.on(topic, listener);
  });
};
