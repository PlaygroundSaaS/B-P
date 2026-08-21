const $ = selector => document.querySelector(selector);
document.querySelectorAll('[data-panel]').forEach(button => {
  button.onclick = () => {
    document.querySelectorAll('.panel').forEach(panel => { panel.hidden = true; });
    $('#' + button.dataset.panel).hidden = false;
  };
});

