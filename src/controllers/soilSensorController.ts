import logger from "../lib/logger";
import supabase from "../lib/supabase";
import { publishMQTT } from "../mqttClient";
import admin from "../lib/firebase";

export async function handleSoilSensorMessage(
  topic: string,
  messageStr: string
) {
  const macAddress = topic.split("/")[2];
  const payload = JSON.parse(messageStr);

  try {
    logger.info(`Handling soil sensor message from ${macAddress}}`);

    const { data: sensors } = await supabase
      .from("sensors")
      .select("sensor_id, sensor_type, sensor_category")
      .eq("mac_address", macAddress);

    if (!sensors || sensors.length === 0) {
      logger.warn(`No sensors found for MAC address: ${macAddress}`);
      return;
    }

    const read_time = new Date()
      .toLocaleString("en-US", { timeZone: "Asia/Manila" })
      .toString();

    for (const sensor of sensors) {
      const { sensor_id, sensor_type, sensor_category } = sensor;
      const sensorData = payload[sensor_type];
      if (sensorData === undefined) continue;

      logger.info(`Received data for sensor ${sensor_type} (${sensorData})`);

      const { data: plots } = await supabase
        .from("user_plot_sensors")
        .select("plot_id")
        .eq("sensor_id", sensor_id);

      if (!plots || plots.length === 0) {
        logger.warn(`No plots found for sensor ID: ${sensor_id}`);
        continue;
      }

      const plot_id = plots[0].plot_id;

      //SAVING OF THE READINGS
      if (sensor_category === "Moisture Sensor") {
        // await supabase.from("moisture_readings").insert({
        //   sensor_id,
        //   plot_id,
        //   read_time,
        //   soil_moisture: sensorData,
        // });

        logger.info(`Inserted moisture reading for sensor ${sensor_id}`);
      } else if (sensor_category === "Nutrient Sensor") {
        const { nitrogen, phosphorus, potassium } = sensorData;
        if (nitrogen && phosphorus && potassium) {
          // await supabase.from("nutrient_readings").insert({
          //   sensor_id,
          //   plot_id,
          //   read_time,
          //   readed_nitrogen: nitrogen,
          //   readed_phosphorus: phosphorus,
          //   readed_potassium: potassium,
          // });
          logger.info(
            `Saved nutrient readings for plot ${plot_id} from sensor ${sensor_id}`
          );
        }
      }

      if (sensor_category === "Moisture Sensor") {
        const { data: cropData } = await supabase
          .from("user_crops")
          .select("moisture_min")
          .eq("plot_id", plot_id)
          .single();

        const { data: plotData } = await supabase
          .from("user_plots")
          .select("valve_tagging, isValveOn, irrigation_type")
          .eq("plot_id", plot_id)
          .single();

        if (!cropData || !plotData) continue;

        if (plotData.irrigation_type !== "AUTO") {
          logger.info(
            `Skipping automatic irrigation for plot ${plot_id} as it is not set to AUTO mode.`
          );
          continue;
        }

        const { valve_tagging, isValveOn } = plotData;
        const moistureBelowThreshold = sensorData < cropData.moisture_min;

        const { data: isPumpOnManually } = await supabase
          .from("iot_device")
          .select("isPumpOnManually")
          .eq("mac_address", macAddress);

        if (isPumpOnManually && isPumpOnManually[0]?.isPumpOnManually) {
          logger.info(`Pump is manually turned ON for device ${macAddress}`);
          return;
        }

        if (moistureBelowThreshold) {
          logger.warn(
            `Moisture level below threshold for plot ${plot_id}. Current moisture: ${sensorData}, Threshold: ${cropData.moisture_min}`
          );

          await publishMQTT(
            `soiltrack/device/${macAddress}/irrigation/automatic`,
            JSON.stringify({
              action: "ON",
              plot_id,
              reason: "LOW MOISTURE",
              valve_tag: valve_tagging,
            })
          );

          if (!isValveOn) {
            try {
              await supabase
                .from("user_plots")
                .update({ isValveOn: true })
                .eq("plot_id", plot_id);

              logger.info(`Valve turned ON for plot ${plot_id}`);
              logger.info(`Updating iot_device for MAC}`);

              await supabase
                .from("iot_device")
                .update({ isPumpOn: true })
                .eq("mac_address", macAddress);

              const { data: userPlotData, error } = await supabase
                .from("user_plots")
                .select("user_id")
                .eq("plot_id", plot_id)
                .single();

              if (error || !userPlotData) {
                logger.warn(`No user found for plot ${plot_id}`);
              } else {
                const userId = userPlotData.user_id;

                const { data: users, error: userError } = await supabase
                  .from("users")
                  .select("device_token")
                  .eq("user_id", userId)
                  .not("device_token", "is", null);

                if (userError || !users || users.length === 0) {
                  logger.warn(`No device tokens found for user ${userId}`);
                } else {
                  const tokens = users
                    .map((u) => u.device_token)
                    .filter(Boolean);

                  if (tokens.length > 0) {
                    const message = {
                      notification: {
                        title: "Irrigation Activated",
                        body: `Irrigation valve turned ON for your plot ${plot_id} due to low soil moisture.`,
                      },
                      tokens: tokens,
                    };

                    const response = await admin
                      .messaging()
                      .sendEachForMulticast(message);
                    logger.info(
                      `Sent notification to user ${userId}: Success=${response.successCount}, Failure=${response.failureCount}`
                    );
                  }
                }
              }
            } catch (err) {
              logger.error(`Failed to send notification: ${err}`);
            }
          }
        } else {
          if (isValveOn) {
            await publishMQTT(
              `soiltrack/device/${macAddress}/irrigation/automatic`,
              JSON.stringify({
                action: "OFF",
                plot_id,
                reason: "MOISTURE SUFFICIENT",
                valve_tag: valve_tagging,
              })
            );
            await supabase
              .from("user_plots")
              .update({ isValveOn: false })
              .eq("plot_id", plot_id);

            await supabase
              .from("iot_device")
              .update({ isPumpOn: false })
              .eq("mac_address", macAddress);

            logger.info(`Valve turned OFF for plot ${plot_id}`);
          }
        }
      }
    }

    const { data: activeValves } = await supabase
      .from("user_plots")
      .select("plot_id")
      .eq("isValveOn", true);

    let needsWater = false;
    for (const { plot_id } of activeValves || []) {
      const { data: sensors } = await supabase
        .from("user_plot_sensors")
        .select("sensor_id")
        .eq("plot_id", plot_id);

      const sensorIds = sensors?.map((s) => s.sensor_id) || [];

      const { data: moistureTypes } = await supabase
        .from("soil_sensors")
        .select("sensor_type")
        .in("sensor_id", sensorIds)
        .eq("sensor_category", "Moisture Sensor");

      const { data: cropData } = await supabase
        .from("user_crops")
        .select("moisture_min")
        .eq("plot_id", plot_id)
        .single();

      if (!moistureTypes || !cropData) continue;

      if (
        moistureTypes.some(
          (s) => payload[s.sensor_type] < cropData.moisture_min
        )
      ) {
        needsWater = true;
        logger.info(
          `Plot ${plot_id} still needs water based on moisture readings.`
        );
        break;
      }
    }

    if (!needsWater) {
      await publishMQTT(
        `soiltrack/device/${macAddress}/irrigation/automatic`,
        JSON.stringify({
          action: "OFF",
          plot_id: null,
          reason: "ALL VALVES CLOSED",
        })
      );
      logger.info(`All valves are closed. No plots need water.`);
    }
  } catch (error) {
    console.error("❌ Error processing soil sensor message:", error);
  }
}
