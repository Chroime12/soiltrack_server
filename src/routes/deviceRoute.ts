import { Router, Request, Response } from "express";
import {
  publishMQTT,
  subscribeToTopics,
  waitForMQTTResponse,
} from "../mqttClient";

const router = Router();

router.post(
  "/reset-wifi",
  async (req: Request, res: Response): Promise<void> => {
    console.log("🔄 Reset Request Sent");
    try {
      await publishMQTT("soiltrack/reset", "RESET_WIFI");
      await waitForMQTTResponse("soiltrack/reset/status", "RESET_SUCCESS");
      res.json({ message: "Device reset successfully" });
    } catch (error) {
      res.status(500).json({ message: "Error resetting device" });
    }
  }
);

router.post(
  "/send-api-key",
  async (req: Request, res: Response): Promise<void> => {
    const { mac_address, api_key }: { mac_address: string; api_key: string } =
      req.body;

    if (!mac_address || !api_key) {
      res.status(400).json({ message: "Missing Parameters" });
      return;
    }

    const publishTopic = `soiltrack/device/${mac_address}/api-key`;
    console.log(`📡 Sending API Key to ESP32 on topic: ${publishTopic}`);

    try {
      await publishMQTT(publishTopic, api_key);
      const response = await waitForMQTTResponse(
        "soiltrack/device/api-key/status",
        "SAVED"
      );

      if (response === "SAVED") {
        res.json({ message: "API Key sent and saved successfully" });
      } else {
        res.status(400).json({ message: "ESP32 MAC Address Mismatch" });
      }
    } catch (error) {
      console.error("❌ Error waiting for ESP32 response:", error);
      res.status(500).json({ message: "No response from ESP32." });
    }
  }
);

router.post(
  "/get-sensors",
  async (req: Request, res: Response): Promise<void> => {
    const { mac_address }: { mac_address: string } = req.body;

    if (!mac_address) {
      res.status(400).json({ message: "Missing MAC address" });
      return;
    }

    const publishTopic = `soiltrack/device/${mac_address}/get-sensors`;
    const responseTopic = `soiltrack/device/${mac_address}/get-sensors/response`;

    console.log(`📡 Requesting sensor count on topic: ${publishTopic}`);

    try {
      await publishMQTT(publishTopic, "");

      const sensorData = await waitForMQTTResponse(responseTopic);

      const payload = JSON.parse(sensorData);

      if (!payload.active_sensors) {
        throw new Error(
          "Invalid response from ESP32: Missing active_sensors key"
        );
      }

      res.json({
        message: "Sensor count retrieved successfully",
        active_sensors: payload.active_sensors,
      });
    } catch (error) {
      console.error("❌ Error getting sensor count:", error);
      res.status(500).json({ message: "Failed to retrieve sensor count." });
    }
  }
);

export default router;
