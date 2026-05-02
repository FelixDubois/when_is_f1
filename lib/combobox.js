/**
 * Searchable combobox with SVG flag icons. Native <select> can't render
 * images per option, so we build a listbox + textbox per the WAI-ARIA
 * combobox pattern (autocomplete-list).
 *
 * Caller provides:
 *   options:  [{ value, label, flagSrc }]
 *   onChange: (value) => void
 *   initialValue: optional starting value
 */
export function createCountryCombobox({
  rootEl,
  toggleEl,
  flagEl,
  currentEl,
  popoverEl,
  searchEl,
  listEl,
  emptyEl,
  options,
  onChange,
  initialValue,
}) {
  let activeIndex = -1;     // highlighted option in current filtered list
  let filtered = options;
  let selectedValue = null;

  // Build option DOM once; reuse with show/hide on filter
  const optionEls = options.map((opt, i) => {
    const li = document.createElement('li');
    li.className = 'combobox__option';
    li.setAttribute('role', 'option');
    li.setAttribute('id', `combobox-opt-${opt.value}`);
    li.dataset.value = opt.value;
    li.dataset.search = opt.label.toLowerCase();
    li.dataset.index = String(i);

    const img = document.createElement('img');
    img.className = 'combobox__flag';
    img.alt = '';
    img.width = 28;
    img.height = 21;
    img.loading = 'lazy';
    img.src = opt.flagSrc;
    li.appendChild(img);

    const name = document.createElement('span');
    name.className = 'combobox__option-name';
    name.textContent = opt.label;
    li.appendChild(name);

    li.addEventListener('mousedown', (e) => {
      // mousedown so we beat the input blur
      e.preventDefault();
      select(opt.value);
      close();
    });
    return li;
  });
  for (const li of optionEls) listEl.appendChild(li);

  function setSelected(value) {
    selectedValue = value;
    const opt = options.find(o => o.value === value);
    if (!opt) return;
    flagEl.src = opt.flagSrc;
    flagEl.alt = '';
    currentEl.textContent = opt.label;
    for (const li of optionEls) {
      li.setAttribute('aria-selected', li.dataset.value === value ? 'true' : 'false');
    }
  }

  function select(value) {
    if (value === selectedValue) return;
    setSelected(value);
    onChange(value);
  }

  function applyFilter(query) {
    const q = query.trim().toLowerCase();
    filtered = q
      ? options.filter(o => o.label.toLowerCase().includes(q))
      : options.slice();
    const visible = new Set(filtered.map(o => o.value));
    let visIndex = 0;
    for (const li of optionEls) {
      const show = visible.has(li.dataset.value);
      li.hidden = !show;
      if (show) li.dataset.visIndex = String(visIndex++);
    }
    emptyEl.hidden = filtered.length > 0;
    listEl.hidden = filtered.length === 0;
    setActive(filtered.length ? 0 : -1);
  }

  function setActive(i) {
    activeIndex = i;
    for (const li of optionEls) li.classList.remove('is-active');
    if (i < 0 || i >= filtered.length) {
      toggleEl.removeAttribute('aria-activedescendant');
      searchEl.removeAttribute('aria-activedescendant');
      return;
    }
    const target = filtered[i];
    const li = optionEls.find(el => el.dataset.value === target.value);
    if (li) {
      li.classList.add('is-active');
      li.scrollIntoView({ block: 'nearest' });
      searchEl.setAttribute('aria-activedescendant', li.id);
    }
  }

  function open() {
    if (!popoverEl.hidden) return;
    popoverEl.hidden = false;
    toggleEl.setAttribute('aria-expanded', 'true');
    searchEl.value = '';
    applyFilter('');
    // Focus the search input after the popover paints
    requestAnimationFrame(() => searchEl.focus());
    // Scroll selected into view
    if (selectedValue) {
      const li = optionEls.find(el => el.dataset.value === selectedValue);
      if (li && !li.hidden) li.scrollIntoView({ block: 'center' });
    }
  }

  function close() {
    if (popoverEl.hidden) return;
    popoverEl.hidden = true;
    toggleEl.setAttribute('aria-expanded', 'false');
    toggleEl.focus();
  }

  // ---- Wire events ----
  toggleEl.addEventListener('click', () => {
    if (popoverEl.hidden) open(); else close();
  });

  searchEl.addEventListener('input', () => applyFilter(searchEl.value));

  searchEl.addEventListener('keydown', (e) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        if (activeIndex < filtered.length - 1) setActive(activeIndex + 1);
        break;
      case 'ArrowUp':
        e.preventDefault();
        if (activeIndex > 0) setActive(activeIndex - 1);
        break;
      case 'Home':
        if (filtered.length) { e.preventDefault(); setActive(0); }
        break;
      case 'End':
        if (filtered.length) { e.preventDefault(); setActive(filtered.length - 1); }
        break;
      case 'Enter':
        if (activeIndex >= 0 && filtered[activeIndex]) {
          e.preventDefault();
          select(filtered[activeIndex].value);
          close();
        }
        break;
      case 'Escape':
        e.preventDefault();
        close();
        break;
      case 'Tab':
        close();
        break;
    }
  });

  // Click outside closes
  document.addEventListener('mousedown', (e) => {
    if (popoverEl.hidden) return;
    if (!rootEl.contains(e.target)) close();
  });

  // Keep popover open if user clicks inside it (search input loses focus on click)
  popoverEl.addEventListener('mousedown', (e) => {
    if (e.target !== searchEl) e.stopPropagation();
  });

  // ---- Initial state ----
  if (initialValue && options.some(o => o.value === initialValue)) {
    setSelected(initialValue);
  } else if (options.length) {
    setSelected(options[0].value);
  }

  return {
    setValue: setSelected,
    getValue: () => selectedValue,
  };
}
