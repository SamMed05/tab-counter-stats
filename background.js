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
  updateBadgeAndCount(); // Ensure we initialize with current tabs data.
});

// Function to save time graph data
function saveTimeGraphData(data) {
  chrome.storage.local.set({ timeGraphData: data });
}

// Function to retrieve time graph data
function getTimeGraphData(callback) {
  chrome.storage.local.get(['timeGraphData'], function(result) {
    callback(result.timeGraphData || []);
  });
}

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

  if (request.action === 'getTabData') {
    const range = request.range;
    const now = new Date();
    let startDate;

    switch (range) {
      case 'today':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case 'week':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
        break;
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
        break;
      case 'year':
        startDate = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
        break;
      case 'allTime':
        startDate = new Date(0);
        break;
      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    }

    // Retrieve tabHistory from storage
    chrome.storage.local.get(['tabHistory'], function(result) {
      const history = result.tabHistory || [];
      const filteredData = history.filter(entry => entry.timestamp >= startDate.getTime());
      sendResponse({ data: filteredData });
    });

    return true; // Will respond asynchronously
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

// Remove global tabHistory variable usage and load it from storage on startup:
chrome.runtime.onStartup.addListener(function() {
  chrome.storage.local.get(['tabHistory'], function(result) {
    // Ensure tabHistory is loaded (or default to an empty array)
    tabHistory = result.tabHistory || [];
  });
});

// Modify trackTabChanges to load & update stored tabHistory
function trackTabChanges() {
  chrome.tabs.query({}, function (tabs) {
    const tabCount = tabs.length;
    const timestamp = Date.now();
    chrome.storage.local.get(['tabHistory'], function(result) {
      let history = result.tabHistory || [];
      history.push({ timestamp, tabCount });
      chrome.storage.local.set({ tabHistory: history });
    });
  });
}

// Example of saving data when it is updated
function updateTimeGraphData(newData) {
  getTimeGraphData(function(existingData) {
    const updatedData = [...existingData, ...newData];
    saveTimeGraphData(updatedData);
  });
}

// Example of retrieving data when the service worker becomes active
chrome.runtime.onStartup.addListener(function() {
  getTimeGraphData(function(data) {
    // Use the retrieved data to update the time graph
    createChart(data);
  });
});

// Listen for tab and window events to update the badge and trigger counting
chrome.tabs.onCreated.addListener(trackTabChanges);
chrome.tabs.onRemoved.addListener(trackTabChanges);
chrome.windows.onCreated.addListener(trackTabChanges);
chrome.windows.onRemoved.addListener(trackTabChanges);
