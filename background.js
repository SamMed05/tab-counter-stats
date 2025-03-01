let data = {};

// On extension install/update, initialize data, tab count and badge
chrome.runtime.onInstalled.addListener(function () {
  chrome.storage.local.get(null, function (result) {
    data = result;
    data.totalTabs = data.totalTabs || 0;

    // Initialize tabCount and prevTabCount to current number of tabs
    chrome.tabs.query({}, function (tabs) {
      data.tabCount = tabs.length;
      data.prevTabCount = tabs.length;
      updateBadge();
      chrome.storage.local.set(data);
    });
  });
  updateBadgeAndCount(); // Ensure counts are up-to-date on install/update
});

// Listen for messages from popup or other parts of the extension
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // Handle main stats data request
  if (request.action === "getData") {
    updateTabAndWindowCounts();
    chrome.windows.getAll({ populate: true }, (windows) => {
      const windowCount = windows.length;
      const tabCount = windows.reduce((sum, w) => sum + w.tabs.length, 0);
      const today = new Date().toLocaleDateString();

      // Retrieve stored data and update today's record.
      chrome.storage.local.get(null, (result) => {
        // Using spread operator to copy properties from 'result' 
        // into a new object while adding/updating the today's key.
        const data = { ...result, [today]: { tabs: tabCount, windows: windowCount } };
        data.totalTabs = result.totalTabs; // Preserve totalTabs

        chrome.storage.local.set({
          totalTabs: data.totalTabs,
          [today]: data[today],
          windows: windowCount,
        }, () => {
          sendResponse({
            tabCount,
            windowCount,
            result,
          });
        });
      });
    });
    return true;
  }

  // Handle request for time-based tab history data
  if (request.action === 'getTabData') {
    const now = new Date();
    let startDate;
    // Determine start date based on requested range to filter history
    switch (request.range) {
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
    // Retrieve and filter stored tabHistory data
    chrome.storage.local.get(['tabHistory'], (result) => {
      const history = result.tabHistory || [];
      const filteredData = history.filter(entry => entry.timestamp >= startDate.getTime());
      sendResponse({ data: filteredData });
    });
    return true;
  }
});

// Update current tab and window counts and store them
function updateTabAndWindowCounts() {
  chrome.windows.getAll({ populate: true }, (windows) => {
    const today = new Date().toLocaleDateString();
    const windowCount = windows.length;
    const tabCount = windows.reduce((sum, win) => sum + win.tabs.length, 0);
    chrome.storage.local.get(['totalTabs','prevTabCount'], (result) => {
      const prevTabCount = result.prevTabCount || 0;
      let newTotalTabs = result.totalTabs || 0;
      if (tabCount > prevTabCount) {
          newTotalTabs += (tabCount - prevTabCount);
      }
      // Merge today's data with updated totalTabs and prevTabCount
      const data = {
        ...result,
        [today]: { tabs: tabCount, windows: windowCount },
        totalTabs: newTotalTabs,
        prevTabCount: tabCount
      };
      chrome.storage.local.set(data);
    });
  });
}

// Function to update the browser action badge based on user settings
function updateBadge() {
  chrome.storage.local.get({ showTabsNumber: true }, (result) => {
    if (result.showTabsNumber) {
      chrome.tabs.query({}, (tabs) => {
        chrome.action.setBadgeText({ text: tabs.length.toString() });
      });
    } else {
      chrome.windows.getAll({ populate: true }, (windows) => {
        chrome.action.setBadgeText({ text: windows.length.toString() });
      });
    }
  });
}

// Helper to update badge and counts together
function updateBadgeAndCount() {
  updateBadge();
  updateTabAndWindowCounts();
}

// Track tab and window events, store history and update UI
const trackTabChanges = () => {
  chrome.tabs.query({}, (tabs) => {
    const tabCount = tabs.length;
    const timestamp = Date.now();
    chrome.storage.local.get(['tabHistory'], (result) => {
      const history = result.tabHistory || [];
      history.push({ timestamp, tabCount });
      chrome.storage.local.set({ tabHistory: history }, () => {
         updateBadge();
         updateTabAndWindowCounts();
      });
    });
  });
};

chrome.tabs.onCreated.addListener(trackTabChanges);
chrome.tabs.onRemoved.addListener(trackTabChanges);
chrome.windows.onCreated.addListener(trackTabChanges);
chrome.windows.onRemoved.addListener(trackTabChanges);
