document.addEventListener('DOMContentLoaded', function() {

  // count the number of tabs and windows and save the data to chrome.storage.local
  function countTabs() {
    let tabCount = 0;
    let windowCount = 0;

    chrome.windows.getAll({populate: true}, function(windows) {
      windowCount = windows.length;

      windows.forEach(function(window) {
        tabCount += window.tabs.length;
      });

      let date = new Date().toLocaleDateString();

      chrome.storage.local.get(null, function(result) {
        /*let data = result || {};
        data[date] = {tabs: tabCount, windows: windowCount};

        //chrome.storage.local.set({totalTabs: data.totalTabs});
        chrome.storage.local.set({totalTabs: data.totalTabs, [date]: data[date], windows: windowCount});

        updateTable(tabCount, windowCount, result);
        renderChart();*/

        // send a message to the service worker to count the tabs
        chrome.runtime.sendMessage({action: "countTabs"}, function(response) {
          // handle the response from the service worker, if any
          updateTable(response.tabCount, response.windowCount, response.result);
          renderChart();
        });
      });
    });
  }

  // render the chart using Chart.js
  function renderChart() {
    chrome.storage.local.get(null, function(result) {
      let dates = [];
      let tabCounts = [];
      let windowCounts = [];
      let now = new Date();
      let numOfDays = 6;
  

      for (let i = numOfDays; i >= 0; i--) {
        let date = new Date(now);
        date.setDate(now.getDate() - i);
        dates.push(date.toLocaleDateString());
        let data = result[date.toLocaleDateString()] || {tabs: 0, windows: 0};
        tabCounts.push(data.tabs || 0);
        windowCounts.push(data.windows || 0);  
      }

      let ctx = document.getElementById('chart').getContext('2d');
      let chart = new Chart(ctx, {
        //type: 'line',
        data: {
          labels: dates,
          datasets: [{
            type: 'line',
            label: 'Tab Count',
            data: tabCounts,
            borderColor: 'rgb(26, 115, 232)',
            borderWidth: 2,
            fill: true,
            backgroundColor: 'rgba(0, 109, 204, 0.3)',
            pointRadius: 3,
            tension: 0.1,
            hidden: false
          }, {
            type: 'bar',
            label: 'Window Count',
            data: windowCounts,
            borderColor: 'rgb(242, 86, 58)',
            borderWidth: 2,
            backgroundColor: 'rgba(242, 86, 58, 0.4)',
            //padding: 0,
            order: 2,
            barThickness: 20,
            borderRadius: 50,
            hidden: false
          }]
        },
        options: {
          scaleShowValues: true,
          //autoSkip: false,
          responsive: true,
          scales: {
            x: {
              ticks: {
                color: "black"
              }
            },
            y: {
              beginAtZero: true,
              ticks: {
                color: "black"
              }
            }
          },
          plugins: {
            legend: {
              //display: false
              labels: {
                font: {
                  //size: 14,
                  //color: 'black',
                  //weight: 'bold'
                }
              }
            }
          }
        }
      });
    });
  }

  function updateTable(tabCount, windowCount, result) {
    // get the elements to update
    let tabCountElem = document.getElementById('tab-count');
    let windowCountElem = document.getElementById('window-count');
    let totalTabsCell = document.getElementById('all-time-tabs');

    // initialize the totalTabs variable with the value of result.totalTabs, if it exists, or 0 if it doesn't
    let totalTabs = result.totalTabs || 0;

    // update the text content
    tabCountElem.textContent = tabCount;
    windowCountElem.textContent = windowCount;
    totalTabsCell.innerText = totalTabs; // update the totalTabsCell with the totalTabs count
  }

  // reset all-time tabs
  const resetButton = document.getElementById('resetButton');

  resetButton.addEventListener('click', function() {
    let totalTabsCell = document.getElementById('all-time-tabs');

    chrome.storage.local.set({totalTabs: 0}, function() {
      totalTabsCell.innerText = 0;
    });
  });

  // call the countTabs function to get the initial tab and window count
  countTabs();

});
