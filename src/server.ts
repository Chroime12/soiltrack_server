import express from "express";
import type { Request, Response } from "express";
import cors from "cors";
import bodyParser from "body-parser";
import dotenv from "dotenv";
import deviceRoutes from "./routes/deviceRoute";
import "./mqttClient";

dotenv.config();

const app = express();
app.use(cors());
app.use(bodyParser.json());

app.use("/device", deviceRoutes);
app.use("/soiltrack", deviceRoutes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
