import { initializeApp } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-app.js";
import {
  GoogleAuthProvider,
  browserLocalPersistence,
  createUserWithEmailAndPassword,
  getAuth,
  onAuthStateChanged,
  sendPasswordResetEmail,
  setPersistence,
  signInWithEmailAndPassword,
  signInWithRedirect,
  signOut
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js";
import { firebaseConfig } from "./firebase-config.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

const form = document.querySelector("#auth-form");
const emailInput = document.querySelector("#email");
const passwordInput = document.querySelector("#password");
const signInButton = document.querySelector("#sign-in");
const signUpButton = document.querySelector("#sign-up");
const googleSignInButton = document.querySelector("#google-sign-in");
const forgotPasswordButton = document.querySelector("#forgot-password");
const signOutButton = document.querySelector("#sign-out");
const formPanel = document.querySelector("#form-panel");
const accountPanel = document.querySelector("#account-panel");
const accountEmail = document.querySelector("#account-email");
const message = document.querySelector("#message");

function allowedReturnUrl(value) {
  if (!value) return null;

  try {
    const url = new URL(value);
    const isCollectiveBucket =
      url.protocol === "https:" &&
      (url.hostname === "collectivebucket.com" ||
        url.hostname.endsWith(".collectivebucket.com"));
    const isLocalDevelopment =
      location.hostname === "localhost" &&
      (url.hostname === "localhost" || url.hostname === "127.0.0.1");

    return isCollectiveBucket || isLocalDevelopment ? url.href : null;
  } catch {
    return null;
  }
}

const params = new URLSearchParams(location.search);
const requestedReturnUrl = params.get("returnTo");
const returnUrl = allowedReturnUrl(requestedReturnUrl);
const signOutRequested = params.get("signOut") === "1";
let redirecting = false;

function hidePanelsForTransition() {
  formPanel.hidden = true;
  accountPanel.hidden = true;
}

if (requestedReturnUrl && !returnUrl) {
  showMessage("Güvenli olmayan dönüş adresi reddedildi.", "error");
}

function showMessage(text, type = "") {
  message.textContent = text;
  message.className = `message${type ? ` message-${type}` : ""}`;
}

function setBusy(busy) {
  emailInput.disabled = busy;
  passwordInput.disabled = busy;
  signInButton.disabled = busy;
  signUpButton.disabled = busy;
  googleSignInButton.disabled = busy;
  forgotPasswordButton.disabled = busy;
  signOutButton.disabled = busy;
}

async function redirectBack() {
  if (!returnUrl || redirecting) return false;
  redirecting = true;
  showMessage("Oturum açıldı. Uygulamaya dönülüyor…", "success");

  try {
    const user = auth.currentUser;
    if (!user) {
      window.setTimeout(() => location.replace(returnUrl), 300);
      return true;
    }

    const tokenResult = await user.getIdTokenResult();
    const target = new URL(returnUrl);
    const hash = new URLSearchParams({
      cb_token: tokenResult.token,
      cb_uid: user.uid,
      cb_email: user.email || "",
      cb_verified: user.emailVerified ? "1" : "0",
      cb_exp: tokenResult.expirationTime
    });
    target.hash = hash.toString();
    window.setTimeout(() => location.replace(target.href), 300);
  } catch {
    redirecting = false;
    showMessage("Oturum bilgisi alınamadı. Lütfen tekrar deneyin.", "error");
    return false;
  }

  return true;
}

function friendlyError(error) {
  const messages = {
    "auth/email-already-in-use": "Bu e-posta adresiyle daha önce hesap oluşturulmuş.",
    "auth/invalid-credential": "E-posta veya şifre hatalı.",
    "auth/invalid-email": "Geçerli bir e-posta adresi girin.",
    "auth/missing-password": "Şifrenizi girin.",
    "auth/network-request-failed": "Ağ bağlantısı kurulamadı. Lütfen tekrar deneyin.",
    "auth/operation-not-allowed": "Bu giriş yöntemi şu anda etkin değil.",
    "auth/too-many-requests": "Çok fazla deneme yapıldı. Lütfen daha sonra tekrar deneyin.",
    "auth/unauthorized-domain": "Bu alan adı Google girişi için yetkili değil.",
    "auth/user-not-found": "Bu e-posta için kayıtlı bir hesap bulunamadı.",
    "auth/weak-password": "Şifre en az 6 karakter olmalı."
  };

  if (messages[error?.code]) return messages[error.code];
  if (error?.code) return "İşlem tamamlanamadı (" + error.code + ").";
  return "İşlem tamamlanamadı. Lütfen tekrar deneyin.";
}

async function authenticateWithGoogle() {
  setBusy(true);
  showMessage("Google hesabına yönlendiriliyor…");

  try {
    await setPersistence(auth, browserLocalPersistence);
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });
    hidePanelsForTransition();
    await signInWithRedirect(auth, provider);
  } catch (error) {
    showMessage(friendlyError(error), "error");
    formPanel.hidden = false;
  } finally {
    setBusy(false);
  }
}

async function resetPassword() {
  var email = emailInput.value.trim();
  if (!email) {
    showMessage("Şifre sıfırlama için önce e-posta adresinizi girin.", "error");
    emailInput.focus();
    return;
  }

  setBusy(true);
  showMessage("Şifre sıfırlama bağlantısı gönderiliyor…");

  try {
    await sendPasswordResetEmail(auth, email, {
      url: location.origin + "/",
      handleCodeInApp: false
    });
    showMessage("Şifre sıfırlama bağlantısı e-posta adresinize gönderildi.", "success");
  } catch (error) {
    showMessage(friendlyError(error), "error");
  } finally {
    setBusy(false);
  }
}

async function authenticate(action) {
  if (!form.reportValidity()) return;

  setBusy(true);
  showMessage("İşlem yapılıyor…");

  try {
    await setPersistence(auth, browserLocalPersistence);
    await action(auth, emailInput.value.trim(), passwordInput.value);
    redirectBack();
  } catch (error) {
    showMessage(friendlyError(error), "error");
  } finally {
    setBusy(false);
  }
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  authenticate(signInWithEmailAndPassword);
});

signUpButton.addEventListener("click", () => {
  authenticate(createUserWithEmailAndPassword);
});

googleSignInButton.addEventListener("click", () => {
  authenticateWithGoogle();
});

forgotPasswordButton.addEventListener("click", () => {
  resetPassword();
});

signOutButton.addEventListener("click", async () => {
  setBusy(true);

  try {
    await signOut(auth);
    showMessage("Oturum kapatıldı.", "success");
    if (returnUrl) window.setTimeout(() => location.replace(returnUrl), 300);
  } catch {
    showMessage("Oturum kapatılamadı. Lütfen tekrar deneyin.", "error");
  } finally {
    setBusy(false);
  }
});

onAuthStateChanged(auth, (user) => {
  if (signOutRequested) {
    hidePanelsForTransition();
    return;
  }

  formPanel.hidden = Boolean(user);
  accountPanel.hidden = !user;
  accountEmail.textContent = user?.email || "";

  if (user) redirectBack();
});

if (signOutRequested) {
  hidePanelsForTransition();
  setBusy(true);
  showMessage("Oturum kapatılıyor. Yönlendiriliyorsunuz…");
  signOut(auth)
    .then(() => {
      showMessage("Oturum kapatıldı. Yönlendiriliyorsunuz…", "success");
      if (returnUrl) {
        window.setTimeout(() => location.replace(returnUrl), 300);
      }
    })
    .catch(() => {
      showMessage("Oturum kapatılamadı. Lütfen tekrar deneyin.", "error");
    })
    .finally(() => {
      setBusy(false);
    });
}
