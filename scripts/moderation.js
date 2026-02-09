const fs = require("fs");
const path = require("path");

const CURATED_PATH = path.join(__dirname, "..", "data", "events_curated.json");
const PENDING_PATH = path.join(__dirname, "..", "data", "events_pending.json");

const loadJson = (filePath, fallback) => {
  if (!fs.existsSync(filePath)) {
    return fallback;
  }
  return JSON.parse(fs.readFileSync(filePath, "utf-8"));
};

const saveJson = (filePath, payload) => {
  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2));
};

const approveEvent = (eventId) => {
  const pending = loadJson(PENDING_PATH, { events: [] });
  const curated = loadJson(CURATED_PATH, { events: [] });

  const remaining = [];
  let approvedEvent = null;

  pending.events.forEach((event) => {
    if (event.id === eventId) {
      approvedEvent = { ...event, status: "approved" };
    } else {
      remaining.push(event);
    }
  });

  if (!approvedEvent) {
    console.log("Event not found in pending list.");
    return;
  }

  curated.events.push(approvedEvent);

  saveJson(PENDING_PATH, { ...pending, events: remaining });
  saveJson(CURATED_PATH, { ...curated, events: curated.events });

  console.log(`Approved event ${eventId}.`);
};

// Example usage: node scripts/moderation.js approve pending-1
const [command, eventId] = process.argv.slice(2);
if (command === "approve" && eventId) {
  approveEvent(eventId);
}

module.exports = { approveEvent };
