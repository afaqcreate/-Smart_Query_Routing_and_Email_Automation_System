// Listens for the keyboard shortcut and triggers a reload
chrome.commands.onCommand.addListener((command) => {
  if (command === "reload-extension") {
    chrome.runtime.reload();
  }
});
