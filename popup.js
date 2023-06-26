document.addEventListener("DOMContentLoaded", function () {
  // Initialize variables and DOM elements
  const tabCountElem = document.getElementById("tab-count");
  const windowCountElem = document.getElementById("window-count");
  const totalTabsCell = document.getElementById("all-time-tabs");
  const resetButton = document.getElementById("resetButton");
  const inputDays = document.getElementById("numOfDays");
  const ctx = document.getElementById("chart").getContext("2d");
  let chart;

  // Get the tab and window count and update the UI
  function countTabs() {
    chrome.runtime.sendMessage({ action: "countTabs" }, function (response) {
      updateTable(response.tabCount, response.windowCount, response.result);
      renderChart(response.result);
    });
  }

  // Add event listener to the input element to update the chart
  inputDays.addEventListener("change", function (response) {
    chrome.storage.local.set({ numOfDays: inputDays.value }); // Store the input value in local storage
    countTabs();
  });

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
      dates.push(date.toLocaleDateString("en-GB"));
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
    totalTabsCell.innerText = result.totalTabs || 0; // Update the totalTabsCell with the totalTabs count, if it exists

    // Reset the totalTabs count if the reset button is clicked
    resetButton.addEventListener("click", function () {
      chrome.storage.local.set({ totalTabs: 0 }, function () {
        totalTabsCell.textContent = 0;
      });
    });
  }

  // Retrieve the input value from local storage
  chrome.storage.local.get({ numOfDays }, function (result) {
    inputDays.value = result.numOfDays;
    countTabs();
  });
});
