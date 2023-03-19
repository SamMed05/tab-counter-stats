let tabCount = 0;
let windowCount = 0;
let totalTabs = 0;

chrome.tabs.query({}, function(tabs) {
  tabCount = tabs.length;
  chrome.action.setBadgeText({text: tabCount.toString()});
});

chrome.tabs.onCreated.addListener(function(tab) {
  tabCount++;
  chrome.action.setBadgeText({text: tabCount.toString()});
});

chrome.tabs.onRemoved.addListener(function(tabId, removeInfo) {
  chrome.tabs.query({}, function(tabs) {
    tabCount = tabs.length;
    chrome.action.setBadgeText({text: tabCount.toString()});
    chrome.storage.local.set({'tabCount': tabCount});
  });
});

// This function only runs once when the extension is installed or updated
chrome.runtime.onInstalled.addListener(function() {
  chrome.storage.local.get(null, function(result) {
    let data = result || {};
    data.totalTabs = data.totalTabs || 0;

    // Initialize tab count to the current number of tabs in the browser
    chrome.tabs.query({}, function(tabs) {
      data.tabCount = tabs.length;
      chrome.action.setBadgeText({text: data.tabCount.toString()});
      chrome.storage.local.set(data);
    });
  });
});

// Increment tab count
chrome.tabs.onCreated.addListener(function(tab) {
  chrome.storage.local.get(null, function(result) {
    let data = result || {};
    data.totalTabs = (data.totalTabs || 0) + 1;
    chrome.storage.local.set(data);
  });
});

// Listen for the message and respond to it
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.action === "countTabs") {
    let tabCount = 0;
    let windowCount = 0;

    chrome.windows.getAll({populate: true}, function(windows) {
      windowCount = windows.length;

      windows.forEach(function(window) {
        tabCount += window.tabs.length;
      });

      let date = new Date().toLocaleDateString();

      chrome.storage.local.get(null, function(result) {
        let data = result || {};
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
