$(document).ready(function () {
  let processList = [];
  let executionTimeline = [];

  $('#algorithmSelector').change(function () {
  const selected = $(this).val();
  
  if (selected === 'RR') {
    $('#quantumGroup').removeClass('d-none');
  } else {
    $('#quantumGroup').addClass('d-none');
  }

  if (selected === 'PriorityNP' || selected === 'PriorityP' || selected === 'HRRN') {
    $('.priority-group').removeClass('d-none');
    $('.priority-header').removeClass('d-none');
  } else {
    $('.priority-group').addClass('d-none');
    $('.priority-header').addClass('d-none');
  }
});


  $('#btnAddProcess').click(function () {
    const pid = parseInt($('#processID').val());
    const arrival = parseInt($('#arrivalTime').val());
    const burst = parseInt($('#burstTime').val());
    const priority = parseInt($('#priority').val());

    if (isNaN(pid) || isNaN(arrival) || isNaN(burst) || burst <= 0 || pid < 1 || arrival < 0) {
      alert("Please enter valid process details.");
      return;
    }

    if (processList.find(p => p.processID === pid)) {
      alert("Duplicate Process ID not allowed.");
      return;
    }

    processList.push({ processID: pid, arrivalTime: arrival, burstTime: burst, priority });
    $('#tblProcessList tbody').append(
      `<tr><td>${pid}</td><td>${arrival}</td><td>${burst}</td><td>${priority}</td></tr>`
    );
    $('#processID, #arrivalTime, #burstTime, #priority').val('');
  });

  $('#btnCalculate').click(function () {
    const algorithm = $('#algorithmSelector').val();
    if (processList.length === 0) {
      alert("Please add at least one process.");
      return;
    }
    //Check if priorities are consecutive (e.g., 1,2,3,... even with duplicates)
    const priorities = processList.map(p => p.priority).filter(p => !isNaN(p));
    const unique = [...new Set(priorities)];
    unique.sort((a, b) => a - b);

    for (let i = 0; i < unique.length - 1; i++) {
      if (unique[i + 1] - unique[i] > 1) {
        alert("Priorities must be consecutive (e.g., 1,2,3...). Found gaps in: " + unique.join(", "));
        return;
      }
    }

    $('#tblResults tbody').empty();
    $('#avgTurnaroundTime, #avgWaitingTime, #throughput').val('');
    $('#ganttChart').empty().parent().hide();
    $('#ganttAnimation').empty().parent().hide();
    executionTimeline = [];

    let results = [];
    switch (algorithm) {
      case 'FCFS':
        results = fcfs([...processList]);
        break;
      case 'SJF':
        results = sjf([...processList]);
        break;
      case 'SRTF':
        results = srtf([...processList]);
        break;
      case 'RR':
        const quantum = parseInt($('#timeQuantum').val());
        if (isNaN(quantum) || quantum <= 0) {
          alert("Please enter a valid time quantum for Round Robin.");
          return;
        }
        results = rr([...processList], quantum);
        break;
      case 'PriorityNP':
        results = priorityNP([...processList]);
        break;
      case 'PriorityP':
        results = priorityP([...processList]);
        break;
     
      case 'HRRN':
        results = hrrn([...processList]);
        break;

      default:
        alert("Algorithm not implemented.");
        return;
    }

    let totalTAT = 0, totalWT = 0, maxCT = 0;
    results.forEach(p => {
      $('#tblResults tbody').append(
        `<tr>
          <td>${p.processID}</td>
          <td>${p.arrivalTime}</td>
          <td>${p.burstTime}</td>
          <td>${p.completionTime}</td>
          <td>${p.waitingTime}</td>
          <td>${p.turnaroundTime}</td>
        </tr>`
      );
      totalTAT += p.turnaroundTime;
      totalWT += p.waitingTime;
      if (p.completionTime > maxCT) maxCT = p.completionTime;
    });

    $('#avgTurnaroundTime').val((totalTAT / results.length).toFixed(2));
    $('#avgWaitingTime').val((totalWT / results.length).toFixed(2));
    $('#throughput').val((results.length / maxCT).toFixed(2));

    if (executionTimeline.length > 0) {
      $('#ganttChartContainer').show();
      $('#ganttAnimationContainer').show();
      renderGanttChart(executionTimeline);
      runGanttAnimation(executionTimeline);
    }

  const cpuSchedulerData = {
    algorithm,
    quantum: algorithm === 'RR' ? parseInt($('#timeQuantum').val()) : null,
    processes: processList.map(p => ({ ...p })), // original data
    timeline: executionTimeline                  // the actual order of CPU execution
    };

  sessionStorage.setItem("cpuSchedulerData", JSON.stringify(cpuSchedulerData));

// Show the Animated View button after calculation
  $('#showAnimatedBtn').show();

  });

  $('#btnReset').click(function () {
    processList = [];
    executionTimeline = [];
    $('#tblProcessList tbody').empty();
    $('#tblResults tbody').empty();
    $('#avgTurnaroundTime, #avgWaitingTime, #throughput').val('');
    $('#ganttChart').empty().parent().hide();
    $('#ganttAnimation').empty().parent().hide();
    $('#processID, #arrivalTime, #burstTime, #priority').val('');
    $('#showAnimatedBtn').hide();
  });

  // FCFS Algorithm
  function fcfs(list) {
    list.sort((a, b) => a.arrivalTime - b.arrivalTime);
    let time = 0;
    list.forEach(p => {
      const start = Math.max(time, p.arrivalTime);
      const end = start + p.burstTime;
      p.completionTime = end;
      p.turnaroundTime = p.completionTime - p.arrivalTime;
      p.waitingTime = p.turnaroundTime - p.burstTime;
      time = end;
      executionTimeline.push({ pid: p.processID, start, end, duration: end - start });
    });
    return list;
  }

  // SJF Algorithm (Non-preemptive)
  function sjf(list) {
    let time = 0;
    let completed = [];
    let processes = [...list];
    while (processes.length > 0) {
      let available = processes.filter(p => p.arrivalTime <= time);
      if (available.length === 0) {
        time++;
        continue;
      }
      let shortest = available.reduce((a, b) => a.burstTime < b.burstTime ? a : b);
      const start = time;
      const end = start + shortest.burstTime;
      shortest.completionTime = end;
      shortest.turnaroundTime = end - shortest.arrivalTime;
      shortest.waitingTime = shortest.turnaroundTime - shortest.burstTime;
      executionTimeline.push({ pid: shortest.processID, start, end, duration: end - start });
      time = end;
      completed.push(shortest);
      processes = processes.filter(p => p.processID !== shortest.processID);
    }
    return completed;
  }

  // SRTF Algorithm (Preemptive SJF)
  function srtf(list) {
    let time = 0;
    let completed = [];
    let processes = list.map(p => ({
      ...p,
      remaining: p.burstTime
    }));
    while (completed.length < list.length) {
      let available = processes.filter(p => p.arrivalTime <= time && p.remaining > 0);
      if (available.length === 0) {
        time++;
        continue;
      }
      let current = available.reduce((a, b) => a.remaining < b.remaining ? a : b);
      const start = time;
      time++;
      current.remaining--;
      const nextTime = time;
      executionTimeline.push({ pid: current.processID, start, end: nextTime, duration: 1 });
      if (current.remaining === 0) {
        current.completionTime = time;
        current.turnaroundTime = current.completionTime - current.arrivalTime;
        current.waitingTime = current.turnaroundTime - current.burstTime;
        completed.push(current);
      }
    }
    return completed;
  }

  // Round Robin Algorithm
  function rr(list, quantum) {
    let time = 0;
    let queue = [...list].map(p => ({
      ...p,
      remaining: p.burstTime
    }));
    let completed = [];
    while (queue.length > 0) {
      let current = queue.shift();
      if (current.arrivalTime > time) {
        time = current.arrivalTime;
      }
      const execTime = Math.min(current.remaining, quantum);
      const start = time;
      const end = start + execTime;
      executionTimeline.push({ pid: current.processID, start, end, duration: execTime });
      current.remaining -= execTime;
      time = end;
      if (current.remaining === 0) {
        current.completionTime = time;
        current.turnaroundTime = current.completionTime - current.arrivalTime;
        current.waitingTime = current.turnaroundTime - current.burstTime;
        completed.push(current);
      } else {
        // Add newly arrived processes that came during current run
        const arrivedProcesses = list.filter(p => p.arrivalTime > start && p.arrivalTime <= time && !queue.some(q => q.processID === p.processID) && !completed.some(c => c.processID === p.processID));
        queue = queue.concat(arrivedProcesses);
        queue.push(current);
      }
    }
    return completed;
  }

  // Priority Non-Preemptive
  function priorityNP(list) {
    let time = 0;
    let completed = [];
    let processes = [...list];
    while (processes.length > 0) {
      let available = processes.filter(p => p.arrivalTime <= time);
      if (available.length === 0) {
        time++;
        continue;
      }
      let highest = available.reduce((a, b) => a.priority < b.priority ? a : b);
      const start = time;
      const end = start + highest.burstTime;
      highest.completionTime = end;
      highest.turnaroundTime = end - highest.arrivalTime;
      highest.waitingTime = highest.turnaroundTime - highest.burstTime;
      executionTimeline.push({ pid: highest.processID, start, end, duration: end - start });
      time = end;
      completed.push(highest);
      processes = processes.filter(p => p.processID !== highest.processID);
    }
    return completed;
  }

  // Priority Preemptive
  function priorityP(list) {
    let time = 0;
    let completed = [];
    let processes = list.map(p => ({
      ...p,
      remaining: p.burstTime
    }));
    while (completed.length < list.length) {
      let available = processes.filter(p => p.arrivalTime <= time && p.remaining > 0);
      if (available.length === 0) {
        time++;
        continue;
      }
      let current = available.reduce((a, b) => a.priority < b.priority ? a : b);
      const start = time;
      time++;
      current.remaining--;
      const nextTime = time;
      executionTimeline.push({ pid: current.processID, start, end: nextTime, duration: 1 });
      if (current.remaining === 0) {
        current.completionTime = time;
        current.turnaroundTime = current.completionTime - current.arrivalTime;
        current.waitingTime = current.turnaroundTime - current.burstTime;
        completed.push(current);
      }
    }
    return completed;
  }

  // HRRN
  function hrrn(list) {
    let time = 0;
    let completed = [];
    let processes = [...list];
    while (processes.length > 0) {
      let available = processes.filter(p => p.arrivalTime <= time);
      if (available.length === 0) {
        time++;
        continue;
      }
      available.forEach(p => {
        p.responseRatio = ((time - p.arrivalTime) + p.burstTime) / p.burstTime;
      });
      let selected = available.reduce((a, b) => a.responseRatio > b.responseRatio ? a : b);
      const start = time;
      const end = start + selected.burstTime;
      selected.completionTime = end;
      selected.turnaroundTime = end - selected.arrivalTime;
      selected.waitingTime = selected.turnaroundTime - selected.burstTime;
      executionTimeline.push({ pid: selected.processID, start, end, duration: end - start });
      time = end;
      completed.push(selected);
      processes = processes.filter(p => p.processID !== selected.processID);
    }
    return completed;
  }


  // Helper to insert IDLE blocks where there are gaps in timeline
function addIdleBlocks(timeline) {
  if (timeline.length === 0) return [];

  const result = [];
  for (let i = 0; i < timeline.length; i++) {
    const current = timeline[i];
    result.push(current);

    // If not last block, check gap to next block
    if (i < timeline.length - 1) {
      const next = timeline[i + 1];
      if (next.start > current.end) {
        // Insert an IDLE block for the gap
        result.push({
          pid: null,                  // no process id for idle
          start: current.end,
          end: next.start,
          duration: next.start - current.end
        });
      }
    }
  }
  return result;
}

// Gantt Chart render with IDLE blocks
function renderGanttChart(timeline) {
  $('#ganttChart').empty();

  const colors = ['#FFB6C1', '#87CEFA', '#98FB98', '#FFD700', '#DDA0DD', '#FF7F50', '#20B2AA'];
  const idleColor = '#b0bec5';  // Vibrant gray-blue for IDLE

  // Insert IDLE blocks
  const timelineWithIdle = addIdleBlocks(timeline);

  timelineWithIdle.forEach((block, i) => {
    const isIdle = block.pid === null;
    const bgColor = isIdle ? idleColor : colors[i % colors.length];
    const label = isIdle ? 'IDLE' : `P${block.pid}`;
    $('#ganttChart').append(`
      <div class="process-block" style="background-color:${bgColor}; width:${block.duration * 50}px">
        ${label}<br><small>${block.start} - ${block.end}</small>
      </div>
    `);
  });
}

// Gantt Animation with IDLE blocks
function runGanttAnimation(timeline) {
  $('#ganttAnimation').empty();

  const colors = ['#FF6F61', '#6B5B95', '#88B04B', '#FFA07A', '#F7CAC9', '#92A8D1', '#955251'];
  const idleColor = '#b0bec5'; // same vibrant gray-blue for IDLE

  // Insert IDLE blocks
  const timelineWithIdle = addIdleBlocks(timeline);

  timelineWithIdle.forEach((block, i) => {
    const isIdle = block.pid === null;
    const bgColor = isIdle ? idleColor : colors[i % colors.length];
    const label = isIdle ? 'IDLE' : `P${block.pid}`;

    $('#ganttAnimation').append(`
      <div class="process-block" id="anim-p${i}" style="background-color:${bgColor}; width:${block.duration * 50}px">
        ${label}<br><small>${block.start} - ${block.end}</small>
      </div>
    `);
  });

  // Flatten timeline for animation step-by-step highlighting
  const flatTimeline = [];
  timelineWithIdle.forEach((block, idx) => {
    for (let i = 0; i < block.duration; i++) {
      flatTimeline.push(idx);
    }
  });

  let current = 0;
  const interval = setInterval(() => {
    if (current > 0) {
      $(`#anim-p${flatTimeline[current - 1]}`).removeClass('active');
    }
    if (current >= flatTimeline.length) {
      clearInterval(interval);
      return;
    }
    $(`#anim-p${flatTimeline[current]}`).addClass('active');
    current++;
  }, 1000);
}
});
