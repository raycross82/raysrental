(function () {
  'use strict';
  var form = document.getElementById('availabilityForm');
  if (!form) return;
  var phone = form.elements.phone, date = form.elements.date;
  var status = document.getElementById('availability-status');
  var fallback = document.getElementById('availability-fallback');
  var textLink = document.getElementById('availability-text');
  var button = form.querySelector('button[type="submit"]');
  var label = button.textContent, sending = false, sent = false, started = false;
  var today = new Date();
  date.min = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');
  var city = new URLSearchParams(window.location.search).get('city');
  if (city) form.elements.city.value = city.slice(0, 100);

  // Never include names, numbers, event details or form contents in analytics.
  function track(event) {
    try { if (typeof window.gtag === 'function') window.gtag('event', event, { method: 'availability_form' }); } catch (_) {}
  }
  function validPhone() {
    var digits = phone.value.replace(/\D/g, '');
    var valid = digits.length === 10 || (digits.length === 11 && digits[0] === '1');
    phone.setCustomValidity(valid ? '' : 'Please enter a 10-digit phone number, with area code.');
  }
  phone.addEventListener('input', function () { phone.setCustomValidity(''); });
  form.addEventListener('input', function () {
    if (!started) { started = true; track('availability_start'); }
  });
  form.addEventListener('submit', function (event) {
    event.preventDefault();
    if (sending || sent) return;
    form.elements.name.value = form.elements.name.value.trim();
    form.elements.city.value = form.elements.city.value.trim();
    validPhone();
    if (!form.reportValidity()) return;
    var data = new FormData(form);
    var details = String(data.get('items') || '').trim() || 'Please help me choose rentals.';
    data.set('items', 'Availability inquiry (not a booking). ' + details);
    var message = "Hi Ray! I'd like to check availability for " + data.get('date') + ' in ' + data.get('city') + '. ' + details + ' My name is ' + data.get('name') + '.';
    var separator = /iPad|iPhone|iPod/.test(navigator.userAgent) ? '&' : '?';
    textLink.href = 'sms:+14696544110' + separator + 'body=' + encodeURIComponent(message);
    sending = true;
    button.disabled = true;
    button.textContent = 'Sending…';
    status.textContent = '';
    fallback.hidden = true;
    var controller = new AbortController();
    var timeout = setTimeout(function () { controller.abort(); }, 15000);
    fetch('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(data).toString(),
      signal: controller.signal
    }).then(function (response) {
      if (!response.ok) throw new Error('Submit failed');
      sent = true;
      track('generate_lead');
      form.hidden = true;
      var success = document.getElementById('availability-success');
      success.hidden = false;
      success.focus();
    }).catch(function () {
      status.textContent = "We couldn't confirm your request was received. Your details are still here — try again or text them to Ray.";
      fallback.hidden = false;
      track('availability_error');
    }).finally(function () {
      clearTimeout(timeout);
      sending = false;
      button.disabled = false;
      button.textContent = label;
    });
  });
})();
