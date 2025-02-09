import express from "express";
import type { Request, Response } from "express";
import cors from "cors";
import bodyParser from "body-parser";
import dotenv from "dotenv";
import mqtt from "mqtt";
import deviceRoutes from "./routes/deviceRoute";

dotenv.config();

const app = express();
app.use(cors());
app.use(bodyParser.json());

app.use("/device", deviceRoutes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
