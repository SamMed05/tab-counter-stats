let data = {};

// This function only runs once when the extension is installed or updated
chrome.runtime.onInstalled.addListener(function () {
  chrome.storage.local.get(null, function (result) {
    data = result;
    data.totalTabs = data.totalTabs || 0;

    // Initialize tab count to the current number of tabs in the browser
    chrome.tabs.query({}, function (tabs) {
      data.tabCount = tabs.length;
      updateBadge();
      chrome.storage.local.set(data);
    });
  });
});

// Listen for the message and respond to it
chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
  if (request.action === "getData") {
    updateTabAndWindowCounts();

    let tabCount = 0;
    let windowCount = 0;

    chrome.windows.getAll({ populate: true }, function (windows) {
      windowCount = windows.length;

      windows.forEach(function (window) {
        tabCount += window.tabs.length;
      });

      let date = new Date().toLocaleDateString();

      chrome.storage.local.get(null, function (result) {
        data = result;
        data[date] = { tabs: tabCount, windows: windowCount };

        chrome.storage.local.set(
          {
            totalTabs: data.totalTabs,
            [date]: data[date],
            windows: windowCount,
          },
          function () {
            // Send a response to the popup with the updated data
            sendResponse({
              tabCount: tabCount,
              windowCount: windowCount,
              result: result,
            });
          }
        );
      });
    });

    // Return true to indicate that the sendResponse callback will be called asynchronously
    return true;
  }
});

function updateTabAndWindowCounts() {
  chrome.windows.getAll({ populate: true }, function (windows) {
    let currentDate = new Date().toLocaleDateString();
    let windowCount = windows.length;
    let tabCount = 0;

    windows.forEach(function (window) {
      tabCount += window.tabs.length;
    });

    // Update the stored data with the tab and window counts for the current day
    chrome.storage.local.get(null, function (result) {
      data = result;
      data[currentDate] = { tabs: tabCount, windows: windowCount };

      // Update the totalTabs count (increment only if tabCount increased)
      if (tabCount > data.tabCount) {
        data.totalTabs = (data.totalTabs || 0) + 1;
      }

      // Store the updated data in local storage
      chrome.storage.local.set(data);
    });
  });
}

// Function to update the badge
function updateBadge() {
  chrome.storage.local.get({ showTabsNumber: true }, function (result) {
    const showTabsNumber = result.showTabsNumber;
    if (showTabsNumber) {
      chrome.tabs.query({}, function (tabs) {
        const tabCount = tabs.length;
        chrome.action.setBadgeText({ text: tabCount.toString() });
      });
    } else {
      chrome.windows.getAll({ populate: true }, function (windows) {
        const windowCount = windows.length;
        chrome.action.setBadgeText({ text: windowCount.toString() });
      });
    }
  });
}

// Listen for tab and window events to update the badge and trigger counting
function updateBadgeAndCount() {
  updateBadge();
  updateTabAndWindowCounts();
}

// Listen for tab and window events to update the badge and trigger counting
chrome.tabs.onCreated.addListener(updateBadgeAndCount);
chrome.tabs.onRemoved.addListener(updateBadgeAndCount);
chrome.windows.onCreated.addListener(updateBadgeAndCount);
chrome.windows.onRemoved.addListener(updateBadgeAndCount);
