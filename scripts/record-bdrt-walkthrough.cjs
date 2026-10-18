const fs = require("node:fs/promises");
const path = require("node:path");
const { chromium } = require("playwright");

const baseUrl = process.env.BDRT_BASE_URL || "http://127.0.0.1:4173/";
const mode = process.env.RECORD_MODE || "both";
const outDir = path.resolve("recordings");
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function clickSafely(page, selector, waitMs = 1000, options = {}) {
  const locator = page.locator(selector).first();
  try {
    if (!(await locator.count())) {
      console.log("Skip missing selector:", selector);
      return false;
    }
    await locator.click({ timeout: 7000, ...options });
    await pause(waitMs);
    return true;
  } catch (error) {
    console.log("Skip unavailable interaction:", selector, error.message.split("\n")[0]);
    return false;
  }
}

async function navigateTo(page, sectionId, mobile) {
  if (mobile) {
    const opened = await clickSafely(page, ".mobile-menu-toggle", 400);
    if (!opened) return;
    await clickSafely(page, '.mobile-menu__nav a[href="#' + sectionId + '"]', 1450);
  } else {
    await clickSafely(page, '.site-nav a[href="#' + sectionId + '"]', 1450);
  }
}

async function recordOne(browser, label, viewport, mobile) {
  const context = await browser.newContext({
    viewport,
    screen: viewport,
    deviceScaleFactor: 1,
    isMobile: mobile,
    hasTouch: mobile,
    reducedMotion: "no-preference",
    recordVideo: {
      dir: outDir,
      size: viewport
    }
  });

  const page = await context.newPage();
  page.setDefaultTimeout(7000);
  console.log("Starting " + label + " recording at " + viewport.width + "x" + viewport.height);

  await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.locator("#home").waitFor({ state: "attached", timeout: 15000 });
  await pause(3800);

  // About: show the editorial section and at least one carousel transition.
  await navigateTo(page, "about", mobile);
  await clickSafely(page, "[data-about-next]", 900);
  await clickSafely(page, "[data-about-next]", 900);

  // Brand selector: show VOXA, then switch to VOXA House.
  await navigateTo(page, "our-brands", mobile);
  await clickSafely(page, '#our-brands [data-brand="voxa"]', 800);
  await clickSafely(page, '#our-brands [data-brand="voxa-house"]', 2200);

  // Commercial businesses: show the range of portfolio companies.
  await navigateTo(page, "businesses", mobile);
  await clickSafely(page, '#businesses [data-brand="involia"]', 1450);
  await clickSafely(page, '#businesses [data-brand="academic-elements"]', 900);
  await clickSafely(page, '#businesses [data-brand="emerging"]', 900);
  await clickSafely(page, '#businesses [data-brand="imerge"]', 1300);

  // Gallery: expand a real loaded image, close it, then expand another.
  await navigateTo(page, "portfolio", mobile);
  await pause(1200);
  const galleryShots = page.locator("#portfolio .portfolio-shot");
  let openedGallery = false;
  for (let index = 0; index < Math.min(await galleryShots.count(), 12); index += 1) {
    const shot = galleryShots.nth(index);
    const loaded = await shot.locator("img").evaluate((img) => img.complete && img.naturalWidth > 0).catch(() => false);
    if (!loaded) continue;
    try {
      await shot.click({ timeout: 6000 });
      await pause(950);
      const flight = page.locator("#portfolio .portfolio-gallery__flight").first();
      if (await flight.count()) await clickSafely(page, "#portfolio .portfolio-gallery__flight", 900);
      await pause(350);
      openedGallery = true;
      const second = galleryShots.nth(Math.min(index + 1, (await galleryShots.count()) - 1));
      const secondLoaded = await second.locator("img").evaluate((img) => img.complete && img.naturalWidth > 0).catch(() => false);
      if (secondLoaded) {
        await second.click({ timeout: 6000 });
        await pause(1500);
      }
      break;
    } catch (error) {
      console.log("Gallery interaction skipped:", error.message.split("\n")[0]);
    }
  }
  if (!openedGallery) {
    console.log("Gallery images did not load in time; keeping the gallery view in the recording.");
    await pause(1800);
  }

  // Show both portal previews without submitting login credentials.
  if (mobile) {
    await clickSafely(page, ".mobile-login", 1300);
    await clickSafely(page, "[data-portal-close]", 700);
    await clickSafely(page, ".mobile-menu-toggle", 400);
    await clickSafely(page, '.mobile-menu__nav a[href="#donor-portal"]', 1200);
  } else {
    await clickSafely(page, '.site-nav--right a[href="#client-login"]', 1300);
    await clickSafely(page, "[data-portal-close]", 700);
    await clickSafely(page, '.site-nav--right a[href="#donor-portal"]', 1300);
  }
  await clickSafely(page, "[data-portal-close]", 800);

  // Inquiry form: show the two available brand choices without pretending to submit it.
  await navigateTo(page, "contact", mobile);
  await clickSafely(page, '#contact [data-contact-slide="form"]', 1100);
  await clickSafely(page, '#contact-inquiry-form input[name="interest"][value^="VOXA House"]', 500);
  const nameField = page.locator('#contact-inquiry-form input[name="name"]');
  const emailField = page.locator('#contact-inquiry-form input[name="email"]');
  const messageField = page.locator('#contact-inquiry-form textarea[name="message"]');
  try {
    if (await nameField.count()) await nameField.fill("Alex Example");
    if (await emailField.count()) await emailField.fill("hello@example.com");
    if (await messageField.count()) await messageField.fill("Interested in learning more about VOXA House partnerships.");
    await pause(1100);
  } catch (error) {
    console.log("Form typing skipped:", error.message.split("\n")[0]);
  }

  await clickSafely(page, '#contact [data-contact-slide="intro"]', 700);
  // Move to the footer using the site's own magazine-page keyboard transition.
  try {
    await page.locator("body").click({ position: { x: 10, y: 10 }, timeout: 3000 });
    await page.keyboard.press("PageDown");
    await pause(1400);
  } catch (_) {}

  // Give the ending a quiet hold before finalising the video file.
  await pause(900);
  const video = page.video();
  await context.close();
  if (video) {
    const destination = path.join(outDir, label + ".webm");
    await video.saveAs(destination);
    console.log("Saved " + destination);
  }
}

(async () => {
  await fs.mkdir(outDir, { recursive: true });
  const browser = await chromium.launch({
    headless: true,
    args: ["--autoplay-policy=no-user-gesture-required", "--disable-dev-shm-usage"]
  });

  try {
    if (mode === "both" || mode === "desktop") {
      await recordOne(browser, "bdrt-desktop", { width: 1440, height: 900 }, false);
    }
    if (mode === "both" || mode === "mobile") {
      await recordOne(browser, "bdrt-mobile", { width: 390, height: 844 }, true);
    }
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
