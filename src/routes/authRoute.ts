import { Router, Request, Response } from "express";

const authRouter = Router();

authRouter.get(
  "/reset-wifi",
  async (req: Request, res: Response): Promise<void> => {
    console.log("🔄 Reset Request Sent");
    try {
      const token = req.query.token as string;
      if (!token) {
        res.status(400).json({ message: "Token is required" });
      }

      const deepLink = `soiltrack://reset-password?token=${token}`;

      res.json({
        message: "Use this deep link on a mobile device",
        deepLink,
      });
    } catch (error) {
      res.status(500).json({ message: "Error resetting device" });
    }
  }
);

export default authRouter;
