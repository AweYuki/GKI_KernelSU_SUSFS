/**
 * Announcement modal: native <dialog> with lightweight Markdown rendering and "Don't show today".
 */

import { lang } from './i18n.js';
import { esc, fetchJsonFresh, getStored, setStored } from './utils.js';
import { openDialog, closeDialog } from './modal.js';

var dialog = document.getElementById('announceDialog');
var bodyEl = document.getElementById('announceBody');
var dateEl = document.getElementById('announceDate');
var closeBtn = document.getElementById('announceClose');
var okBtn = document.getElementById('announceOk');
var dismissCheck = document.getElementById('announceDismissToday');
var openBtn = document.getElementById('announceOpen');
var loaded = false;

var DISMISS_KEY = 'announce_dismiss';
var SEEN_KEY = 'announce_seen';

// Get current local date string (YYYY-MM-DD)
function localDateStr() {
  var d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

var getItem = getStored;
var setItem = setStored;
var latestDate = '';

// ---- Lightweight Markdown renderer ----

// Render inline Markdown (code, links, bold, italic)
function renderInlineMarkdown(text) {
  var html = esc(text == null ? '' : String(text));
  var codeTokens = [];

  // Replace inline code spans with placeholders first so asterisks/brackets inside aren't parsed
  html = html.replace(/`([^`\n]+)`/g, function (_, codeText) {
    codeTokens.push('<code>' + codeText + '</code>');
    return '<!--CODE' + (codeTokens.length - 1) + '-->';
  });

  html = html.replace(/\[([^\]\n]+)\]\(([^)\s]+)\)/g, function (_, label, url) {
    var safe = /^(https?:\/\/|\/|\.\/|[\w-]+\.html)/i.test(url) ? url : '#';
    var external = /^https?:/i.test(safe) ? ' target="_blank" rel="noopener noreferrer"' : '';
    return '<a href="' + safe + '"' + external + '>' + label + '</a>';
  });
  html = html.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*([^*\n]+)\*/g, '<em>$1</em>');

  return html.replace(/<!--CODE(\d+)-->/g, function (_, idx) {
    return codeTokens[Number(idx)] || '';
  });
}

// Render block-level Markdown (headings, lists, blockquotes, code blocks, paragraphs)
function renderMarkdown(markdownText) {
  var normalized = String(markdownText == null ? '' : markdownText)
    .replace(/\r\n?/g, '\n')
    .trim();
  if (!normalized) return '';

  var blocks = normalized.split(/\n{2,}/);
  var out = [];

  blocks.forEach(function (block) {
    var lines = block.split('\n');
    var fence = block.match(/^```([a-zA-Z0-9_-]+)?\n([\s\S]*?)\n```$/);
    if (fence) {
      var langClass = fence[1] ? ' class="lang-' + fence[1].toLowerCase() + '"' : '';
      out.push('<pre><code' + langClass + '>' + esc(fence[2]) + '</code></pre>');
      return;
    }

    var heading = block.match(/^\s*(#{1,6})\s+(.+)$/);
    if (heading && lines.length === 1) {
      var level = heading[1].length;
      out.push('<h' + level + '>' + renderInlineMarkdown(heading[2]) + '</h' + level + '>');
      return;
    }

    if (lines.every(function (line) { return /^\s*>\s?/.test(line); })) {
      out.push('<blockquote>' + lines.map(function (line) {
        return renderInlineMarkdown(line.replace(/^\s*>\s?/, ''));
      }).join('<br>') + '</blockquote>');
      return;
    }

    // Allow mixed paragraph lines and list lines within the same block by splitting into segments
    var segments = [];
    lines.forEach(function (line) {
      var kind = /^\s*[-*]\s+/.test(line) ? 'ul' : /^\s*\d+\.\s+/.test(line) ? 'ol' : 'p';
      var seg = segments[segments.length - 1];
      if (!seg || seg.kind !== kind) { seg = { kind: kind, lines: [] }; segments.push(seg); }
      seg.lines.push(line);
    });
    segments.forEach(function (seg) {
      if (seg.kind === 'ul') {
        out.push('<ul>' + seg.lines.map(function (line) {
          return '<li>' + renderInlineMarkdown(line.replace(/^\s*[-*]\s+/, '')) + '</li>';
        }).join('') + '</ul>');
      } else if (seg.kind === 'ol') {
        out.push('<ol>' + seg.lines.map(function (line) {
          return '<li>' + renderInlineMarkdown(line.replace(/^\s*\d+\.\s+/, '')) + '</li>';
        }).join('') + '</ol>');
      } else {
        out.push('<p>' + seg.lines.map(renderInlineMarkdown).join('<br>') + '</p>');
      }
    });
  });

  return out.join('');
}

// Normalize announcement text (join array of lines if needed)
function normalizeAnnouncementText(value) {
  if (Array.isArray(value)) return value.join('\n');
  if (value == null) return '';
  return String(value);
}

// Select announcement text matching the active language
function getAnnouncementText(item) {
  if (lang === 'vi') {
    return normalizeAnnouncementText(item.content_vi_md || item.content_vi || item.content_md || item.content);
  }
  if (lang === 'zh') {
    return normalizeAnnouncementText(item.content_zh_md || item.content_zh || item.content_md || item.content);
  }
  return normalizeAnnouncementText(item.content_md || item.content || item.content_vi_md || item.content_zh_md);
}

function hideAnnounce() {
  if (dismissCheck.checked) setItem(DISMISS_KEY, localDateStr());
  closeDialog(dialog);
}

// When auto = true (opened automatically on page load), focus the dialog itself to avoid a jarring button focus ring
function showAnnounce(auto) {
  dismissCheck.checked = false;
  openBtn.classList.remove('has-unread');
  openBtn.removeAttribute('data-unread');
  // Mark as seen only when actually presented to the user
  if (latestDate) setItem(SEEN_KEY, latestDate);
  openDialog(dialog);
  if (auto) dialog.focus();
  else okBtn.focus();
}

export function initAnnouncement() {
  closeBtn.addEventListener('click', hideAnnounce);
  okBtn.addEventListener('click', hideAnnounce);
  dialog.addEventListener('click', function (e) {
    if (e.target === dialog) hideAnnounce();
  });
  // Respect "Don't show today" when dismissed via Escape as well
  dialog.addEventListener('cancel', function () {
    if (dismissCheck.checked) setItem(DISMISS_KEY, localDateStr());
  });
  openBtn.addEventListener('click', function () {
    if (!loaded) return;
    showAnnounce(false);
  });

  loadAnnouncement();
}

async function loadAnnouncement() {
  try {
    var json = await fetchJsonFresh('data/announcement.json');
    var items = json.items;
    if (!items || items.length === 0) return;

    var html = '';
    items.forEach(function (item) {
      var text = getAnnouncementText(item);
      var markdownHtml = renderMarkdown(text);
      if (!markdownHtml) return;
      var dateText = item.date ? esc(item.date) : '';
      if (item.date && item.date > latestDate) latestDate = item.date;
      html += '<article class="announce__item">' +
        '<div class="md">' + markdownHtml + '</div>' +
        (dateText ? '<div class="announce__meta"><time class="announce__date" datetime="' + dateText + '">' + dateText + '</time></div>' : '') +
        '</article>';
    });
    if (!html) return;

    bodyEl.innerHTML = html;
    dateEl.textContent = latestDate;
    loaded = true;
    openBtn.hidden = false;

    // Unread indicator: show dot when the latest announcement date is newer than the last seen date
    var seen = getItem(SEEN_KEY) || '';
    var unread = latestDate > seen;
    openBtn.classList.toggle('has-unread', unread);
    if (unread) openBtn.setAttribute('data-unread', '1');

    if (getItem(DISMISS_KEY) === localDateStr()) return;
    showAnnounce(true);
  } catch (e) {
    // Announcements are optional; ignore load failures without blocking the main page
  }
}
