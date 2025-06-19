import { publishMQTT } from "../../mqttClient";
import {
  updateValveStatus,
  updatePumpStatus,
  saveIrrigationLog,
  sendIrrigationNotification,
} from "../../services/sensorService";

interface StartIrrigationParams {
  plot_id: number;
  macAddress: string;
  start_time: string;
  duration_minutes: number;
  valve_tagging: string;
  user_id: string;
  dateInPHT: Date;
  isValveOn: boolean;
}

export const startIrrigation = async ({
  plot_id,
  macAddress,
  start_time,
  duration_minutes,
  valve_tagging,
  user_id,
  dateInPHT,
  isValveOn,
}: StartIrrigationParams) => {
  const message = `Irrigation started for plot ${plot_id} at ${start_time}. Duration: ${duration_minutes} minutes.`;

  await publishMQTT(
    `soiltrack/device/${macAddress}/irrigation/automatic`,
    JSON.stringify({
      action: "ON",
      plot_id,
      reason: "SCHEDULED IRRIGATION",
      valve_tag: valve_tagging,
      valve_only: false,
    })
  );

  if (!isValveOn) {
    await updateValveStatus(plot_id, true);
    await saveIrrigationLog(
      macAddress,
      plot_id,
      dateInPHT.toISOString(),
      message,
      user_id
    );
    await sendIrrigationNotification({
      plotId: plot_id,
      title: "Irrigation Activated",
      reason: `Scheduled (${start_time})`,
    });
  }
};
