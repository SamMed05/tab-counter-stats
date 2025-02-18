document.addEventListener("DOMContentLoaded", function () {
  // Initialize variables and DOM elements
  const tabCountElem = document.getElementById("tab-count");
  const windowCountElem = document.getElementById("window-count");
  const totalTabsCell = document.getElementById("all-time-tabs");
  const resetButton = document.getElementById("resetButton");
  const inputDays = document.getElementById("numOfDays");
  const ctx = document.getElementById("chart").getContext("2d");
  const dateFormatToggle = document.getElementById("dateFormat");
  let useGBDateFormat;
  const tabWindowToggle = document.getElementById("toggleTabWindow");
  let showTabsNumber;
  let chart;

  // Get the tab and window count and update the UI
  function countTabsAndWindows() {
    chrome.runtime.sendMessage({ action: "getData" }, function (response) {
      updateTable(response.tabCount, response.windowCount, response.result);
      renderChart(response.result);
    });
  }

  // Add event listener to the input element to update the chart
  inputDays.addEventListener("change", function () {
    chrome.storage.local.set({ numOfDays: inputDays.value }); // Store the input value in local storage
    countTabsAndWindows();
  });

  // Add event listener to the date format toggle button
  dateFormatToggle.addEventListener("change", function () {
    useGBDateFormat = dateFormatToggle.checked;
    chrome.storage.local.set({ useGBDateFormat: useGBDateFormat });
    countTabsAndWindows();
  });
  // Add event listener to the tab/window toggle button
  tabWindowToggle.addEventListener("change", function () {
    showTabsNumber = tabWindowToggle.checked;
    chrome.storage.local.set({ showTabsNumber: showTabsNumber });
    updateBadge(); // Update badge when the toggle changes
  });

  // Tab switching logic
  const tabs = document.querySelectorAll(".tab");
  const tabContents = document.querySelectorAll(".tab-content");

  tabs.forEach((tab, index) => {
    tab.addEventListener("click", () => {
      tabs.forEach(t => t.classList.remove("active"));
      tabContents.forEach(tc => tc.classList.remove("active"));

      tab.classList.add("active");
      tabContents[index].classList.add("active");
    });
  });

  // Set the first tab as active by default
  tabs[0].classList.add("active");
  tabContents[0].classList.add("active");

  // Render the chart using Chart.js
  function renderChart(result) {
    let dates = [];
    let tabCounts = [];
    let windowCounts = [];
    let now = new Date();
    let numOfDays = parseInt(inputDays.value);

    for (let i = numOfDays - 1; i >= 0; i--) {
      let date = new Date(now);
      date.setDate(now.getDate() - i);
      dates.push(
        useGBDateFormat
          ? date.toLocaleDateString("en-GB", { month: "2-digit", day: "numeric" }) // or month: "short"
          : date.toLocaleDateString(undefined, { month: "2-digit", day: "numeric" }) // or month: "short"
      );
      let data = result[date.toLocaleDateString()] || { tabs: 0, windows: 0 };
      tabCounts.push(data.tabs || 0);
      windowCounts.push(data.windows || 0);
    }

    // Destroy existing chart instance if it exists
    if (chart) {
      chart.destroy();
    }

    chart = new Chart(ctx, {
      data: {
        labels: dates,
        datasets: [
          {
            type: "line",
            label: "Tab count",
            data: tabCounts,
            borderColor: "rgb(26, 115, 232)",
            borderWidth: 2,
            fill: true,
            backgroundColor: "rgba(0, 109, 204, 0.3)",
            pointRadius: 3,
            tension: 0.1,
            hidden: false,
          },
          {
            type: "bar",
            label: "Window count",
            data: windowCounts,
            borderColor: "rgb(242, 86, 58)",
            borderWidth: 2,
            backgroundColor: "rgba(242, 86, 58, 0.4)",
            order: 2,
            barThickness: 20,
            borderRadius: 50,
            hidden: false,
          },
        ],
      },
      options: {
        scaleShowValues: true,
        responsive: true,
        scales: {
          x: {
            ticks: {
              color: "black",
            },
          },
          y: {
            beginAtZero: true,
            ticks: {
              color: "black",
            },
          },
        },
      },
    });
  }

  // Update the tab and window count on the UI
  function updateTable(tabCount, windowCount, result) {
    // Update the text content
    tabCountElem.textContent = tabCount;
    windowCountElem.textContent = windowCount;
    totalTabsCell.textContent = result.totalTabs || 0; // Update the totalTabsCell with the totalTabs count, if it exists

    // Reset the totalTabs count if the reset button is clicked
    resetButton.addEventListener("click", function () {
      // Display a confirmation dialog
      if (confirm("Are you sure you want to reset the total tabs count?")) {
        chrome.storage.local.set({ totalTabs: 0 }, function () {
          totalTabsCell.textContent = 0;
        });
      }
    });
  }

  // Retrieve the input value from local storage
  chrome.storage.local.get({ numOfDays }, function (result) {
    inputDays.value = result.numOfDays;
    countTabsAndWindows();
  });

  // Retrieve the date format from local storage
  chrome.storage.local.get({ useGBDateFormat: false }, function (result) {
    useGBDateFormat = result.useGBDateFormat;
    dateFormatToggle.checked = useGBDateFormat;
  });

  // Retrieve the showTabsNumber value from local storage
  chrome.storage.local.get({ showTabsNumber: true }, function (result) {
    showTabsNumber = result.showTabsNumber;
    tabWindowToggle.checked = showTabsNumber;
    updateBadge(); // Update badge based on initial state
  });

  // Function to update badge
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
});
