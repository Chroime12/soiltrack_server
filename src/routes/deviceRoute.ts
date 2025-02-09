import { Router, Request, Response } from "express";
import { publishMQTT, waitForMQTTResponse } from "../mqttClient";

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

      const espResponse = await waitForMQTTResponse(
        "soiltrack/device/api-key/status"
      );

      console.log(`✅ ESP32 Response: ${espResponse}`);

      res.json({ message: `ESP32 Response: ${espResponse}` });
    } catch (error) {
      console.error("❌ Error waiting for ESP32 response:", error);
      res.status(500).json({ message: "No response from ESP32." });
    }
  }
);

export default router;
