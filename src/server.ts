import express from "express";
import type { Request, Response } from "express";
import cors from "cors";
import bodyParser from "body-parser";
import dotenv from "dotenv";
import deviceRoutes from "./routes/deviceRoute";
import "./mqttClient";
import authRouter from "./routes/authRoute";
import "./lib/firebase";
import "./controllers/monitorDeviceHealth";
import serverMetricsRoute from "./routes/serverMetricsRoute";
import "./jobs/scheduler";

dotenv.config();

const app = express();
app.use(cors());
app.use(bodyParser.json());

app.use("/auth", authRouter);
app.use("/device", deviceRoutes);
app.use("/soiltrack", deviceRoutes);
app.use("/server-metrics", serverMetricsRoute);

const PORT = process.env.PORT || 3500;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
