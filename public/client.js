(function () {
  "use strict";

  var script = document.currentScript;
  var configuredOrigin = script && script.dataset.authOrigin;
  var AUTH_ORIGIN = configuredOrigin || "https://auth.collectivebucket.com";
  var requests = new Map();
  var iframe;
  var iframeReady;
  var requestNumber = 0;
  var currentSession = null;

  function authUrl(returnTo) {
    var url = new URL("/", AUTH_ORIGIN);
    url.searchParams.set("returnTo", returnTo || window.location.href);
    return url.href;
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
    var response = await request("get-session", {
      forceRefresh: Boolean(options && options.forceRefresh)
    });
    notify(response.session || null);
    return currentSession;
  }

  function login(returnTo) {
    window.location.assign(authUrl(returnTo));
  }

  async function logout() {
    await request("sign-out");
    notify(null);
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
        notify(null);
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
    renderControls();
    getSession().catch(function () {
      notify(null);
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
        notify(null);
      });
    }
  }, 50 * 60 * 1000);
})();
