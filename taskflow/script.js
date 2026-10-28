
"use strict";

/* =================================
   TASKFLOW — FUNCIONALIDADES
================================= */

const STORAGE_KEY = "taskflow-tasks-v1";

const $ = (selector) => document.querySelector(selector);

const taskForm = $("#task-form");
const taskTitle = $("#task-title");
const taskDescription = $("#task-description");
const taskPriority = $("#task-priority");
const taskDate = $("#task-date");
const taskList = $("#task-list");
const emptyState = $("#empty-state");
const searchInput = $("#task-search");
const toastElement = $("#toast");

let currentFilter = "all";
let editingId = null;
let toastTimeout;

// Carrega as tarefas salvas no navegador
function loadTasks() {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);

        if (!saved) return [];

        const parsed = JSON.parse(saved);

        if (!Array.isArray(parsed)) return [];

        return parsed.filter((task) =>
            task &&
            typeof task.id === "string" &&
            typeof task.title === "string" &&
            typeof task.completed === "boolean" &&
            ["low", "medium", "high"].includes(task.priority)
        );
    } catch (error) {
        console.error("Não foi possível carregar as tarefas:", error);
        return [];
    }
}

let tasks = loadTasks();

// Salva as alterações
function saveTasks() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
        return true;
    } catch (error) {
        console.error("Não foi possível salvar as tarefas:", error);
        showToast("Não foi possível salvar. Verifique o armazenamento do navegador.");
        return false;
    }
}

// Escapa texto antes de inseri-lo no HTML
function escapeHTML(value) {
    return String(value).replace(/[&<>"']/g, (character) => {
        const entities = {
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;"
        };

        return entities[character];
    });
}

// Datas locais sem deslocamento de fuso horário
function localDateString(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
}

function formatDate(dateString) {
    if (!dateString) return "";

    const parts = dateString.split("-").map(Number);

    if (parts.length !== 3 || parts.some(Number.isNaN)) {
        return "Data inválida";
    }

    const [year, month, day] = parts;
    const date = new Date(year, month - 1, day);

    if (
        date.getFullYear() !== year ||
        date.getMonth() !== month - 1 ||
        date.getDate() !== day
    ) {
        return "Data inválida";
    }

    return new Intl.DateTimeFormat("pt-BR").format(date);
}

function formatToday() {
    const formatted = new Intl.DateTimeFormat("pt-BR", {
        weekday: "long",
        day: "numeric",
        month: "long"
    }).format(new Date());

    $("#today-label").textContent =
        formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

function showToast(message) {
    clearTimeout(toastTimeout);

    toastElement.textContent = message;
    toastElement.classList.add("show");

    toastTimeout = setTimeout(() => {
        toastElement.classList.remove("show");
    }, 2600);
}

// Estatísticas do painel
function updateStats() {
    const total = tasks.length;
    const completed = tasks.filter((task) => task.completed).length;
    const pending = total - completed;
    const progress = total ? Math.round((completed / total) * 100) : 0;

    $("#stat-total").textContent = total;
    $("#stat-pending").textContent = pending;
    $("#stat-completed").textContent = completed;
    $("#stat-progress").textContent = `${progress}%`;
    $("#progress-fill").style.width = `${progress}%`;

    $("#nav-all").textContent = total;
    $("#nav-pending").textContent = pending;
    $("#nav-completed").textContent = completed;

    $("#footer-summary").textContent = total
        ? `${completed} de ${total} tarefas concluídas`
        : "Tudo começa com uma tarefa.";

    $("#clear-completed").hidden = completed === 0;
}

// Aplica filtro e pesquisa
function getVisibleTasks() {
    const query = searchInput.value.trim().toLocaleLowerCase("pt-BR");

    return tasks
        .filter((task) => {
            if (currentFilter === "pending" && task.completed) {
                return false;
            }

            if (currentFilter === "completed" && !task.completed) {
                return false;
            }

            const searchableText =
                `${task.title} ${task.description}`.toLocaleLowerCase("pt-BR");

            return searchableText.includes(query);
        })
        .sort((a, b) => {
            if (a.completed !== b.completed) {
                return Number(a.completed) - Number(b.completed);
            }

            const priorityOrder = { high: 0, medium: 1, low: 2 };
            const priorityDifference =
                priorityOrder[a.priority] - priorityOrder[b.priority];

            if (priorityDifference !== 0) {
                return priorityDifference;
            }

            if (a.date && b.date) {
                return a.date.localeCompare(b.date);
            }

            if (a.date) return -1;
            if (b.date) return 1;

            return b.createdAt - a.createdAt;
        });
}

// Atualiza a aparência dos filtros
function updateFilterButtons() {
    document.querySelectorAll("[data-filter]").forEach((button) => {
        const active = button.dataset.filter === currentFilter;

        if (
            button.classList.contains("side-link") ||
            button.classList.contains("filter-tab")
        ) {
            button.classList.toggle("active", active);
        }
    });

    const titles = {
        all: "Todas as tarefas",
        pending: "Tarefas pendentes",
        completed: "Tarefas concluídas"
    };

    $("#list-title").textContent = titles[currentFilter];
}

// Renderiza os cartões
function renderTasks() {
    updateStats();
    updateFilterButtons();

    const visibleTasks = getVisibleTasks();

    $("#visible-count").textContent =
        `${visibleTasks.length} ${visibleTasks.length === 1 ? "tarefa" : "tarefas"}`;

    taskList.innerHTML = visibleTasks.map((task) => {
        const priorityNames = {
            high: "Alta prioridade",
            medium: "Média prioridade",
            low: "Baixa prioridade"
        };

        const today = localDateString();
        const isOverdue = task.date && task.date < today && !task.completed;
        const isDueToday = task.date === today && !task.completed;

        let dateClass = "";

        if (isOverdue) dateClass = "overdue";
        else if (isDueToday) dateClass = "due-today";

        let dateLabel = "";

        if (task.date) {
            if (isOverdue) {
                dateLabel = "Atrasada · ";
            } else if (isDueToday) {
                dateLabel = "Hoje · ";
            }

            dateLabel += formatDate(task.date);
        }

        return `
            <article class="task-item ${task.completed ? "is-completed" : ""}">
                <button
                    type="button"
                    class="task-check ${task.completed ? "checked" : ""}"
                    data-action="toggle"
                    data-id="${escapeHTML(task.id)}"
                    aria-label="${task.completed ? "Reabrir tarefa" : "Concluir tarefa"}"
                    aria-pressed="${task.completed}"
                >${task.completed ? "✓" : ""}</button>

                <div class="task-main">
                    <h3 class="task-title">${escapeHTML(task.title)}</h3>

                    ${task.description ? `
                        <p class="task-description">${escapeHTML(task.description)}</p>
                    ` : ""}

                    <div class="task-meta">
                        <span class="priority ${task.priority}">
                            ${escapeHTML(priorityNames[task.priority])}
                        </span>

                        ${dateLabel ? `
                            <span class="task-date ${dateClass}">
                                ◷ ${escapeHTML(dateLabel)}
                            </span>
                        ` : ""}

                        ${task.completed ? `
                            <span class="task-status">✓ Concluída</span>
                        ` : ""}
                    </div>
                </div>

                <div class="task-actions">
                    <button
                        type="button"
                        class="task-action"
                        data-action="edit"
                        data-id="${escapeHTML(task.id)}"
                        aria-label="Editar ${escapeHTML(task.title)}"
                        title="Editar tarefa"
                    >✎</button>

                    <button
                        type="button"
                        class="task-action delete"
                        data-action="delete"
                        data-id="${escapeHTML(task.id)}"
                        aria-label="Excluir ${escapeHTML(task.title)}"
                        title="Excluir tarefa"
                    >⌫</button>
                </div>
            </article>
        `;
    }).join("");

    emptyState.hidden = visibleTasks.length > 0;
    taskList.hidden = visibleTasks.length === 0;

    if (visibleTasks.length === 0) {
        const query = searchInput.value.trim();

        if (query) {
            emptyState.querySelector("h3").textContent =
                "Nenhuma tarefa encontrada";

            emptyState.querySelector("p").textContent =
                "Tente outro termo de pesquisa.";
        } else if (currentFilter === "completed") {
            emptyState.querySelector("h3").textContent =
                "Nada concluído por enquanto";

            emptyState.querySelector("p").textContent =
                "Conclua uma tarefa e ela aparecerá aqui.";
        } else if (currentFilter === "pending") {
            emptyState.querySelector("h3").textContent =
                "Você não tem tarefas pendentes";

            emptyState.querySelector("p").textContent =
                "Tudo em dia! Você pode adicionar novas atividades.";
        } else {
            emptyState.querySelector("h3").textContent =
                "Nenhuma tarefa por aqui";

            emptyState.querySelector("p").textContent =
                "Adicione uma tarefa para começar a organizar sua rotina.";
        }
    }
}

// Abre o formulário
function openForm(task = null) {
    editingId = task ? task.id : null;

    $("#form-title").textContent = task
        ? "Editar tarefa"
        : "Criar nova tarefa";

    $("#save-task-button").textContent = task
        ? "Salvar alterações"
        : "Salvar tarefa";

    taskTitle.value = task ? task.title : "";
    taskDescription.value = task ? task.description : "";
    taskPriority.value = task ? task.priority : "medium";
    taskDate.value = task ? task.date : "";

    taskForm.hidden = false;
    taskForm.scrollIntoView({ behavior: "smooth", block: "start" });

    taskTitle.focus({ preventScroll: true });
}

function closeForm() {
    taskForm.reset();
    taskForm.hidden = true;
    editingId = null;
}

// Criar ou editar tarefa
taskForm.addEventListener("submit", (event) => {
    event.preventDefault();

    const title = taskTitle.value.trim();
    const description = taskDescription.value.trim();
    const priority = taskPriority.value;
    const date = taskDate.value;

    if (!title) {
        taskTitle.focus();
        showToast("Digite um título para a tarefa.");
        return;
    }

    if (date && !formatDate(date).includes("/")) {
        showToast("Selecione uma data válida.");
        return;
    }

    if (editingId) {
        const task = tasks.find((item) => item.id === editingId);

        if (!task) {
            showToast("Essa tarefa não foi encontrada.");
            closeForm();
            return;
        }

        const oldTask = { ...task };

        task.title = title;
        task.description = description;
        task.priority = priority;
        task.date = date;

        if (!saveTasks()) {
            Object.assign(task, oldTask);
            return;
        }

        closeForm();
        renderTasks();
        showToast("Tarefa atualizada com sucesso!");
        return;
    }

    const newTask = {
        id: crypto.randomUUID
            ? crypto.randomUUID()
            : `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        title,
        description,
        priority,
        date,
        completed: false,
        createdAt: Date.now()
    };

    tasks.unshift(newTask);

    if (!saveTasks()) {
        tasks = tasks.filter((task) => task.id !== newTask.id);
        return;
    }

    currentFilter = "all";
    searchInput.value = "";

    closeForm();
    renderTasks();
    showToast("Tarefa criada com sucesso!");
});

// Ações dos cartões
taskList.addEventListener("click", (event) => {
    const button = event.target.closest("[data-action]");

    if (!button) return;

    const task = tasks.find((item) => item.id === button.dataset.id);

    if (!task) return;

    const action = button.dataset.action;

    if (action === "toggle") {
        const previous = task.completed;

        task.completed = !task.completed;

        if (!saveTasks()) {
            task.completed = previous;
            return;
        }

        renderTasks();
        showToast(task.completed
            ? "Tarefa concluída!"
            : "Tarefa reaberta.");
    }

    if (action === "edit") {
        openForm(task);
    }

    if (action === "delete") {
        const confirmed = window.confirm(
            `Deseja excluir a tarefa "${task.title}"?`
        );

        if (!confirmed) return;

        const previousTasks = [...tasks];
        tasks = tasks.filter((item) => item.id !== task.id);

        if (!saveTasks()) {
            tasks = previousTasks;
            return;
        }

        renderTasks();
        showToast("Tarefa excluída.");
    }
});

// Filtros da barra lateral e da lista
document.querySelectorAll("[data-filter]").forEach((button) => {
    button.addEventListener("click", () => {
        currentFilter = button.dataset.filter;
        renderTasks();
    });
});

// Pesquisa instantânea
searchInput.addEventListener("input", renderTasks);

// Botões do formulário
$("#new-task-button").addEventListener("click", () => openForm());
$("#empty-add-button").addEventListener("click", () => openForm());
$("#close-form").addEventListener("click", closeForm);
$("#cancel-form").addEventListener("click", closeForm);

// Limpar tarefas concluídas
$("#clear-completed").addEventListener("click", () => {
    const completed = tasks.filter((task) => task.completed);

    if (completed.length === 0) return;

    const confirmed = window.confirm(
        `Excluir ${completed.length} tarefa(s) concluída(s)?`
    );

    if (!confirmed) return;

    const previousTasks = [...tasks];
    tasks = tasks.filter((task) => !task.completed);

    if (!saveTasks()) {
        tasks = previousTasks;
        return;
    }

    renderTasks();
    showToast("Tarefas concluídas removidas.");
});

// Ano e data atual
$("#current-year").textContent = new Date().getFullYear();
formatToday();

// Inicialização
renderTasks();

console.log("TaskFlow iniciado com sucesso!");
