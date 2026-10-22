let data = {};
const MAX_RAW_HISTORY = 10000;
const MAX_MONTH_POINTS = 2000;

const getBucketTimestamp = (timestamp, range) => {
  const date = new Date(timestamp);
  if (range === 'allTime') {
    return new Date(date.getFullYear(), date.getMonth(), 1).getTime();
  }
  if (range === 'year') {
    const dayOfWeek = date.getDay() || 7;
    date.setDate(date.getDate() - dayOfWeek + 1);
    return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  }
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
};

const normalizeHistoryEntry = (entry) => {
  const timestamp = Number(entry.timestamp);
  const tabCount = Number(entry.tabCount);
  if (!Number.isFinite(timestamp) || !Number.isFinite(tabCount)) return null;
  return { timestamp, tabCount, samples: entry.samples || 0 };
};

const parseLegacyDate = (value, monthFirstFallback) => {
  const parts = value.split(/[\/.\-]/).map(Number);
  if (parts.length !== 3 || !parts.every(Number.isInteger)) return NaN;

  let year, month, day;
  if (parts[0] > 31) {
    [year, month, day] = parts;
  } else if (parts[2] > 31) {
    year = parts[2];
    if (parts[0] > 12) {
      [day, month] = parts;
    } else if (parts[1] > 12) {
      [month, day] = parts;
    } else {
      month = parts[monthFirstFallback ? 0 : 1];
      day = parts[monthFirstFallback ? 1 : 0];
    }
  } else {
    return NaN;
  }

  if (month < 1 || month > 12 || day < 1 || day > 31) return NaN;
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return NaN;
  }
  return date.getTime();
};

const getLegacyDailyHistory = (storedData) => {
  const legacyEntries = Object.entries(storedData)
    .filter(([key, value]) => value && typeof value === 'object' &&
      Number.isFinite(Number(value.tabs)) && !['tabHistory', 'tabHistoryArchive'].includes(key));
  let hasMonthFirstDate = false;
  let hasDayFirstDate = false;
  legacyEntries.forEach(([key]) => {
    const parts = key.split(/[\/.\-]/).map(Number);
    if (parts.length === 3 && parts[2] > 31) {
      if (parts[1] > 12) hasMonthFirstDate = true;
      if (parts[0] > 12) hasDayFirstDate = true;
    }
  });
  const monthFirstFallback = hasMonthFirstDate !== hasDayFirstDate
    ? hasMonthFirstDate
    : navigator.language.toLowerCase().startsWith('en-us');

  return legacyEntries.map(([key, value]) => {
    const timestamp = parseLegacyDate(key, monthFirstFallback);
    return Number.isFinite(timestamp)
      ? { timestamp, tabCount: Number(value.tabs), samples: 1 }
      : null;
  })
    .filter(Boolean);
};

const addToDailyArchive = (archive, entries) => {
  const buckets = new Map(archive.map(entry => [entry.timestamp, entry]));
  entries.forEach(entry => {
    const timestamp = getBucketTimestamp(entry.timestamp, 'month');
    const bucket = buckets.get(timestamp) || { timestamp, tabCount: 0, samples: 0 };
    bucket.tabCount += entry.tabCount;
    bucket.samples += 1;
    buckets.set(timestamp, bucket);
  });
  return Array.from(buckets.values()).sort((a, b) => a.timestamp - b.timestamp);
};

const aggregateHistory = (entries, range) => {
  entries = entries.map(normalizeHistoryEntry).filter(Boolean);
  if (range === 'today' || range === 'week') {
    return entries
      .sort((a, b) => a.timestamp - b.timestamp)
      .map(entry => ({
        timestamp: entry.timestamp,
        tabCount: entry.samples ? Math.round(entry.tabCount / entry.samples) : entry.tabCount
      }));
  }

  if (range === 'month') {
    const detailedEntries = entries
      .sort((a, b) => a.timestamp - b.timestamp)
      .map(entry => ({
        timestamp: entry.timestamp,
        tabCount: entry.samples ? Math.round(entry.tabCount / entry.samples) : entry.tabCount
      }));

    if (detailedEntries.length <= MAX_MONTH_POINTS) return detailedEntries;

    const step = (detailedEntries.length - 1) / (MAX_MONTH_POINTS - 1);
    return Array.from({ length: MAX_MONTH_POINTS }, (_, index) => (
      detailedEntries[Math.round(index * step)]
    ));
  }

  const buckets = new Map();
  entries.forEach(entry => {
    const timestamp = getBucketTimestamp(entry.timestamp, range);
    const samples = entry.samples || 1;
    const bucket = buckets.get(timestamp) || { timestamp, total: 0, samples: 0 };
    // Archived entries already contain the sum of their samples.
    bucket.total += entry.tabCount;
    bucket.samples += samples;
    buckets.set(timestamp, bucket);
  });

  return Array.from(buckets.values())
    .sort((a, b) => a.timestamp - b.timestamp)
    .map(bucket => ({
      timestamp: bucket.timestamp,
      tabCount: Math.round(bucket.total / bucket.samples)
    }));
};

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
    chrome.windows.getAll({}, (windows) => {
      const windowCount = windows.length;
      const today = new Date().toLocaleDateString();

      chrome.tabs.query({}, (tabs) => {
        const tabCount = tabs.length;
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
    // Merge recent raw points with the compact archive, then reduce long ranges.
    chrome.storage.local.get(null, (result) => {
      const legacyHistory = getLegacyDailyHistory(result);
      const rawHistory = [
        ...(result.tabHistoryArchive || []),
        ...(result.tabHistory || [])
      ];
      const maxObservedTabCount = [
        ...legacyHistory,
        ...(result.tabHistory || []),
        { tabCount: result.tabCount || 0 }
      ].reduce((max, entry) => Math.max(max, Number(entry.tabCount) || 0), 0);
      const suspiciousAverageLimit = Math.max(1000, maxObservedTabCount * 10);
      const history = [
        ...rawHistory.map(entry => {
          const samples = Number(entry.samples) || 1;
          const average = Number(entry.tabCount) / samples;
          if (samples > 1 && average > suspiciousAverageLimit) {
            return null;
          }
          return entry;
        }).filter(Boolean),
        ...legacyHistory
      ];
      const nowTimestamp = Date.now();
      const filteredData = history.filter(entry =>
        entry.timestamp >= startDate.getTime() && entry.timestamp <= nowTimestamp
      );
      sendResponse({ data: aggregateHistory(filteredData, request.range) });
    });
    return true;
  }
});

// Update current tab and window counts and store them
function updateTabAndWindowCounts(recordHistory = false) {
  chrome.windows.getAll({}, (windows) => {
    const today = new Date().toLocaleDateString();
    const windowCount = windows.length;
    chrome.tabs.query({}, (tabs) => {
      const tabCount = tabs.length;
      const keys = recordHistory
        ? ['totalTabs', 'prevTabCount', 'tabHistory', 'tabHistoryArchive']
        : ['totalTabs', 'prevTabCount'];

      chrome.storage.local.get(keys, (result) => {
        const prevTabCount = result.prevTabCount || 0;
        let newTotalTabs = result.totalTabs || 0;
        if (tabCount > prevTabCount) {
          newTotalTabs += tabCount - prevTabCount;
        }

        const updates = {
          [today]: { tabs: tabCount, windows: windowCount },
          totalTabs: newTotalTabs,
          prevTabCount: tabCount
        };

        if (recordHistory && tabCount !== prevTabCount) {
          const history = result.tabHistory || [];
          history.push({ timestamp: Date.now(), tabCount });
          const overflow = Math.max(0, history.length - MAX_RAW_HISTORY);
          updates.tabHistory = history.slice(overflow);
          if (overflow > 0) {
            updates.tabHistoryArchive = addToDailyArchive(
              result.tabHistoryArchive || [],
              history.slice(0, overflow)
            );
          }
        }

        chrome.storage.local.set(updates);
      });
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

// Coalesce bursts of tab/window events into one storage update.
let pendingTabChange;
const trackTabChanges = () => {
  clearTimeout(pendingTabChange);
  pendingTabChange = setTimeout(() => {
    updateTabAndWindowCounts(true);
    updateBadge();
  }, 300);
};

chrome.tabs.onCreated.addListener(trackTabChanges);
chrome.tabs.onRemoved.addListener(trackTabChanges);
chrome.windows.onCreated.addListener(trackTabChanges);
chrome.windows.onRemoved.addListener(trackTabChanges);
