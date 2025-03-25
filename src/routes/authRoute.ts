import { Router, Request, Response } from "express";

const authRouter = Router();

authRouter.get("/reset-password", (req: Request, res: Response) => {
  const token = req.query.token as string;

  if (!token) {
    res.status(400).json({ message: "Token is required" });
    return;
  }

  const deepLink = `soiltrack://reset-password?token=${token}`;

  res.redirect(deepLink);
});

export default authRouter;
