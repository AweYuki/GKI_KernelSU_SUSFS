/**
 * Time converter module: convert date + time into the UTC string format used by kernel version strings.
 * Inputs are rendered by render.js and moved across branches, so events are handled via delegation.
 */

export function initTimeConverter() {
  var pad = function (n) { return String(n).padStart(2, '0'); };
  var days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  function update() {
    var tcDate = document.getElementById('tcDate');
    var tcTime = document.getElementById('tcTime');
    var tcResult = document.getElementById('tcResult');
    var tcCopy = document.getElementById('tcCopy');
    if (!tcDate || !tcTime || !tcResult || !tcCopy) return;

    var d = tcDate.value;
    var tm = tcTime.value;
    if (!d || !tm) { tcResult.textContent = '—'; tcCopy.dataset.copy = ''; return; }
    var parts = tm.split(':');
    var h = parseInt(parts[0], 10);
    var m = parseInt(parts[1], 10);
    var s = parseInt(parts[2] || '0', 10);
    var dp = d.split('-');
    var local = new Date(Date.UTC(parseInt(dp[0], 10), parseInt(dp[1], 10) - 1, parseInt(dp[2], 10), h, m, s));
    var utcStr = days[local.getUTCDay()] + ' ' + months[local.getUTCMonth()] + ' ' + pad(local.getUTCDate()) + ' ' +
      pad(local.getUTCHours()) + ':' + pad(local.getUTCMinutes()) + ':' + pad(local.getUTCSeconds()) + ' UTC ' + local.getUTCFullYear();
    tcResult.textContent = utcStr;
    tcCopy.dataset.copy = utcStr;
  }

  // Seed inputs with the current UTC timestamp after initial render
  function seed() {
    var tcDate = document.getElementById('tcDate');
    var tcTime = document.getElementById('tcTime');
    if (!tcDate || !tcTime || tcDate.value) return;
    var now = new Date();
    tcDate.value = now.toISOString().slice(0, 10);
    tcTime.value = now.toISOString().slice(11, 19);
    update();
  }

  document.addEventListener('input', function (e) {
    if (e.target && (e.target.id === 'tcDate' || e.target.id === 'tcTime')) update();
  });

  return { seed: seed, update: update };
}
