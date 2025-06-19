import supabase from "../lib/supabase";
import { publishMQTT } from "../mqttClient";
import {
  getCropData,
  getPlotData,
  getPlotId,
  getSensors,
  saveIrrigationLog,
  saveMoistureReadings,
  saveNutrientReading,
  sendIrrigationNotification,
  stopIrrigationLog,
  updatePumpStatus,
  updateValveStatus,
} from "../services/sensorService";

export async function handleSoilSensorMessage(
  topic: string,
  messageStr: string
) {
  const macAddress = topic.split("/")[2];

  console.log(
    "\n======================= 🌱 NEW SENSOR MESSAGE ======================="
  );
  console.log(`📡 MAC Address: ${macAddress}`);
  console.log(
    `🕒 Time: ${new Date().toLocaleString("en-US", {
      timeZone: "Asia/Manila",
    })}`
  );
  console.log(
    "====================================================================\n"
  );

  const payload = JSON.parse(messageStr);

  const read_time = payload.timestamp
    ? new Date(payload.timestamp).toLocaleString("en-US", {
        timeZone: "Asia/Manila",
      })
    : new Date().toLocaleString("en-US", {
        timeZone: "Asia/Manila",
      });

  delete payload.timestamp;
  let processedMoistureSensor = false;
  let notificationMessage;

  try {
    const sensors = await getSensors(macAddress);

    if (!sensors || sensors.length === 0) {
      console.warn(`No sensors found for MAC address: ${macAddress}`);
      return;
    }

    const now = Date.now();
    const THIRTY_MINUTES = 10 * 60 * 1000;
    const THIRTY_MINUTES_NPK = 10 * 60 * 1000;

    for (const { sensor_id, sensor_type, sensor_category } of sensors) {
      const sensorData = payload[sensor_type];
      if (sensorData === undefined) continue;

      const plot_id = await getPlotId(sensor_id);
      if (!plot_id) {
        console.warn(`⚠️ Skipping sensor ${sensor_id} — no plot assigned`);
        continue;
      }

      const plotData = await getPlotData(plot_id);
      if (!plotData) {
        console.warn(`⚠️ Skipping plot ${plot_id} — no plot data`);
        continue;
      }

      const cropData = await getCropData(plot_id);
      if (!cropData) {
        console.warn(
          `⚠️ No crop data for plot ${plot_id}, skipping irrigation only`
        );
      }

      const { data: sensorRecord } = await supabase
        .from("soil_sensors")
        .select("last_data_saved")
        .eq("sensor_id", sensor_id)
        .maybeSingle();

      const lastSaveTime = sensorRecord?.last_data_saved
        ? new Date(sensorRecord.last_data_saved).getTime()
        : 0;

      // const isAutomated = plotData.irrigation_type === "Automated Irrigation";
      // const isIrrigating = plotData?.isValveOn;
      // const shouldSave =
      //   (isAutomated && isIrrigating) || now - lastSaveTime > THIRTY_MINUTES;

      const shouldSave = now - lastSaveTime > THIRTY_MINUTES;

      if (shouldSave) {
        if (sensor_category === "Moisture Sensor") {
          processedMoistureSensor = true;
          await saveMoistureReadings(sensor_id, plot_id, read_time, sensorData);
        } else if (sensor_category === "NPK Sensor") {
          const { N: nitrogen, P: phosphorus, K: potassium } = sensorData || {};

          if (
            nitrogen !== undefined &&
            phosphorus !== undefined &&
            potassium !== undefined
          ) {
            console.info(`💾 Saving nutrient data for plot ${plot_id}`);
            await saveNutrientReading(
              sensor_id,
              plot_id,
              read_time,
              nitrogen,
              phosphorus,
              potassium
            );
          }
        }

        await supabase
          .from("soil_sensors")
          .update({ last_data_saved: new Date().toISOString() })
          .eq("sensor_id", sensor_id);

        console.info(
          `💾 Saving data for sensor ${sensor_type} on plot ${plot_id} at ${read_time}`
        );
      } else {
        console.info(
          `⏳ Skipping save for sensor ${sensor_type} on plot ${plot_id} - last saved recently`
        );
      }

      if (sensor_category !== "Moisture Sensor" || !cropData) continue;

      if (plotData.irrigation_type !== "Automated Irrigation") continue;

      const { valve_tagging, isValveOn } = plotData;
      const moistureBelow = sensorData < cropData.moisture_min;

      if (moistureBelow) {
        await publishMQTT(
          `soiltrack/device/${macAddress}/irrigation/automatic`,
          JSON.stringify({
            action: "ON",
            plot_id,
            reason: "LOW MOISTURE",
            valve_tag: valve_tagging,
            valve_only: true,
          })
        );

        if (!isValveOn) {
          notificationMessage = `Irrigation started for plot ${plot_id} due to low soil moisture.`;
          await updateValveStatus(plot_id, true);
          console.info(`🌊 Valve turned ON for plot ${plot_id}`);
          await sendIrrigationNotification({
            plotId: plot_id,
            title: "Irrigation Activated",
            reason: "low soil moisture",
          });

          await saveIrrigationLog(
            macAddress,
            plot_id,
            new Date().toISOString(),
            notificationMessage,
            plotData.user_id
          );
        }
      } else {
        if (isValveOn) {
          notificationMessage = `Irrigation stopped for plot ${plot_id} as soil moisture is sufficient.`;
          await publishMQTT(
            `soiltrack/device/${macAddress}/irrigation/automatic`,
            JSON.stringify({
              action: "OFF",
              plot_id,
              reason: "MOISTURE SUFFICIENT",
              valve_tag: valve_tagging,
              valve_only: true,
            })
          );
          await sendIrrigationNotification({
            plotId: plot_id,
            title: "Irrigation Deactivated",
            reason: "sufficient soil moisture",
          });

          await updateValveStatus(plot_id, false);
          console.info(`✅ Valve turned OFF for plot ${plot_id}`);

          await stopIrrigationLog(
            macAddress,
            plot_id,
            new Date().toISOString(),
            notificationMessage,
            plotData.user_id
          );
        }
      }
    }
  } catch (error) {
    console.error(`❌ Error handling message from ${macAddress}: ${error}`);
  }
}
