const state = {
  processes: [],
  algorithms: [
    { id: "fcfs", label: "FCFS", checked: true },
    { id: "sjf", label: "SJF", checked: false },
    { id: "srtf", label: "SRTF", checked: true },
    { id: "priority", label: "Priority", checked: false },
    { id: "aging", label: "Priority Aging", checked: true },
    { id: "rr", label: "Round Robin", checked: true }
  ],
  result: null,
  editingPid: null
};

const colors = ["#2563eb", "#7c3aed", "#10b981", "#f59e0b", "#ec4899", "#06b6d4", "#ef4444"];

const els = {
  algorithmList: document.getElementById("algorithmList"),
  processTableBody: document.getElementById("processTableBody"),
  rankingCards: document.getElementById("rankingCards"),
  runCards: document.getElementById("runCards"),
  splitScreen: document.getElementById("splitScreen"),
  utilizationCanvas: document.getElementById("utilizationCanvas"),
  deadlockSummary: document.getElementById("deadlockSummary"),
  resourceGraph: document.getElementById("resourceGraph"),
  quantumInput: document.getElementById("quantumInput"),
  themeSelect: document.getElementById("themeSelect"),
  algorithmsActive: document.getElementById("algorithmsActive"),
  processCount: document.getElementById("processCount"),
  deadlockStatus: document.getElementById("deadlockStatus"),
  pidInput: document.getElementById("pidInput"),
  arrivalInput: document.getElementById("arrivalInput"),
  priorityInput: document.getElementById("priorityInput"),
  cpuInput: document.getElementById("cpuInput"),
  ioInput: document.getElementById("ioInput"),
  maxInput: document.getElementById("maxInput"),
  allocationInput: document.getElementById("allocationInput"),
  requestInput: document.getElementById("requestInput"),
  resource1: document.getElementById("resource1"),
  resource2: document.getElementById("resource2"),
  resource3: document.getElementById("resource3"),
  runBtn: document.getElementById("runBtn"),
  loadDemoBtn: document.getElementById("loadDemoBtn"),
  addProcessBtn: document.getElementById("addProcessBtn"),
  clearFormBtn: document.getElementById("clearFormBtn")
};

async function init() {
  renderAlgorithmList();
  bindEvents();
  await loadDemo();
}

function bindEvents() {
  els.runBtn.addEventListener("click", runSimulation);
  els.loadDemoBtn.addEventListener("click", loadDemo);
  els.addProcessBtn.addEventListener("click", upsertProcess);
  els.clearFormBtn.addEventListener("click", clearForm);
  els.themeSelect.addEventListener("change", applyTheme);
}

async function loadDemo() {
  const response = await fetch("/api/defaults");
  const payload = await response.json();
  state.processes = payload.processes;
  els.quantumInput.value = payload.quantum;
  [els.resource1.value, els.resource2.value, els.resource3.value] = payload.totalResources;
  state.algorithms.forEach((item) => {
    item.checked = payload.algorithms.includes(item.id);
  });
  clearForm();
  renderAlgorithmList();
  renderProcessTable();
  await runSimulation();
}

function renderAlgorithmList() {
  els.algorithmList.innerHTML = "";
  state.algorithms.forEach((algorithm) => {
    const wrapper = document.createElement("label");
    wrapper.className = "checkbox-pill";
    wrapper.innerHTML = `
      <input type="checkbox" ${algorithm.checked ? "checked" : ""} data-id="${algorithm.id}">
      <span>${algorithm.label}</span>
    `;
    wrapper.querySelector("input").addEventListener("change", (event) => {
      algorithm.checked = event.target.checked;
    });
    els.algorithmList.appendChild(wrapper);
  });
}

function renderProcessTable() {
  els.processTableBody.innerHTML = "";
  state.processes.forEach((process) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${process.pid}</td>
      <td>${process.arrivalTime}</td>
      <td>${process.priority}</td>
      <td>${process.cpuBursts.join(", ")}</td>
      <td>${process.ioBursts.join(", ") || "-"}</td>
      <td>${process.maxResources.join(", ")}</td>
      <td>${process.allocation.join(", ")}</td>
      <td>${process.request.join(", ")}</td>
      <td>
        <div class="small-actions">
          <button class="ghost" data-action="edit" data-pid="${process.pid}">Edit</button>
          <button class="ghost" data-action="delete" data-pid="${process.pid}">Delete</button>
        </div>
      </td>
    `;
    row.querySelectorAll("button").forEach((button) => {
      button.addEventListener("click", () => {
        if (button.dataset.action === "edit") {
          loadProcessIntoForm(button.dataset.pid);
        } else {
          deleteProcess(button.dataset.pid);
        }
      });
    });
    els.processTableBody.appendChild(row);
  });
  els.processCount.textContent = String(state.processes.length);
}

function parseCsvVector(value) {
  const trimmed = String(value || "").trim();
  if (!trimmed) {
    return [];
  }
  return trimmed.split(",").map((item) => Number(item.trim())).filter((item) => !Number.isNaN(item));
}

function upsertProcess() {
  const process = {
    pid: els.pidInput.value.trim() || `P${state.processes.length + 1}`,
    arrivalTime: Number(els.arrivalInput.value),
    priority: Number(els.priorityInput.value),
    cpuBursts: parseCsvVector(els.cpuInput.value),
    ioBursts: parseCsvVector(els.ioInput.value),
    maxResources: parseCsvVector(els.maxInput.value),
    allocation: parseCsvVector(els.allocationInput.value),
    request: parseCsvVector(els.requestInput.value)
  };

  const index = state.processes.findIndex((item) => item.pid === state.editingPid);
  if (index >= 0) {
    state.processes[index] = process;
  } else {
    state.processes.push(process);
  }

  clearForm();
  renderProcessTable();
}

function clearForm() {
  state.editingPid = null;
  els.pidInput.value = "";
  els.arrivalInput.value = "0";
  els.priorityInput.value = "1";
  els.cpuInput.value = "4,3";
  els.ioInput.value = "2";
  els.maxInput.value = "2,1,1";
  els.allocationInput.value = "0,0,0";
  els.requestInput.value = "0,0,0";
}

function loadProcessIntoForm(pid) {
  const process = state.processes.find((item) => item.pid === pid);
  if (!process) {
    return;
  }
  state.editingPid = pid;
  els.pidInput.value = process.pid;
  els.arrivalInput.value = process.arrivalTime;
  els.priorityInput.value = process.priority;
  els.cpuInput.value = process.cpuBursts.join(",");
  els.ioInput.value = process.ioBursts.join(",");
  els.maxInput.value = process.maxResources.join(",");
  els.allocationInput.value = process.allocation.join(",");
  els.requestInput.value = process.request.join(",");
}

function deleteProcess(pid) {
  state.processes = state.processes.filter((process) => process.pid !== pid);
  renderProcessTable();
}

async function runSimulation() {
  const algorithms = state.algorithms.filter((item) => item.checked).map((item) => item.id);
  if (algorithms.length === 0) {
    window.alert("Select at least one algorithm.");
    return;
  }

  const payload = {
    processes: state.processes,
    quantum: Number(els.quantumInput.value),
    algorithms,
    totalResources: [Number(els.resource1.value), Number(els.resource2.value), Number(els.resource3.value)]
  };

  const response = await fetch("/api/simulate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  const result = await response.json();
  if (!response.ok) {
    window.alert(result.error || "Simulation failed.");
    return;
  }
  state.result = result;
  renderDashboard();
}

function renderDashboard() {
  if (!state.result) {
    return;
  }
  els.algorithmsActive.textContent = String(state.result.meta.algorithms.length);
  els.deadlockStatus.textContent = state.result.deadlock.safe ? "Safe" : "Unsafe";
  els.deadlockStatus.style.color = state.result.deadlock.safe ? "#7df0c0" : "#ff9a9a";
  renderRanking();
  renderSplitScreen();
  renderRunCards();
  renderDeadlock();
  renderUtilizationChart();
}

function renderRanking() {
  els.rankingCards.innerHTML = "";
  state.result.ranking.forEach((entry) => {
    const card = document.createElement("div");
    card.className = "mini-card";
    card.innerHTML = `
      <strong>#${entry.rank} ${entry.algorithmName}</strong>
      <div class="metric-grid">
        <div><span>CPU Util</span>${entry.metrics.cpuUtilization}%</div>
        <div><span>Throughput</span>${entry.metrics.throughput}</div>
        <div><span>Avg WT</span>${entry.metrics.averageWaitingTime}</div>
        <div><span>Avg TAT</span>${entry.metrics.averageTurnaroundTime}</div>
      </div>
    `;
    els.rankingCards.appendChild(card);
  });
}

function renderSplitScreen() {
  els.splitScreen.innerHTML = "";
  state.result.runs.slice(0, 2).forEach((run, index) => {
    els.splitScreen.appendChild(createRunCard(run, index));
  });
}

function renderRunCards() {
  els.runCards.innerHTML = "";
  state.result.runs.forEach((run, index) => {
    els.runCards.appendChild(createRunCard(run, index));
  });
}

function createRunCard(run) {
  const card = document.createElement("article");
  card.className = "run-card";
  const processColors = new Map();
  run.processMetrics.forEach((item, itemIndex) => {
    processColors.set(item.pid, colors[itemIndex % colors.length]);
  });
  processColors.set("IDLE", "#334155");

  const ganttMarkup = run.gantt.map((segment) => {
    const width = Math.max((segment.end - segment.start) * 28, 42);
    return `
      <div class="gantt-block" style="width:${width}px;background:${processColors.get(segment.pid) || "#64748b"}">
        ${segment.pid}
        <small>${segment.start}-${segment.end}</small>
      </div>
    `;
  }).join("");

  const stateRows = run.stateTimeline.slice(0, 12).map((row) => `
    <div class="state-row">
      <div>T${row.time}</div>
      <div>${row.running}</div>
      <div>${row.ready.join(", ") || "-"}</div>
      <div>${row.waiting.join(", ") || "-"}</div>
    </div>
  `).join("");

  card.innerHTML = `
    <strong>${run.algorithmName}</strong>
    <div class="metric-grid">
      <div><span>CPU Util</span>${run.metrics.cpuUtilization}%</div>
      <div><span>Throughput</span>${run.metrics.throughput}</div>
      <div><span>Avg WT</span>${run.metrics.averageWaitingTime}</div>
      <div><span>Avg RT</span>${run.metrics.averageResponseTime}</div>
    </div>
    <div class="gantt-strip">${ganttMarkup}</div>
    <div class="run-state">
      <div class="state-row">
        <div><strong>Time</strong></div>
        <div><strong>CPU</strong></div>
        <div><strong>Ready</strong></div>
        <div><strong>Waiting / I/O</strong></div>
      </div>
      ${stateRows}
    </div>
  `;
  return card;
}

function renderDeadlock() {
  const { deadlock } = state.result;
  els.deadlockSummary.innerHTML = `
    <div class="deadlock-note">
      <span class="tag ${deadlock.safe ? "safe" : "unsafe"}">${deadlock.safe ? "Safe Sequence" : "Unsafe State"}</span>
      ${deadlock.safeSequence.join(" → ") || "No safe sequence"}
    </div>
    ${deadlock.decisions.map((decision) => `
      <div class="deadlock-note"><strong>${decision.pid}</strong>: ${decision.action.toUpperCase()}<br>${decision.reason}</div>
    `).join("")}
  `;
  drawResourceGraph(deadlock.graph);
}

function drawResourceGraph(graph) {
  const svg = els.resourceGraph;
  svg.innerHTML = `
    <defs>
      <marker id="arrow" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto" markerUnits="strokeWidth">
        <path d="M0,0 L0,6 L9,3 z" fill="#8ea6c7"></path>
      </marker>
    </defs>
  `;

  const processNodes = graph.nodes.filter((node) => node.type === "process");
  const resourceNodes = graph.nodes.filter((node) => node.type === "resource");
  const position = new Map();

  processNodes.forEach((node, index) => position.set(node.id, { x: 140, y: 60 + index * 62 }));
  resourceNodes.forEach((node, index) => position.set(node.id, { x: 470, y: 75 + index * 82 }));

  graph.edges.forEach((edge) => {
    const from = position.get(edge.from);
    const to = position.get(edge.to);
    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("x1", String(from.x));
    line.setAttribute("y1", String(from.y));
    line.setAttribute("x2", String(to.x));
    line.setAttribute("y2", String(to.y));
    line.setAttribute("stroke", edge.kind === "granted" ? "#31c48d" : edge.kind === "request" ? "#f59e0b" : "#58a6ff");
    line.setAttribute("stroke-width", "2");
    line.setAttribute("marker-end", "url(#arrow)");
    svg.appendChild(line);

    const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
    label.setAttribute("x", String((from.x + to.x) / 2));
    label.setAttribute("y", String((from.y + to.y) / 2 - 6));
    label.setAttribute("fill", "#8ea6c7");
    label.setAttribute("font-size", "11");
    label.setAttribute("text-anchor", "middle");
    label.textContent = edge.label;
    svg.appendChild(label);
  });

  graph.nodes.forEach((node) => {
    const { x, y } = position.get(node.id);
    const shape = document.createElementNS("http://www.w3.org/2000/svg", node.type === "process" ? "circle" : "rect");
    if (node.type === "process") {
      shape.setAttribute("cx", String(x));
      shape.setAttribute("cy", String(y));
      shape.setAttribute("r", "24");
    } else {
      shape.setAttribute("x", String(x - 34));
      shape.setAttribute("y", String(y - 24));
      shape.setAttribute("width", "68");
      shape.setAttribute("height", "48");
      shape.setAttribute("rx", "14");
    }
    shape.setAttribute("fill", node.type === "process" ? "#1d4ed8" : "#0f766e");
    shape.setAttribute("stroke", "rgba(255,255,255,0.15)");
    shape.setAttribute("stroke-width", "2");
    svg.appendChild(shape);

    const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
    label.setAttribute("x", String(x));
    label.setAttribute("y", String(y + 4));
    label.setAttribute("fill", "#ffffff");
    label.setAttribute("font-size", "13");
    label.setAttribute("font-weight", "700");
    label.setAttribute("text-anchor", "middle");
    label.textContent = node.label;
    svg.appendChild(label);
  });
}

function renderUtilizationChart() {
  const canvas = els.utilizationCanvas;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "rgba(255,255,255,0.04)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const padding = { left: 46, right: 16, top: 20, bottom: 34 };
  const chartWidth = canvas.width - padding.left - padding.right;
  const chartHeight = canvas.height - padding.top - padding.bottom;
  const maxTime = Math.max(...state.result.runs.map((run) => run.cpuUtilizationTimeline.at(-1)?.time || 1), 1);

  ctx.strokeStyle = "rgba(142,166,199,0.22)";
  ctx.lineWidth = 1;
  for (let step = 0; step <= 5; step += 1) {
    const y = padding.top + (chartHeight / 5) * step;
    ctx.beginPath();
    ctx.moveTo(padding.left, y);
    ctx.lineTo(padding.left + chartWidth, y);
    ctx.stroke();
  }

  ctx.fillStyle = "#8ea6c7";
  ctx.font = "12px Segoe UI";
  for (let tick = 0; tick <= 5; tick += 1) {
    const value = 100 - tick * 20;
    const y = padding.top + (chartHeight / 5) * tick + 4;
    ctx.fillText(`${value}%`, 8, y);
  }

  state.result.runs.forEach((run, index) => {
    ctx.strokeStyle = colors[index % colors.length];
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    run.cpuUtilizationTimeline.forEach((point, pointIndex) => {
      const x = padding.left + (point.time / maxTime) * chartWidth;
      const y = padding.top + ((100 - point.busyPercent) / 100) * chartHeight;
      if (pointIndex === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
  });

  state.result.runs.forEach((run, index) => {
    const x = padding.left + 10 + index * 120;
    const y = canvas.height - 12;
    ctx.fillStyle = colors[index % colors.length];
    ctx.fillRect(x, y - 8, 14, 4);
    ctx.fillStyle = "#8ea6c7";
    ctx.fillText(run.algorithmName, x + 20, y);
  });
}

function applyTheme() {
  const selected = els.themeSelect.value;
  if (selected === "system") {
    document.body.classList.toggle("light", window.matchMedia("(prefers-color-scheme: light)").matches);
    return;
  }
  document.body.classList.toggle("light", selected === "light");
}

init();
