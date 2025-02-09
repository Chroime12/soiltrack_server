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

client.on("connect", () => {
  console.log("Connected to MQTT Broker");

  const topic = "soiltrack/moisture";

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
    const data = JSON.parse(message.toString());
    console.log(`🛠 Raw Message Data:`, message);

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
  console.log("🔄 Reset request received, sending MQTT command...");

  // Publish reset command
  client.publish("soiltrack/reset", "RESET_WIFI", (err) => {
    if (err) {
      console.error("❌ Error publishing reset command:", err);
      return res.status(500).json({ message: "Error resetting device" });
    }
    console.log("📡 Reset command sent, waiting for ESP32 response...");

    // Wait for ESP32 confirmation
    const timeout = setTimeout(() => {
      console.error("❌ Device did not respond to reset command");
      res
        .status(500)
        .json({ message: "ESP32 reset timeout. No response received." });
    }, 10000); // Timeout after 10 seconds

    // Listen for response from ESP32
    const onMessage = (topic: string, message: Buffer) => {
      if (
        topic === "soiltrack/reset/status" &&
        message.toString() === "RESET_SUCCESS"
      ) {
        console.log("✅ Reset confirmation received from ESP32!");
        clearTimeout(timeout); // Cancel timeout
        res.json({ message: "ESP32 successfully reset!" });

        // Unsubscribe from event after handling response
        client.removeListener("message", onMessage);
      }
    };

    client.on("message", onMessage);
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
