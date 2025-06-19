// src/jobs/scheduledIrrigation.ts
import supabase from "../../lib/supabase";
import {
  getMacAddress,
  getPlotData,
  saveIrrigationLog,
  sendIrrigationNotification,
  stopIrrigationLog,
  updatePumpStatus,
  updateValveStatus,
} from "../../services/sensorService";
import { publishMQTT } from "../../mqttClient";
import { startIrrigation } from "./startIrrigation";
import { stopIrrigation } from "./stopIrrigation";

export const handleScheduledIrrigation = async () => {
  let notificationMessage;
  console.log("💧 Checking irrigation schedules...");
  const nowInPHT = new Date().toLocaleString("en-US", {
    timeZone: "Asia/Manila",
  });
  const dateInPHT = new Date(nowInPHT);
  const now = new Date();

  const currentDay = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][
    now.getDay()
  ];

  const { data: schedules, error } = await supabase
    .from("irrigation_schedule")
    .select("*")
    .filter("days_of_week", "cs", `["${currentDay}"]`)
    .eq("is_enabled", true);

  if (error)
    throw new Error(
      `❌ Failed to fetch irrigation schedules: ${JSON.stringify(error)}`
    );

  for (const sched of schedules || []) {
    const {
      schedule_id,
      plot_id,
      start_time,
      duration_minutes,
      last_triggered,
    } = sched;
    const [h, m, s] = start_time.split(":").map(Number);
    const startDateTime = new Date(now);
    startDateTime.setHours(h, m, s || 0, 0);
    const endDateTime = new Date(
      startDateTime.getTime() + duration_minutes * 60 * 1000
    );

    const plotData = await getPlotData(plot_id);
    if (!plotData) {
      console.warn(`⚠️ Skipping plot ${plot_id} — no plot data`);
      continue;
    }

    const { valve_tagging, isValveOn, user_id, irrigation_type } = plotData;
    const macAddress = await getMacAddress(user_id);

    if (!macAddress) {
      console.warn(`⚠️ No MAC address for plot ${plot_id}`);
      continue;
    }

    if (irrigation_type !== "Scheduled Irrigation") continue;

    const lastTriggeredDate = last_triggered ? new Date(last_triggered) : null;
    const alreadyTriggeredToday =
      lastTriggeredDate &&
      lastTriggeredDate.toDateString() === now.toDateString();

    if (now >= startDateTime && now < endDateTime && !alreadyTriggeredToday) {
      await startIrrigation({
        plot_id,
        start_time,
        duration_minutes,
        macAddress,
        valve_tagging,
        isValveOn,
        user_id,
        dateInPHT,
      });
    } else if (now >= endDateTime && isValveOn) {
      await stopIrrigation({
        plot_id,
        duration_minutes,
        macAddress,
        valve_tagging,
        user_id,
        dateInPHT,
        start_time,
      });
    }
  }
};
