import admin from "../lib/firebase";
import logger from "../lib/logger";
import supabase from "../lib/supabase";

interface NotificationOptions {
  plotId: number;
  title: string;
  body?: string;
  reason?: string;
}

export async function getSensors(mac_address: string) {
  const { data } = await supabase
    .from("soil_sensors")
    .select("sensor_id, sensor_type, sensor_category")
    .eq("mac_address", mac_address);
  return data || [];
}

export async function getPlotId(sensor_id: string) {
  const { data } = await supabase
    .from("user_plot_sensors")
    .select("plot_id")
    .eq("sensor_id", sensor_id);
  return data?.[0]?.plot_id;
}

export async function getCropData(plotId: string) {
  const { data } = await supabase
    .from("user_crops")
    .select("moisture_min")
    .eq("plot_id", plotId)
    .single();
  return data;
}

export async function getPlotData(plot_id: string) {
  const { data } = await supabase
    .from("user_plots")
    .select("valve_tagging, isValveOn, user_id, irrigation_type")
    .eq("plot_id", plot_id)
    .single();
  return data;
}

export async function getMacAddress(user_id: string) {
  const { data } = await supabase
    .from("iot_device")
    .select("mac_address")
    .eq("user_id", user_id)
    .single();
  return data?.mac_address;
}

export async function isPumpManuallyOn(macAddress: string) {
  const { data } = await supabase
    .from("iot_device")
    .select("isPumpOnManually")
    .eq("mac_address", macAddress);
  return data?.[0]?.isPumpOnManually === true;
}

export async function updateValveStatus(plot_id: number, status: boolean) {
  await supabase
    .from("user_plots")
    .update({ isValveOn: status })
    .eq("plot_id", plot_id);
}

export async function updatePumpStatus(macAddress: string, status: boolean) {
  await supabase
    .from("iot_device")
    .update({ isPumpOn: status })
    .eq("mac_address", macAddress);
}

export async function sendIrrigationNotification({
  plotId,
  title,
  body,
  reason,
}: NotificationOptions) {
  const { data: userPlotData } = await supabase
    .from("user_plots")
    .select("user_id, plot_name")
    .eq("plot_id", plotId)
    .single();

  if (!userPlotData) return;

  const { data: users } = await supabase
    .from("users")
    .select("device_token")
    .eq("user_id", userPlotData.user_id)
    .not("device_token", "is", null);

  const tokens = users?.map((u) => u.device_token).filter(Boolean) || [];
  if (tokens.length === 0) return;

  const finalBody =
    body ||
    `Irrigation valve status changed for your plot ${userPlotData.plot_name}` +
      (reason ? ` due to ${reason}.` : ".");

  const message = {
    notification: {
      title,
      body: finalBody,
    },
    tokens,
  };

  const response = await admin.messaging().sendEachForMulticast(message);
  logger.info(
    `Notification sent: Success=${response.successCount}, Failure=${response.failureCount}`
  );
}

export async function saveMoistureReadings(
  sensor_id: string,
  plot_id: string,
  read_time: string,
  moisture: number
) {
  const { error } = await supabase.from("moisture_readings").insert({
    sensor_id,
    plot_id,
    read_time,
    soil_moisture: moisture,
  });

  if (error) {
    console.error(`❌ Failed to save moisture reading: ${error.message}`);
  } else {
    console.info(`💾 Moisture reading saved for sensor ${sensor_id}`);
  }
}

export async function saveNutrientReading(
  sensor_id: string,
  plot_id: string,
  read_time: string,
  nitrogen: number,
  phosphorus: number,
  potassium: number
) {
  const { error } = await supabase.from("nutrient_readings").insert({
    sensor_id,
    plot_id,
    read_time,
    readed_nitrogen: nitrogen,
    readed_phosphorus: phosphorus,
    readed_potassium: potassium,
  });

  if (error) {
    console.error(`❌ Failed to save nutrient reading: ${error.message}`);
  } else {
    console.info(`💾 Nutrient reading saved for sensor ${sensor_id}`);
  }
}

export async function saveIrrigationLog(
  mac_address: string,
  plot_id: number,
  time_started: string,
  notificationMessage: string,
  userId: string
) {
  const { error, status, statusText } = await supabase
    .from("irrigation_log")
    .insert({
      mac_address,
      plot_id,
      time_started,
    });

  const { error: notificationError } = await supabase
    .from("notifications")
    .insert({
      user_id: userId,
      message: `Irrigation started for plot ${plot_id}`,
      notification_type: notificationMessage,
      notification_time: time_started,
    });

  if (error) {
    console.error("❌ Failed to save irrigation log:");
    console.error("• Status:", status);
    console.error("• Status Text:", statusText);
    console.error("• Error Message:", error.message);
    console.error("• Error Details:", error.details);
    console.error("• Error Hint:", error.hint);
    console.error("• Full Error:", error);
  } else {
    console.info(`💾 Irrigation log saved for plot ${plot_id}`);
  }
}

export async function stopIrrigationLog(
  mac_address: string,
  plot_id: number,
  time_stopped: string,
  notificationMessage: string,
  userId: string
) {
  const { data, error } = await supabase
    .from("irrigation_log")
    .update({ time_stopped })
    .eq("mac_address", mac_address)
    .eq("plot_id", plot_id)
    .is("time_stopped", null)
    .select();

  const { error: notificationError } = await supabase
    .from("notifications")
    .insert({
      user_id: userId,
      message: `Irrigation started for plot ${plot_id}`,
      notification_type: notificationMessage,
      notification_time: time_stopped,
    });

  if (error) {
    console.error(`❌ Failed to stop irrigation log: ${error.message}`);
  } else if (!data || data.length === 0) {
    console.warn(`⚠️ No irrigation log row updated for plot ${plot_id}`);
  } else {
    console.info(
      `🛑 Irrigation log stopped for plot ${plot_id}, updated rows: ${data.length}`
    );
  }
}
