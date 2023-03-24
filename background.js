let tabCount = 0;
let windowCount = 0;
let totalTabs = 0;
let data = {};

chrome.tabs.onCreated.addListener(updateBadge);
chrome.tabs.onRemoved.addListener(updateBadge);
chrome.tabs.onUpdated.addListener(updateBadge);

function updateBadge() {
  chrome.tabs.query({}, function(tabs) {
    // Calculate the total number of tabs
    tabCount = tabs.length;
    // Set the badge text
    chrome.action.setBadgeText({text: tabCount.toString()});

    chrome.storage.local.set({tabCount: tabCount});
  });
}

// Increment total tab count
chrome.tabs.onCreated.addListener(function(tab) {
  chrome.storage.local.get(null, function(result) {
    data = result || {};
    data.totalTabs = (data.totalTabs || 0) + 1;
    chrome.storage.local.set(data);
  });
});

// This function only runs once when the extension is installed or updated
chrome.runtime.onInstalled.addListener(function() {
  chrome.storage.local.get(null, function(result) {
    data = result || {};
    data.totalTabs = data.totalTabs || 0;

    // Initialize tab count to the current number of tabs in the browser
    chrome.tabs.query({}, function(tabs) {
      data.tabCount = tabs.length;
      chrome.action.setBadgeText({text: data.tabCount.toString()});
      chrome.storage.local.set(data);
    });
  });
});

// Listen for the message and respond to it
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.action === "countTabs") {
    tabCount = 0;
    windowCount = 0;

    chrome.windows.getAll({populate: true}, function(windows) {
      windowCount = windows.length;

      windows.forEach(function(window) {
        tabCount += window.tabs.length;
      });

      let date = new Date().toLocaleDateString();

      chrome.storage.local.get(null, function(result) {
        data = result || {};
        data[date] = {tabs: tabCount, windows: windowCount};

        chrome.storage.local.set({totalTabs: data.totalTabs, [date]: data[date], windows: windowCount}, function() {
          // Send a response to the popup with the updated data
          sendResponse({tabCount: tabCount, windowCount: windowCount, result: result});
        });
      });
    });

    // Return true to indicate that the sendResponse callback will be called asynchronously
    return true;
  }
});