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
      res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Email Verified</title>
            <style>
                body {
                    margin: 0;
                    padding: 0;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    height: 100vh;
                    font-family: Arial, sans-serif;
                    background-color: #f4f7fc;
                }
                .container {
                    background: #fff;
                    padding: 30px 40px;
                    border-radius: 10px;
                    box-shadow: 0 8px 20px rgba(0, 0, 0, 0.1);
                    text-align: center;
                    max-width: 500px;
                    width: 100%;
                }
                h1 {
                    color: #333;
                    margin-bottom: 20px;
                }
                p {
                    color: #666;
                    font-size: 16px;
                    margin-bottom: 20px;
                }
                a {
                    display: inline-block;
                    margin-top: 10px;
                    padding: 12px 24px;
                    background-color: #4CAF50;
                    color: #fff;
                    text-decoration: none;
                    border-radius: 6px;
                    font-size: 16px;
                    transition: background-color 0.3s ease;
                }
                a:hover {
                    background-color: #45a049;
                }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>Email Verified!</h1>
                <p>Thank you for confirming your email address.<br>You can now proceed to login and start using our service.</p>
            </div>
        </body>
        </html>
      `);
    } catch (error) {
      res.status(500).json({ message: "Error processing email verification" });
    }
  }
);

export default authRouter;
