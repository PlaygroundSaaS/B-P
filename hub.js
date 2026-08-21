const $ = selector => document.querySelector(selector);
const showArea = name => { $('#welcome').hidden = true; $('#business').hidden = name !== 'business'; $('#client').hidden = name !== 'client'; };
document.querySelectorAll('[data-area]').forEach(button => button.onclick = () => showArea(button.dataset.area));
document.querySelectorAll('[data-home]').forEach(button => button.onclick = () => { $('#welcome').hidden = false; $('#business').hidden = true; $('#client').hidden = true; });
document.querySelectorAll('[data-panel]').forEach(button => button.onclick = () => { $('#business .panel').forEach(panel => panel.hidden = true); $('#' + button.dataset.panel).hidden = false; });
document.querySelectorAll('[data-client-panel]').forEach(button => button.onclick = () => { $('#client .client-panel').forEach(panel => panel.hidden = true); $('#' + button.dataset.clientPanel).hidden = false; });

