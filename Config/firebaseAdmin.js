import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

let app;
let auth;

const apps = getApps();
if (!apps.length) {
  try {
    let credentialOption;
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
      credentialOption = cert(serviceAccount);
    } else if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_PRIVATE_KEY) {
      credentialOption = cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
      });
    }

    app = initializeApp({
      projectId: process.env.FIREBASE_PROJECT_ID || "touch-live-7a1f8",
      ...(credentialOption && { credential: credentialOption }),
    });
    auth = getAuth(app);
    console.log("🔥 Firebase Admin initialized successfully");
  } catch (error) {
    console.warn("⚠️ Firebase Admin initialization warning:", error.message);
    if (apps.length > 0) {
      app = apps[0];
      try {
        auth = getAuth(app);
      } catch (_) {}
    }
  }
} else {
  app = apps[0];
  auth = getAuth(app);
}

export { app, auth };
export default {
  app,
  auth: () => auth,
};
