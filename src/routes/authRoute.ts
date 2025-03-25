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

      res.send(`
        <html>
        <head>
            <title>Redirecting...</title>
            <script>
                window.location.href = "${deepLink}";
            </script>
        </head>
        <body>
            <p>If you are not redirected, <a href="${deepLink}">click here</a>.</p>
        </body>
        </html>
    `);
    } catch (error) {
      res.status(500).json({ message: "Error resetting device" });
    }
  }
);

export default authRouter;
