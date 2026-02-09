const searchInput = document.querySelector("#event-search");
const eventCards = Array.from(document.querySelectorAll(".event-card"));

if (searchInput) {
  searchInput.addEventListener("input", (event) => {
    const query = event.target.value.trim().toLowerCase();

    eventCards.forEach((card) => {
      const text = card.textContent.toLowerCase();
      const tags = card.dataset.tags || "";
      const match = text.includes(query) || tags.includes(query);
      card.style.display = match || query.length === 0 ? "flex" : "none";
    });
  });
}
