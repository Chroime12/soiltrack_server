import { Router, Request, Response } from "express";
import os from "os-utils";
import supabase from "../lib/supabase";

const router = Router();

function getServerMetrics(): Promise<{
  cpuUsagePercent: number;
  freeMemory: number;
  totalMemory: number;
  systemUptimeSeconds: number;
  loadAverage: number;
}> {
  return new Promise((resolve) => {
    os.cpuUsage((cpu: number) => {
      resolve({
        cpuUsagePercent: parseFloat((cpu * 100).toFixed(2)),
        freeMemory: os.freemem(),
        totalMemory: os.totalmem(),
        systemUptimeSeconds: os.sysUptime(),
        loadAverage: os.loadavg(),
      });
    });
  });
}

export async function logServerMetricsToSupabase() {
  const metrics = await getServerMetrics();
  try {
    const { error } = await supabase.from("server_metrics").insert([
      {
        cpu_usage: metrics.cpuUsagePercent,
        free_memory: metrics.freeMemory,
        total_memory: metrics.totalMemory,
        system_uptime: metrics.systemUptimeSeconds,
        load_average: metrics.loadAverage,
      },
    ]); // Ensure the load average is not logged to avoid potential issues with large numbers

    if (error) {
      const errorDetails =
        typeof error === "object" && error !== null
          ? JSON.stringify(error, Object.getOwnPropertyNames(error))
          : String(error);
      throw new Error(
        `Failed to log server metrics to Supabase: ${errorDetails}`
      );
    }
  } catch (error) {
    throw new Error(
      `Failed to log server metrics to Supabase: ${
        error instanceof Error ? error.stack || error.message : String(error)
      }`
    );
  }
}

router.get("/get-metrics", async (req: Request, res: Response) => {
  const metrics = await getServerMetrics();
  res.json({
    cpuUsagePercent: metrics.cpuUsagePercent,
    freeMemory: metrics.freeMemory,
    totalMemory: metrics.totalMemory,
    systemUptimeSeconds: metrics.systemUptimeSeconds,
    loadAverage: metrics.loadAverage,
  });
});

export default router;
