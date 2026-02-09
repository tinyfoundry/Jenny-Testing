const DATA_PATH = "data/events_curated.json";
const REGION_STORAGE_KEY = "fff-region";
const SAVED_STORAGE_KEY = "fff-saved-events";

const elements = {
  featuredContainer: document.querySelector("#featured-events"),
  featuredTitle: document.querySelector("#featured-title"),
  featuredMeta: document.querySelector("#featured-meta"),
  featuredDescription: document.querySelector("#featured-description"),
  regionToggle: document.querySelector(".toggle"),
  eventsGrid: document.querySelector("#events-grid"),
  filterRegion: document.querySelector("#filter-region"),
  filterCategory: document.querySelector("#filter-category"),
  filterAge: document.querySelector("#filter-age"),
  filterDate: document.querySelector("#filter-date"),
  filterSearch: document.querySelector("#filter-search"),
};

const loadEvents = async () => {
  const response = await fetch(DATA_PATH);
  if (!response.ok) {
    throw new Error("Unable to load events.");
  }
  const payload = await response.json();
  return payload.events || [];
};

const getSavedEvents = () => {
  const stored = localStorage.getItem(SAVED_STORAGE_KEY);
  if (!stored) {
    return new Set();
  }
  try {
    return new Set(JSON.parse(stored));
  } catch (error) {
    return new Set();
  }
};

const saveSavedEvents = (savedSet) => {
  localStorage.setItem(SAVED_STORAGE_KEY, JSON.stringify([...savedSet]));
};

const formatDate = (isoDate) => {
  const date = new Date(isoDate);
  if (Number.isNaN(date.valueOf())) {
    return "Date TBA";
  }
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    weekday: "short",
  });
};

const buildEventMeta = (event) => {
  const dateLabel = formatDate(event.start_date);
  const timeLabel = event.time ? ` • ${event.time}` : "";
  return `${dateLabel}${timeLabel} • ${event.location_name}`;
};

const createEventCard = (event, savedSet) => {
  const card = document.createElement("article");
  card.className = "card event-card";

  const title = document.createElement("h3");
  title.textContent = event.title;

  const meta = document.createElement("p");
  meta.className = "event-meta";
  meta.textContent = buildEventMeta(event);

  const description = document.createElement("p");
  description.textContent = event.curated_description;

  const pill = document.createElement("span");
  pill.className = "pill";
  pill.textContent = event.category;

  const actionRow = document.createElement("div");
  actionRow.className = "event-actions";

  const saveButton = document.createElement("button");
  saveButton.className = "secondary-button";
  saveButton.type = "button";
  saveButton.textContent = savedSet.has(event.id) ? "Saved" : "Save";

  saveButton.addEventListener("click", () => {
    if (savedSet.has(event.id)) {
      savedSet.delete(event.id);
      saveButton.textContent = "Save";
    } else {
      savedSet.add(event.id);
      saveButton.textContent = "Saved";
    }
    saveSavedEvents(savedSet);
  });

  const shareButton = document.createElement("button");
  shareButton.className = "secondary-button";
  shareButton.type = "button";
  shareButton.textContent = "Share";

  shareButton.addEventListener("click", async () => {
    const shareData = {
      title: event.title,
      text: event.curated_description,
      url: event.canonical_url,
    };

    if (navigator.share) {
      await navigator.share(shareData);
      return;
    }

    try {
      await navigator.clipboard.writeText(event.canonical_url);
      shareButton.textContent = "Link copied";
      setTimeout(() => {
        shareButton.textContent = "Share";
      }, 2000);
    } catch (error) {
      shareButton.textContent = "Copy failed";
      setTimeout(() => {
        shareButton.textContent = "Share";
      }, 2000);
    }
  });

  actionRow.append(saveButton, shareButton);
  card.append(title, meta, description, pill, actionRow);

  return card;
};

const renderFeaturedEvents = (events, region) => {
  if (!elements.featuredContainer) {
    return;
  }

  const savedSet = getSavedEvents();
  const filtered = events.filter((event) => event.city === region).slice(0, 3);
  elements.featuredContainer.innerHTML = "";

  if (filtered.length === 0) {
    elements.featuredContainer.innerHTML = "<p>No featured events yet.</p>";
    return;
  }

  filtered.forEach((event) => {
    elements.featuredContainer.append(createEventCard(event, savedSet));
  });
};

const updateHeroSpotlight = (events, region) => {
  if (!elements.featuredTitle) {
    return;
  }

  const spotlight = events.find((event) => event.city === region) || events[0];
  if (!spotlight) {
    elements.featuredTitle.textContent = "No events yet";
    elements.featuredMeta.textContent = "";
    elements.featuredDescription.textContent = "";
    return;
  }

  elements.featuredTitle.textContent = spotlight.title;
  elements.featuredMeta.textContent = buildEventMeta(spotlight);
  elements.featuredDescription.textContent = spotlight.curated_description;
};

const renderEventsList = (events) => {
  if (!elements.eventsGrid) {
    return;
  }

  const savedSet = getSavedEvents();
  elements.eventsGrid.innerHTML = "";

  events.forEach((event) => {
    elements.eventsGrid.append(createEventCard(event, savedSet));
  });
};

const getCurrentRegion = () => {
  const stored = localStorage.getItem(REGION_STORAGE_KEY);
  return stored || "St. Augustine";
};

const setRegionToggle = (region) => {
  if (!elements.regionToggle) {
    return;
  }

  const buttons = elements.regionToggle.querySelectorAll("button");
  buttons.forEach((button) => {
    const isActive = button.dataset.region === region;
    button.classList.toggle("active", isActive);
  });
};

const attachRegionToggle = (events) => {
  if (!elements.regionToggle) {
    return;
  }

  elements.regionToggle.addEventListener("click", (event) => {
    const target = event.target.closest("button");
    if (!target) {
      return;
    }
    const region = target.dataset.region;
    localStorage.setItem(REGION_STORAGE_KEY, region);
    setRegionToggle(region);
    renderFeaturedEvents(events, region);
    updateHeroSpotlight(events, region);
  });
};

const filterEvents = (events) => {
  const regionValue = elements.filterRegion?.value || "all";
  const categoryValue = elements.filterCategory?.value || "all";
  const ageValue = elements.filterAge?.value || "all";
  const dateValue = elements.filterDate?.value || "";
  const searchValue = elements.filterSearch?.value.toLowerCase() || "";

  return events.filter((event) => {
    const matchesRegion = regionValue === "all" || event.city === regionValue;
    const matchesCategory = categoryValue === "all" || event.category === categoryValue;
    const matchesAge =
      ageValue === "all" || (event.age_range || "all").toLowerCase() === ageValue.toLowerCase();
    const matchesDate =
      !dateValue || new Date(event.start_date).toISOString().slice(0, 10) >= dateValue;
    const matchesSearch =
      !searchValue ||
      event.title.toLowerCase().includes(searchValue) ||
      event.curated_description.toLowerCase().includes(searchValue) ||
      event.location_name.toLowerCase().includes(searchValue);

    return matchesRegion && matchesCategory && matchesAge && matchesDate && matchesSearch;
  });
};

const attachFilters = (events) => {
  if (!elements.eventsGrid) {
    return;
  }

  const update = () => {
    const filtered = filterEvents(events);
    renderEventsList(filtered);
  };

  [
    elements.filterRegion,
    elements.filterCategory,
    elements.filterAge,
    elements.filterDate,
    elements.filterSearch,
  ].forEach((input) => {
    if (input) {
      input.addEventListener("input", update);
    }
  });

  update();
};

const attachHeroActions = (events) => {
  const viewButton = document.querySelector("[data-action='view-events']");
  const saveButton = document.querySelector("[data-action='save-featured']");
  if (viewButton) {
    viewButton.addEventListener("click", () => {
      window.location.href = "events.html";
    });
  }

  if (saveButton) {
    saveButton.addEventListener("click", () => {
      const region = getCurrentRegion();
      const spotlight = events.find((event) => event.city === region) || events[0];
      if (!spotlight) {
        return;
      }
      const savedSet = getSavedEvents();
      savedSet.add(spotlight.id);
      saveSavedEvents(savedSet);
      saveButton.textContent = "Saved";
    });
  }
};

const init = async () => {
  try {
    const events = await loadEvents();
    const currentRegion = getCurrentRegion();

    setRegionToggle(currentRegion);
    updateHeroSpotlight(events, currentRegion);
    renderFeaturedEvents(events, currentRegion);
    renderEventsList(events);
    attachRegionToggle(events);
    attachFilters(events);
    attachHeroActions(events);
  } catch (error) {
    if (elements.featuredContainer) {
      elements.featuredContainer.innerHTML = "<p>Unable to load events right now.</p>";
    }
    if (elements.eventsGrid) {
      elements.eventsGrid.innerHTML = "<p>Unable to load events right now.</p>";
    }
  }
};

init();
