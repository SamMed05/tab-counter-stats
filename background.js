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

// Listen for the message and respond to it
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "getData") {
    updateTabAndWindowCounts();
    chrome.windows.getAll({ populate: true }, (windows) => {
      const windowCount = windows.length;
      const tabCount = windows.reduce((sum, w) => sum + w.tabs.length, 0);
      const today = new Date().toLocaleDateString();

      chrome.storage.local.get(null, (result) => {
        const data = { ...result, [today]: { tabs: tabCount, windows: windowCount } };
        // Preserve totalTabs from previous value
        data.totalTabs = result.totalTabs;
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

  if (request.action === 'getTabData') {
    const now = new Date();
    let startDate;
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
    chrome.storage.local.get(['tabHistory'], (result) => {
      const history = result.tabHistory || [];
      const filteredData = history.filter(entry => entry.timestamp >= startDate.getTime());
      sendResponse({ data: filteredData });
    });
    return true;
  }
});

// Simplify updateTabAndWindowCounts using Array.reduce
function updateTabAndWindowCounts() {
  chrome.windows.getAll({ populate: true }, (windows) => {
    const today = new Date().toLocaleDateString();
    const windowCount = windows.length;
    const tabCount = windows.reduce((sum, win) => sum + win.tabs.length, 0);
    chrome.storage.local.get(null, (result) => {
      const data = { ...result, [today]: { tabs: tabCount, windows: windowCount } };
      if (tabCount > result.tabCount) {
        data.totalTabs = (result.totalTabs || 0) + 1;
      }
      chrome.storage.local.set(data);
    });
  });
}

// Function to update the badge
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

// Listen for tab and window events to update the badge and trigger counting
function updateBadgeAndCount() {
  updateBadge();
  updateTabAndWindowCounts();
}

// One‑time registration for tab/window events
const trackTabChanges = () => {
  chrome.tabs.query({}, (tabs) => {
    const tabCount = tabs.length;
    const timestamp = Date.now();
    chrome.storage.local.get(['tabHistory'], (result) => {
      const history = result.tabHistory || [];
      history.push({ timestamp, tabCount });
      chrome.storage.local.set({ tabHistory: history });
    });
  });
};

chrome.tabs.onCreated.addListener(trackTabChanges);
chrome.tabs.onRemoved.addListener(trackTabChanges);
chrome.windows.onCreated.addListener(trackTabChanges);
chrome.windows.onRemoved.addListener(trackTabChanges);
