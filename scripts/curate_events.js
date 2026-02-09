const fs = require("fs");
const path = require("path");

const RAW_PATH = path.join(__dirname, "..", "data", "events_raw.json");
const CURATED_PATH = path.join(__dirname, "..", "data", "events_curated.json");
const PENDING_PATH = path.join(__dirname, "..", "data", "events_pending.json");

const loadJson = (filePath, fallback) => {
  if (!fs.existsSync(filePath)) {
    return fallback;
  }
  return JSON.parse(fs.readFileSync(filePath, "utf-8"));
};

const inferCity = (location) =>
  location.toLowerCase().includes("jacksonville") ? "Jacksonville" : "St. Augustine";

const inferCategory = (text) => {
  const value = text.toLowerCase();
  if (value.includes("story")) return "Storytime";
  if (value.includes("museum") || value.includes("science")) return "Learning";
  if (value.includes("run") || value.includes("bike") || value.includes("playground")) {
    return "Active";
  }
  if (value.includes("food") || value.includes("market")) return "Food & Fun";
  return "Outdoor";
};

const inferAgeRange = (text) => {
  const value = text.toLowerCase();
  if (value.includes("toddler")) return "0-3";
  if (value.includes("story")) return "4-7";
  if (value.includes("run") || value.includes("bike")) return "8-12";
  return "all";
};

const rewriteDescription = (event) => {
  const base = `Families are invited to ${event.name.toLowerCase()}.`;
  const support =
    "Expect a calm schedule, clear instructions, and space for kids to move or take breaks.";
  const close =
    "We summarize the essentials so parents can plan quickly, then confirm timing on the source link.";
  return `${base} ${support} ${close}`;
};

const toPendingEvent = (rawEvent) => {
  const text = `${rawEvent.name} ${rawEvent.description} ${rawEvent.location}`;
  return {
    id: rawEvent.id,
    title: rawEvent.name,
    start_date: rawEvent.date,
    end_date: null,
    time: null,
    city: inferCity(rawEvent.location),
    location_name: rawEvent.location.split(",")[0],
    category: inferCategory(text),
    age_range: inferAgeRange(text),
    curated_description: rewriteDescription(rawEvent),
    source: "facebook",
    source_attribution: "Public Facebook event",
    canonical_url: rawEvent.url,
    status: "pending",
  };
};

const run = () => {
  const rawPayload = loadJson(RAW_PATH, { events: [] });
  const curatedPayload = loadJson(CURATED_PATH, { events: [] });

  const existingApproved = curatedPayload.events.filter(
    (event) => event.status === "approved"
  );

  const pendingEvents = rawPayload.events.map(toPendingEvent);

  const pendingPayload = {
    generated_at: new Date().toISOString(),
    events: pendingEvents,
  };

  const curatedPayloadUpdated = {
    generated_at: new Date().toISOString(),
    events: existingApproved,
  };

  // Manual moderation happens by moving pending events into the curated file
  // after reviewing details and changing status to "approved".
  fs.writeFileSync(PENDING_PATH, JSON.stringify(pendingPayload, null, 2));
  fs.writeFileSync(CURATED_PATH, JSON.stringify(curatedPayloadUpdated, null, 2));

  console.log(
    `Prepared ${pendingEvents.length} pending events and retained ${existingApproved.length} approved events.`
  );
};

run();
