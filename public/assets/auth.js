import { initializeApp } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-app.js";
import {
  browserLocalPersistence,
  createUserWithEmailAndPassword,
  getAuth,
  onAuthStateChanged,
  setPersistence,
  signInWithEmailAndPassword,
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
  signOutButton.disabled = busy;
}

function redirectBack() {
  if (!returnUrl) return false;
  showMessage("Oturum açıldı. Uygulamaya dönülüyor…", "success");
  window.setTimeout(() => location.replace(returnUrl), 300);
  return true;
}

function friendlyError(error) {
  const messages = {
    "auth/email-already-in-use": "Bu e-posta adresiyle daha önce hesap oluşturulmuş.",
    "auth/invalid-credential": "E-posta veya şifre hatalı.",
    "auth/invalid-email": "Geçerli bir e-posta adresi girin.",
    "auth/missing-password": "Şifrenizi girin.",
    "auth/too-many-requests": "Çok fazla deneme yapıldı. Lütfen daha sonra tekrar deneyin.",
    "auth/weak-password": "Şifre en az 6 karakter olmalı."
  };

  return messages[error?.code] || "İşlem tamamlanamadı. Lütfen tekrar deneyin.";
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
  formPanel.hidden = Boolean(user);
  accountPanel.hidden = !user;
  accountEmail.textContent = user?.email || "";

  if (user) redirectBack();
});
