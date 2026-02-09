const fs = require("fs");
const path = require("path");

const OUTPUT_PATH = path.join(__dirname, "..", "data", "events_raw.json");
const KEYWORDS = [
  "kids",
  "family",
  "storytime",
  "playground",
  "library",
  "festival",
  "museum",
];
const ALLOWED_CITIES = ["St. Augustine", "Jacksonville"];

const mockApiResponse = {
  events: [
    {
      id: "fb-101",
      name: "Library Storytime",
      description: "Weekly storytime with songs and a small craft.",
      date: "2024-03-08",
      location: "St. Johns County Library, St. Augustine",
      url: "https://facebook.com/events/library-storytime",
      keywords: ["storytime", "kids"],
    },
    {
      id: "fb-102",
      name: "Family Museum Morning",
      description: "Interactive exhibits and a kid-friendly scavenger hunt.",
      date: "2024-03-12",
      location: "Museum of Science & History, Jacksonville",
      url: "https://facebook.com/events/family-museum-morning",
      keywords: ["museum", "family"],
    },
    {
      id: "fb-103",
      name: "Sunset Playground Meetup",
      description: "Meet other families at the playground with light snacks.",
      date: "2024-04-02",
      location: "Treaty Oak Park, Jacksonville",
      url: "https://facebook.com/events/playground-meetup",
      keywords: ["playground", "family"],
    },
    {
      id: "fb-104",
      name: "Spring Festival",
      description: "Community festival with food, music, and kids activities.",
      date: "2024-05-01",
      location: "Downtown Plaza, St. Augustine",
      url: "https://facebook.com/events/spring-festival",
      keywords: ["festival", "family"],
    }
  ],
};

const isWithinDays = (dateString, days = 30) => {
  const today = new Date();
  const target = new Date(dateString);
  const diff = target.getTime() - today.getTime();
  const diffDays = diff / (1000 * 60 * 60 * 24);
  return diffDays >= 0 && diffDays <= days;
};

const matchesCity = (location) =>
  ALLOWED_CITIES.some((city) => location.toLowerCase().includes(city.toLowerCase()));

const matchesKeywords = (event) =>
  event.keywords.some((keyword) => KEYWORDS.includes(keyword));

const fetchMockEvents = () => {
  // In production, replace this with a real API call to a public events provider.
  return mockApiResponse.events;
};

const run = () => {
  const events = fetchMockEvents()
    .filter((event) => isWithinDays(event.date))
    .filter((event) => matchesCity(event.location))
    .filter((event) => matchesKeywords(event))
    .map((event) => ({
      id: event.id,
      name: event.name,
      description: event.description,
      date: event.date,
      location: event.location,
      url: event.url,
    }));

  const payload = {
    generated_at: new Date().toISOString(),
    source: "mock_facebook_api",
    events,
  };

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(payload, null, 2));
  console.log(`Saved ${events.length} raw events to ${OUTPUT_PATH}`);
};

run();
