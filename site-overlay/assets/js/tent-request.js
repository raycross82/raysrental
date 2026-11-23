// Keep the existing quote inbox and the availability form's SMS fallback in sync.
(() => {
  const form = document.querySelector('#availabilityForm');
  if (!form || !('FormDataEvent' in window)) return;
  const extras = form.querySelector('.tent-extras');
  const quantities = extras.querySelectorAll('input');
  extras.hidden = false;
  // Reveal invalid quantity controls before native validation focuses them.
  extras.addEventListener('invalid', () => { extras.open = true; }, true);

  form.addEventListener('formdata', ({formData}) => {
    const selections = Array.from(quantities)
      .filter(input => Number.isInteger(input.valueAsNumber) && input.valueAsNumber > 0)
      .map(input => input.valueAsNumber + ' × ' + input.dataset.item);
    const notes = String(formData.get('items') || '').trim();
    formData.set('items', [formData.get('package'), selections.join(', '), notes].filter(Boolean).join('. '));
  });
})();
