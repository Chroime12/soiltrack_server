import { publishMQTT } from "../../mqttClient";
import {
  updateValveStatus,
  updatePumpStatus,
  saveIrrigationLog,
  sendIrrigationNotification,
  stopIrrigationLog,
} from "../../services/sensorService";

interface StopIrrigationParams {
  plot_id: number;
  macAddress: string;
  start_time: string;
  duration_minutes: number;
  valve_tagging: string;
  user_id: string;
  dateInPHT: Date;
}

export const stopIrrigation = async ({
  plot_id,
  macAddress,
  start_time,
  duration_minutes,
  valve_tagging,
  user_id,
  dateInPHT,
}: StopIrrigationParams) => {
  const message = `Irrigation started for plot ${plot_id} at ${start_time}. Duration: ${duration_minutes} minutes.`;

  await publishMQTT(
    `soiltrack/device/${macAddress}/irrigation/automatic`,
    JSON.stringify({
      action: "OFF",
      plot_id,
      reason: "SCHEDULED DURATION ENDED",
      valve_tag: valve_tagging,
      valve_only: false,
    })
  );

  await updateValveStatus(plot_id, false);
  await updatePumpStatus(macAddress, false);
  await stopIrrigationLog(
    macAddress,
    plot_id,
    dateInPHT.toISOString(),
    message,
    user_id
  );

  console.info(
    `🛑 Valve turned OFF for plot ${plot_id} after scheduled duration.`
  );

  await sendIrrigationNotification({
    plotId: plot_id,
    title: "Irrigation Deactivated",
    reason: "Scheduled irrigation duration ended",
  });
};
