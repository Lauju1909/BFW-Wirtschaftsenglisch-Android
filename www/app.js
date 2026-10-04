/**
 * app.js – BFW Vokabel-Verwaltung (Zentrale Vokabel-Management-App)
 * Vollständige Themen- und Vokabelverwaltung für Wirtschaftsenglisch (BFW 1 & BFW 2)
 * mit Export- und Übergabefunktion für VokabelStar und VokabelMeister.
 * 100% Barrierefrei (NVDA / TalkBack).
 */

class BFWVocabManager {
  constructor() {
    this.topics = [];
    this.currentFilter = "ALL";
    this.searchQuery = "";
    this.activeTopic = null;
    this.currentEditingWordIndex = -1;

    this.init();
  }

  async init() {
    await this.loadTopics();
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

  // ------------------------------------------
  // DATEN SPEICHERN & LADEN
  // ------------------------------------------
  async loadTopics() {
    try {
      const saved = localStorage.getItem("bfw_vocab_topics");
      if (saved) {
        this.topics = JSON.parse(saved);
      }
    } catch (e) {
      console.warn("Konnte gespeicherte Themen nicht laden:", e);
    }

    // Falls noch nichts gespeichert ist, lade Katalog aus bfw_catalog.json oder bfw_catalog.js
    if (!this.topics || this.topics.length === 0) {
      if (window.BFW_CATALOG && Array.isArray(window.BFW_CATALOG)) {
        this.topics = JSON.parse(JSON.stringify(window.BFW_CATALOG));
      } else {
        try {
          const res = await fetch("bfw_catalog.json");
          if (res.ok) {
            this.topics = await res.json();
          }
        } catch (e) {
          console.error("Fehler beim Laden des Standard-Katalogs:", e);
        }
      }
      this.saveTopics();
    }

    this.updateStats();
  }

  saveTopics() {
    try {
      localStorage.setItem("bfw_vocab_topics", JSON.stringify(this.topics));
    } catch (e) {
      console.error("Fehler beim Speichern der Themen:", e);
    }
    this.updateStats();
  }

  updateStats() {
    const totalWords = this.topics.reduce((sum, t) => sum + (t.words ? t.words.length : 0), 0);
    const topicsEl = document.getElementById("stat-total-topics");
    if (topicsEl) topicsEl.textContent = `${this.topics.length} Themen`;
    const wordsEl = document.getElementById("stat-total-words");
    if (wordsEl) wordsEl.textContent = `${totalWords} Vokabeln`;
  }

  // ------------------------------------------
  // EVENT BINDINGS
  // ------------------------------------------
  bindEvents() {
    // Filter Tabs
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

    // Suchleiste
    const searchInput = document.getElementById("search-input");
    if (searchInput) {
      searchInput.addEventListener("input", (e) => {
        this.searchQuery = e.target.value.toLowerCase().trim();
        this.render();
      });
    }

    // Action Bar Buttons
    document.getElementById("btn-create-topic")?.addEventListener("click", () => {
      this.openTopicModal();
    });

    document.getElementById("btn-open-import")?.addEventListener("click", () => {
      this.openImportModal();
    });

    document.getElementById("btn-backup-all")?.addEventListener("click", () => {
      this.exportCompleteBackup();
    });

    document.getElementById("btn-reset-catalog")?.addEventListener("click", () => {
      this.resetToDefaultCatalog();
    });

    // Vocab Modal Events
    document.getElementById("btn-close-vocab-modal")?.addEventListener("click", () => {
      this.closeVocabModal();
    });

    document.getElementById("modal-search-input")?.addEventListener("input", (e) => {
      this.renderModalWords(e.target.value.toLowerCase().trim());
    });

    document.getElementById("btn-save-word")?.addEventListener("click", () => {
      this.saveWordFromForm();
    });

    document.getElementById("btn-cancel-edit-word")?.addEventListener("click", () => {
      this.resetWordForm();
    });

    document.getElementById("btn-test-speak")?.addEventListener("click", () => {
      const term = document.getElementById("input-word-front")?.value.trim();
      if (term) this.speak(term);
    });

    // Enter key in vocab form saves word
    ["input-word-front", "input-word-back", "input-word-note"].forEach(id => {
      document.getElementById(id)?.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          this.saveWordFromForm();
        }
      });
    });

    // Export buttons inside Vocab Modal
    document.getElementById("modal-btn-download-star")?.addEventListener("click", () => {
      if (this.activeTopic) this.exportForVokabelStar(this.activeTopic);
    });

    document.getElementById("modal-btn-download-meister")?.addEventListener("click", () => {
      if (this.activeTopic) this.exportForVokabelMeister(this.activeTopic);
    });

    document.getElementById("modal-btn-download-txt")?.addEventListener("click", () => {
      if (this.activeTopic) this.exportAsTxt(this.activeTopic);
    });

    document.getElementById("modal-btn-share-topic")?.addEventListener("click", () => {
      if (this.activeTopic) this.shareTopic(this.activeTopic);
    });

    // Topic Modal Events (Create / Edit)
    document.getElementById("btn-close-topic-modal")?.addEventListener("click", () => {
      this.closeTopicModal();
    });
    document.getElementById("btn-cancel-topic")?.addEventListener("click", () => {
      this.closeTopicModal();
    });
    document.getElementById("btn-save-topic")?.addEventListener("click", () => {
      this.saveTopicFromModal();
    });

    // Import Modal Events
    document.getElementById("btn-close-import-modal")?.addEventListener("click", () => {
      this.closeImportModal();
    });
    document.getElementById("btn-cancel-import")?.addEventListener("click", () => {
      this.closeImportModal();
    });
    document.getElementById("btn-execute-import")?.addEventListener("click", () => {
      this.executeImport();
    });

    // Import Radio Mode Switch
    const radioNew = document.getElementById("target-mode-new");
    const radioExisting = document.getElementById("target-mode-existing");
    const groupNew = document.getElementById("group-new-topic-name");
    const groupExisting = document.getElementById("group-existing-topic-select");

    const updateImportModeUI = () => {
      if (radioNew && radioNew.checked) {
        if (groupNew) groupNew.style.display = "block";
        if (groupExisting) groupExisting.style.display = "none";
      } else {
        if (groupNew) groupNew.style.display = "none";
        if (groupExisting) groupExisting.style.display = "block";
      }
    };

    radioNew?.addEventListener("change", updateImportModeUI);
    radioExisting?.addEventListener("change", updateImportModeUI);

    // Escape Key closes modals
    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        this.closeVocabModal();
        this.closeTopicModal();
        this.closeImportModal();
      }
    });
  }

  // ------------------------------------------
  // THEMEN-KARTEN RENDERN
  // ------------------------------------------
  render() {
    const container = document.getElementById("topics-container");
    if (!container) return;
    container.innerHTML = "";

    const filtered = this.topics.filter(topic => {
      // Filter tab
      if (this.currentFilter === "BFW 1" && topic.level !== "BFW 1") return false;
      if (this.currentFilter === "BFW 2" && topic.level !== "BFW 2") return false;
      if (this.currentFilter === "CUSTOM" && topic.level !== "EIGENES") return false;

      // Suchfeld
      if (this.searchQuery) {
        const matchesTitle = (topic.title || "").toLowerCase().includes(this.searchQuery);
        const matchesSub = (topic.subtitle || "").toLowerCase().includes(this.searchQuery);
        const matchesDesc = (topic.desc || "").toLowerCase().includes(this.searchQuery);
        const matchesWord = (topic.words || []).some(w => 
          (w.front || "").toLowerCase().includes(this.searchQuery) || 
          (w.back || "").toLowerCase().includes(this.searchQuery)
        );
        return matchesTitle || matchesSub || matchesDesc || matchesWord;
      }
      return true;
    });

    if (filtered.length === 0) {
      container.innerHTML = `
        <div style="grid-column: 1/-1; text-align: center; padding: 48px 16px; color: var(--text-muted);">
          <p style="font-size: 1.2rem; margin-bottom: 8px;">Keine passenden Themen gefunden.</p>
          <button type="button" class="btn btn-primary" onclick="window.bfwManager.openTopicModal()">
            <span>➕ Jetzt ein neues Thema anlegen</span>
          </button>
        </div>
      `;
      return;
    }

    filtered.forEach(topic => {
      const card = document.createElement("article");
      card.className = "topic-card";
      card.setAttribute("aria-label", `Thema: ${topic.title}`);

      let badgeClass = "badge-custom";
      if (topic.level === "BFW 1") badgeClass = "badge-bfw1";
      if (topic.level === "BFW 2") badgeClass = "badge-bfw2";

      const wordCount = topic.words ? topic.words.length : 0;

      card.innerHTML = `
        <div class="topic-card-header">
          <span class="topic-icon" aria-hidden="true">${topic.icon || "📚"}</span>
          <span class="badge ${badgeClass}">${topic.level}</span>
        </div>
        <div>
          <h2 class="topic-title">${this.escapeHtml(topic.title)}</h2>
          <div class="topic-meta">${this.escapeHtml(topic.subtitle || "")} • <strong>${wordCount} Vokabeln</strong></div>
        </div>
        <p class="topic-desc">${this.escapeHtml(topic.desc || "Keine Beschreibung vorhanden.")}</p>
        
        <div class="topic-card-actions">
          <button type="button" class="btn btn-primary btn-manage" data-id="${topic.id}">
            <span>📝 Vokabeln verwalten (${wordCount})</span>
          </button>
          <div class="topic-action-row">
            <button type="button" class="btn btn-secondary btn-sm flex-1 btn-export-star" data-id="${topic.id}" title="Für VokabelStar exportieren">
              <span>⭐ An VokabelStar</span>
            </button>
            <button type="button" class="btn btn-secondary btn-sm flex-1 btn-export-meister" data-id="${topic.id}" title="Für VokabelMeister exportieren">
              <span>✍️ An VokabelMeister</span>
            </button>
          </div>
          <div class="topic-action-row">
            <button type="button" class="btn btn-secondary btn-sm flex-1 btn-edit-topic" data-id="${topic.id}" title="Thema bearbeiten">
              <span>✏️ Bearbeiten</span>
            </button>
            <button type="button" class="btn btn-danger btn-sm btn-delete-topic" data-id="${topic.id}" title="Thema löschen" aria-label="Thema ${topic.title} löschen">
              <span>🗑️</span>
            </button>
          </div>
        </div>
      `;

      // Event Listeners
      card.querySelector(".btn-manage").addEventListener("click", () => {
        this.openVocabModal(topic);
      });
      card.querySelector(".btn-export-star").addEventListener("click", () => {
        this.exportForVokabelStar(topic);
      });
      card.querySelector(".btn-export-meister").addEventListener("click", () => {
        this.exportForVokabelMeister(topic);
      });
      card.querySelector(".btn-edit-topic").addEventListener("click", () => {
        this.openTopicModal(topic);
      });
      card.querySelector(".btn-delete-topic").addEventListener("click", () => {
        this.deleteTopic(topic);
      });

      container.appendChild(card);
    });
  }

  // ------------------------------------------
  // MODAL 1: VOKABEL-VERWALTUNG EINES THEMAS
  // ------------------------------------------
  openVocabModal(topic) {
    this.activeTopic = topic;
    this.currentEditingWordIndex = -1;

    document.getElementById("modal-topic-title").textContent = topic.title;
    document.getElementById("modal-topic-sub").textContent = `${topic.subtitle} • ${topic.words.length} Vokabeln`;
    document.getElementById("modal-topic-icon").textContent = topic.icon || "📚";

    const searchInput = document.getElementById("modal-search-input");
    if (searchInput) searchInput.value = "";

    this.resetWordForm();
    this.renderModalWords("");

    const modal = document.getElementById("vocab-modal");
    if (modal) {
      modal.style.display = "flex";
      document.getElementById("input-word-front")?.focus();
      this.announce(`Vokabel-Verwaltung für Thema ${topic.title} geöffnet.`);
    }
  }

  closeVocabModal() {
    const modal = document.getElementById("vocab-modal");
    if (modal) modal.style.display = "none";
    this.activeTopic = null;
    this.currentEditingWordIndex = -1;
    this.render();
  }

  renderModalWords(search = "") {
    const list = document.getElementById("modal-vocab-list");
    if (!list || !this.activeTopic) return;
    list.innerHTML = "";

    let words = this.activeTopic.words || [];
    if (search) {
      words = words.filter(w => 
        (w.front || "").toLowerCase().includes(search) || 
        (w.back || "").toLowerCase().includes(search) ||
        (w.note || "").toLowerCase().includes(search)
      );
    }

    // Subtitle aktualisieren
    const sub = document.getElementById("modal-topic-sub");
    if (sub) {
      sub.textContent = `${this.activeTopic.subtitle} • ${this.activeTopic.words.length} Vokabeln ${search ? `(${words.length} Treffer)` : ""}`;
    }

    if (words.length === 0) {
      list.innerHTML = `<li style="text-align: center; color: var(--text-muted); padding: 24px;">Keine Vokabeln vorhanden oder gefunden.</li>`;
      return;
    }

    words.forEach((w) => {
      // Find actual index in topic
      const realIndex = this.activeTopic.words.indexOf(w);

      const li = document.createElement("li");
      li.className = "vocab-item";
      li.innerHTML = `
        <div class="vocab-item-main">
          <span class="vocab-front">${this.escapeHtml(w.front)}</span>
          <button type="button" class="btn-speak" title="Englische Aussprache anhören" aria-label="Aussprache für ${w.front} anhören">🔊</button>
          <span class="vocab-back">→ ${this.escapeHtml(w.back)}</span>
          ${w.note ? `<span class="vocab-note-tag">${this.escapeHtml(w.note)}</span>` : ""}
        </div>
        <div class="vocab-item-actions">
          <button type="button" class="btn-icon btn-edit-word" title="Vokabel bearbeiten" aria-label="Vokabel ${w.front} bearbeiten">✏️</button>
          <button type="button" class="btn-icon btn-del-word" title="Vokabel löschen" aria-label="Vokabel ${w.front} löschen" style="color: var(--danger);">🗑️</button>
        </div>
      `;

      li.querySelector(".btn-speak").addEventListener("click", () => {
        this.speak(w.front);
      });

      li.querySelector(".btn-edit-word").addEventListener("click", () => {
        this.editWord(realIndex);
      });

      li.querySelector(".btn-del-word").addEventListener("click", () => {
        this.deleteWord(realIndex);
      });

      list.appendChild(li);
    });
  }

  saveWordFromForm() {
    if (!this.activeTopic) return;
    const frontInput = document.getElementById("input-word-front");
    const backInput = document.getElementById("input-word-back");
    const noteInput = document.getElementById("input-word-note");

    const front = frontInput?.value.trim();
    const back = backInput?.value.trim();
    const note = noteInput?.value.trim() || "";

    if (!front || !back) {
      alert("Bitte gib sowohl den englischen Begriff als auch die deutsche Übersetzung ein.");
      if (!front) frontInput?.focus(); else backInput?.focus();
      return;
    }

    if (this.currentEditingWordIndex >= 0 && this.currentEditingWordIndex < this.activeTopic.words.length) {
      // Update existing word
      this.activeTopic.words[this.currentEditingWordIndex] = { front, back, note };
      this.announce(`Vokabel "${front}" wurde aktualisiert.`);
    } else {
      // Add new word
      this.activeTopic.words.unshift({ front, back, note });
      this.announce(`Neue Vokabel "${front}" hinzugefügt.`);
    }

    this.saveTopics();
    this.resetWordForm();
    this.renderModalWords(document.getElementById("modal-search-input")?.value.toLowerCase().trim() || "");
  }

  editWord(index) {
    if (!this.activeTopic || index < 0 || index >= this.activeTopic.words.length) return;
    const w = this.activeTopic.words[index];
    this.currentEditingWordIndex = index;

    const frontInput = document.getElementById("input-word-front");
    const backInput = document.getElementById("input-word-back");
    const noteInput = document.getElementById("input-word-note");
    const heading = document.getElementById("vocab-form-heading");
    const saveBtnText = document.getElementById("btn-save-word-text");
    const cancelBtn = document.getElementById("btn-cancel-edit-word");

    if (frontInput) frontInput.value = w.front;
    if (backInput) backInput.value = w.back;
    if (noteInput) noteInput.value = w.note || "";
    if (heading) heading.textContent = `✏️ Vokabel bearbeiten`;
    if (saveBtnText) saveBtnText.textContent = `Änderung speichern`;
    if (cancelBtn) cancelBtn.style.display = "inline-flex";

    frontInput?.focus();
    this.announce(`Bearbeite Vokabel: ${w.front}`);
  }

  deleteWord(index) {
    if (!this.activeTopic || index < 0 || index >= this.activeTopic.words.length) return;
    const w = this.activeTopic.words[index];
    if (confirm(`Möchtest du die Vokabel "${w.front} = ${w.back}" wirklich löschen?`)) {
      this.activeTopic.words.splice(index, 1);
      this.saveTopics();
      if (this.currentEditingWordIndex === index) {
        this.resetWordForm();
      }
      this.renderModalWords(document.getElementById("modal-search-input")?.value.toLowerCase().trim() || "");
      this.announce(`Vokabel "${w.front}" wurde gelöscht.`);
    }
  }

  resetWordForm() {
    this.currentEditingWordIndex = -1;
    const frontInput = document.getElementById("input-word-front");
    const backInput = document.getElementById("input-word-back");
    const noteInput = document.getElementById("input-word-note");
    const heading = document.getElementById("vocab-form-heading");
    const saveBtnText = document.getElementById("btn-save-word-text");
    const cancelBtn = document.getElementById("btn-cancel-edit-word");

    if (frontInput) frontInput.value = "";
    if (backInput) backInput.value = "";
    if (noteInput) noteInput.value = "";
    if (heading) heading.textContent = `➕ Neue Vokabel hinzufügen`;
    if (saveBtnText) saveBtnText.textContent = `Vokabel speichern`;
    if (cancelBtn) cancelBtn.style.display = "none";
  }

  // ------------------------------------------
  // MODAL 2: THEMA ERSTELLEN & BEARBEITEN
  // ------------------------------------------
  openTopicModal(topic = null) {
    const isEdit = topic !== null;
    document.getElementById("topic-modal-title").textContent = isEdit ? "✏️ Thema bearbeiten" : "➕ Neues Thema anlegen";
    document.getElementById("edit-topic-id").value = isEdit ? topic.id : "";
    document.getElementById("input-topic-title").value = isEdit ? topic.title : "";
    document.getElementById("input-topic-sub").value = isEdit ? topic.subtitle : "";
    document.getElementById("select-topic-level").value = isEdit ? topic.level : "EIGENES";
    document.getElementById("input-topic-icon").value = isEdit ? (topic.icon || "📚") : "📚";
    document.getElementById("input-topic-desc").value = isEdit ? (topic.desc || "") : "";

    const modal = document.getElementById("topic-modal");
    if (modal) {
      modal.style.display = "flex";
      document.getElementById("input-topic-title")?.focus();
    }
  }

  closeTopicModal() {
    const modal = document.getElementById("topic-modal");
    if (modal) modal.style.display = "none";
  }

  saveTopicFromModal() {
    const id = document.getElementById("edit-topic-id").value.trim();
    const title = document.getElementById("input-topic-title").value.trim();
    const subtitle = document.getElementById("input-topic-sub").value.trim();
    const level = document.getElementById("select-topic-level").value;
    const icon = document.getElementById("input-topic-icon").value.trim() || "📚";
    const desc = document.getElementById("input-topic-desc").value.trim();

    if (!title) {
      alert("Bitte gib einen Thementitel ein.");
      document.getElementById("input-topic-title")?.focus();
      return;
    }

    if (id) {
      // Bestehendes Thema editieren
      const existing = this.topics.find(t => t.id === id);
      if (existing) {
        existing.title = title;
        existing.subtitle = subtitle;
        existing.level = level;
        existing.icon = icon;
        existing.desc = desc;
        this.announce(`Thema ${title} wurde aktualisiert.`);
      }
    } else {
      // Neues Thema anlegen
      const newId = "custom_" + Date.now();
      const newTopic = {
        id: newId,
        title,
        subtitle: subtitle || "Eigenes Thema",
        level: level || "EIGENES",
        icon,
        desc: desc || "Selbst erstelltes Thema.",
        words: []
      };
      this.topics.unshift(newTopic);
      this.announce(`Neues Thema ${title} angelegt.`);
    }

    this.saveTopics();
    this.closeTopicModal();
    this.render();
  }

  deleteTopic(topic) {
    if (confirm(`Möchtest du das gesamte Thema "${topic.title}" mit allen ${topic.words.length} Vokabeln wirklich löschen?`)) {
      const idx = this.topics.findIndex(t => t.id === topic.id);
      if (idx !== -1) {
        this.topics.splice(idx, 1);
        this.saveTopics();
        this.render();
        this.announce(`Thema ${topic.title} gelöscht.`);
      }
    }
  }

  resetToDefaultCatalog() {
    if (confirm("Möchtest du alle 8 originalen BFW-Themenlisten auf den Auslieferungszustand zurücksetzen? Eigene Themen bleiben erhalten.")) {
      const defaultCatalog = window.BFW_CATALOG || [];
      if (defaultCatalog.length === 0) {
        alert("Standard-Katalog nicht gefunden.");
        return;
      }

      // Keep only custom topics
      const customTopics = this.topics.filter(t => t.id.startsWith("custom_"));
      this.topics = [...JSON.parse(JSON.stringify(defaultCatalog)), ...customTopics];
      this.saveTopics();
      this.render();
      this.announce("Originale BFW-Listen wurden erfolgreich wiederhergestellt.");
    }
  }

  // ------------------------------------------
  // MODAL 3: UNIVERSAL-IMPORT
  // ------------------------------------------
  openImportModal() {
    const select = document.getElementById("import-existing-topic-select");
    if (select) {
      select.innerHTML = "";
      this.topics.forEach(t => {
        const opt = document.createElement("option");
        opt.value = t.id;
        opt.textContent = `${t.title} (${t.words.length} Wörter)`;
        select.appendChild(opt);
      });
    }

    const fileInput = document.getElementById("import-file-input");
    if (fileInput) fileInput.value = "";
    const textInput = document.getElementById("import-text-input");
    if (textInput) textInput.value = "";
    const statusEl = document.getElementById("import-status");
    if (statusEl) statusEl.style.display = "none";

    const modal = document.getElementById("import-modal");
    if (modal) modal.style.display = "flex";
  }

  closeImportModal() {
    const modal = document.getElementById("import-modal");
    if (modal) modal.style.display = "none";
  }

  async executeImport() {
    const statusEl = document.getElementById("import-status");
    statusEl.style.display = "block";
    statusEl.className = "status-msg";
    statusEl.textContent = "Verarbeite Vokabel-Daten …";

    const isNew = document.getElementById("target-mode-new")?.checked;
    const newTitle = document.getElementById("import-new-topic-name")?.value.trim() || "Importierte Vokabelliste";
    const existingId = document.getElementById("import-existing-topic-select")?.value;

    const fileInput = document.getElementById("import-file-input");
    const file = fileInput?.files?.[0];
    const rawText = document.getElementById("import-text-input")?.value.trim();

    let parsedWords = [];

    try {
      if (file) {
        parsedWords = await this.parseFile(file);
      } else if (rawText) {
        parsedWords = this.parseRawText(rawText);
      } else {
        throw new Error("Bitte wähle eine Datei aus oder füge Text ein.");
      }

      if (parsedWords.length === 0) {
        throw new Error("Es konnten keine Vokabelpaare erkannt werden.");
      }

      if (isNew) {
        const newTopic = {
          id: "custom_" + Date.now(),
          title: newTitle,
          subtitle: "Importiert am " + new Date().toLocaleDateString("de-DE"),
          level: "EIGENES",
          icon: "📥",
          desc: `${parsedWords.length} Vokabeln importiert.`,
          words: parsedWords
        };
        this.topics.unshift(newTopic);
        this.announce(`${parsedWords.length} Vokabeln in neues Thema "${newTitle}" importiert.`);
      } else {
        const target = this.topics.find(t => t.id === existingId);
        if (!target) throw new Error("Ziel-Thema wurde nicht gefunden.");
        target.words = [...target.words, ...parsedWords];
        this.announce(`${parsedWords.length} Vokabeln zu Thema "${target.title}" hinzugefügt.`);
      }

      this.saveTopics();
      statusEl.className = "status-msg success";
      statusEl.textContent = `Erfolg: ${parsedWords.length} Vokabeln erfolgreich importiert!`;

      setTimeout(() => {
        this.closeImportModal();
        this.render();
      }, 1200);

    } catch (err) {
      statusEl.className = "status-msg error";
      statusEl.textContent = "Fehler: " + err.message;
    }
  }

  async parseFile(file) {
    const ext = file.name.split(".").pop().toLowerCase();

    if (ext === "json") {
      const text = await file.text();
      const data = JSON.parse(text);
      const items = Array.isArray(data) ? data : (data.words || data.items || []);
      return items.map(it => ({
        front: (it.front || it.english || it.source || "").trim(),
        back: (it.back || it.german || it.target || "").trim(),
        note: (it.note || it.kategorie || "").trim()
      })).filter(w => w.front && w.back);

    } else if (ext === "docx" && window.mammoth) {
      const arrayBuffer = await file.arrayBuffer();
      const res = await window.mammoth.extractRawText({ arrayBuffer });
      return this.parseRawText(res.value);

    } else if (["xlsx", "xls", "csv"].includes(ext) && window.XLSX) {
      const arrayBuffer = await file.arrayBuffer();
      const wb = window.XLSX.read(arrayBuffer, { type: "array" });
      const firstSheet = wb.Sheets[wb.SheetNames[0]];
      const rows = window.XLSX.utils.sheet_to_json(firstSheet, { header: 1 });
      const list = [];
      rows.forEach(r => {
        if (r && r.length >= 2 && r[0] && r[1]) {
          list.push({
            front: String(r[0]).trim(),
            back: String(r[1]).trim(),
            note: r[2] ? String(r[2]).trim() : ""
          });
        }
      });
      return list;

    } else {
      // Text fallback
      const text = await file.text();
      return this.parseRawText(text);
    }
  }

  parseRawText(text) {
    const lines = text.split(/\r?\n/);
    const list = [];
    lines.forEach(l => {
      const clean = l.trim();
      if (!clean) return;
      let sep = "=";
      if (clean.includes(" = ")) sep = " = ";
      else if (clean.includes("\t")) sep = "\t";
      else if (clean.includes(";")) sep = ";";
      else if (clean.includes("|")) sep = "|";
      else if (clean.includes(" - ")) sep = " - ";
      else if (clean.includes("=")) sep = "=";

      const parts = clean.split(sep);
      if (parts.length >= 2) {
        const front = parts[0].trim();
        const back = parts[1].trim();
        const note = parts[2] ? parts[2].trim() : "";
        if (front && back) list.push({ front, back, note });
      }
    });
    return list;
  }

  // ------------------------------------------
  // EXPORT- & WEITERGABE-FUNKTIONEN
  // ------------------------------------------
  exportForVokabelStar(topic) {
    // VokabelStar-kompatibles Format
    const data = {
      title: `[${topic.level}] ${topic.title}`,
      subtitle: topic.subtitle,
      lang: "en-US",
      words: topic.words.map((w, idx) => ({
        id: `${topic.id}_${idx + 1}`,
        source: w.back, // In VokabelStar ist source die Frage (Deutsch)
        target: w.front, // target ist die englische Vokabel
        note: w.note || topic.subtitle,
        box: 1
      }))
    };

    const filename = `VokabelStar_${this.slugify(topic.title)}.json`;
    this.triggerDownloadOrShare(JSON.stringify(data, null, 2), filename, "application/json", `VokabelStar-Export: ${topic.title}`);
  }

  exportForVokabelMeister(topic) {
    // VokabelMeister-kompatibles JSON-Format
    const data = topic.words.map(w => ({
      front: w.front,
      back: w.back,
      kategorie: `BFW: ${topic.title}`,
      lang_front: "Englisch",
      lang_back: "Deutsch",
      attempts: 0,
      correct: 0
    }));

    const filename = `VokabelMeister_${this.slugify(topic.title)}.json`;
    this.triggerDownloadOrShare(JSON.stringify(data, null, 2), filename, "application/json", `VokabelMeister-Export: ${topic.title}`);
  }

  exportAsTxt(topic) {
    const lines = topic.words.map(w => `${w.front} | ${w.back}${w.note ? ` | ${w.note}` : ""}`);
    const filename = `${this.slugify(topic.title)}_Vokabeln.txt`;
    this.triggerDownloadOrShare(lines.join("\n"), filename, "text/plain", `Vokabelliste: ${topic.title}`);
  }

  exportCompleteBackup() {
    const backup = {
      app: "BFW Vokabel-Verwaltung",
      exportedAt: new Date().toISOString(),
      topicCount: this.topics.length,
      topics: this.topics
    };
    const filename = `BFW_Vokabel_GesamtBackup_${new Date().toISOString().slice(0, 10)}.json`;
    this.triggerDownload(JSON.stringify(backup, null, 2), filename, "application/json");
    this.announce("Gesamt-Backup aller Vokabel-Themen wird heruntergeladen.");
  }

  async shareTopic(topic) {
    const lines = topic.words.map(w => `${w.front} = ${w.back}`).join("\n");
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Vokabelliste: ${topic.title}`,
          text: `Vokabeln für ${topic.title} (${topic.words.length} Wörter):\n\n` + lines
        });
        return;
      } catch (e) {
        // Fallback to copy or download
      }
    }
    // Fallback: copy to clipboard
    navigator.clipboard.writeText(lines).then(() => {
      alert(`Vokabelliste "${topic.title}" in die Zwischenablage kopiert!`);
    }).catch(() => {
      this.exportAsTxt(topic);
    });
  }

  triggerDownloadOrShare(content, filename, mimeType, shareTitle) {
    // If Web Share API with files is supported (Android)
    if (navigator.canShare && navigator.canShare({ files: [new File([""], filename, { type: mimeType })] })) {
      try {
        const file = new File([content], filename, { type: mimeType });
        navigator.share({
          title: shareTitle,
          files: [file]
        }).catch(() => this.triggerDownload(content, filename, mimeType));
        return;
      } catch (e) {
        // fallback to download
      }
    }
    this.triggerDownload(content, filename, mimeType);
  }

  triggerDownload(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    this.announce(`Datei "${filename}" wird heruntergeladen.`);
  }

  // ------------------------------------------
  // SPRACHAUSGABE (TTS)
  // ------------------------------------------
  speak(text, lang = "en-US") {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang;
    utterance.rate = 0.95;

    // Englische Stimme bevorzugen
    const voices = window.speechSynthesis.getVoices();
    const enVoice = voices.find(v => v.lang.startsWith("en-") && (v.name.includes("Natural") || v.name.includes("Google") || v.name.includes("English")));
    if (enVoice) utterance.voice = enVoice;

    window.speechSynthesis.speak(utterance);
  }

  // ------------------------------------------
  // HILFSFUNKTIONEN
  // ------------------------------------------
  escapeHtml(str) {
    if (!str) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  slugify(str) {
    return (str || "thema")
      .toLowerCase()
      .replace(/ä/g, "ae")
      .replace(/ö/g, "oe")
      .replace(/ü/g, "ue")
      .replace(/ß/g, "ss")
      .replace(/[^a-z0-9_-]/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_|_$/g, "");
  }
}

window.addEventListener("DOMContentLoaded", () => {
  window.bfwManager = new BFWVocabManager();
});
