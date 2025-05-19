// Updated app.js for Schedulink: CPU Scheduling Simulator

$(document).ready(function () {
    $(".form-group-time-quantum").hide();
    let processList = [];
  
    // Show/Hide Time Quantum field for RR
    $('#algorithmSelector').on('change', function () {
      if (this.value === 'optRR') {
        $(".form-group-time-quantum").show(300);
      } else {
        $(".form-group-time-quantum").hide(300);
      }
    });
  
    // Add process to list
    $('#btnAddProcess').on('click', function () {
      let pid = parseInt($('#processID').val());
      let at = parseInt($('#arrivalTime').val());
      let bt = parseInt($('#burstTime').val());
  
      if (!isValidProcessInput(pid, at, bt)) {
        alert("Invalid input! Ensure all fields are filled with valid, non-negative numbers. Burst time must be > 0.");
        return;
      }
  
      if (processList.some(p => p.processID === pid)) {
        alert("Duplicate Process ID not allowed.");
        return;
      }
  
      processList.push({ processID: pid, arrivalTime: at, burstTime: bt });
  
      $('#tblProcessList tbody').append(
        `<tr><td>${pid}</td><td>${at}</td><td>${bt}</td></tr>`
      );
  
      $('#processID, #arrivalTime, #burstTime').val('');
    });
  
    // Trigger scheduling
    $('#btnCalculate').on('click', function () {
      if (processList.length === 0) {
        alert("Please add at least one process.");
        return;
      }
  
      const algo = $('#algorithmSelector').val();
      const timeQuantum = parseInt($('#timeQuantum').val());
      const dataCopy = JSON.parse(JSON.stringify(processList));
  
      $('#tblResults tbody').empty();
      $('#avgTurnaroundTime, #avgWaitingTime, #throughput').val('');
  
      let results = [];
  
      switch (algo) {
        case 'optFCFS': results = scheduleFCFS(dataCopy); break;
        case 'optSJF': results = scheduleSJF(dataCopy); break;
        case 'optSRTF': results = scheduleSRTF(dataCopy); break;
        case 'optRR':
          if (isNaN(timeQuantum) || timeQuantum <= 0) {
            alert("Enter a valid positive Time Quantum for Round Robin.");
            return;
          }
          results = scheduleRR(dataCopy, timeQuantum);
          break;
        default:
          alert("Unsupported algorithm selected.");
          return;
      }
  
      renderResults(results);
    });
  
    function isValidProcessInput(pid, at, bt) {
      return (
        !isNaN(pid) && pid >= 0 &&
        !isNaN(at) && at >= 0 &&
        !isNaN(bt) && bt > 0
      );
    }
  
    function renderResults(results) {
      let totalWT = 0, totalTAT = 0, maxCT = 0;
  
      results.forEach(proc => {
        $('#tblResults tbody').append(
          `<tr>
            <td>${proc.processID}</td>
            <td>${proc.arrivalTime}</td>
            <td>${proc.burstTime}</td>
            <td>${proc.completedTime}</td>
            <td>${proc.waitingTime}</td>
            <td>${proc.turnAroundTime}</td>
          </tr>`
        );
        totalWT += proc.waitingTime;
        totalTAT += proc.turnAroundTime;
        if (proc.completedTime > maxCT) maxCT = proc.completedTime;
      });
  
      const n = results.length;
      $('#avgTurnaroundTime').val((totalTAT / n).toFixed(2));
      $('#avgWaitingTime').val((totalWT / n).toFixed(2));
      $('#throughput').val((n / maxCT).toFixed(2));
    }
  
    // --- Scheduling Algorithms ---
  
    function scheduleFCFS(plist) {
      plist.sort((a, b) => a.arrivalTime - b.arrivalTime);
      let time = 0;
      let result = [];
  
      for (let p of plist) {
        time = Math.max(time, p.arrivalTime);
        let ct = time + p.burstTime;
        let tat = ct - p.arrivalTime;
        let wt = tat - p.burstTime;
  
        result.push({ ...p, completedTime: ct, turnAroundTime: tat, waitingTime: wt });
        time = ct;
      }
      return result;
    }
  
    function scheduleSJF(plist) {
      let time = 0;
      let result = [];
      let ready = [];
      plist.sort((a, b) => a.arrivalTime - b.arrivalTime);
  
      while (plist.length > 0 || ready.length > 0) {
        while (plist.length > 0 && plist[0].arrivalTime <= time) {
          ready.push(plist.shift());
        }
  
        if (ready.length === 0) {
          time = plist[0].arrivalTime;
          continue;
        }
  
        ready.sort((a, b) => a.burstTime - b.burstTime);
        let p = ready.shift();
  
        let ct = time + p.burstTime;
        let tat = ct - p.arrivalTime;
        let wt = tat - p.burstTime;
        result.push({ ...p, completedTime: ct, turnAroundTime: tat, waitingTime: wt });
        time = ct;
      }
      return result;
    }
  
    function scheduleSRTF(plist) {
      let time = 0, completed = [];
      let queue = [];
      let map = new Map();
  
      plist.forEach(p => map.set(p.processID, { ...p }));
      plist.sort((a, b) => a.arrivalTime - b.arrivalTime);
  
      while (plist.length > 0 || queue.length > 0) {
        while (plist.length > 0 && plist[0].arrivalTime <= time) {
          queue.push(plist.shift());
        }
        if (queue.length === 0) {
          time++;
          continue;
        }
  
        queue.sort((a, b) => a.burstTime - b.burstTime);
        let current = queue.shift();
        current.burstTime--;
  
        if (current.burstTime === 0) {
          current.completedTime = time + 1;
          completed.push(current);
        } else {
          queue.push(current);
        }
        time++;
      }
  
      return completed.map(proc => {
        let original = map.get(proc.processID);
        let tat = proc.completedTime - original.arrivalTime;
        let wt = tat - original.burstTime;
        return {
          ...original,
          completedTime: proc.completedTime,
          turnAroundTime: tat,
          waitingTime: wt
        };
      });
    }
  
    function scheduleRR(plist, tq) {
      let time = 0, queue = [], result = [];
      let map = new Map();
      plist.forEach(p => map.set(p.processID, { ...p }));
      plist.sort((a, b) => a.arrivalTime - b.arrivalTime);
  
      while (plist.length > 0 || queue.length > 0) {
        while (plist.length > 0 && plist[0].arrivalTime <= time) {
          queue.push(plist.shift());
        }
  
        if (queue.length === 0) {
          time++;
          continue;
        }
  
        let p = queue.shift();
        let execTime = Math.min(tq, p.burstTime);
        p.burstTime -= execTime;
        time += execTime;
  
        while (plist.length > 0 && plist[0].arrivalTime <= time) {
          queue.push(plist.shift());
        }
  
        if (p.burstTime > 0) {
          queue.push(p);
        } else {
          p.completedTime = time;
          result.push(p);
        }
      }
  
      return result.map(proc => {
        let original = map.get(proc.processID);
        let tat = proc.completedTime - original.arrivalTime;
        let wt = tat - original.burstTime;
        return {
          ...original,
          completedTime: proc.completedTime,
          turnAroundTime: tat,
          waitingTime: wt
        };
      });
    }
  });
  