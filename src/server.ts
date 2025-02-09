import express from "express";
import type { Request, Response } from "express";
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

let resetMessageReceived = false;

client.on("connect", () => {
  console.log("Connected to MQTT Broker");

  const topics = ["soiltrack/moisture", "soiltrack/reset/status"];

  client.subscribe(topics, (err) => {
    if (err) {
      console.log(`Subscription error: ${err}`);
    } else {
      console.log(`Subscribed to topic: ${topics.join(", ")}`);
    }
  });
});

client.on("message", (topic, message) => {
  const messageStr = message.toString().trim();
  console.log(`📩 Received message on topic '${topic}': ${message.toString()}`);

  if (topic === "soiltrack/reset/status") {
    if (messageStr === "RESET_SUCCESS") {
      console.log(`✅ ESP32 responded with: ${messageStr}`);
      resetMessageReceived = true;
    }
    return;
  }

  try {
    const data = JSON.parse(messageStr);

    if (!("moisture1" in data) || !("moisture2" in data)) {
      console.warn(
        `⚠️ Moisture1 or Moisture2 key missing in received data:`,
        data
      );
    } else {
      console.log(`✅ Parsed Data:`, data);
      console.log(
        `🌱 Moisture 1: ${data.moisture1}% | 🌱 Moisture 2: ${data.moisture2}%`
      );
    }
  } catch (error) {
    console.error(`❌ Error parsing message: ${error}`);
  }
});

app.post("/toggle-pump", (req: Request, res: Response): void => {
  const { pumpStatus } = req.body;

  if (pumpStatus !== "ON" && pumpStatus !== "OFF") {
    res.status(400).json({ message: "Invalid pump status" });
    return;
  }

  client.publish("soiltrack/pump", pumpStatus, (err) => {
    if (err) {
      console.error(`❌ Error publishing pump status: ${err}`);
      return res.status(500).json({ message: "Error toggling pump" });
    }
    console.log(`🚰 Pump Command Sent: ${pumpStatus}`);
    res.json({ message: `Pump turned ${pumpStatus}` });
  });
});

app.post("/reset-wifi", (req: Request, res: Response): void => {
  console.log("🔄 Reset Request Sent");
  resetMessageReceived = false;

  client.publish("soiltrack/reset", "RESET_WIFI", (err) => {
    if (err) {
      console.error(`❌ Error publishing reset command: ${err}`);
      return res.status(500).json({ message: "Error resetting device" });
    }
  });

  let retries = 10;
  const checkInterval = setInterval(() => {
    if (resetMessageReceived) {
      clearInterval(checkInterval);
      return res.json({ message: "Device reset successfully" });
    }
    if (retries === 0) {
      clearInterval(checkInterval);
      return res.status(500).json({ message: "No response from device." });
    }
    retries--;
  }, 1000);
});

app.post("/send-api-key", (req: Request, res: Response): void => {
  const { mac_address, api_key } = req.body;

  if (!mac_address || !api_key) {
    res.status(400).json({ message: "Missing Parameters" });
    return;
  }

  const publishTopic = `soiltrack/device/${mac_address}/api-key`;
  const responseTopic = "soiltrack/device/api-key/status";

  console.log(`📡 Sending API Key to ESP32 on topic: ${publishTopic}`);
  let apiKeySaved = false;

  client.publish(publishTopic, api_key, (err) => {
    if (err) {
      console.error("❌ Error sending API Key:", err);
      return res.status(500).json({ message: "Error sending API Key" });
    }
  });

  let retries = 10;
  const checkInterval = setInterval(() => {
    if (apiKeySaved) {
      clearInterval(checkInterval);
      return res.json({ message: "API Key saved successfully!" });
    }

    if (retries === 0) {
      clearInterval(checkInterval);
      return res.status(500).json({ message: "No response from ESP32." });
    }

    retries--;
  }, 1000);

  client.on("message", (topic, message) => {
    if (topic === responseTopic && message.toString().trim() === "SAVED") {
      console.log("✅ ESP32 confirmed API Key saved.");
      apiKeySaved = true;
    }
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
