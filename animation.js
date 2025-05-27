$(document).ready(function () {
  const rawData = sessionStorage.getItem("cpuSchedulerData");
  if (!rawData) {
    alert(
      "No scheduling data found. Please run a simulation first on the main page."
    );
    $("#replayBtn").prop("disabled", true);
    return;
  }

  const data = JSON.parse(rawData);
  const processes = data.processes || [];
  const timeline = data.timeline || [];
  const quantum = data.quantum;
  const algorithm = data.algorithm;

  if (processes.length === 0 || timeline.length === 0) {
    alert("Incomplete data. Please run a simulation first.");
    $("#replayBtn").prop("disabled", true);
    return;
  }

  // Selectors
  const $readyQueue = $("#readyQueue");
  const $cpuExecution = $("#cpuExecution");
  const $waitingQueue = $("#waitingQueue");
  const $progressBar = $("#progressBar");
  const $timeDisplay = $("#timeDisplay");

  let simulationTime = 0;
  let currentIndex = 0;
  const INTERVAL = 500; // in ms for visible animation
  const processColors = {};
  const usedColors = [];

  function getColor(pid) {
    if (processColors[pid]) return processColors[pid];
    const colors = [
      "#FF6F61",
      "#6B5B95",
      "#88B04B",
      "#FFA07A",
      "#F7CAC9",
      "#92A8D1",
      "#955251",
      "#D65076",
    ];
    const color = colors[usedColors.length % colors.length];
    usedColors.push(color);
    processColors[pid] = color;
    return color;
  }

  function createProcessDiv(pid) {
    return $(
      `<div id="proc-${pid}" class="process" style="background-color:${getColor(
        pid
      )};">P${pid}</div>`
    );
  }

  // Step 1: Show all processes in ready queue at start
  function initReadyQueue() {
    $readyQueue.empty();
    processes.forEach((p) => {
      const $proc = createProcessDiv(p.processID);
      $readyQueue.append($proc);
    });
  }

  const processExecutionTime = {};
  const processWentToIO = {};

  // Step 2: Animate timeline entries
  function runTimelineAnimation() {
    if (currentIndex >= timeline.length) return;

    const entry = timeline[currentIndex];
    const pid = entry.pid;
    const duration = entry.duration;
    const start = entry.start;

    const $proc = $(`#proc-${pid}`);

    if ($proc.length === 0) {
      console.warn(`Missing div for process ${pid}`);
      currentIndex++;
      runTimelineAnimation();
      return;
    }

    // Show IDLE if simulationTime < next process start time
    const interval = setInterval(() => {
      if (simulationTime >= start) {
        clearInterval(interval);
        $("#cpuExecution").empty(); // Clear IDLE or leftover content

        // Track cumulative execution time
        if (!processExecutionTime[pid]) processExecutionTime[pid] = 0;
        processExecutionTime[pid] += duration;

        const preemptiveAlgos = ["RR", "SRTF", "PriorityP"];
        const isPreemptive = preemptiveAlgos.includes(algorithm);
        const hasIO =
          isPreemptive &&
          processExecutionTime[pid] >= 2 &&
          !processWentToIO[pid];

        $proc.detach().appendTo($cpuExecution).hide().fadeIn(200);
        $progressBar.css("width", "0%");

        let progress = 0;
        const steps = duration * (1000 / INTERVAL);
        const step = 100 / steps;

        let elapsed = 0;
        const progressInterval = setInterval(() => {
          progress += step;
          elapsed += INTERVAL / 1000;
          simulationTime += INTERVAL / 1000;
          $progressBar.css("width", `${Math.min(progress, 100)}%`);
          $timeDisplay.text(simulationTime.toFixed(1));
        }, INTERVAL);

        if (hasIO) {
          processWentToIO[pid] = true;
          setTimeout(() => {
            clearInterval(progressInterval);
            $progressBar.css("width", `0%`);
            $cpuExecution.empty();

            $proc.fadeOut(200, () => {
              $proc.detach().appendTo($waitingQueue).fadeIn(300);

              setTimeout(() => {
                $proc.fadeOut(200, () => {
                  $proc.detach().appendTo($readyQueue).fadeIn(300);
                  currentIndex++;
                  runTimelineAnimation();
                });
              }, 2000); // Simulated I/O delay
            });
          }, duration * 1000);
        } else {
          setTimeout(() => {
            clearInterval(progressInterval);
            $progressBar.css("width", `0%`);
            $cpuExecution.empty();

            const moreEntries = timeline
              .slice(currentIndex + 1)
              .some((e) => e.pid === pid);
            if (moreEntries) {
              $proc.fadeOut(200, () => {
                $proc.detach().appendTo($readyQueue).fadeIn(300);
                currentIndex++;
                runTimelineAnimation();
              });
            } else {
              $proc.fadeOut(200, () => $proc.remove());
              currentIndex++;
              runTimelineAnimation();
            }
          }, duration * 1000);
        }
      } else {
        // Before process arrives, show IDLE state
        if (
          $("#cpuExecution").children().length === 0 &&
          $("#cpuExecution .idle").length === 0
        ) {
          $("#cpuExecution").html(
            '<div class="idle" style="padding:8px;background:#ddd;border-radius:8px;">IDLE</div>'
          );
        }

        simulationTime += INTERVAL / 1000;
        $timeDisplay.text(simulationTime.toFixed(1));
      }
    }, INTERVAL);
  }

  // Replay button
  $("#replayBtn").click(() => {
    location.reload(); // reload page and re-trigger animation
  });

  // Start
  initReadyQueue();
  runTimelineAnimation();
});
