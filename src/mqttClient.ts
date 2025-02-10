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

      // If expectedMessage is provided, check if it matches
      if (expectedMessage && message !== expectedMessage) {
        console.warn(
          `⚠️ Unexpected response on '${topic}': ${message} (Expected: ${expectedMessage})`
        );
        return; // Ignore and keep listening
      }

      clearTimeout(timeoutHandle);
      mqttEvents.removeListener(topic, listener);
      resolve(message);
    };

    mqttEvents.on(topic, listener);
  });
};

// export const waitForMQTTResponse = (
//   topic: string,
//   expectedMessage: string,
//   timeout: number = 10000
// ) => {
//   return new Promise<void>((resolve, reject) => {
//     const timeoutHandle = setTimeout(() => {
//       mqttEvents.removeListener(topic, listener);
//       reject(new Error(`Timeout waiting for response on ${topic}`));
//     }, timeout);

//     const listener = (message: string) => {
//       if (message === expectedMessage) {
//         clearTimeout(timeoutHandle);
//         mqttEvents.removeListener(topic, listener);
//         resolve();
//       }
//     };

//     mqttEvents.on(topic, listener);
//   });
// };
