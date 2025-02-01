import express, { Request, Response } from "express";
import cors from "cors";
import bodyParser from "body-parser";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(cors());
app.use(bodyParser.json());

interface MoistureData {
  value: number;
  timeStamp: Date | null;
}

let moistureData: MoistureData = { value: 0, timeStamp: null };

app.post("/update-moisture", (req: Request, res: Response) => {
  const { value } = req.body;
  moistureData = { value, timeStamp: new Date() };
  res.json(moistureData);
});

app.get("/moisture", (req: Request, res: Response) => {
  res.json(moistureData);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
