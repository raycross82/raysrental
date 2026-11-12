(function () {
  'use strict';
  var picker = document.getElementById('tent-addons');
  if (!picker || !('FormDataEvent' in window)) return;
  var form = picker.closest('form');
  var controls = Array.from(picker.querySelectorAll('input[data-rental]'));
  var summary = document.getElementById('tent-addon-summary');
  var emptySummary = summary.textContent;

  function selections() {
    return controls.flatMap(function (input) {
      if (input.type === 'checkbox') return input.checked ? [input.dataset.rental] : [];
      var quantity = input.valueAsNumber;
      return Number.isInteger(quantity) && quantity > 0 ? [quantity + ' × ' + input.dataset.rental] : [];
    });
  }
  function refresh() {
    var count = selections().length;
    summary.textContent = count ? count + (count === 1 ? ' add-on selected' : ' add-ons selected') : emptySummary;
    controls.forEach(function (input) {
      if (input.type !== 'number') return;
      input.parentElement.querySelector('[data-step="-1"]').disabled = !(input.valueAsNumber > 0);
    });
  }
  picker.addEventListener('click', function (event) {
    var button = event.target.closest('button[data-step]');
    if (!button) return;
    var input = button.parentElement.querySelector('input');
    if (button.dataset.step === '1') input.stepUp();
    else input.stepDown();
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  picker.addEventListener('input', refresh);
  picker.addEventListener('invalid', function () { picker.open = true; }, true);
  // Both the availability request and its SMS fallback read this same FormData.
  // Compose once per submission so retries can't modify or duplicate guest notes.
  form.addEventListener('formdata', function (event) {
    var selected = selections();
    if (!selected.length) return;
    var notes = String(event.formData.get('items') || '').trim();
    var extras = 'Additional rentals requested: ' + selected.join(', ') + '.';
    event.formData.set('items', [extras, notes].filter(Boolean).join('\n'));
  });
  function openLinkedPicker() {
    if (window.location.hash === '#tent-addons') picker.open = true;
  }
  picker.hidden = false;
  var chooseExtras = document.querySelector('[data-choose-tent-addons]');
  if (chooseExtras) {
    chooseExtras.href = '#tent-addons';
    chooseExtras.addEventListener('click', function () { picker.open = true; });
  }
  refresh();
  openLinkedPicker();
  window.addEventListener('hashchange', openLinkedPicker);
})();
