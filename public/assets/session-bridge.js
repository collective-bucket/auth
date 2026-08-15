import { initializeApp } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js";
import { firebaseConfig } from "./firebase-config.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

function isAllowedOrigin(origin) {
  try {
    const url = new URL(origin);
    const isCollectiveBucket =
      url.protocol === "https:" &&
      (url.hostname === "collectivebucket.com" ||
        url.hostname.endsWith(".collectivebucket.com"));
    const isLocalDevelopment =
      location.hostname === "localhost" &&
      (url.hostname === "localhost" || url.hostname === "127.0.0.1");

    return isCollectiveBucket || isLocalDevelopment;
  } catch {
    return false;
  }
}

function respond(event, payload) {
  event.source?.postMessage(
    {
      source: "collective-bucket-auth",
      requestId: event.data.requestId,
      ...payload
    },
    event.origin
  );
}

async function currentSession(forceRefresh = false) {
  await auth.authStateReady();
  const user = auth.currentUser;

  if (!user) return null;

  const tokenResult = await user.getIdTokenResult(forceRefresh);
  return {
    uid: user.uid,
    email: user.email,
    emailVerified: user.emailVerified,
    idToken: tokenResult.token,
    expiresAt: tokenResult.expirationTime
  };
}

window.addEventListener("message", async (event) => {
  if (
    event.source !== window.parent ||
    !isAllowedOrigin(event.origin) ||
    event.data?.source !== "collective-bucket-app"
  ) {
    return;
  }

  try {
    if (event.data.type === "get-session") {
      respond(event, {
        type: "session",
        session: await currentSession(Boolean(event.data.forceRefresh))
      });
      return;
    }

    if (event.data.type === "sign-out") {
      await signOut(auth);
      respond(event, { type: "signed-out", session: null });
    }
  } catch {
    respond(event, {
      type: "error",
      error: "Oturum bilgisi alınamadı."
    });
  }
});

onAuthStateChanged(auth, () => {
  window.parent.postMessage(
    { source: "collective-bucket-auth", type: "auth-state-changed" },
    "*"
  );
});
