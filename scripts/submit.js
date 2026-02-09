const form = document.querySelector("#submission-form");

const buildSubmissionPayload = (formData) => {
  return {
    id: crypto.randomUUID(),
    title: formData.get("title"),
    start_date: formData.get("date"),
    time: formData.get("time"),
    city: formData.get("city"),
    location_name: formData.get("location"),
    category: formData.get("category"),
    curated_description: formData.get("description"),
    source: "user",
    source_attribution: "User submission",
    canonical_url: formData.get("url"),
    status: "pending",
  };
};

const storePendingLocally = (payload) => {
  const stored = localStorage.getItem("fff-pending-submissions");
  const submissions = stored ? JSON.parse(stored) : [];
  submissions.push(payload);
  localStorage.setItem("fff-pending-submissions", JSON.stringify(submissions));
};

const downloadPendingJson = async (payload) => {
  // Static sites cannot write to disk, so we fetch the current file,
  // append the new submission, and download a refreshed JSON file.
  const response = await fetch("data/events_pending.json");
  if (!response.ok) {
    return;
  }
  const pending = await response.json();
  pending.events = pending.events || [];
  pending.events.push(payload);
  pending.generated_at = new Date().toISOString();

  const blob = new Blob([JSON.stringify(pending, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "events_pending.json";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

if (form) {
  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const formData = new FormData(form);
    const honeypot = formData.get("company");

    if (honeypot) {
      return;
    }

    const payload = buildSubmissionPayload(formData);

    // Placeholder endpoint for static hosting.
    // Replace with a real API that appends to data/events_pending.json.
    console.log("Submitting event payload", payload);
    storePendingLocally(payload);
    await downloadPendingJson(payload);

    form.reset();
    alert("Thanks! Your event is now in our review queue.");
  });
}
