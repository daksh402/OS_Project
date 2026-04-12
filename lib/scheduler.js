const AGING_INTERVAL = 4;

const ALGORITHM_CONFIG = {
  fcfs: { id: "fcfs", name: "FCFS", preemptive: false },
  sjf: { id: "sjf", name: "SJF", preemptive: false },
  srtf: { id: "srtf", name: "SRTF", preemptive: true },
  priority: { id: "priority", name: "Priority", preemptive: true },
  aging: { id: "aging", name: "Priority Aging", preemptive: true },
  rr: { id: "rr", name: "Round Robin", preemptive: true }
};

function defaultPayload() {
  return {
    processes: [
      {
        pid: "P1",
        arrivalTime: 0,
        priority: 2,
        cpuBursts: [4, 3],
        ioBursts: [3],
        maxResources: [3, 2, 1],
        allocation: [1, 0, 0],
        request: [1, 1, 0]
      },
      {
        pid: "P2",
        arrivalTime: 1,
        priority: 1,
        cpuBursts: [3, 2],
        ioBursts: [2],
        maxResources: [2, 2, 2],
        allocation: [1, 1, 0],
        request: [0, 1, 1]
      },
      {
        pid: "P3",
        arrivalTime: 2,
        priority: 3,
        cpuBursts: [5],
        ioBursts: [],
        maxResources: [3, 1, 1],
        allocation: [1, 0, 1],
        request: [1, 0, 0]
      },
      {
        pid: "P4",
        arrivalTime: 4,
        priority: 2,
        cpuBursts: [2, 4],
        ioBursts: [4],
        maxResources: [2, 1, 2],
        allocation: [0, 1, 0],
        request: [1, 0, 1]
      }
    ],
    quantum: 2,
    algorithms: ["fcfs", "srtf", "rr", "aging"],
    totalResources: [7, 5, 4]
  };
}

function positiveInt(value, label) {
  const normalized = Number(value);
  if (!Number.isFinite(normalized) || normalized <= 0) {
    throw new Error(`${label} must be greater than 0`);
  }
  return Math.floor(normalized);
}

function nonNegativeInt(value, label) {
  const normalized = Number(value);
  if (!Number.isFinite(normalized) || normalized < 0) {
    throw new Error(`${label} must be greater than or equal to 0`);
  }
  return Math.floor(normalized);
}

function resourceVector(values) {
  if (!Array.isArray(values)) {
    return [0, 0, 0];
  }
  return values.map((value) => nonNegativeInt(value, "resource value"));
}

function normalizeProcesses(processes) {
  if (!Array.isArray(processes) || processes.length === 0) {
    throw new Error("At least one process is required");
  }

  return processes.map((process, index) => {
    const pid = String(process.pid || `P${index + 1}`);
    const cpuBursts = Array.isArray(process.cpuBursts) && process.cpuBursts.length
      ? process.cpuBursts.map((value) => positiveInt(value, `${pid} CPU burst`))
      : [positiveInt(process.cpuBurst || process.burstTime || 1, `${pid} CPU burst`)];
    const ioBursts = Array.isArray(process.ioBursts)
      ? process.ioBursts.map((value) => nonNegativeInt(value, `${pid} I/O burst`))
      : [];
    if (cpuBursts.length !== ioBursts.length + 1) {
      throw new Error(`${pid} must have exactly one more CPU burst than I/O bursts`);
    }

    return {
      pid,
      arrivalTime: nonNegativeInt(process.arrivalTime, `${pid} arrival time`),
      priority: nonNegativeInt(process.priority, `${pid} priority`),
      cpuBursts,
      ioBursts,
      maxResources: resourceVector(process.maxResources),
      allocation: resourceVector(process.allocation),
      request: resourceVector(process.request)
    };
  });
}

function cloneProcess(process) {
  return {
    pid: process.pid,
    arrivalTime: process.arrivalTime,
    priority: process.priority,
    cpuBursts: [...process.cpuBursts],
    ioBursts: [...process.ioBursts],
    currentCpuIndex: 0,
    currentIoIndex: 0,
    remainingCpu: process.cpuBursts[0],
    state: "new",
    waitingSince: null,
    totalWaitingTime: 0,
    responseTime: null,
    completionTime: null,
    ioCompleteAt: null,
    quantumRemaining: 0
  };
}

function simulateSuite(payload) {
  const defaults = defaultPayload();
  const processes = normalizeProcesses(payload.processes || defaults.processes);
  const algorithms = Array.isArray(payload.algorithms) && payload.algorithms.length
    ? payload.algorithms.filter((id) => ALGORITHM_CONFIG[id])
    : defaults.algorithms;
  const quantum = positiveInt(payload.quantum || defaults.quantum, "quantum");
  const totalResources = resourceVector(payload.totalResources || defaults.totalResources);

  const runs = algorithms.map((algorithmId) => simulateAlgorithm(algorithmId, processes, quantum));
  const deadlock = analyzeDeadlock(totalResources, processes);
  const ranking = rankRuns(runs);

  return {
    meta: {
      generatedAt: new Date().toISOString(),
      quantum,
      algorithms,
      processCount: processes.length
    },
    runs,
    ranking,
    deadlock
  };
}

function simulateAlgorithm(algorithmId, baseProcesses, quantum) {
  const config = ALGORITHM_CONFIG[algorithmId];
  const processes = baseProcesses.map(cloneProcess);
  const readyQueue = [];
  const waitingQueue = [];
  const gantt = [];
  const stateTimeline = [];
  const cpuUtilizationTimeline = [];
  let time = 0;
  let busyTime = 0;
  let running = null;
  let completed = 0;

  while (completed < processes.length) {
    moveArrivals(processes, readyQueue, time);
    moveCompletedIo(waitingQueue, readyQueue, time);

    if (config.preemptive && running && shouldPreempt(config.id, running, readyQueue, time)) {
      enqueueReady(readyQueue, running, time);
      running = null;
    }

    if (!running) {
      running = pickNextProcess(config.id, readyQueue, quantum, time);
      if (running) {
        if (running.responseTime === null) {
          running.responseTime = time - running.arrivalTime;
        }
        running.state = "running";
      }
    }

    const readySnapshot = readyQueue.map((process) => process.pid);
    const waitingSnapshot = waitingQueue.map((process) => process.pid);

    if (!running) {
      pushGantt(gantt, "IDLE", time, time + 1);
      stateTimeline.push({ time, running: "IDLE", ready: readySnapshot, waiting: waitingSnapshot });
      time += 1;
      cpuUtilizationTimeline.push(cumulativeUtilPoint(time, busyTime));
      continue;
    }

    pushGantt(gantt, running.pid, time, time + 1);
    stateTimeline.push({ time, running: running.pid, ready: readySnapshot, waiting: waitingSnapshot });

    running.remainingCpu -= 1;
    busyTime += 1;
    if (config.id === "rr") {
      running.quantumRemaining -= 1;
    }

    time += 1;
    cpuUtilizationTimeline.push(cumulativeUtilPoint(time, busyTime));

    if (running.remainingCpu === 0) {
      if (running.currentIoIndex < running.ioBursts.length) {
        running.state = "waiting";
        running.ioCompleteAt = time + running.ioBursts[running.currentIoIndex];
        running.currentIoIndex += 1;
        running.currentCpuIndex += 1;
        running.remainingCpu = running.cpuBursts[running.currentCpuIndex];
        waitingQueue.push(running);
      } else {
        running.state = "done";
        running.completionTime = time;
        completed += 1;
      }
      running = null;
      continue;
    }

    if (config.id === "rr" && running.quantumRemaining === 0) {
      enqueueReady(readyQueue, running, time);
      running = null;
    }
  }

  return {
    algorithmId: config.id,
    algorithmName: config.name,
    gantt,
    stateTimeline,
    cpuUtilizationTimeline,
    metrics: buildMetrics(config.name, processes, time, busyTime),
    processMetrics: processes.map((process) => ({
      pid: process.pid,
      turnaroundTime: process.completionTime - process.arrivalTime,
      waitingTime: process.totalWaitingTime,
      responseTime: process.responseTime,
      completionTime: process.completionTime
    }))
  };
}

function moveArrivals(processes, readyQueue, time) {
  processes.forEach((process) => {
    if (process.state === "new" && process.arrivalTime <= time) {
      enqueueReady(readyQueue, process, time);
    }
  });
}

function moveCompletedIo(waitingQueue, readyQueue, time) {
  for (let index = waitingQueue.length - 1; index >= 0; index -= 1) {
    if (waitingQueue[index].ioCompleteAt <= time) {
      const process = waitingQueue.splice(index, 1)[0];
      enqueueReady(readyQueue, process, time);
    }
  }
}

function enqueueReady(queue, process, time) {
  process.state = "ready";
  process.waitingSince = time;
  queue.push(process);
}

function pickNextProcess(algorithmId, queue, quantum, time) {
  if (queue.length === 0) {
    return null;
  }

  let pickedIndex = 0;
  if (algorithmId === "sjf" || algorithmId === "srtf") {
    pickedIndex = bestIndex(queue, (process) => [process.remainingCpu, process.arrivalTime, process.pid]);
  } else if (algorithmId === "priority") {
    pickedIndex = bestIndex(queue, (process) => [process.priority, process.remainingCpu, process.pid]);
  } else if (algorithmId === "aging") {
    pickedIndex = bestIndex(queue, (process) => [effectivePriority(process, time), process.remainingCpu, process.pid]);
  }

  const process = queue.splice(pickedIndex, 1)[0];
  if (process.waitingSince !== null) {
    process.totalWaitingTime += time - process.waitingSince;
  }
  process.waitingSince = null;
  if (algorithmId === "rr") {
    process.quantumRemaining = quantum;
  }
  return process;
}

function shouldPreempt(algorithmId, running, readyQueue, time) {
  if (readyQueue.length === 0) {
    return false;
  }
  if (algorithmId === "srtf") {
    return readyQueue.some((process) => process.remainingCpu < running.remainingCpu);
  }
  if (algorithmId === "priority") {
    return readyQueue.some((process) => process.priority < running.priority);
  }
  if (algorithmId === "aging") {
    return readyQueue.some((process) => effectivePriority(process, time) < effectivePriority(running, time));
  }
  return false;
}

function effectivePriority(process, time) {
  if (process.waitingSince === null) {
    return process.priority;
  }
  return Math.max(0, process.priority - Math.floor((time - process.waitingSince) / AGING_INTERVAL));
}

function bestIndex(items, getKeys) {
  let selectedIndex = 0;
  let selectedKeys = getKeys(items[0]);
  for (let index = 1; index < items.length; index += 1) {
    const keys = getKeys(items[index]);
    if (compareTuple(keys, selectedKeys) < 0) {
      selectedIndex = index;
      selectedKeys = keys;
    }
  }
  return selectedIndex;
}

function compareTuple(left, right) {
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] < right[index]) {
      return -1;
    }
    if (left[index] > right[index]) {
      return 1;
    }
  }
  return 0;
}

function pushGantt(gantt, pid, start, end) {
  const previous = gantt[gantt.length - 1];
  if (previous && previous.pid === pid && previous.end === start) {
    previous.end = end;
    return;
  }
  gantt.push({ pid, start, end });
}

function cumulativeUtilPoint(time, busyTime) {
  return {
    time,
    busyPercent: Number(((busyTime / time) * 100).toFixed(2)),
    idlePercent: Number((100 - (busyTime / time) * 100).toFixed(2))
  };
}

function buildMetrics(name, processes, totalTime, busyTime) {
  const turnaroundValues = processes.map((process) => process.completionTime - process.arrivalTime);
  const waitingValues = processes.map((process) => process.totalWaitingTime);
  const responseValues = processes.map((process) => process.responseTime);
  return {
    algorithm: name,
    totalTime,
    busyTime,
    idleTime: totalTime - busyTime,
    cpuUtilization: percentage(busyTime, totalTime),
    throughput: Number((processes.length / totalTime).toFixed(3)),
    averageTurnaroundTime: average(turnaroundValues),
    averageWaitingTime: average(waitingValues),
    averageResponseTime: average(responseValues)
  };
}

function average(values) {
  return Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(2));
}

function percentage(value, total) {
  return Number(((value / total) * 100).toFixed(2));
}

function rankRuns(runs) {
  return [...runs]
    .map((run) => ({
      algorithmId: run.algorithmId,
      algorithmName: run.algorithmName,
      score:
        run.metrics.averageWaitingTime * 0.3 +
        run.metrics.averageTurnaroundTime * 0.3 +
        run.metrics.averageResponseTime * 0.2 -
        run.metrics.cpuUtilization * 0.1 -
        run.metrics.throughput * 10 * 0.1,
      metrics: run.metrics
    }))
    .sort((left, right) => left.score - right.score)
    .map((entry, index) => ({
      rank: index + 1,
      algorithmId: entry.algorithmId,
      algorithmName: entry.algorithmName,
      score: Number(entry.score.toFixed(2)),
      metrics: entry.metrics
    }));
}

function analyzeDeadlock(totalResources, processes) {
  const allocation = processes.map((process) => process.allocation);
  const max = processes.map((process) => process.maxResources);
  const request = processes.map((process) => process.request);
  const available = totalResources.map((total, resourceIndex) => {
    const allocated = allocation.reduce((sum, vector) => sum + (vector[resourceIndex] || 0), 0);
    return total - allocated;
  });
  const need = max.map((vector, processIndex) =>
    vector.map((value, resourceIndex) => Math.max(0, value - (allocation[processIndex][resourceIndex] || 0)))
  );

  const decisions = processes.map((process, processIndex) => {
    const wanted = request[processIndex];
    const canTry = everyLE(wanted, need[processIndex]) && everyLE(wanted, available);
    if (!canTry) {
      return {
        pid: process.pid,
        request: wanted,
        action: "deferred",
        reason: "Request would exceed available resources or declared maximum need."
      };
    }

    const projectedAvailable = subtractVectors(available, wanted);
    const projectedAllocation = allocation.map((vector) => [...vector]);
    projectedAllocation[processIndex] = addVectors(projectedAllocation[processIndex], wanted);
    const projectedNeed = need.map((vector) => [...vector]);
    projectedNeed[processIndex] = subtractVectors(projectedNeed[processIndex], wanted);
    const safety = safeSequence(projectedAvailable, projectedAllocation, projectedNeed, processes.map((p) => p.pid));

    return {
      pid: process.pid,
      request: wanted,
      action: safety.safe ? "granted" : "deferred",
      reason: safety.safe
        ? "Request remains in a safe state, so Banker granted it automatically."
        : "Request is postponed because it would move the system into an unsafe state.",
      projectedSafeSequence: safety.sequence
    };
  });

  const safety = safeSequence(available, allocation, need, processes.map((process) => process.pid));
  const nodes = [
    ...processes.map((process, index) => ({ id: process.pid, label: process.pid, type: "process", index })),
    ...totalResources.map((value, index) => ({ id: `R${index + 1}`, label: `R${index + 1} (${value})`, type: "resource", index }))
  ];
  const edges = [];

  processes.forEach((process, processIndex) => {
    allocation[processIndex].forEach((value, resourceIndex) => {
      if (value > 0) {
        edges.push({ from: `R${resourceIndex + 1}`, to: process.pid, label: `alloc ${value}`, kind: "allocation" });
      }
    });
    request[processIndex].forEach((value, resourceIndex) => {
      if (value > 0) {
        edges.push({
          from: process.pid,
          to: `R${resourceIndex + 1}`,
          label: `req ${value}`,
          kind: decisions[processIndex].action === "granted" ? "granted" : "request"
        });
      }
    });
  });

  return {
    totalResources,
    available,
    need,
    safe: safety.safe,
    safeSequence: safety.sequence,
    decisions,
    graph: { nodes, edges }
  };
}

function safeSequence(initialAvailable, allocation, need, pids) {
  const available = [...initialAvailable];
  const finished = new Array(allocation.length).fill(false);
  const sequence = [];
  let progress = true;

  while (sequence.length < allocation.length && progress) {
    progress = false;
    for (let index = 0; index < allocation.length; index += 1) {
      if (!finished[index] && everyLE(need[index], available)) {
        finished[index] = true;
        progress = true;
        sequence.push(pids[index]);
        for (let resourceIndex = 0; resourceIndex < available.length; resourceIndex += 1) {
          available[resourceIndex] += allocation[index][resourceIndex] || 0;
        }
      }
    }
  }

  return { safe: finished.every(Boolean), sequence };
}

function everyLE(left, right) {
  return left.every((value, index) => value <= (right[index] || 0));
}

function addVectors(left, right) {
  return left.map((value, index) => value + (right[index] || 0));
}

function subtractVectors(left, right) {
  return left.map((value, index) => value - (right[index] || 0));
}

module.exports = {
  defaultPayload,
  simulateSuite
};
