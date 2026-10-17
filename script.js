(() => {
  const toggle = document.querySelector(".menu-toggle");
  const menu = document.querySelector("#mobile-menu");
  const scrim = document.querySelector(".menu-scrim");
  if (!toggle || !menu || !scrim) return;

  const closeMenu = () => {
    toggle.setAttribute("aria-expanded", "false");
    toggle.setAttribute("aria-label", "Open navigation");
    menu.hidden = true;
    scrim.classList.remove("is-visible");
    document.body.classList.remove("menu-open");
  };

  const openMenu = () => {
    toggle.setAttribute("aria-expanded", "true");
    toggle.setAttribute("aria-label", "Close navigation");
    menu.hidden = false;
    scrim.classList.add("is-visible");
    document.body.classList.add("menu-open");
  };

  toggle.addEventListener("click", () => {
    toggle.getAttribute("aria-expanded") === "true" ? closeMenu() : openMenu();
  });
  menu.querySelectorAll("a").forEach((link) => link.addEventListener("click", closeMenu));
  scrim.addEventListener("click", closeMenu);
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeMenu();
  });
  window.addEventListener("resize", () => {
    if (window.innerWidth > 760) closeMenu();
  });
})();
