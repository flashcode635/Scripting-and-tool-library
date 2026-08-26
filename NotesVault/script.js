// ---------- State ----------
    let vaultHandle = null;
    let notesHandle = null;
    let attachmentsHandle = null;

    let currentNoteFileName = null;
    let autoSaveTimer = null;
    let saveErrorShown = false;

    let useLocalStorage = false;
    let localNotes = {};

    // ---------- UI helpers ----------
    function setSaveStatus(state, text) {
      const el = document.getElementById('save-status');
      el.dataset.state = state;
      el.textContent = text;
    }

    // ---------- LocalStorage helpers ----------
    function loadFromLocalStorage() {
      const saved = localStorage.getItem('localWebNotes');
      localNotes = saved ? JSON.parse(saved) : {};
    }

    function saveToLocalStorage() {
      try {
        localStorage.setItem('localWebNotes', JSON.stringify(localNotes));
      } catch (e) {
        alert("Browser storage full (~5MB limit). Delete some notes/images, or export the ZIP and clean up.");
      }
    }

    // ---------- Folder helpers ----------
    async function getOrCreateDir(parent, name) {
      try {
        const existing = await parent.getDirectoryHandle(name);
        console.log(`[Vault] Folder "${name}" already exists — using it.`);
        return existing;
      } catch (e) {
        if (e.name === 'NotFoundError') {
          console.log(`[Vault] Folder "${name}" missing — creating it.`);
          return await parent.getDirectoryHandle(name, { create: true });
        }
        throw e;
      }
    }

    async function ensureWritePermission() {
      if (!vaultHandle || !vaultHandle.queryPermission) return;
      let status = await vaultHandle.queryPermission({ mode: 'readwrite' });
      if (status !== 'granted' && vaultHandle.requestPermission) {
        status = await vaultHandle.requestPermission({ mode: 'readwrite' });
      }
      if (status !== 'granted') throw new Error('Write permission not granted');
    }

    // ---------- 1. Init Vault ----------
    async function initVault() {
      if (!('showDirectoryPicker' in window)) {
        const useFallback = confirm(
          "File System Access API is not available here.\n\n" +
          "(Brave users: enable brave://flags/#file-system-access-api first)\n\n" +
          "Use 'Browser Storage' mode instead? Notes stay inside the browser and can be exported as a ZIP anytime."
        );
        if (useFallback) {
          useLocalStorage = true;
          document.getElementById('vault-name').innerText = "My Vault";
          document.getElementById('welcome-screen').style.display = 'none';
          loadFromLocalStorage();
          const names = await refreshNoteList();
          if (names.length) await openNote(names[0]);
          else await createNewNote();
        } else {
          alert("For folder mode: use Chrome/Chromium/Edge (or Brave with the flag enabled) and open via http://localhost:8000");
        }
        return;
      }

      try {
        vaultHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
        await ensureWritePermission();

        notesHandle = await getOrCreateDir(vaultHandle, 'notes');
        attachmentsHandle = await getOrCreateDir(vaultHandle, 'attachments');

        document.getElementById('vault-name').innerText = vaultHandle.name;
        document.getElementById('welcome-screen').style.display = 'none';

        const names = await refreshNoteList();
        if (names.length) await openNote(names[0]);
      } catch (err) {
        if (err.name !== 'AbortError') {
          console.error("Vault Init Error:", err);
          alert("Error accessing folder: " + err.message);
        }
      }
    }

    // ---------- 2. Note List ----------
    async function getNoteNames() {
      const names = [];
      if (useLocalStorage) {
        names.push(...Object.keys(localNotes).filter(n => n.endsWith('.html')));
      } else if (notesHandle) {
        for await (const entry of notesHandle.values()) {
          if (entry.kind === 'file' && entry.name.endsWith('.html')) names.push(entry.name);
        }
      }
      return names.sort();
    }

    async function refreshNoteList() {
      const names = await getNoteNames();
      const listEl = document.getElementById('note-list');
      listEl.innerHTML = '';
      names.forEach(addNoteListItem);
      return names;
    }

    function addNoteListItem(fileName) {
      const li = document.createElement('li');
      li.className = 'note-item' + (fileName === currentNoteFileName ? ' active' : '');
      const titleText = fileName.replace('.html', '');
      li.innerHTML = `
        <span class="note-name" onclick="openNote('${fileName}')">${titleText}</span>
        <span class="delete-btn" onclick="deleteNote('${fileName}', event)">✕</span>
      `;
      document.getElementById('note-list').appendChild(li);
    }

    // ---------- 3. Create Note ----------
    async function createNewNote() {
      const baseName = "Untitled";
      let fileName = `${baseName}.html`;
      let counter = 1;

      try {
        if (useLocalStorage) {
          while (localNotes[fileName]) fileName = `${baseName}_${counter++}.html`;
          localNotes[fileName] = `<h1>${fileName.replace('.html', '')}</h1><p></p>`;
          saveToLocalStorage();
        } else {
          if (!notesHandle) return;
          while (await fileExists(notesHandle, fileName)) fileName = `${baseName}_${counter++}.html`;
          const fh = await notesHandle.getFileHandle(fileName, { create: true });
          const w = await fh.createWritable();
          await w.write(`<h1>${fileName.replace('.html', '')}</h1><p></p>`);
          await w.close();
        }
        await refreshNoteList();
        await openNote(fileName);
      } catch (err) {
        console.error("Create failed:", err);
        alert("Could not create note: " + err.message);
      }
    }

    // ---------- 4. Open Note ----------
    async function openNote(fileName) {
      currentNoteFileName = fileName;
      let content = '';

      if (useLocalStorage) {
        content = localNotes[fileName] || '';
      } else {
        const fh = await notesHandle.getFileHandle(fileName);
        const file = await fh.getFile();
        content = await file.text();
      }

      document.getElementById('note-title').value = fileName.replace('.html', '');

      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = content;

      const h1 = tempDiv.querySelector('h1');
      if (h1) h1.remove();

      if (!useLocalStorage) {
        for (let img of tempDiv.querySelectorAll('img')) {
          const src = img.getAttribute('src');
          if (src && src.startsWith('../attachments/')) {
            const imageName = src.replace('../attachments/', '');
            try {
              const imgFile = await (await attachmentsHandle.getFileHandle(imageName)).getFile();
              img.src = URL.createObjectURL(imgFile);
              img.dataset.filename = imageName;
            } catch (e) {
              console.error("Image load failed:", imageName);
            }
          }
        }
      }

      document.getElementById('editor').innerHTML = tempDiv.innerHTML;
      highlightAllCodeBlocks();
      setSaveStatus('saved', 'Saved');
      await refreshNoteList();
    }

    // ---------- 5. Save Note ----------
    async function saveCurrentNote() {
      if (!currentNoteFileName) return;
      setSaveStatus('saving', 'Saving…');

      try {
        const title = document.getElementById('note-title').value.trim() || 'Untitled';
        const editorDiv = document.getElementById('editor').cloneNode(true);

        if (useLocalStorage) {
          localNotes[currentNoteFileName] = `<h1>${title}</h1>\n${editorDiv.innerHTML}`;
          saveToLocalStorage();
        } else {
          await ensureWritePermission();

          editorDiv.querySelectorAll('img').forEach(img => {
            if (img.dataset.filename) {
              img.src = `../attachments/${img.dataset.filename}`;
              img.removeAttribute('data-filename');
            }
          });

          const fh = await notesHandle.getFileHandle(currentNoteFileName, { create: true });
          const w = await fh.createWritable();
          await w.write(`<h1>${title}</h1>\n${editorDiv.innerHTML}`);
          await w.close();
        }

        saveErrorShown = false;
        setSaveStatus('saved', 'Saved');
      } catch (err) {
        console.error("Save failed:", err);
        setSaveStatus('error', 'Save failed');
        if (!saveErrorShown) {
          saveErrorShown = true;
          alert("Save failed: " + err.message + "\n\nIf this is a permission issue, reload the page and select the vault folder again.");
        }
      }
    }

    function triggerAutoSave() {
      setSaveStatus('unsaved', 'Unsaved…');
      clearTimeout(autoSaveTimer);
      autoSaveTimer = setTimeout(saveCurrentNote, 500);
    }

    document.getElementById('editor').addEventListener('input', triggerAutoSave);
    document.getElementById('note-title').addEventListener('input', triggerAutoSave);

    // Ctrl+S = instant save
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        saveCurrentNote();
      }
    });

    // ---------- Rename File Helper ----------
    async function renameCurrentNote() {
      if (!currentNoteFileName) return;
      const currentRawName = currentNoteFileName.replace('.html', '');
      const inputName = prompt("Enter new filename:", currentRawName);
      if (!inputName || inputName.trim() === '' || inputName.trim() === currentRawName) return;

      const cleanName = inputName.trim().replace(/[/\\?%*:|"<>]/g, '');
      const newFileName = `${cleanName}.html`;

      try {
        if (useLocalStorage) {
          if (localNotes[newFileName]) {
            alert("A note with this file name already exists.");
            return;
          }
          localNotes[newFileName] = localNotes[currentNoteFileName];
          delete localNotes[currentNoteFileName];
          saveToLocalStorage();
        } else {
          if (await fileExists(notesHandle, newFileName)) {
            alert("A file with this name already exists in the vault.");
            return;
          }
          await saveCurrentNote(); // Commit latest buffer changes
          const oldFileHandle = await notesHandle.getFileHandle(currentNoteFileName);
          const file = await oldFileHandle.getFile();
          const content = await file.text();

          const newFileHandle = await notesHandle.getFileHandle(newFileName, { create: true });
          const w = await newFileHandle.createWritable();
          await w.write(content);
          await w.close();

          await notesHandle.removeEntry(currentNoteFileName);
        }

        currentNoteFileName = newFileName;
        await refreshNoteList();
        await openNote(newFileName);
      } catch (err) {
        console.error("Rename failed:", err);
        alert("Failed to rename file: " + err.message);
      }
    }

    // ---------- Code Block: language list ----------
    const CODE_LANGUAGES = [
      { value: 'auto',       label: 'Auto Detect' },
      { value: 'javascript', label: 'JavaScript' },
      { value: 'typescript', label: 'TypeScript' },
      { value: 'python',     label: 'Python' },
      { value: 'html',       label: 'HTML' },
      { value: 'css',        label: 'CSS' },
      { value: 'json',       label: 'JSON' },
      { value: 'bash',       label: 'Bash / Shell' },
      { value: 'java',       label: 'Java' },
      { value: 'cpp',        label: 'C++' },
      { value: 'c',          label: 'C' },
      { value: 'csharp',     label: 'C#' },
      { value: 'php',        label: 'PHP' },
      { value: 'ruby',       label: 'Ruby' },
      { value: 'go',         label: 'Go' },
      { value: 'rust',       label: 'Rust' },
      { value: 'sql',        label: 'SQL' },
      { value: 'yaml',       label: 'YAML' },
      { value: 'markdown',   label: 'Markdown' },
      { value: 'plaintext',  label: 'Plain Text' },
    ];

    // Only guess among this sane subset when set to "Auto Detect" —
    // hljs's unrestricted auto-detect is what caused everything to be
    // misclassified as one giant comment block.
    const AUTO_DETECT_SUBSET = CODE_LANGUAGES
      .map(l => l.value)
      .filter(v => v !== 'auto' && v !== 'plaintext');

    function buildLangSelect(selectedValue) {
      const select = document.createElement('select');
      select.className = 'code-lang-select';
      select.title = 'Set snippet language';
      CODE_LANGUAGES.forEach(({ value, label }) => {
        const opt = document.createElement('option');
        opt.value = value;
        opt.textContent = label;
        if (value === selectedValue) opt.selected = true;
        select.appendChild(opt);
      });
      return select;
    }

    // Highlights a single code block using the language stored on its wrapper.
    // Reads codeEl.textContent (always the true raw text, even after a
    // previous highlight pass added span tags) so it's safe to call repeatedly.
    function highlightCodeBlock(wrapper) {
      if (typeof hljs === 'undefined' || !wrapper) return;
      const codeEl = wrapper.querySelector('code');
      const selectEl = wrapper.querySelector('.code-lang-select');
      if (!codeEl) return;

      const lang = wrapper.dataset.language || 'auto';
      if (selectEl && selectEl.value !== lang) selectEl.value = lang;

      const rawText = codeEl.textContent;
      let result;
      try {
        if (lang !== 'auto' && hljs.getLanguage(lang)) {
          result = hljs.highlight(rawText, { language: lang, ignoreIllegals: true });
        } else if (lang === 'plaintext') {
          result = { value: escapeHtml(rawText), language: 'plaintext' };
        } else {
          result = hljs.highlightAuto(rawText, AUTO_DETECT_SUBSET);
        }
      } catch (err) {
        console.error('Highlight failed:', err);
        return;
      }

      codeEl.innerHTML = result.value;
      codeEl.className = 'hljs' + (result.language ? ` language-${result.language}` : '');
    }

    function escapeHtml(str) {
      const div = document.createElement('div');
      div.textContent = str;
      return div.innerHTML;
    }

    // ---------- Insert Code Block ----------
    function insertCodeBlock() {
      const selection = window.getSelection();
      let selectedText = selection.toString();

      const wrapper = document.createElement('div');
      wrapper.className = 'code-block-wrapper';
      wrapper.contentEditable = 'false';
      wrapper.dataset.language = 'auto';

      const header = document.createElement('div');
      header.className = 'code-block-header';
      header.appendChild(buildLangSelect('auto'));
      wrapper.appendChild(header);

      const preTag = document.createElement('pre');
      const codeTag = document.createElement('code');
      codeTag.contentEditable = 'true';
      codeTag.spellcheck = false;
      codeTag.textContent = selectedText || '// Enter code here...';
      preTag.appendChild(codeTag);
      wrapper.appendChild(preTag);

      if (selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        range.deleteContents();
        range.insertNode(wrapper);
      } else {
        document.getElementById('editor').appendChild(wrapper);
      }

      // Add trailing paragraph to step out of block easily
      const p = document.createElement('p');
      p.innerHTML = '<br>';
      wrapper.after(p);

      highlightCodeBlock(wrapper);
      triggerAutoSave();
    }

    // React to language dropdown changes (event delegation, works for
    // blocks created now and blocks restored from a saved note)
    document.getElementById('editor').addEventListener('change', (e) => {
      if (e.target.classList && e.target.classList.contains('code-lang-select')) {
        const wrapper = e.target.closest('.code-block-wrapper');
        if (!wrapper) return;
        wrapper.dataset.language = e.target.value;
        highlightCodeBlock(wrapper);
        triggerAutoSave();
      }
    });

    // ---------- Highlight all code blocks currently in the editor ----------
    // Called after a note is opened. Handles both the new wrapper-based
    // blocks and any old plain <pre><code> blocks saved before this update.
    function highlightAllCodeBlocks() {
      if (typeof hljs === 'undefined') return;

      document.querySelectorAll('#editor .code-block-wrapper').forEach(highlightCodeBlock);

      document.querySelectorAll('#editor pre code').forEach(codeEl => {
        if (codeEl.closest('.code-block-wrapper')) return; // already handled above
        const rawText = codeEl.textContent;
        try {
          const result = hljs.highlightAuto(rawText, AUTO_DETECT_SUBSET);
          codeEl.innerHTML = result.value;
          codeEl.className = 'hljs' + (result.language ? ` language-${result.language}` : '');
        } catch (err) {
          console.error('Highlight failed:', err);
        }
      });
    }

    // ---------- 6. Image Paste ----------
    document.getElementById('editor').addEventListener('paste', async (e) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (const item of items) {
        if (item.type.startsWith('image/')) {
          e.preventDefault();
          const file = item.getAsFile();

          if (useLocalStorage) {
            const reader = new FileReader();
            reader.onload = (event) => insertImageToEditor(event.target.result);
            reader.readAsDataURL(file);
          } else {
            const ext = file.type.split('/')[1] || 'png';
            const imageName = `img_${Date.now()}.${ext}`;

            const imgHandle = await attachmentsHandle.getFileHandle(imageName, { create: true });
            const w = await imgHandle.createWritable();
            await w.write(file);
            await w.close();

            insertImageToEditor(URL.createObjectURL(file), imageName);
          }
        }
      }
    });

    function insertImageToEditor(src, filename = null) {
      const imgTag = document.createElement('img');
      imgTag.src = src;
      if (filename) imgTag.dataset.filename = filename;

      const selection = window.getSelection();
      if (selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        range.insertNode(imgTag);
        range.collapse(false);
      } else {
        document.getElementById('editor').appendChild(imgTag);
      }
      triggerAutoSave();
    }

    // ---------- 7. Delete Note ----------
    async function deleteNote(fileName, event) {
      event.stopPropagation();
      if (confirm(`Delete "${fileName}"?`)) {
        if (useLocalStorage) {
          delete localNotes[fileName];
          saveToLocalStorage();
        } else {
          await notesHandle.removeEntry(fileName);
        }
        if (currentNoteFileName === fileName) {
          currentNoteFileName = null;
          document.getElementById('note-title').value = '';
          document.getElementById('editor').innerHTML = '';
        }
        await refreshNoteList();
      }
    }

    // ---------- 8. Export Vault (ZIP) ----------
    async function exportVault() {
      if (!useLocalStorage) {
        alert("Folder mode is active — notes are already saved on your disk 🙂");
        return;
      }
      if (Object.keys(localNotes).length === 0) {
        alert("No notes to export!");
        return;
      }
      if (typeof JSZip === 'undefined') {
        alert("JSZip library could not load. Check your internet connection.");
        return;
      }

      setSaveStatus('saving', 'Exporting…');
      const zip = new JSZip();
      const notesFolder = zip.folder("notes");
      for (const [fileName, content] of Object.entries(localNotes)) {
        notesFolder.file(fileName, content);
      }

      const blob = await zip.generateAsync({ type: "blob" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = "LocalWebNotes_Vault.zip";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);

      setSaveStatus('saved', 'Exported!');
      setTimeout(() => setSaveStatus('saved', 'Saved'), 2000);
    }

    // ---------- Helpers ----------
    async function fileExists(dirHandle, fileName) {
      try { await dirHandle.getFileHandle(fileName); return true; } catch { return false; }
    }

    function execCmd(command, value = null) {
      document.execCommand(command, false, value);
      triggerAutoSave();
    }

    // Toolbar buttons selection ko steal na karein
    document.querySelectorAll('.toolbar button').forEach(b =>
      b.addEventListener('mousedown', e => e.preventDefault())
    );