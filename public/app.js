const state = {
  processes: [],
  algorithms: [
    { id: "fcfs", label: "FCFS", checked: true },
    { id: "sjf", label: "SJF", checked: true },
    { id: "aging", label: "Priority (Aging)", checked: true },
    { id: "rr", label: "Round Robin", checked: true }
  ],
  result: null,
  editingPid: null
};

const colors = ["#2563eb", "#7c3aed", "#10b981", "#f59e0b", "#ec4899", "#06b6d4", "#ef4444"];

const els = {
  landingScreen: document.getElementById("landingScreen"),
  dashboardShell: document.getElementById("dashboardShell"),
  algorithmList: document.getElementById("algorithmList"),
  processTableBody: document.getElementById("processTableBody"),
  rankingCards: document.getElementById("rankingCards"),
  runCards: document.getElementById("runCards"),
  utilizationCanvas: document.getElementById("utilizationCanvas"),
  summaryNotes: document.getElementById("summaryNotes"),
  deadlockSummary: document.getElementById("deadlockSummary"),
  resourceGraph: document.getElementById("resourceGraph"),
  quantumInput: document.getElementById("quantumInput"),
  themeSelect: document.getElementById("themeSelect"),
  algorithmsActive: document.getElementById("algorithmsActive"),
  processCount: document.getElementById("processCount"),
  bestAlgorithm: document.getElementById("bestAlgorithm"),
  pidInput: document.getElementById("pidInput"),
  arrivalInput: document.getElementById("arrivalInput"),
  priorityInput: document.getElementById("priorityInput"),
  cpuInput: document.getElementById("cpuInput"),
  maxInput: document.getElementById("maxInput"),
  allocationInput: document.getElementById("allocationInput"),
  requestInput: document.getElementById("requestInput"),
  resource1: document.getElementById("resource1"),
  resource2: document.getElementById("resource2"),
  resource3: document.getElementById("resource3"),
  homeBtn: document.getElementById("homeBtn"),
  runBtn: document.getElementById("runBtn"),
  loadDemoBtn: document.getElementById("loadDemoBtn"),
  addProcessBtn: document.getElementById("addProcessBtn"),
  clearFormBtn: document.getElementById("clearFormBtn")
};

const panels = Array.from(document.querySelectorAll(".view-panel"));
const navButtons = Array.from(document.querySelectorAll(".nav-btn"));
const slideCards = Array.from(document.querySelectorAll(".slide-card"));

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
  els.homeBtn.addEventListener("click", showLanding);
  navButtons.forEach((button) => {
    button.addEventListener("click", () => openView(button.dataset.view));
  });
  slideCards.forEach((card) => {
    card.addEventListener("click", () => openView(card.dataset.view));
  });
}

async function loadDemo() {
  const response = await fetch("/api/defaults");
  const payload = await response.json();
  state.processes = payload.processes.map((process) => ({
    pid: process.pid,
    arrivalTime: process.arrivalTime,
    priority: process.priority,
    cpuBursts: [process.cpuBursts[0]],
    maxResources: process.maxResources,
    allocation: process.allocation,
    request: process.request
  }));
  els.quantumInput.value = payload.quantum;
  [els.resource1.value, els.resource2.value, els.resource3.value] = payload.totalResources;
  state.algorithms.forEach((item) => {
    item.checked = payload.algorithms.includes(item.id);
  });
  clearForm();
  renderAlgorithmList();
  renderProcessTable();
  await runSimulation();
  openView("scheduler");
}

function renderAlgorithmList() {
  els.algorithmList.innerHTML = "";
  state.algorithms.forEach((algorithm) => {
    const wrapper = document.createElement("label");
    wrapper.className = "checkbox-pill";
    wrapper.innerHTML = `
      <input type="checkbox" ${algorithm.checked ? "checked" : ""}>
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
      <td>${process.cpuBursts[0]}</td>
      <td>${(process.maxResources || [0, 0, 0]).join(", ")}</td>
      <td>${(process.allocation || [0, 0, 0]).join(", ")}</td>
      <td>${(process.request || [0, 0, 0]).join(", ")}</td>
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
    return [0, 0, 0];
  }
  return trimmed
    .split(",")
    .map((item) => Number(item.trim()))
    .filter((item) => !Number.isNaN(item));
}

function upsertProcess() {
  const process = {
    pid: els.pidInput.value.trim() || `P${state.processes.length + 1}`,
    arrivalTime: Number(els.arrivalInput.value),
    priority: Number(els.priorityInput.value),
    cpuBursts: [Number(els.cpuInput.value)],
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
  els.cpuInput.value = "4";
  els.maxInput.value = "2,1,1";
  els.allocationInput.value = "0,0,0";
  els.requestInput.value = "0,0,0";
}

function loadProcessIntoForm(pid) {
  const process = state.processes.find((item) => item.pid === pid);
  if (!process) {
    return;
  }
  openView("scheduler");
  state.editingPid = pid;
  els.pidInput.value = process.pid;
  els.arrivalInput.value = process.arrivalTime;
  els.priorityInput.value = process.priority;
  els.cpuInput.value = process.cpuBursts[0];
  els.maxInput.value = (process.maxResources || [0, 0, 0]).join(",");
  els.allocationInput.value = (process.allocation || [0, 0, 0]).join(",");
  els.requestInput.value = (process.request || [0, 0, 0]).join(",");
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
    processes: state.processes.map((process) => ({
      pid: process.pid,
      arrivalTime: process.arrivalTime,
      priority: process.priority,
      cpuBursts: process.cpuBursts,
      ioBursts: [],
      maxResources: process.maxResources || [0, 0, 0],
      allocation: process.allocation || [0, 0, 0],
      request: process.request || [0, 0, 0]
    })),
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
  openView("results");
}

function renderDashboard() {
  if (!state.result) {
    return;
  }
  els.algorithmsActive.textContent = String(state.result.meta.algorithms.length);
  els.bestAlgorithm.textContent = state.result.ranking[0]?.algorithmName || "-";
  renderRanking();
  renderRunCards();
  renderSummary();
  renderDeadlock();
  renderUtilizationChart();
}

function showLanding() {
  els.landingScreen.classList.remove("hidden");
  els.dashboardShell.classList.add("hidden");
}

function openView(view) {
  els.landingScreen.classList.add("hidden");
  els.dashboardShell.classList.remove("hidden");

  if (view === "all") {
    panels.forEach((panel) => panel.classList.remove("hidden"));
    navButtons.forEach((button) => button.classList.toggle("active", button.dataset.view === "all"));
    return;
  }

  panels.forEach((panel) => {
    panel.classList.toggle("hidden", panel.dataset.panel !== view);
  });
  navButtons.forEach((button) => button.classList.toggle("active", button.dataset.view === view));
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

function renderRunCards() {
  els.runCards.innerHTML = "";
  state.result.runs.forEach((run) => {
    els.runCards.appendChild(createRunCard(run));
  });
}

function createRunCard(run) {
  const card = document.createElement("article");
  card.className = "run-card";
  const processColors = new Map();
  run.processMetrics.forEach((item, index) => {
    processColors.set(item.pid, colors[index % colors.length]);
  });
  processColors.set("IDLE", "#334155");

  const ganttMarkup = run.gantt.map((segment) => {
    const width = Math.max((segment.end - segment.start) * 30, 44);
    return `
      <div class="gantt-block" style="width:${width}px;background:${processColors.get(segment.pid) || "#64748b"}">
        ${segment.pid}
        <small>${segment.start}-${segment.end}</small>
      </div>
    `;
  }).join("");

  const stateRows = run.stateTimeline.slice(0, 10).map((row) => `
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
        <div><strong>Waiting</strong></div>
      </div>
      ${stateRows}
    </div>
  `;
  return card;
}

function renderSummary() {
  const top = state.result.ranking[0];
  const averageCpu = (
    state.result.runs.reduce((sum, run) => sum + run.metrics.cpuUtilization, 0) /
    state.result.runs.length
  ).toFixed(2);

  els.summaryNotes.innerHTML = `
    <div class="summary-note"><strong>Best Performing Algorithm</strong><br>${top.algorithmName} ranked first with score ${top.score}.</div>
    <div class="summary-note"><strong>Average CPU Utilization</strong><br>${averageCpu}% across the selected algorithms.</div>
    <div class="summary-note"><strong>Evaluation Basis</strong><br>Ranking uses waiting time, turnaround time, response time, throughput, and CPU utilization.</div>
  `;
}

function renderDeadlock() {
  const { deadlock } = state.result;
  els.deadlockSummary.innerHTML = `
    <div class="summary-note">
      <strong>Status</strong><br>
      <span class="tag ${deadlock.safe ? "safe" : "unsafe"}">${deadlock.safe ? "Safe" : "Unsafe"}</span>
      ${deadlock.safeSequence.length ? deadlock.safeSequence.join(" → ") : "No safe sequence"}
    </div>
    ${deadlock.decisions.map((decision) => `
      <div class="summary-note">
        <strong>${decision.pid}</strong><br>
        ${decision.action.toUpperCase()} - ${decision.reason}
      </div>
    `).join("")}
  `;
  drawResourceGraph(deadlock.graph);
}

function drawResourceGraph(graph) {
  const svg = els.resourceGraph;
  const processNodes = graph.nodes.filter((node) => node.type === "process");
  const resourceNodes = graph.nodes.filter((node) => node.type === "resource");
  const topPadding = 64;
  const bottomPadding = 56;
  const processSpacing = 84;
  const resourceSpacing = 96;
  const height = Math.max(
    320,
    topPadding + bottomPadding + Math.max(processNodes.length - 1, 0) * processSpacing,
    topPadding + bottomPadding + Math.max(resourceNodes.length - 1, 0) * resourceSpacing
  );

  svg.setAttribute("viewBox", `0 0 620 ${height}`);
  svg.innerHTML = `
    <defs>
      <marker id="arrow" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto" markerUnits="strokeWidth">
        <path d="M0,0 L0,6 L9,3 z" fill="#8ea6c7"></path>
      </marker>
    </defs>
  `;
  const position = new Map();
  processNodes.forEach((node, index) => position.set(node.id, { x: 140, y: topPadding + index * processSpacing }));
  resourceNodes.forEach((node, index) => position.set(node.id, { x: 485, y: topPadding + 14 + index * resourceSpacing }));

  const slotUsage = new Map();
  graph.nodes.forEach((node) => slotUsage.set(node.id, 0));

  graph.edges.forEach((edge) => {
    const from = position.get(edge.from);
    const to = position.get(edge.to);
    if (!from || !to) return;

    const fromSlot = slotUsage.get(edge.from) || 0;
    const toSlot = slotUsage.get(edge.to) || 0;
    slotUsage.set(edge.from, fromSlot + 1);
    slotUsage.set(edge.to, toSlot + 1);

    const x1 = edge.from.startsWith("R") ? from.x - 34 : from.x + 24;
    const x2 = edge.to.startsWith("R") ? to.x - 34 : to.x + 24;
    const y1 = from.y + ((fromSlot % 5) - 2) * 8;
    const y2 = to.y + ((toSlot % 5) - 2) * 8;
    const midX = (x1 + x2) / 2;
    const bend = edge.kind === "allocation" ? -18 : 18;

    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute(
      "d",
      `M ${x1} ${y1} C ${midX - 42} ${y1 + bend}, ${midX + 42} ${y2 - bend}, ${x2} ${y2}`
    );
    path.setAttribute("fill", "none");
    path.setAttribute("stroke", edge.kind === "granted" ? "#31c48d" : edge.kind === "request" ? "#f59e0b" : "#58a6ff");
    path.setAttribute("stroke-width", "2.5");
    path.setAttribute("marker-end", "url(#arrow)");
    path.setAttribute("opacity", "0.96");
    svg.appendChild(path);

    const labelX = midX;
    const labelY = (y1 + y2) / 2;
    const labelBg = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    labelBg.setAttribute("x", String(labelX - 24));
    labelBg.setAttribute("y", String(labelY - 11));
    labelBg.setAttribute("width", "48");
    labelBg.setAttribute("height", "18");
    labelBg.setAttribute("rx", "9");
    labelBg.setAttribute("fill", "rgba(9,17,31,0.92)");
    labelBg.setAttribute("stroke", "rgba(142,166,199,0.16)");
    svg.appendChild(labelBg);

    const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
    label.setAttribute("x", String(labelX));
    label.setAttribute("y", String(labelY + 3));
    label.setAttribute("fill", "#8ea6c7");
    label.setAttribute("font-size", "10");
    label.setAttribute("font-weight", "700");
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
  document.body.classList.toggle("light", els.themeSelect.value === "light");
}

init();
