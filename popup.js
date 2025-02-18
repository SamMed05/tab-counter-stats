document.addEventListener("DOMContentLoaded", function () {
  // Initialize variables and DOM elements
  const tabCountElem = document.getElementById("tab-count");
  const windowCountElem = document.getElementById("window-count");
  const totalTabsCell = document.getElementById("all-time-tabs");
  const resetButton = document.getElementById("resetButton");
  const inputDays = document.getElementById("numOfDays");
  const ctx = document.getElementById("chart").getContext("2d");
  const dateFormatToggle = document.getElementById("dateFormat");
  const tabWindowToggle = document.getElementById("toggleTabWindow");
  const timeCtx = document.getElementById('timeChart').getContext('2d');
  let stepEnabled = false;
  let autoScale = false;
  let useGBDateFormat = false;
  let showTabsNumber = true;
  let chart;
  let timeChart;

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

    let fillGradient = ctx.createLinearGradient(0, 0, 0, ctx.canvas.height);
    fillGradient.addColorStop(0, 'rgba(26, 115, 232, 0.5)');
    fillGradient.addColorStop(1, 'rgba(26, 115, 232, 0)');

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
            backgroundColor: fillGradient,
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

  // Retrieve all settings before initializing
  chrome.storage.local.get({
    stepEnabled: false,
    autoScale: false,
    numOfDays: 7,
    useGBDateFormat: false,
    showTabsNumber: true
  }, function (result) {
    stepEnabled = result.stepEnabled;
    autoScale = result.autoScale;
    document.getElementById('stepToggle').checked = stepEnabled;
    document.getElementById('autoScaleToggle').checked = autoScale;

    inputDays.value = result.numOfDays;
    useGBDateFormat = result.useGBDateFormat;
    dateFormatToggle.checked = useGBDateFormat;

    showTabsNumber = result.showTabsNumber;
    tabWindowToggle.checked = showTabsNumber;
    updateBadge(); // Update badge based on initial state

    countTabsAndWindows(); // Renders the main chart
    updateChart('today');  // Renders the time chart
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

  // Time graph
  function createChart(data) {
    if (timeChart) {
      timeChart.destroy();
    }

    timeChart = new Chart(timeCtx, {
      type: 'line',
      data: {
        labels: data.map(entry => new Date(entry.timestamp)),
        datasets: [{
          label: '',
          data: data.map(entry => entry.tabCount),
          borderColor: 'rgb(26, 115, 232)',
          borderWidth: 1,
          fill: true,
          backgroundColor: 'rgba(26, 115, 232, 0.8)', // Solid color
          pointRadius: 0,
          tension: 0.1,
          stepped: stepEnabled ? 'before' : false,
        }]
      },
      options: {
        scales: {
          x: {
            type: 'time',
            time: {
              unit: 'second',
              tooltipFormat: 'MMM d, HH:mm',
              displayFormats: {
                second: 'HH:mm:ss',
                minute: 'HH:mm',
                hour: 'MMM d, HH:mm',
                day: 'MMM d',
                week: 'MMM d',
                month: 'MMM yyyy',
                year: 'yyyy'
              }
            }
          },
          y: {
            beginAtZero: !autoScale,
            ticks: {
              stepSize: 1 // Only integer steps
            }
          }
        },
        plugins: {
          legend: {
            display: false
          }
        }
      }
    });
  }

  function updateChart(range) {
    chrome.runtime.sendMessage({ action: 'getTabData', range: range }, function (response) {
      createChart(response.data);
    });
  }

  document.getElementById('todayButton').addEventListener('click', function () {
    updateChart('today');
  });

  document.getElementById('weekButton').addEventListener('click', function () {
    updateChart('week');
  });

  document.getElementById('monthButton').addEventListener('click', function () {
    updateChart('month');
  });

  document.getElementById('yearButton').addEventListener('click', function () {
    updateChart('year');
  });

  document.getElementById('allTimeButton').addEventListener('click', function () {
    updateChart('allTime');
  });

  document.getElementById('autoScaleToggle').addEventListener('change', function() {
    autoScale = this.checked;
    chrome.storage.local.set({ autoScale });
    if (timeChart) {
      timeChart.options.scales.y.beginAtZero = !autoScale;
      timeChart.update();
    }
  });

  document.getElementById('stepToggle').addEventListener('change', function() {
    stepEnabled = this.checked;
    chrome.storage.local.set({ stepEnabled });
    if (timeChart) {
      timeChart.data.datasets[0].stepped = stepEnabled ? 'before' : false;
      timeChart.update();
    }
  });

  // Initial load
  updateChart('today');
});
