document.addEventListener("DOMContentLoaded", () => {
  // Initialize UI elements after DOM loads
  const tabCountElem = document.getElementById("tab-count");
  const windowCountElem = document.getElementById("window-count");
  const totalTabsCell = document.getElementById("all-time-tabs");
  const resetButton = document.getElementById("resetButton");
  const inputDays = document.getElementById("numOfDays");
  const ctx = document.getElementById("chart").getContext("2d");
  const timeCtx = document.getElementById("timeChart").getContext("2d");
  const dateFormatToggle = document.getElementById("dateFormat");
  const tabWindowToggle = document.getElementById("toggleTabWindow");
  const tabs = document.querySelectorAll(".tab");
  const tabContents = document.querySelectorAll(".tab-content");
  const timeButtons = document.querySelectorAll(".chartOptions button");

  // Settings and chart variables
  let stepEnabled = false, autoScale = false, useGBDateFormat = false, showTabsNumber = true;
  let chart, timeChart;

  // Helper: update badge on popup via background operations
  const updateBadge = () => {
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
  };

  // Event: reset total tabs count and update the UI
  resetButton.addEventListener("click", () => {
    if (confirm("Are you sure you want to reset the total tabs count?")) {
      chrome.storage.local.set({ totalTabs: 0 }, () => {
        totalTabsCell.textContent = 0;
      });
    }
  });

  // Render daily tabs chart using Chart.js based on stored results
  const renderChart = (result) => {
    const now = new Date();
    const numOfDays = parseInt(inputDays.value);
    const dates = [], tabCounts = [], windowCounts = [];
    for (let i = numOfDays - 1; i >= 0; i--) {
      let date = new Date(now);
      date.setDate(now.getDate() - i);
      // Toggle between GB and default date formats
      const displayDate = useGBDateFormat 
        ? date.toLocaleDateString("en-GB", { month: "2-digit", day: "numeric" })
        : date.toLocaleDateString(undefined, { month: "2-digit", day: "numeric" });
      dates.push(displayDate);
      const dayData = result[date.toLocaleDateString()] || { tabs: 0, windows: 0 };
      tabCounts.push(dayData.tabs || 0);
      windowCounts.push(dayData.windows || 0);
    }
    if (chart) chart.destroy();
    // Create a gradient fill for the line chart
    const fillGradient = ctx.createLinearGradient(0, 0, 0, ctx.canvas.height);
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
          },
        ],
      },
      options: {
        responsive: true,
        scales: {
          x: { ticks: { color: "black" } },
          y: { beginAtZero: true, ticks: { color: "black" } }
        },
      },
    });
  };

  // Update main stats by requesting stored data from background
  const updateMainStats = () => {
    chrome.runtime.sendMessage({ action: "getData" }, (response) => {
      tabCountElem.textContent = response.tabCount;
      windowCountElem.textContent = response.windowCount;
      totalTabsCell.textContent = response.result.totalTabs || 0;
      renderChart(response.result);
    });
  };

  // Helper to determine time unit for chart based on range
  const getTimeUnit = (range) => {
    switch (range) {
      case 'today': return 'hour';
      case 'week': 
      case 'month': return 'day';
      case 'year': return 'month';
      case 'allTime': return 'year';
      default: return 'day';
    }
  };

  // Create timeChart using Chart.js for the time-based graph
  const createTimeChart = (data, range) => {
    if (timeChart) timeChart.destroy();
    const timeUnit = getTimeUnit(range);
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
          backgroundColor: 'rgba(26, 115, 232, 0.8)',
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
              unit: timeUnit, // dynamically set time unit
              tooltipFormat: 'MMM d, HH:mm',
              displayFormats: {
                hour: 'HH:mm',
                day: 'MMM d',
                month: 'MMM yyyy',
                year: 'yyyy'
              }
            },
            ticks: { color: "black" }
          },
          y: {
            beginAtZero: !autoScale,
            ticks: { stepSize: 1, color: "black" }
          }
        },
        plugins: { legend: { display: false } }
      }
    });
  };

  // Request data for time-based graph and update timeChart
  const updateTimeChart = (range) => {
    chrome.runtime.sendMessage({ action: 'getTabData', range }, (response) => {
      createTimeChart(response.data, range);
    });
  };

  // Attach event listeners to time interval buttons and toggles
  document.getElementById('todayButton').addEventListener('click', () => updateTimeChart('today'));
  document.getElementById('weekButton').addEventListener('click', () => updateTimeChart('week'));
  document.getElementById('monthButton').addEventListener('click', () => updateTimeChart('month'));
  document.getElementById('yearButton').addEventListener('click', () => updateTimeChart('year'));
  document.getElementById('allTimeButton').addEventListener('click', () => updateTimeChart('allTime'));

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

  // Update statistics on input change events and update storage settings
  inputDays.addEventListener("change", () => {
    chrome.storage.local.set({ numOfDays: inputDays.value });
    updateMainStats();
  });
  dateFormatToggle.addEventListener("change", () => {
    useGBDateFormat = dateFormatToggle.checked;
    chrome.storage.local.set({ useGBDateFormat });
    updateMainStats();
  });
  tabWindowToggle.addEventListener("change", () => {
    showTabsNumber = tabWindowToggle.checked;
    chrome.storage.local.set({ showTabsNumber });
    updateBadge();
  });

  // Tab switching logic: lazy-load timeChart when second tab is accessed
  tabs.forEach((tab, index) => {
    tab.addEventListener("click", () => {
      tabs.forEach(t => t.classList.remove("active"));
      tabContents.forEach(tc => tc.classList.remove("active"));
      tab.classList.add("active");
      tabContents[index].classList.add("active");
      if (index === 1 && !timeChart) {
        updateTimeChart('today');
      }
    });
  });

  // Set default active tab on load
  tabs[0].classList.add("active");
  tabContents[0].classList.add("active");

  // Initialize settings from storage then update main UI stats and set toggle states
  chrome.storage.local.get({
    stepEnabled: true,
    autoScale: true,
    numOfDays: 7,
    useGBDateFormat: false,
    showTabsNumber: true
  }, (result) => {
    stepEnabled = result.stepEnabled;
    autoScale = result.autoScale;
    inputDays.value = result.numOfDays;
    useGBDateFormat = result.useGBDateFormat;
    dateFormatToggle.checked = useGBDateFormat;
    showTabsNumber = result.showTabsNumber;
    tabWindowToggle.checked = showTabsNumber;
    // Restore second tab toggle states
    document.getElementById('autoScaleToggle').checked = autoScale;
    document.getElementById('stepToggle').checked = stepEnabled;
    updateBadge();
    updateMainStats(); // Initial rendering of daily tabs chart
  });

  // Set default active state for "Today" time chart button
  document.getElementById('todayButton').classList.add('active');

  // Manage active state on time interval button group
  timeButtons.forEach(button => {
    button.addEventListener('click', () => {
      timeButtons.forEach(btn => btn.classList.remove('active'));
      button.classList.add('active');
    });
  });
});
