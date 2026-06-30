// Tiny DOM helper to cut down on document.createElement boilerplate.
// el('div', { class: 'x', text: 'hi', onClick: fn, attrs: { role: 'button' } }, [childNode, 'text'])
export function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v == null || v === false) continue;
    if (k === 'class') node.className = v;
    else if (k === 'text') node.textContent = v;
    else if (k === 'html') node.innerHTML = v; // trusted static markup only
    else if (k === 'dataset') Object.assign(node.dataset, v);
    else if (k === 'attrs') {
      for (const [ak, av] of Object.entries(v)) {
        if (av == null || av === false) continue;
        node.setAttribute(ak, av === true ? '' : String(av));
      }
    } else if (k.startsWith('on') && typeof v === 'function') {
      node.addEventListener(k.slice(2).toLowerCase(), v);
    } else if (k in node) {
      try { node[k] = v; } catch { node.setAttribute(k, String(v)); }
    } else {
      node.setAttribute(k, String(v));
    }
  }
  const kids = Array.isArray(children) ? children : [children];
  for (const c of kids) {
    if (c == null || c === false) continue;
    node.append(c.nodeType ? c : document.createTextNode(String(c)));
  }
  return node;
}

export function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
  return node;
}

// Non-blocking toast. type: 'info' | 'success' | 'error'
let toastHost = null;
export function toast(message, { type = 'info', action = null, timeout = 4000 } = {}) {
  if (!toastHost) {
    toastHost = el('div', { class: 'toast-host', attrs: { 'aria-live': 'polite' } });
    document.body.appendChild(toastHost);
  }
  const t = el('div', { class: `toast toast--${type}` }, [
    el('span', { class: 'toast__msg', text: message }),
  ]);
  if (action) {
    t.appendChild(el('button', {
      class: 'toast__action', type: 'button', text: action.label,
      onClick: () => { action.onClick(); t.remove(); },
    }));
  }
  toastHost.appendChild(t);
  if (timeout) setTimeout(() => t.remove(), timeout);
  return t;
}
