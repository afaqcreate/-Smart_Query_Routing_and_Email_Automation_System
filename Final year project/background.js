// background.js
chrome.commands.onCommand.addListener((command) => {
  if (command === "reload-extension") {
    chrome.runtime.reload();
  }
});

// Listen for the OAuth success message from the FastAPI callback HTML page
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "OAUTH_SUCCESS") {
    console.log("Background script received user data:", request.user);
    
    // Store the user in Chrome's local storage so the Student screen can access it
    chrome.storage.local.set({ uquery_user: request.user }, () => {
      console.log("User data saved to storage.");
      sendResponse({ status: "success" });
    });
    
    return true; // Keep the message channel open for the async response
  }
});