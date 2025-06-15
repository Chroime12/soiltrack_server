import { sendTestPushNotification } from "../controllers/soilSensorController";
import * as dotenv from "dotenv";
import supabase from "../lib/supabase";

dotenv.config();

async function testSoilSensor() {
  const topic = "soiltrack/device/94:54:C5:B7:F2:34/soil";
  const message = JSON.stringify({
    moisture: 18,
    nutrient: {
      nitrogen: 5,
      phosphorus: 3,
      potassium: 4,
    },
  });

  try {
    await sendTestPushNotification(
      "cbqQwfReQiKZ6rCWrRhiDs:APA91bFs_UsWK3CLEFnS6caDedlPuG4lTScEaS_clDLv7vx1sRmxyx_SWWL8J5T4t_dVJY2k_miIyKLGurxWnZHLqsPpu2adgLZ-UNqbSUvgh2vjdhrVLRk"
    );
    console.log("✅ Test completed.");
  } catch (err) {
    console.error("❌ Error during test:", err);
  }
}

testSoilSensor();
