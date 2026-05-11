export function createSearchSuggestions(deps) {
  let debounceTimer = null;
  let abortController = null;
  let suggestions = [];
  let selectedIndex = -1;
  let open = false;

  const dropdown = document.createElement("div");
  dropdown.className = "ca-suggest";
  dropdown.setAttribute("role", "listbox");
  dropdown.hidden = true;
  deps.form.append(dropdown);

  function wire() {
    deps.input.setAttribute("role", "combobox");
    deps.input.setAttribute("aria-autocomplete", "list");
    deps.input.setAttribute("aria-expanded", "false");

    deps.input.addEventListener("input", () => handleInput(deps.input.value));
    deps.input.addEventListener("focus", () => {
      if (suggestions.length > 0) setOpen(true);
    });
    deps.input.addEventListener("keydown", handleKeydown);
    document.addEventListener("click", handleDocumentClick);
  }

  function handleInput(value) {
    selectedIndex = -1;
    if (debounceTimer !== null) window.clearTimeout(debounceTimer);
    if (abortController !== null) abortController.abort();

    const query = value.trim();
    if (query.length === 0) {
      suggestions = [];
      setOpen(false);
      render();
      return;
    }

    setOpen(true);
    renderLoading();
    debounceTimer = window.setTimeout(async () => {
      abortController = new AbortController();
      try {
        const result = await deps.api(`/api/suggest?q=${encodeURIComponent(query)}`, {
          signal: abortController.signal,
        });
        suggestions = result.pages ?? [];
        selectedIndex = -1;
        setOpen(suggestions.length > 0);
        render();
      } catch {
        if (!abortController.signal.aborted) {
          suggestions = [];
          setOpen(false);
          render();
        }
      }
    }, 180);
  }

  function handleKeydown(event) {
    if (!open || suggestions.length === 0) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      selectedIndex = selectedIndex < suggestions.length - 1 ? selectedIndex + 1 : 0;
      render();
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      selectedIndex = selectedIndex > 0 ? selectedIndex - 1 : suggestions.length - 1;
      render();
      return;
    }
    if (event.key === "Escape") {
      setOpen(false);
      selectedIndex = -1;
      return;
    }
    if (event.key === "Enter" && selectedIndex >= 0) {
      event.preventDefault();
      navigateToSuggestion(suggestions[selectedIndex]);
    }
  }

  function handleDocumentClick(event) {
    if (!deps.form.contains(event.target)) setOpen(false);
  }

  function renderLoading() {
    dropdown.innerHTML = `
      <div class="ca-suggest-state">
        <span class="ca-suggest-state-mark" aria-hidden="true">⌘</span>
        Searching the index...
      </div>
    `;
  }

  function render() {
    if (suggestions.length === 0) {
      dropdown.innerHTML = "";
      return;
    }
    dropdown.innerHTML = suggestions.map((page, index) => suggestionRow(page, index)).join("");
    dropdown.querySelectorAll("[data-suggestion-index]").forEach((button) => {
      button.addEventListener("mousedown", (event) => {
        event.preventDefault();
        const index = Number(button.getAttribute("data-suggestion-index"));
        navigateToSuggestion(suggestions[index]);
      });
      button.addEventListener("mouseenter", () => {
        selectedIndex = Number(button.getAttribute("data-suggestion-index"));
        render();
      });
    });
  }

  function suggestionRow(page, index) {
    const selected = index === selectedIndex;
    const topics = page.topics?.slice(0, 2).join(", ") ?? "";
    const detail = page.summary || topics || page.slug;
    return `
      <button
        class="ca-suggest-item ${selected ? "ca-suggest-item-selected" : ""}"
        type="button"
        role="option"
        aria-selected="${selected ? "true" : "false"}"
        data-suggestion-index="${deps.escapeAttr(index)}"
      >
        <span class="ca-suggest-title">${deps.escapeHtml(page.title ?? page.slug)}</span>
        <span class="ca-suggest-detail">${deps.escapeHtml(detail)}</span>
      </button>
    `;
  }

  function navigateToSuggestion(page) {
    if (!page) return;
    setOpen(false);
    deps.input.value = "";
    deps.navigate(`/page/${page.slug}`);
  }

  function setOpen(nextOpen) {
    open = nextOpen;
    dropdown.hidden = !open;
    deps.input.setAttribute("aria-expanded", open ? "true" : "false");
  }

  return { wire };
}
