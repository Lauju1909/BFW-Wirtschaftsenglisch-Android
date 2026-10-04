/**
 * app.js – BFW Wirtschaftsenglisch Vokabel-Hub
 * Ermöglicht das getrennte Herunterladen und Verwalten von Vokabellisten
 * nach Schulthemen sortiert (BFW 1 & BFW 2) für VokabelStar & VokabelMeister.
 */

class BFWVocabHub {
  constructor() {
    this.catalog = [];
    this.downloaded = new Set();
    this.currentFilter = "ALL";
    this.searchQuery = "";
    this.activeTopic = null;

    this.init();
  }

  async init() {
    this.loadDownloadedState();
    await this.loadCatalog();
    this.bindEvents();
    this.render();
  }

  announce(msg) {
    const el = document.getElementById("sr-announcer");
    if (el) {
      el.textContent = "";
      setTimeout(() => { el.textContent = msg; }, 50);
    }
  }

  loadDownloadedState() {
    try {
      const saved = localStorage.getItem("bfw_downloaded_topics");
      if (saved) {
        this.downloaded = new Set(JSON.parse(saved));
      }
    } catch (e) {
      console.warn("Could not load downloaded state:", e);
    }
  }

  saveDownloadedState() {
    try {
      localStorage.setItem("bfw_downloaded_topics", JSON.stringify([...this.downloaded]));
    } catch (e) {
      console.warn("Could not save downloaded state:", e);
    }
    const badge = document.getElementById("downloaded-count");
    if (badge) badge.textContent = this.downloaded.size;
  }

  async loadCatalog() {
    try {
      const res = await fetch("bfw_catalog.json");
      if (res.ok) {
        this.catalog = await res.json();
      }
    } catch (e) {
      console.error("Error loading catalog:", e);
    }

    // Stats
    const totalWords = this.catalog.reduce((sum, t) => sum + (t.count || t.words.length), 0);
    const topicsEl = document.getElementById("stat-total-topics");
    if (topicsEl) topicsEl.textContent = `${this.catalog.length} Themen`;
    const wordsEl = document.getElementById("stat-total-words");
    if (wordsEl) wordsEl.textContent = `${totalWords} Vokabeln`;
    const badge = document.getElementById("downloaded-count");
    if (badge) badge.textContent = this.downloaded.size;
  }

  bindEvents() {
    // Filter tabs
    document.querySelectorAll(".filter-tab").forEach(tab => {
      tab.addEventListener("click", () => {
        document.querySelectorAll(".filter-tab").forEach(t => {
          t.classList.remove("active");
          t.setAttribute("aria-selected", "false");
        });
        tab.classList.add("active");
        tab.setAttribute("aria-selected", "true");
        this.currentFilter = tab.getAttribute("data-filter");
        this.render();
      });
    });

    // Search input
    const searchInput = document.getElementById("search-input");
    if (searchInput) {
      searchInput.addEventListener("input", (e) => {
        this.searchQuery = e.target.value.toLowerCase().trim();
        this.render();
      });
    }

    // Modal close
    document.getElementById("btn-close-modal").addEventListener("click", () => {
      this.closeModal();
    });

    // Modal search
    document.getElementById("modal-search-input").addEventListener("input", (e) => {
      this.renderModalWords(e.target.value.toLowerCase().trim());
    });

    // Modal Download Buttons
    document.getElementById("modal-btn-download-star").addEventListener("click", () => {
      if (this.activeTopic) this.downloadForVokabelStar(this.activeTopic);
    });

    document.getElementById("modal-btn-download-meister").addEventListener("click", () => {
      if (this.activeTopic) this.downloadForVokabelMeister(this.activeTopic);
    });

    document.getElementById("modal-btn-download-txt").addEventListener("click", () => {
      if (this.activeTopic) this.downloadAsTxt(this.activeTopic);
    });
  }

  render() {
    const container = document.getElementById("topics-container");
    if (!container) return;
    container.innerHTML = "";

    const filtered = this.catalog.filter(topic => {
      // Level / Download filter
      if (this.currentFilter === "BFW 1" && topic.level !== "BFW 1") return false;
      if (this.currentFilter === "BFW 2" && topic.level !== "BFW 2") return false;
      if (this.currentFilter === "DOWNLOADED" && !this.downloaded.has(topic.id)) return false;

      // Search query
      if (this.searchQuery) {
        const matchesTitle = topic.title.toLowerCase().includes(this.searchQuery);
        const matchesSub = topic.subtitle.toLowerCase().includes(this.searchQuery);
        const matchesDesc = topic.desc.toLowerCase().includes(this.searchQuery);
        const matchesWord = topic.words.some(w => 
          w.front.toLowerCase().includes(this.searchQuery) || 
          w.back.toLowerCase().includes(this.searchQuery)
        );
        return matchesTitle || matchesSub || matchesDesc || matchesWord;
      }
      return true;
    });

    if (filtered.length === 0) {
      container.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 40px; color: var(--text-muted);">Keine Themen gefunden.</div>`;
      return;
    }

    filtered.forEach(topic => {
      const isDownloaded = this.downloaded.has(topic.id);
      const card = document.createElement("article");
      card.className = "topic-card";
      card.innerHTML = `
        <div class="topic-header">
          <span class="topic-icon" aria-hidden="true">${topic.icon}</span>
          <div class="topic-title-wrap">
            <span class="topic-level-badge ${topic.level === 'BFW 1' ? 'bfw1' : 'bfw2'}">${topic.level}</span>
            <h2 class="topic-title">${topic.title}</h2>
            <div class="topic-subtitle">${topic.subtitle}</div>
          </div>
        </div>

        <p class="topic-desc">${topic.desc}</p>

        <div class="topic-meta">
          <span><strong>${topic.count || topic.words.length}</strong> Vokabeln</span>
          <span class="download-status-badge ${isDownloaded ? 'downloaded' : 'not-downloaded'}">
            ${isDownloaded ? '✅ Heruntergeladen' : '⚪ Nicht geladen'}
          </span>
        </div>

        <div class="topic-actions">
          <div class="btn-row">
            <button type="button" class="btn btn-secondary" data-preview="${topic.id}">
              <span>👁️ Vokabeln ansehen</span>
            </button>
            ${isDownloaded 
              ? `<button type="button" class="btn btn-danger" data-del="${topic.id}" title="Thema aus lokalem Speicher entfernen">🗑️ Löschen</button>`
              : `<button type="button" class="btn btn-primary" data-save="${topic.id}">📥 Laden</button>`
            }
          </div>
          <div class="btn-row">
            <button type="button" class="btn btn-outline" data-dl-star="${topic.id}" title="JSON für VokabelStar">
              <span>⭐ VokabelStar</span>
            </button>
            <button type="button" class="btn btn-outline" data-dl-meister="${topic.id}" title="JSON für VokabelMeister">
              <span>✍️ VokabelMeister</span>
            </button>
          </div>
        </div>
      `;

      // Event Listeners
      card.querySelector(`[data-preview="${topic.id}"]`).addEventListener("click", () => {
        this.openModal(topic);
      });

      const saveBtn = card.querySelector(`[data-save="${topic.id}"]`);
      if (saveBtn) {
        saveBtn.addEventListener("click", () => {
          this.downloaded.add(topic.id);
          this.saveDownloadedState();
          this.announce(`${topic.title} wurde heruntergeladen.`);
          this.render();
        });
      }

      const delBtn = card.querySelector(`[data-del="${topic.id}"]`);
      if (delBtn) {
        delBtn.addEventListener("click", () => {
          if (confirm(`Thema '${topic.title}' wirklich aus dem lokalen Download-Speicher löschen?`)) {
            this.downloaded.delete(topic.id);
            this.saveDownloadedState();
            this.announce(`${topic.title} wurde gelöscht.`);
            this.render();
          }
        });
      }

      card.querySelector(`[data-dl-star="${topic.id}"]`).addEventListener("click", () => {
        this.downloadForVokabelStar(topic);
      });

      card.querySelector(`[data-dl-meister="${topic.id}"]`).addEventListener("click", () => {
        this.downloadForVokabelMeister(topic);
      });

      container.appendChild(card);
    });
  }

  openModal(topic) {
    this.activeTopic = topic;
    document.getElementById("modal-topic-icon").textContent = topic.icon;
    document.getElementById("modal-topic-title").textContent = topic.title;
    document.getElementById("modal-topic-sub").textContent = `${topic.level} • ${topic.subtitle} • ${topic.words.length} Vokabeln`;
    document.getElementById("modal-search-input").value = "";

    this.renderModalWords("");
    document.getElementById("vocab-modal").style.display = "flex";
    this.announce(`Vokabel-Details für ${topic.title} geöffnet.`);
  }

  closeModal() {
    document.getElementById("vocab-modal").style.display = "none";
    this.activeTopic = null;
  }

  renderModalWords(searchQuery) {
    if (!this.activeTopic) return;
    const list = document.getElementById("modal-vocab-list");
    list.innerHTML = "";

    const words = this.activeTopic.words.filter(w => {
      if (!searchQuery) return true;
      return w.front.toLowerCase().includes(searchQuery) || w.back.toLowerCase().includes(searchQuery);
    });

    if (words.length === 0) {
      list.innerHTML = `<li style="text-align: center; color: var(--text-muted); padding: 20px;">Keine Vokabeln gefunden.</li>`;
      return;
    }

    words.forEach(w => {
      const li = document.createElement("li");
      li.className = "vocab-item";
      li.innerHTML = `
        <span class="vocab-front">${w.front}</span>
        <button type="button" class="btn-speak" aria-label="Aussprache für ${w.front} anhören">🔊</button>
        <span class="vocab-back">${w.back}</span>
      `;

      li.querySelector(".btn-speak").addEventListener("click", () => {
        this.speak(w.front, "en-US");
      });

      list.appendChild(li);
    });
  }

  speak(text, lang = "en-US") {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang;
    window.speechSynthesis.speak(utterance);
  }

  downloadForVokabelStar(topic) {
    // Format compatible with VokabelStar (id, front, back, options, etc.)
    const data = topic.words.map((w, idx) => ({
      id: `${topic.id}_${idx + 1}`,
      front: w.front,
      back: w.back,
      topic: topic.title,
      level: topic.level,
      langFront: "Englisch",
      langBack: "Deutsch"
    }));

    this.triggerDownload(
      JSON.stringify(data, null, 2),
      `VokabelStar_${topic.id}.json`,
      "application/json"
    );
    this.downloaded.add(topic.id);
    this.saveDownloadedState();
    this.render();
  }

  downloadForVokabelMeister(topic) {
    // Format compatible with VokabelMeister (front, back, kategorie, lang_front, lang_back, attempts, correct)
    const data = topic.words.map(w => ({
      front: w.front,
      back: w.back,
      kategorie: `BFW: ${topic.title}`,
      lang_front: "Englisch",
      lang_back: "Deutsch",
      attempts: 0,
      correct: 0
    }));

    this.triggerDownload(
      JSON.stringify(data, null, 2),
      `VokabelMeister_${topic.id}.json`,
      "application/json"
    );
    this.downloaded.add(topic.id);
    this.saveDownloadedState();
    this.render();
  }

  downloadAsTxt(topic) {
    const lines = topic.words.map(w => `${w.front} | ${w.back}`);
    this.triggerDownload(
      lines.join("\n"),
      `${topic.id}_Vokabeln.txt`,
      "text/plain"
    );
  }

  triggerDownload(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    this.announce(`Datei ${filename} wird heruntergeladen.`);
  }
}

window.addEventListener("DOMContentLoaded", () => {
  window.bfwHub = new BFWVocabHub();
});
