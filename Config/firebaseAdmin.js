import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

let app;
let auth;

const cleanPrivateKey = (rawKey) => {
  if (!rawKey) return "";
  let key = rawKey.trim();
  // Strip surrounding quotes if present (e.g. from env files)
  if ((key.startsWith('"') && key.endsWith('"')) || (key.startsWith("'") && key.endsWith("'"))) {
    key = key.slice(1, -1);
  }
  // Convert literal \n to actual newlines
  return key.replace(/\\n/g, "\n").trim();
};

const apps = getApps();
if (!apps.length) {
  try {
    let credentialOption;

    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      const raw = process.env.FIREBASE_SERVICE_ACCOUNT.trim();
      const serviceAccount = JSON.parse(raw);
      credentialOption = cert(serviceAccount);
    } else if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_PRIVATE_KEY) {
      const privateKey = cleanPrivateKey(process.env.FIREBASE_PRIVATE_KEY);
      credentialOption = cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey,
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
    try {
      app = initializeApp({
        projectId: process.env.FIREBASE_PROJECT_ID || "touch-live-7a1f8",
      });
      auth = getAuth(app);
    } catch (_) {}
  }
} else {
  app = apps[0];
  try {
    auth = getAuth(app);
  } catch (_) {}
}

export { app, auth };
export default {
  app,
  auth: () => auth,
};
