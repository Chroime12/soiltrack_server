import cron from "node-cron";
import { handleScheduledIrrigation } from "../handlers/irrigation/checkIrrigationSchedule";
import { logServerMetricsToSupabase } from "../routes/serverMetricsRoute";

cron.schedule("* * * * *", async () => {
  try {
    console.log("🕒 CRON: Checking irrigatioan schedule...");
    await handleScheduledIrrigation();
  } catch (err) {
    console.error("❌ Error during scheduled irrigation:", err);
  }
});

cron.schedule("*/5 * * * *", async () => {
  try {
    console.log("🕒 CRON: Logging server metrics...");
    logServerMetricsToSupabase();
  } catch (error) {
    console.error("❌ Error during 5-minute interval task:", error);
  }
});
