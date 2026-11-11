import { expect, test, type Page } from "@playwright/test";

async function discoverKolkata(page: Page) {
  await page.goto("/discover?city=kolkata");
  await expect(page.getByTestId("results")).toBeVisible();
}

test.describe("home", () => {
  test("renders the globe, labels archived data, and lets a spacecraft be chosen without the canvas", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("/");

    await expect(page.getByRole("heading", { level: 1 })).toContainText("The oldest thing above you");
    await expect(page.getByTestId("mode-banner")).toContainText("Demonstration data");
    await expect(page.locator('[data-testid="globe-canvas"][data-ready="true"]')).toBeVisible();

    const card = page.getByTestId("sat-card");
    await expect(card).toContainText("1958");
    await expect(card).toContainText("Vanguard 1");
    await expect(card).toContainText(/km up/); // in-browser propagation produced a position

    await page.getByRole("button", { name: /Hubble Space Telescope/ }).click();
    await expect(card).toContainText("1990");
    await expect(card.getByRole("link", { name: /Read its history/ })).toHaveAttribute("href", "/satellites/20580");

    const clock = page.getByLabel("Simulation time");
    await page.getByRole("button", { name: "Pause" }).click();
    const frozen = await clock.textContent();
    await page.waitForTimeout(700);
    expect(await clock.textContent()).toBe(frozen);
    await page.getByRole("button", { name: "Speed 600 times real time" }).click();
    await expect(clock).not.toHaveText(frozen!);
    expect(errors).toEqual([]);
  });

  test("city search leads to a real discovery", async ({ page }) => {
    await page.goto("/");
    const box = page.getByRole("combobox", { name: "Your city" });
    await box.fill("kol");
    await page.getByRole("option", { name: /Kolkata/ }).click();
    await page.getByRole("button", { name: "Find what passes over" }).click();
    await expect(page).toHaveURL(/\/discover\?city=kolkata/);
    await expect(page.getByTestId("oldest-name")).toHaveText("Vanguard 1");
  });
});

test.describe("discovery", () => {
  test("ranks eligible spacecraft by launch date and shows provenance and limits", async ({ page }) => {
    await discoverKolkata(page);

    await expect(page.getByTestId("oldest-year")).toHaveText("1958");
    await expect(page.getByTestId("oldest-name")).toHaveText("Vanguard 1");
    await expect(page.getByText("Demonstration result.")).toBeVisible();

    const provenance = page.getByTestId("provenance").first();
    await expect(provenance).toContainText("Archived capture");
    await expect(provenance).toContainText(/Element epoch .* UTC/);
    await expect(provenance).toContainText(/Retrieved .* UTC/);
    await expect(provenance.getByRole("link", { name: "CelesTrak GP source" })).toHaveAttribute("href", /celestrak\.org.*CATNR=5/);

    await page.getByRole("button", { name: /Show all/ }).click();
    const years = (await page.locator('[data-testid="candidate"] .ranked__year').allTextContents()).map(Number);
    expect(years.length).toBeGreaterThan(100);
    expect(years).toEqual([...years].sort((a, b) => a - b));

    await expect(page.getByText(/does not mean the object will be visible/)).toBeVisible();
    await expect(page.getByText(/not a prediction that the spacecraft can be seen/)).toBeVisible();
  });

  test("explains every exclusion", async ({ page }) => {
    await discoverKolkata(page);
    const exclusions = page.getByTestId("exclusions");
    await exclusions.locator("summary").click();
    await expect(exclusions).toContainText("no public element set");
    await expect(exclusions.getByRole("row", { name: /VELA 1/ })).toContainText("No GP data found");
  });

  test("a candidate row expands to its passes and sky track", async ({ page }) => {
    await discoverKolkata(page);
    const row = page.getByTestId("candidate").nth(1);
    await row.getByRole("button").first().click();
    await expect(row.getByRole("table")).toBeVisible();
    await expect(row.getByRole("img", { name: /Sky chart of the pass/ })).toBeVisible();
    await expect(row.getByTestId("provenance")).toContainText("Archived capture");
  });

  test("exact coordinates at high latitude give a different, later answer", async ({ page }) => {
    await page.goto("/discover");
    await expect(page.getByTestId("idle")).toBeVisible();
    await page.getByRole("button", { name: "Enter exact coordinates instead" }).click();
    await page.getByLabel("Latitude, north positive").fill("69.65");
    await page.getByLabel("Longitude, east positive").fill("18.96");
    await page.getByRole("button", { name: "Find the oldest" }).click();
    await expect(page.getByTestId("results")).toBeVisible();
    await expect(page.getByTestId("oldest-name")).not.toHaveText("Vanguard 1");
    expect(Number(await page.getByTestId("oldest-year").textContent())).toBeGreaterThan(1958);
    const exclusions = page.getByTestId("exclusions");
    await exclusions.locator("summary").click();
    await expect(exclusions.getByRole("row", { name: /VANGUARD 1/ })).toContainText("no qualifying pass");
  });

  test("rejects impossible coordinates before calling the service", async ({ page }) => {
    await page.goto("/discover");
    await page.getByRole("button", { name: "Enter exact coordinates instead" }).click();
    await page.getByLabel("Latitude, north positive").fill("123");
    await page.getByLabel("Longitude, east positive").fill("10");
    await page.getByRole("button", { name: "Find the oldest" }).click();
    await expect(page.locator("form").getByRole("alert")).toContainText("latitude between −90 and 90");
    await expect(page.getByTestId("results")).toHaveCount(0);
  });

  test("shows an error, not placeholder results, when the service fails", async ({ page }) => {
    await page.route("**/api/v1/discover", (route) =>
      route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: { code: "internal_error", message: "The server failed to complete the request." } }) }),
    );
    await page.goto("/discover?city=kolkata");
    const error = page.getByTestId("error");
    await expect(error).toContainText("The prediction could not be computed.");
    await expect(error).toContainText("No placeholder results are shown");
    await expect(page.getByTestId("results")).toHaveCount(0);
    await expect(page.getByTestId("oldest-name")).toHaveCount(0);
  });

  test("an empty result is reported as empty", async ({ page }) => {
    // Sixty days after the capture every element set is beyond the 30-day limit.
    const status = await (await page.request.get("/api/v1/status")).json();
    const later = new Date(new Date(status.default_window_start).getTime() + 60 * 86_400_000).toISOString().slice(0, 16);
    await page.goto(`/discover?city=kolkata&start=${later}`);
    await expect(page.getByTestId("no-results")).toContainText("No spacecraft in the searched set qualifies");
    await page.getByTestId("exclusions").locator("summary").click();
    await expect(page.getByTestId("exclusions")).toContainText("elements too old");
  });
});

test.describe("satellite history", () => {
  test("shows story, orbit, sources and editorial status", async ({ page }) => {
    await page.goto("/satellites/5");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Vanguard 1");
    await expect(page.getByText("CelesTrak SATCAT, and it matches our curated record.")).toBeVisible();
    await expect(page.getByRole("heading", { name: "The story" })).toBeVisible();
    await expect(page.getByText("First satellite powered by solar cells.")).toBeVisible();
    await expect(page.locator('[data-testid="globe-canvas"][data-ready="true"]')).toBeVisible();
    await expect(page.getByTestId("provenance").first()).toContainText("Archived capture");
    await page.getByText("Element set as two lines (TLE)").click();
    await expect(page.getByTestId("tle")).toContainText("1 00005U 58002B");
    await expect(page.getByTestId("editorial-note")).toContainText("Editorial status: draft");
    await expect(page.getByRole("link", { name: /NSSDCA Master Catalog entry 1958-002B/ })).toHaveAttribute("href", /nssdc\.gsfc\.nasa\.gov.*1958-002B/);
    await expect(page.getByRole("link", { name: /SATCAT record/ })).toHaveAttribute("href", /celestrak\.org\/satcat/);
  });

  test("lists local passes after a discovery", async ({ page }) => {
    await discoverKolkata(page);
    await page.getByRole("link", { name: "Read its history", exact: true }).click();
    await expect(page).toHaveURL(/\/satellites\/5$/);
    const local = page.getByTestId("local-passes");
    await expect(local).toContainText("Over Kolkata");
    await expect(local.getByRole("table")).toBeVisible();
    await expect(local).toContainText("A pass does not mean the spacecraft will be visible");
  });

  test("a re-entered spacecraft has a story but no orbit", async ({ page }) => {
    await page.goto("/satellites/2");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Sputnik 1");
    await expect(page.getByText("No orbit to draw.")).toBeVisible();
    await expect(page.getByText(/Re-entered the atmosphere \(CelesTrak SATCAT decay date\)/)).toBeVisible();
  });

  test("an object outside the dataset is a 404", async ({ page }) => {
    const response = await page.goto("/satellites/99999");
    expect(response?.status()).toBe(404);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("We have no record of that object.");
  });
});

test.describe("graveyard, explorer, method", () => {
  test("graveyard separates silent orbiters from re-entered missions", async ({ page }) => {
    await page.goto("/graveyard");
    await expect(page.getByRole("img", { name: /Lifelines of \d+ curated missions/ })).toBeVisible();
    const panel = page.getByRole("tabpanel");
    await expect(panel.getByRole("heading", { name: "Vanguard 1" })).toBeVisible();
    await expect(panel.getByRole("heading", { name: "Hubble Space Telescope" })).toHaveCount(0);
    await page.getByRole("tab", { name: /Returned to Earth/ }).click();
    await expect(panel.getByRole("heading", { name: "Sputnik 1" })).toBeVisible();
    await expect(panel.getByRole("heading", { name: "Aryabhata" })).toBeVisible();
    await page.getByRole("tab", { name: /Catalogue only/ }).click();
    await expect(panel.getByRole("table")).toContainText("TIROS 3");
  });

  test("orbit lab and element decoder compute from stated inputs", async ({ page }) => {
    await page.goto("/explore");
    await page.getByRole("button", { name: "ISS", exact: true }).click();
    await expect(page.getByTestId("lab-period")).toHaveText(/^9[23] min$/);
    await page.getByRole("button", { name: "Syncom 3", exact: true }).click();
    await expect(page.getByTestId("lab-period")).toHaveText(/^23 h 5\d min$/);

    const explain = page.getByTestId("decoder-explain");
    await expect(explain).toContainText("tilted 34.24° to the equator");
    await page.getByRole("button", { name: /^Mean motion:/ }).click();
    await expect(explain).toContainText(/10\.86\d+ orbits per day, so one lap takes about 132\.\d minutes/);
    await expect(page.getByRole("img", { name: /Ages of the \d+ element sets in use/ })).toBeVisible();
    await expect(page.getByText("These have not yet been tried with students")).toBeVisible();
  });

  test("method page states the data mode and the rules", async ({ page }) => {
    await page.goto("/methodology");
    await expect(page.getByText("Demonstration — archived CelesTrak capture, not current data.")).toBeVisible();
    await expect(page.getByTestId("status-panel")).toContainText("Elements fetched live0");
    await expect(page.getByText("heritage-v1")).toBeVisible();
    await expect(page.getByText(/no mock orbital data/)).toBeVisible();
    await expect(page.getByText(/PyEphem/)).toBeVisible();
  });
});

test.describe("layout and accessibility basics", () => {
  for (const path of ["/", "/discover?city=kolkata", "/satellites/5", "/graveyard", "/explore", "/methodology"]) {
    test(`${path} has one h1, a main landmark and no sideways scroll @mobile`, async ({ page }) => {
      await page.goto(path);
      if (path.startsWith("/discover")) await expect(page.getByTestId("results")).toBeVisible();
      await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
      await expect(page.getByRole("main")).toHaveCount(1);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow).toBeLessThanOrEqual(0);
      const unnamed = await page.evaluate(
        () => [...document.querySelectorAll("button, a, input, select")].filter((el) => {
          const e = el as HTMLElement;
          const name = e.getAttribute("aria-label") || e.textContent?.trim() || (e.id && document.querySelector(`label[for="${e.id}"]`)?.textContent) || e.getAttribute("aria-labelledby");
          return !name;
        }).length,
      );
      expect(unnamed).toBe(0);
    });
  }

  test("skip link is the first focusable element", async ({ page }) => {
    await page.goto("/");
    await page.keyboard.press("Tab");
    await expect(page.getByRole("link", { name: "Skip to content" })).toBeFocused();
  });
});
