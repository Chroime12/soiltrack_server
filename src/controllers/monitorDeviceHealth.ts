import cron from "node-cron";
import supabase from "../lib/supabase";
import {
  publishMQTT,
  waitForMQTTResponse,
  subscribeToTopics,
} from "../mqttClient";
import admin from "../lib/firebase";

cron.schedule("5 * * * *", async () => {
  console.log("🔍 Checking for inactive devices...");

  const now = new Date();

  const { data: devices, error } = await supabase.from("iot_device").select(
    `mac_address,
        device_status,
        last_seen,
        last_notified,
        user_id,
        users:user_id (
        user_fname,
        device_token
        )
    `
  );

  if (error) {
    console.error("❌ Error fetching devices:", JSON.stringify(error, null, 2));
    return;
  }

  for (const device of devices || []) {
    const user = Array.isArray(device.users) ? device.users[0] : device.users;
    if (!user?.device_token) continue;

    const mac = device.mac_address;
    const checkEspTopic = `soiltrack/device/${mac}/check-device`;
    const responseEspTopic = `${checkEspTopic}/response`;
    const checkNanoTopic = `soiltrack/device/${mac}/check-nano`;
    const responseNanoTopic = `${checkNanoTopic}/response`;

    try {
      await subscribeToTopics([responseEspTopic, responseNanoTopic]);
      await new Promise((res) => setTimeout(res, 100));

      await publishMQTT(checkEspTopic, "PING");
      await publishMQTT(checkNanoTopic, "PING");

      const [espRes, nanoRes] = await Promise.allSettled([
        waitForMQTTResponse(responseEspTopic, "PONG", 5000),
        waitForMQTTResponse(responseNanoTopic, "NANO_PONG", 5000),
      ]);

      const espOk = espRes.status === "fulfilled" && espRes.value === "PONG";
      const nanoOk =
        nanoRes.status === "fulfilled" && nanoRes.value === "NANO_PONG";

      if (espOk && nanoOk) {
        console.log(`✅ Device ${mac} is fully active (ESP + Nano).`);

        await supabase
          .from("iot_device")
          .update({
            device_status: espOk && nanoOk ? "ONLINE" : "OFFLINE",
            last_seen:
              espOk && nanoOk ? new Date().toISOString() : device.last_seen,
          })
          .eq("mac_address", mac);
        continue;
      }

      console.warn(`⚠️ Device ${mac} is partially or fully offline.`);

      console.log("Raw last_notified:", device.last_notified);
      const lastNotified = device.last_notified
        ? new Date(device.last_notified)
        : null;

      if (lastNotified) {
        console.log("lastNotified local time:", lastNotified.toLocaleString());
      } else {
        console.log("lastNotified is null");
      }

      const cooldownExpired =
        !lastNotified ||
        now.getTime() - lastNotified.getTime() > 60 * 60 * 1000;

      console.log("Cooldown expired?", cooldownExpired);

      if (cooldownExpired) {
        const issue =
          !espOk && !nanoOk
            ? "ESP and Nano are offline"
            : !espOk
            ? "ESP is offline"
            : "Nano is offline";

        try {
          await admin.messaging().send({
            token: user.device_token,
            notification: {
              title: "🚨 Device Inactivity Alert",
              body: `Your device is offline: ${issue}.`,
            },
          });

          const { error: notificationError } = await supabase
            .from("notifications")
            .insert({
              user_id: device.user_id,
              notification_type: "WARNING",
              message:
                "Your device has been inactive for over an hour. Please check your device. It will result in a loss of data if not addressed.",
              is_read: false,
              notification_time: new Date(
                new Date().toLocaleString("en-US", { timeZone: "Asia/Manila" })
              ).toISOString(),
            });

          if (notificationError) {
            console.error(
              "❌ Failed to insert notification:",
              notificationError
            );
          }

          console.log(
            `📬 Notification sent to user ${user.user_fname} (${user.device_token}) about device ${mac} being offline.`
          );

          const { error: updateError } = await supabase
            .from("iot_device")
            .update({
              device_status: "OFFLINE",
              last_notified: now.toISOString(),
            })
            .eq("mac_address", mac);

          if (updateError) {
            console.error("❌ Failed to update last_notified:", updateError);
          }
        } catch (err) {
          console.error(`Failed to send notification: ${err}`);
        }
      } else {
        console.log(`⏱️ Notification for ${mac} suppressed (cooldown active)`);
      }
    } catch (error) {
      console.warn(`⚠️ No PONG from ${mac}, treating as offline`);
    }
  }
});
