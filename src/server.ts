import express, { Request, Response } from "express";
import cors from "cors";
import bodyParser from "body-parser";
import dotenv from "dotenv";
import mqtt from "mqtt";

dotenv.config();

const app = express();
app.use(cors());
app.use(bodyParser.json());

const MQTT_BROKER =
  "mqtts://492fff856e4e41edb7fdca124aca8f56.s1.eu.hivemq.cloud";
const MQTT_USERNAME = "Chroime";
const MQTT_PASSWORD = "Secret12";

const client = mqtt.connect(MQTT_BROKER, {
  username: MQTT_USERNAME,
  password: MQTT_PASSWORD,
});

client.on("connect", () => {
  console.log("Connected to MQTT Broker");

  const topic = "soiltrack/test";

  client.subscribe(topic, (err) => {
    if (err) {
      console.log(`Subscription error: ${err}`);
    } else {
      console.log(`Subscribed to topic: ${topic}`);
    }
  });
});

client.on("message", (topic, message) => {
  console.log(`📩 Received message on topic '${topic}': ${message.toString()}`);

  try {
    console.log("🛠 Raw Message Data:", message); // Debugging raw message

    const data = JSON.parse(message.toString());
    console.log("✅ Parsed Data:", data); // Check what gets parsed

    if (data.moisture !== undefined) {
      console.log(`🌱 Soil Moisture: ${data.moisture}%`);
    } else {
      console.warn("⚠️ Moisture key missing in received data:", data);
    }
  } catch (error) {
    console.error("❌ Error parsing message:", error);
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
