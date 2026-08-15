(function () {
  "use strict";

  var script = document.currentScript;
  var configuredOrigin = script && script.dataset.authOrigin;
  var AUTH_ORIGIN = configuredOrigin || "https://auth.collectivebucket.com";
  var CACHE_KEY = "cb_auth_session_v1";
  var requests = new Map();
  var iframe;
  var iframeReady;
  var requestNumber = 0;
  var currentSession = null;

  function authUrl(returnTo, extra) {
    var url = new URL("/", AUTH_ORIGIN);
    url.searchParams.set("returnTo", returnTo || window.location.href);
    if (extra) {
      Object.keys(extra).forEach(function (key) {
        url.searchParams.set(key, extra[key]);
      });
    }
    return url.href;
  }

  function readCache() {
    try {
      var raw = window.localStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      var session = JSON.parse(raw);
      if (!session || !session.idToken || !session.uid) return null;
      if (session.expiresAt && Date.parse(session.expiresAt) <= Date.now() + 30000) {
        window.localStorage.removeItem(CACHE_KEY);
        return null;
      }
      return session;
    } catch {
      return null;
    }
  }

  function writeCache(session) {
    try {
      if (!session || !session.idToken) {
        window.localStorage.removeItem(CACHE_KEY);
        return;
      }
      window.localStorage.setItem(CACHE_KEY, JSON.stringify(session));
    } catch {
      // ignore quota / private mode failures
    }
  }

  function clearCache() {
    try {
      window.localStorage.removeItem(CACHE_KEY);
    } catch {
      // ignore
    }
  }

  function consumeHashSession() {
    if (!window.location.hash || window.location.hash.indexOf("cb_token=") === -1) {
      return null;
    }

    try {
      var params = new URLSearchParams(window.location.hash.slice(1));
      var token = params.get("cb_token");
      var uid = params.get("cb_uid");
      if (!token || !uid) return null;

      var session = {
        uid: uid,
        email: params.get("cb_email") || "",
        emailVerified: params.get("cb_verified") === "1",
        idToken: token,
        expiresAt: params.get("cb_exp") || ""
      };

      writeCache(session);
      history.replaceState(
        null,
        "",
        window.location.pathname + window.location.search
      );
      return session;
    } catch {
      return null;
    }
  }

  function ensureIframe() {
    if (iframe) return iframeReady;

    iframe = document.createElement("iframe");
    iframe.src = new URL("/session", AUTH_ORIGIN).href;
    iframe.title = "Collective Bucket oturum köprüsü";
    iframe.hidden = true;
    iframe.setAttribute("aria-hidden", "true");
    iframe.setAttribute("tabindex", "-1");

    iframeReady = new Promise(function (resolve, reject) {
      var timeout = window.setTimeout(function () {
        reject(new Error("Oturum servisine ulaşılamadı."));
      }, 10000);

      iframe.addEventListener("load", function () {
        window.clearTimeout(timeout);
        resolve();
      }, { once: true });
    });

    (document.body || document.documentElement).appendChild(iframe);
    return iframeReady;
  }

  async function request(type, payload) {
    await ensureIframe();

    return new Promise(function (resolve, reject) {
      var requestId = "cb-auth-" + Date.now() + "-" + (++requestNumber);
      var timeout = window.setTimeout(function () {
        requests.delete(requestId);
        reject(new Error("Oturum isteği zaman aşımına uğradı."));
      }, 10000);

      requests.set(requestId, {
        resolve: resolve,
        reject: reject,
        timeout: timeout
      });

      iframe.contentWindow.postMessage(
        Object.assign({
          source: "collective-bucket-app",
          type: type,
          requestId: requestId
        }, payload || {}),
        AUTH_ORIGIN
      );
    });
  }

  function notify(session) {
    currentSession = session;
    window.dispatchEvent(new CustomEvent("cb-auth-changed", {
      detail: { session: session }
    }));
    renderControls();
  }

  async function getSession(options) {
    var forceRefresh = Boolean(options && options.forceRefresh);
    var cached = readCache();

    try {
      var response = await request("get-session", {
        forceRefresh: forceRefresh
      });
      if (response.session && response.session.idToken) {
        writeCache(response.session);
        notify(response.session);
        return currentSession;
      }
    } catch {
      // iOS'ta üçüncü taraf iframe depolaması boş olabilir; cache'e düş.
    }

    if (cached) {
      notify(cached);
      return cached;
    }

    notify(null);
    return null;
  }

  function login(returnTo) {
    window.location.assign(authUrl(returnTo));
  }

  async function logout() {
    clearCache();
    try {
      await request("sign-out");
    } catch {
      // iframe sign-out iOS'ta başarısız olabilir
    }
    notify(null);
    window.location.assign(
      authUrl(window.location.href, { signOut: "1" })
    );
  }

  function renderControls() {
    document.querySelectorAll("[data-cb-auth]").forEach(function (container) {
      container.replaceChildren();

      if (currentSession) {
        var email = document.createElement("span");
        email.className = "cb-auth-email";
        email.textContent = currentSession.email || "Oturum açık";

        var signOutButton = document.createElement("button");
        signOutButton.type = "button";
        signOutButton.className = "btn btn-ghost";
        signOutButton.textContent = "Çıkış";
        signOutButton.addEventListener("click", function () {
          signOutButton.disabled = true;
          logout().catch(function () {
            signOutButton.disabled = false;
          });
        });

        container.append(email, signOutButton);
        return;
      }

      var signInLink = document.createElement("a");
      signInLink.className = "btn btn-ghost";
      signInLink.href = authUrl();
      signInLink.textContent = "Giriş Yap";
      container.appendChild(signInLink);
    });
  }

  window.addEventListener("message", function (event) {
    if (
      event.origin !== AUTH_ORIGIN ||
      event.source !== (iframe && iframe.contentWindow) ||
      event.data?.source !== "collective-bucket-auth"
    ) {
      return;
    }

    if (event.data.type === "auth-state-changed") {
      getSession().catch(function () {
        var cached = readCache();
        notify(cached);
      });
      return;
    }

    var pending = requests.get(event.data.requestId);
    if (!pending) return;

    window.clearTimeout(pending.timeout);
    requests.delete(event.data.requestId);

    if (event.data.type === "error") {
      pending.reject(new Error(event.data.error));
    } else {
      pending.resolve(event.data);
    }
  });

  window.CollectiveBucketAuth = {
    getSession: getSession,
    getCurrentSession: function () { return currentSession; },
    login: login,
    logout: logout
  };

  function start() {
    var handedOff = consumeHashSession();
    if (handedOff) {
      notify(handedOff);
    } else {
      var cached = readCache();
      if (cached) notify(cached);
      else renderControls();
    }

    getSession().catch(function () {
      if (!currentSession) notify(readCache());
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }

  window.setInterval(function () {
    if (document.visibilityState === "visible") {
      getSession({ forceRefresh: true }).catch(function () {
        var cached = readCache();
        notify(cached);
      });
    }
  }, 50 * 60 * 1000);
})();
