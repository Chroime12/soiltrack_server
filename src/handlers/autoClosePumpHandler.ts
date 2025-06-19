import { updatePumpStatus } from "../services/sensorService";

export async function handleAutoClosePumpMessage(
  topic: string,
  messageStr: string
) {
  const macAddress = topic.split("/")[2];
  console.log(
    "\n======================= 🚰 PUMP AUTO-CLOSE MESSAGE ======================="
  );
  console.log(`📡 MAC Address: ${macAddress}`);
  updatePumpStatus(macAddress, false);
}
