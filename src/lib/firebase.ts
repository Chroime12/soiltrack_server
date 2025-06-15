import admin from "firebase-admin";
import path from "path";

if (!admin.apps.length) {
  const serviceAccount = require(path.resolve(
    __dirname,
    "../assets/my-firebase-key.json"
  ));

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

export default admin;
