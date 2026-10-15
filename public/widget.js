/**
 * Reception AI widget launcher.
 *
 * Embedding used to be a raw <iframe> snippet: always mounted, always the same
 * size, no launcher, and no way for the owner to say which sites may load their
 * agent. Any page that copied the snippet could run someone else's agent and
 * spend their minutes.
 *
 * Usage:
 *   <script src="https://your-app/widget.js" data-agent="agt_123" defer></script>
 *
 * Optional attributes:
 *   data-position  "right" (default) | "left"
 *   data-label     launcher tooltip text
 *   data-open      "true" to start open
 *
 * The allowlist is enforced SERVER-side (the widget page checks the Referer
 * against the agent's configured domains). This file is convenience, not
 * security — anything here can be edited by whoever embeds it.
 */
(function () {
  "use strict";

  var current = document.currentScript;
  if (!current) return;

  var agentId = current.getAttribute("data-agent");
  if (!agentId) {
    console.error('[aether] widget.js needs data-agent="<agent id>"');
    return;
  }

  // Same origin the script was loaded from, so one snippet works in every
  // environment without the embedder editing URLs.
  var origin = new URL(current.src, window.location.href).origin;
  var position = current.getAttribute("data-position") === "left" ? "left" : "right";
  var label = current.getAttribute("data-label") || "Chat with us";
  var startOpen = current.getAttribute("data-open") === "true";

  if (document.getElementById("aether-widget-root")) return; // already mounted

  var root = document.createElement("div");
  root.id = "aether-widget-root";
  root.style.cssText = [
    "position:fixed",
    "bottom:20px",
    position + ":20px",
    "z-index:2147483000",
    "font-family:system-ui,-apple-system,Segoe UI,sans-serif",
  ].join(";");

  var panel = document.createElement("div");
  panel.setAttribute("aria-hidden", "true");
  panel.style.cssText = [
    "width:min(400px,calc(100vw - 40px))",
    "height:min(620px,calc(100vh - 120px))",
    "border-radius:16px",
    "overflow:hidden",
    "box-shadow:0 12px 48px rgba(0,0,0,.28)",
    "opacity:0",
    "transform:translateY(12px) scale(.98)",
    "transition:opacity .18s ease,transform .18s ease",
    "pointer-events:none",
    "background:#111",
    "margin-bottom:12px",
  ].join(";");

  // The iframe is created lazily: an embedded widget should cost nothing until
  // someone opens it, and mounting it on every page load was a request, a
  // render and a websocket for visitors who never clicked.
  var frame = null;
  function ensureFrame() {
    if (frame) return;
    frame = document.createElement("iframe");
    frame.src = origin + "/w/" + encodeURIComponent(agentId) + "?embed=1";
    frame.title = label;
    frame.allow = "microphone";
    frame.style.cssText = "width:100%;height:100%;border:0;display:block";
    panel.appendChild(frame);
  }

  var button = document.createElement("button");
  button.type = "button";
  button.setAttribute("aria-label", label);
  button.setAttribute("aria-expanded", "false");
  button.style.cssText = [
    "width:56px",
    "height:56px",
    "border-radius:50%",
    "border:0",
    "cursor:pointer",
    "background:#111",
    "color:#fff",
    "box-shadow:0 6px 20px rgba(0,0,0,.28)",
    "display:flex",
    "align-items:center",
    "justify-content:center",
    "margin-" + (position === "left" ? "right" : "left") + ":auto",
    "transition:transform .15s ease",
  ].join(";");
  button.innerHTML =
    '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
    'stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 8.4 8.4 0 0 1-3.8-.9L3 21l2-4.9A8.4 8.4 0 0 1 12 3a8.4 8.4 0 0 1 9 8.5Z"/></svg>';

  var open = false;
  function setOpen(next) {
    open = next;
    button.setAttribute("aria-expanded", String(open));
    panel.setAttribute("aria-hidden", String(!open));
    if (open) {
      ensureFrame();
      panel.style.opacity = "1";
      panel.style.transform = "translateY(0) scale(1)";
      panel.style.pointerEvents = "auto";
    } else {
      panel.style.opacity = "0";
      panel.style.transform = "translateY(12px) scale(.98)";
      panel.style.pointerEvents = "none";
    }
  }

  button.addEventListener("click", function () {
    setOpen(!open);
  });
  button.addEventListener("mouseenter", function () {
    button.style.transform = "scale(1.05)";
  });
  button.addEventListener("mouseleave", function () {
    button.style.transform = "scale(1)";
  });

  // Escape closes, which is the behaviour anyone trapped in an overlay reaches
  // for first.
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && open) setOpen(false);
  });

  // The widget page asks to be closed from its own header button.
  window.addEventListener("message", function (e) {
    if (e.origin !== origin) return;
    if (e.data && e.data.source === "aether-widget" && e.data.type === "close") setOpen(false);
  });

  root.appendChild(panel);
  root.appendChild(button);

  function mount() {
    document.body.appendChild(root);
    if (startOpen) setOpen(true);
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mount);
  } else {
    mount();
  }
})();
