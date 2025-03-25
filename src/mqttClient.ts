import mqtt from "mqtt";
import { EventEmitter } from "events";
import * as dotenv from "dotenv";
import supabase from "./lib/supabase";

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

mqttClient.on("message", async (topic, message) => {
  const messageStr = message.toString().trim();
  console.log(`📩 Received message on '${topic}': ${messageStr}`);

  mqttEvents.emit(topic, messageStr);

  if (topic.startsWith("soiltrack/device/") && topic.endsWith("/soil")) {
    const macAddress = topic.split("/")[2];
    const payload = JSON.parse(messageStr);

    try {
      const { data: sensors, error: sensorsError } = await supabase
        .from("soil_sensors")
        .select("sensor_id, sensor_type, sensor_category")
        .eq("mac_address", macAddress);

      if (sensorsError || !sensors || sensors.length === 0) {
        console.error(`❌ Error fetching sensor data:`, sensorsError);
        return;
      }

      const philippineTime = new Date().toLocaleString("en-US", {
        timeZone: "Asia/Manila",
      });

      for (const sensor of sensors) {
        const { sensor_id, sensor_type, sensor_category } = sensor;
        const sensorData = payload[sensor_type];
        console.log("Sensor Data is ", sensorData);

        if (sensorData == undefined) {
          console.warn(`⚠️ No data found for sensor ${sensor_type}`);
          continue;
        }

        const { data: plots, error: plotError } = await supabase
          .from("user_plot_sensors")
          .select("plot_id")
          .eq("sensor_id", sensor_id);

        if (plotError || !plots || plots.length === 0) {
          console.warn(`⚠️ No plot assigned to sensor ${sensor_id}`);
          continue;
        }

        const plot_id = plots[0].plot_id;

        if (sensor_category === "Moisture Sensor") {
          const { error: moistureError } = await supabase
            .from("moisture_readings")
            .insert({
              read_time: philippineTime,
              soil_moisture: sensorData,
              plot_id,
              sensor_id,
            });

          if (moistureError) {
            console.error(
              `❌ Error inserting moisture reading:`,
              moistureError
            );
          }
        } else if (
          sensor_category === "NPK Sensor" &&
          typeof sensorData === "object"
        ) {
          const {
            N: readed_nitrogen,
            P: readed_phosphorus,
            K: readed_potassium,
          } = sensorData;

          const { error: nutrientError } = await supabase
            .from("nutrient_readings")
            .insert({
              read_time: philippineTime,
              readed_nitrogen,
              readed_phosphorus,
              readed_potassium,
              plot_id,
              sensor_id,
            });

          if (nutrientError) {
            console.error(
              `❌ Supabase nutrient insert error:`,
              JSON.stringify(nutrientError, null, 2)
            );
          }
        }
      }
    } catch (e) {
      console.error(`❌ Error processing sensor data:`, e);
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
