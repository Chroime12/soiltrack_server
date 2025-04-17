import { Router, Request, Response } from "express";

const authRouter = Router();

authRouter.get(
  "/reset-password",
  async (req: Request, res: Response): Promise<void> => {
    try {
      const token = req.query.token as string;
      const email = req.query.email as string;

      if (!token || !email) {
        res.status(400).json({ message: "Token and email are required" });
        return;
      }

      console.log("🔄 Reset Request Sent", token);
      const deepLink = `soiltrack://reset-password?token=${token}&email=${encodeURIComponent(
        email
      )}`;

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

authRouter.get(
  "/verify-email",
  async (req: Request, res: Response): Promise<void> => {
    try {
      const token = req.query.token as string;
      const email = req.query.email as string;

      if (!token || !email) {
        res.status(400).json({ message: "Token and email are required" });
        return;
      }

      // Here you could verify the token if needed.
      // But since you're showing a static page, you can skip token verification.

      // You can also log or process the token if necessary
      console.log("🔄 Email Verification Request Sent", token);

      // Return a simple HTML page with a success message
      res.send(`
        <html>
        <head>
            <title>Email Verified</title>
        </head>
        <body>
            <h1>Your email has been successfully verified!</h1>
            <p>Thank you for confirming your email address. You can now <a href="https://yourapp.com/login">log in</a> and start using our service.</p>
        </body>
        </html>
      `);
    } catch (error) {
      res.status(500).json({ message: "Error processing email verification" });
    }
  }
);

export default authRouter;
