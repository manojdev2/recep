const THEME_KEY = "aether-theme";
const PAGES = [
  ["overview", "Overview"],
  ["guide", "User guide"],
  ["workspace", "Workspace"],
  ["architecture", "Architecture"],
  ["install", "Install"],
  ["env", "Environment"],
  ["deploy", "Deploy"],
  ["api", "HTTP API"],
  ["admin", "Admin"],
  ["troubleshoot", "Troubleshooting"],
];

/** Old anchors that still turn up in links. */
const ALIASES = { studio: "workspace" };

function pageId() {
  const hash = (location.hash || "#overview").replace(/^#\/?/, "").split("/")[0];
  const id = ALIASES[hash] ?? hash;
  return PAGES.some(([pid]) => pid === id) ? id : "overview";
}

function setTheme(pref, opts) {
  const light =
    pref === "light" ||
    (pref !== "dark" && window.matchMedia("(prefers-color-scheme: light)").matches);
  const resolved = light ? "light" : "dark";
  document.documentElement.classList.remove("light", "dark");
  document.documentElement.classList.add(resolved);
  document.documentElement.style.colorScheme = resolved;
  document.documentElement.dataset.theme = pref;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", resolved === "light" ? "#f8f9fd" : "#181b2d");
  try {
    if (opts?.persist !== false) localStorage.setItem(THEME_KEY, pref);
  } catch {
    /* ignore */
  }
  const btn = document.getElementById("theme-toggle");
  if (btn)
    btn.setAttribute(
      "aria-label",
      resolved === "light" ? "Switch to dark mode" : "Switch to light mode",
    );
}

function cycleTheme() {
  const current = document.documentElement.classList.contains("light") ? "light" : "dark";
  setTheme(current === "light" ? "dark" : "light");
}

function showPage(id) {
  document.querySelectorAll("[data-page]").forEach((el) => {
    el.classList.toggle("active", el.dataset.page === id);
  });
  document.querySelectorAll("[data-nav]").forEach((el) => {
    el.classList.toggle("active", el.dataset.nav === id);
  });
  const title = PAGES.find(([pid]) => pid === id)?.[1] ?? "Docs";
  document.title = `${title} · Reception AI Docs`;
  const crumb = document.getElementById("crumb");
  if (crumb) crumb.textContent = title;
  window.scrollTo({
    top: 0,
    behavior: "instant" in document.documentElement.style ? "instant" : "auto",
  });
}

function go(id) {
  if (location.hash !== `#${id}`) location.hash = id;
  else showPage(id);
  closeDrawer();
  closeSearch();
}

function openDrawer() {
  document.getElementById("drawer")?.classList.add("open");
  document.getElementById("menu-btn")?.setAttribute("aria-expanded", "true");
}

function closeDrawer() {
  document.getElementById("drawer")?.classList.remove("open");
  document.getElementById("menu-btn")?.setAttribute("aria-expanded", "false");
}

function closeSearch() {
  document.getElementById("search-hits")?.classList.remove("open");
}

function buildIndex() {
  const items = [];
  document.querySelectorAll("[data-page]").forEach((page) => {
    const pid = page.dataset.page;
    page.querySelectorAll("h2, h3").forEach((heading) => {
      items.push({
        page: pid,
        title: heading.textContent.trim(),
        section: heading.tagName === "H2" ? "Section" : "Topic",
        id: heading.id || "",
      });
    });
  });
  return items;
}

function renderHits(query, index) {
  const box = document.getElementById("search-hits");
  if (!box) return;
  const q = query.trim().toLowerCase();
  if (!q) {
    box.classList.remove("open");
    box.innerHTML = "";
    return;
  }
  const hits = index
    .filter((item) => item.title.toLowerCase().includes(q) || item.page.includes(q))
    .slice(0, 8);
  if (!hits.length) {
    box.classList.add("open");
    box.innerHTML = `<button type="button" disabled>No matches</button>`;
    return;
  }
  box.classList.add("open");
  box.innerHTML = hits
    .map(
      (item, i) =>
        `<button type="button" data-hit="${item.page}" data-anchor="${item.id}" aria-selected="${i === 0}">
          ${item.title}<small>${PAGES.find(([id]) => id === item.page)?.[1] ?? item.page}</small>
        </button>`,
    )
    .join("");
}

function wireCopy() {
  document.querySelectorAll("pre").forEach((pre) => {
    if (pre.querySelector(".copy")) return;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "copy";
    btn.textContent = "Copy";
    btn.addEventListener("click", async () => {
      const text = pre.innerText.replace(/^Copy\n/, "");
      try {
        await navigator.clipboard.writeText(text);
        btn.textContent = "Copied";
        setTimeout(() => {
          btn.textContent = "Copy";
        }, 1400);
      } catch {
        btn.textContent = "Copy failed";
      }
    });
    pre.appendChild(btn);
  });
}

function bootTheme() {
  // Same default as the app (src/lib/theme-boot.ts): dark until someone
  // chooses otherwise. The inline script in the page head already painted it;
  // this only re-applies the stored choice.
  let pref = "dark";
  let stored = null;
  try {
    stored = localStorage.getItem(THEME_KEY);
    if (stored === "light" || stored === "dark" || stored === "system") pref = stored;
  } catch {
    /* ignore */
  }
  // Do not persist the default — writing "dark" here would record a choice the
  // visitor never made, and a later change to the default could not reach them.
  setTheme(pref, { persist: stored !== null });
}

document.addEventListener("DOMContentLoaded", () => {
  bootTheme();
  showPage(pageId());
  wireCopy();
  const index = buildIndex();

  document.querySelectorAll("[data-nav]").forEach((link) => {
    link.addEventListener("click", (event) => {
      event.preventDefault();
      go(link.dataset.nav);
    });
  });

  document.getElementById("theme-toggle")?.addEventListener("click", cycleTheme);
  document.getElementById("menu-btn")?.addEventListener("click", openDrawer);
  document.getElementById("drawer-close")?.addEventListener("click", closeDrawer);
  document.querySelector(".drawer-backdrop")?.addEventListener("click", closeDrawer);

  const search = document.getElementById("search");
  search?.addEventListener("input", () => renderHits(search.value, index));
  search?.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      search.blur();
      closeSearch();
    }
    if (event.key === "Enter") {
      const first = document.querySelector("#search-hits button[data-hit]");
      if (first) {
        event.preventDefault();
        go(first.getAttribute("data-hit"));
      }
    }
  });

  document.getElementById("search-hits")?.addEventListener("click", (event) => {
    const btn = event.target.closest("[data-hit]");
    if (!btn) return;
    go(btn.getAttribute("data-hit"));
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "/" && document.activeElement?.tagName !== "INPUT") {
      event.preventDefault();
      search?.focus();
    }
  });

  document.addEventListener("click", (event) => {
    if (!event.target.closest(".search-wrap")) closeSearch();
  });
});

window.addEventListener("hashchange", () => showPage(pageId()));
