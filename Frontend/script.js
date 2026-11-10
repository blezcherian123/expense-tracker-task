"use strict";

/* =========================================================
   CONFIGURATION
   ---------------------------------------------------------
   - If the page is served by the FastAPI backend (port 8000),
     relative paths are used (no CORS needed).
   - If opened directly (file://, Live Server, etc.) it falls
     back to the backend URL. Backend has CORS enabled.
   ========================================================= */
const CUSTOM_API_BASE = ""; // e.g. "http://localhost:8000/api/expenses"

const SERVED_BY_BACKEND =
    (location.protocol === "http:" || location.protocol === "https:") &&
    location.port === "8000";

const API_BASE =
    CUSTOM_API_BASE ||
    (SERVED_BY_BACKEND ? "/api/expenses" : "http://127.0.0.1:8000/api/expenses");

const CURRENCY = "₹"; // change to "$", "€", etc. if you prefer

/* =========================================================
   STATE
   ========================================================= */
let expenses = [];
let editingId = null;
let allCategories = [];        // every category ever entered (unfiltered)
const DEFAULT_CATEGORIES = []; // built-in suggestions, snapshotted from the HTML

/* =========================================================
   DOM REFERENCES
   ========================================================= */
const $ = (id) => document.getElementById(id);

const form = $("expenseForm");
const formTitle = $("formTitle");
const submitBtn = $("submitBtn");
const cancelEditBtn = $("cancelEditBtn");

const titleInput = $("title");
const amountInput = $("amount");
const categoryInput = $("category");
const dateInput = $("date");
const noteInput = $("note");

const expenseBody = $("expenseBody");
const listCount = $("listCount");

const statusBanner = $("statusBanner");

const statTotal = $("statTotal");
const statCount = $("statCount");
const statMonth = $("statMonth");

const filterTitleInput = $("filterTitleInput");
const filterCategory = $("filterCategory");
const filterFrom = $("filterFrom");
const filterTo = $("filterTo");

/* =========================================================
   HELPERS
   ========================================================= */
function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (ch) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
    })[ch]);
}

function formatMoney(value) {
    const num = Number(value);
    if (!Number.isFinite(num)) return CURRENCY + "0.00";
    return (
        CURRENCY +
        num.toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        })
    );
}

function formatDate(iso) {
    if (!iso) return "—";
    const [y, m, d] = String(iso).split("-").map(Number);
    if (!y || !m || !d) return iso;
    return new Date(y, m - 1, d).toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
    });
}

function todayISO() {
    const now = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function showBanner(message, type = "success") {
    statusBanner.textContent = message;
    statusBanner.className = `banner banner-${type}`;
    window.clearTimeout(showBanner._timer);
    if (type === "success") {
        showBanner._timer = window.setTimeout(hideBanner, 3000);
    }
}

function hideBanner() {
    statusBanner.className = "banner hidden";
}

/* ---------- TOAST NOTIFICATIONS ---------- */

let toastTimer = null;

function showToast(message, type = "error") {
    const toast = $("toast");
    toast.textContent = message;
    toast.className = `toast toast-${type} toast-visible`;
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(hideToast, 3200);
}

function hideToast() {
    $("toast").className = "toast";
}

/* ---------- DATE-RANGE GUARDS (filter section) ----------
   Two cases, each with its own toast notification:
   - "to" date earlier than the "from" date -> "Past dates are not allowed"
   - "from" date later than the "to" date   -> "From date cannot be later than To date"
   The native picker also blocks earlier "to" dates via min. */

function syncToDateMin() {
    if (filterFrom.value) {
        filterTo.min = filterFrom.value;
    } else {
        filterTo.removeAttribute("min");
    }
}

function handleFromDateChange() {
    // a from date after the already-selected to date is not allowed
    if (filterFrom.value && filterTo.value && filterFrom.value > filterTo.value) {
        filterFrom.value = ""; // reject the invalid selection
        showToast("From date cannot be later than To date");
    }

    syncToDateMin(); // reflect the (possibly cleared) from date
    loadExpenses();
}

function handleToDateChange() {
    // a to date before the from date is in the past
    if (filterFrom.value && filterTo.value && filterTo.value < filterFrom.value) {
        filterTo.value = ""; // reject the past date
        showToast("Past dates are not allowed");
    }

    loadExpenses();
}

async function readErrorMessage(response) {
    try {
        const data = await response.json();
        if (typeof data.detail === "string") return data.detail;
        if (Array.isArray(data.detail)) {
            return data.detail
                .map((d) => {
                    const field = Array.isArray(d.loc) ? d.loc.slice(1).join(".") : "";
                    return field ? `${field}: ${d.msg}` : d.msg;
                })
                .join(" | ");
        }
        return `Request failed (HTTP ${response.status})`;
    } catch {
        return `Request failed (HTTP ${response.status})`;
    }
}

/* =========================================================
   VALIDATION
   ========================================================= */
function clearErrors() {
    ["title", "amount", "category", "date", "note"].forEach((name) => {
        $(`${name}Error`).textContent = "";
        $(name).classList.remove("input-invalid");
    });
}

function setError(name, message) {
    $(`${name}Error`).textContent = message;
    $(name).classList.add("input-invalid");
}

function validateForm() {
    clearErrors();
    let valid = true;

    if (!titleInput.value.trim()) {
        setError("title", "Title is required");
        valid = false;
    }

    const amount = Number(amountInput.value);
    if (!amountInput.value.trim() || !Number.isFinite(amount) || amount <= 0) {
        setError("amount", "Enter an amount greater than 0");
        valid = false;
    }

    if (!categoryInput.value.trim()) {
        setError("category", "Category is required");
        valid = false;
    }

    if (!dateInput.value) {
        setError("date", "Date is required");
        valid = false;
    }

    return valid;
}

/* =========================================================
   API CALLS
   ========================================================= */
function buildFilterQuery() {
    const params = new URLSearchParams();

    const title = filterTitleInput.value.trim();
    const category = filterCategory.value;
    const from = filterFrom.value;
    const to = filterTo.value;

    if (title) params.set("title", title);
    if (category) params.set("category", category);
    if (from) params.set("from_date", from);
    if (to) params.set("to_date", to);

    const query = params.toString();
    return query ? `?${query}` : "";
}

async function loadExpenses() {
    try {
        const response = await fetch(`${API_BASE}${buildFilterQuery()}`);

        if (!response.ok) {
            throw new Error(await readErrorMessage(response));
        }

        expenses = await response.json();
        renderTable();
        renderStats();

        // keep the dropdown in sync with any categories in the result set
        mergeCategories(expenses.map((e) => e.category));
        populateCategoryFilter();

        hideBanner();
    } catch (error) {
        expenseBody.innerHTML =
            `<tr><td colspan="6" class="empty-cell error-cell">` +
            `Could not load expenses. Is the backend running on port 8000?` +
            `</td></tr>`;
        listCount.textContent = "0 records";
        showBanner(error.message || "Failed to load expenses", "error");
    }
}

/* Load the COMPLETE list of entered categories from the backend.
   This is independent of any active filter, so the dropdown always
   shows every category even while results are narrowed down. */
async function loadCategories() {
    try {
        const response = await fetch(`${API_BASE}/categories`);

        if (response.ok) {
            const data = await response.json();
            if (Array.isArray(data)) {
                allCategories = data.filter(Boolean);
            }
        }
    } catch {
        // backend unreachable — fall back to whatever is loaded locally
    }

    // make sure categories present in the current list are visible too
    mergeCategories(expenses.map((e) => e.category));

    populateCategoryFilter();
    populateFormCategoryList();
}

function mergeCategories(list) {
    list.forEach((category) => {
        if (category && !allCategories.includes(category)) {
            allCategories.push(category);
        }
    });
    allCategories.sort((a, b) => a.localeCompare(b));
}

async function loadMonthlySummary() {
    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();

    try {
        const response = await fetch(
            `${API_BASE}/summary/monthly?month=${month}&year=${year}`
        );
        if (!response.ok) return;
        const data = await response.json();
        statMonth.textContent = formatMoney(data.total_expenses);
    } catch {
        statMonth.textContent = "—";
    }
}

async function submitExpense(event) {
    event.preventDefault();

    if (!validateForm()) return;

    const payload = {
        title: titleInput.value.trim(),
        amount: Number(Number(amountInput.value).toFixed(2)),
        category: categoryInput.value.trim(),
        date: dateInput.value,
        note: noteInput.value.trim() || null,
    };

    const isEditing = editingId !== null;
    const url = isEditing ? `${API_BASE}/${editingId}` : API_BASE;
    const method = isEditing ? "PUT" : "POST";

    submitBtn.disabled = true;
    submitBtn.textContent = isEditing ? "Saving…" : "Adding…";

    try {
        const response = await fetch(url, {
            method,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            throw new Error(await readErrorMessage(response));
        }

        showBanner(
            isEditing ? "Expense updated successfully" : "Expense added successfully",
            "success"
        );

        resetForm();
        await Promise.all([loadExpenses(), loadCategories(), loadMonthlySummary()]);
    } catch (error) {
        showBanner(error.message || "Failed to save expense", "error");
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = isEditing ? "Update Expense" : "Add Expense";
    }
}

async function deleteExpense(id) {
    const confirmed = window.confirm(
        "Delete this expense? This cannot be undone."
    );
    if (!confirmed) return;

    try {
        const response = await fetch(`${API_BASE}/${id}`, { method: "DELETE" });

        if (!response.ok) {
            throw new Error(await readErrorMessage(response));
        }

        showBanner("Expense deleted", "success");

        if (editingId === id) resetForm();

        await Promise.all([loadExpenses(), loadCategories(), loadMonthlySummary()]);
    } catch (error) {
        showBanner(error.message || "Failed to delete expense", "error");
    }
}

/* =========================================================
   RENDERING
   ========================================================= */
function renderTable() {
    listCount.textContent = `${expenses.length} record${expenses.length === 1 ? "" : "s"}`;

    if (expenses.length === 0) {
        expenseBody.innerHTML =
            `<tr><td colspan="6" class="empty-cell">` +
            `No expenses found. Add one using the form above.` +
            `</td></tr>`;
        return;
    }

    expenseBody.innerHTML = expenses
        .map((expense) => {
            const note = expense.note
                ? escapeHtml(expense.note)
                : `<span class="muted">—</span>`;

            return `
                <tr data-id="${expense.id}">
                    <td data-label="Date">${escapeHtml(formatDate(expense.date))}</td>
                    <td data-label="Title" class="cell-title">${escapeHtml(expense.title)}</td>
                    <td data-label="Category">
                        <span class="badge">${escapeHtml(expense.category)}</span>
                    </td>
                    <td data-label="Amount" class="num cell-amount">${formatMoney(expense.amount)}</td>
                    <td data-label="Note" class="cell-note" title="${note.replace(/"/g, "&quot;")}">${note}</td>
                    <td data-label="Actions" class="actions-col">
                        <button type="button" class="btn btn-small btn-edit" data-action="edit" data-id="${expense.id}">Edit</button>
                        <button type="button" class="btn btn-small btn-delete" data-action="delete" data-id="${expense.id}">Delete</button>
                    </td>
                </tr>`;
        })
        .join("");
}

function renderStats() {
    const total = expenses.reduce((sum, expense) => sum + Number(expense.amount), 0);
    statTotal.textContent = formatMoney(total);
    statCount.textContent = String(expenses.length);
}

/* Single source of truth for BOTH the filter dropdown and the
   Add-Expense suggestions: built-in defaults + every category
   ever entered. This keeps the two lists identical. */
function getMergedCategories() {
    const merged = new Set([...DEFAULT_CATEGORIES, ...allCategories]);
    return [...merged].sort((a, b) => a.localeCompare(b));
}

/* Rebuild the filter dropdown. The user picks from a dropdown
   (no typing), and it always lists the same categories as the
   Add-Expense field — even while a filter is active. */
function populateCategoryFilter() {
    const selected = filterCategory.value;
    const categories = getMergedCategories();

    filterCategory.innerHTML =
        `<option value="">All categories</option>` +
        categories
            .map(
                (c) =>
                    `<option value="${escapeHtml(c)}"${c === selected ? " selected" : ""}>${escapeHtml(c)}</option>`
            )
            .join("");

    // keep a selection that is not in the list yet (e.g. just renamed)
    if (selected && !categories.includes(selected)) {
        filterCategory.insertAdjacentHTML(
            "beforeend",
            `<option value="${escapeHtml(selected)}" selected>${escapeHtml(selected)}</option>`
        );
    }
}

/* Keep the Add-Expense category suggestions in sync, using the
   exact same list as the filter dropdown. */
function populateFormCategoryList() {
    $("categoryList").innerHTML = getMergedCategories()
        .map((c) => `<option value="${escapeHtml(c)}"></option>`)
        .join("");
}

/* =========================================================
   FORM MODE
   ========================================================= */
function startEdit(id) {
    const expense = expenses.find((e) => e.id === id);
    if (!expense) return;

    editingId = id;
    titleInput.value = expense.title;
    amountInput.value = Number(expense.amount).toFixed(2);
    categoryInput.value = expense.category;
    dateInput.value = expense.date;
    noteInput.value = expense.note || "";

    formTitle.textContent = "Edit Expense";
    submitBtn.textContent = "Update Expense";
    cancelEditBtn.classList.remove("hidden");

    form.scrollIntoView({ behavior: "smooth", block: "start" });
    titleInput.focus();
}

function resetForm() {
    editingId = null;
    form.reset();
    dateInput.value = todayISO();
    clearErrors();
    formTitle.textContent = "Add Expense";
    submitBtn.textContent = "Add Expense";
    cancelEditBtn.classList.add("hidden");
}

/* =========================================================
   EVENT WINTERS / BINDINGS
   ========================================================= */
function debounce(fn, delay = 350) {
    let timer;
    return (...args) => {
        window.clearTimeout(timer);
        timer = window.setTimeout(() => fn(...args), delay);
    };
}

function init() {
    // snapshot the built-in suggestions before we start rebuilding them
    DEFAULT_CATEGORIES.push(
        ...Array.from($("categoryList").options).map((option) => option.value)
    );

    dateInput.value = todayISO();

    form.addEventListener("submit", submitExpense);
    cancelEditBtn.addEventListener("click", resetForm);

    expenseBody.addEventListener("click", (event) => {
        const button = event.target.closest("button[data-action]");
        if (!button) return;

        const id = Number(button.dataset.id);
        if (button.dataset.action === "edit") startEdit(id);
        if (button.dataset.action === "delete") deleteExpense(id);
    });

    filterTitleInput.addEventListener("input", debounce(loadExpenses));
    filterCategory.addEventListener("change", loadExpenses);
    filterFrom.addEventListener("change", handleFromDateChange);
    filterTo.addEventListener("change", handleToDateChange);

    $("resetFiltersBtn").addEventListener("click", () => {
        filterTitleInput.value = "";
        filterCategory.value = "";
        filterFrom.value = "";
        filterTo.value = "";
        syncToDateMin(); // clears the min constraint on the "to" field
        hideBanner();
        hideToast();
        loadExpenses();
    });

    loadExpenses();
    loadCategories();
    loadMonthlySummary();
}

document.addEventListener("DOMContentLoaded", init);
