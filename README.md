# Personal Expense Tracker

A small website for recording personal expenses. You can add an expense, see it in a list, search and filter the list, edit or delete an entry, and review totals for the visible list and current month.

## How the pieces fit together

Think of the app as three parts:

1. **The page (`Frontend/`)** is what a person sees and uses in a web browser.
2. **The service (`backend/main.py`)** receives the page's requests, checks the data, and decides what to do.
3. **The database** keeps the expense records after the browser is closed. Its connection details come from `backend/.env`.

When you submit the form, the browser sends the expense to the service. The service validates it, saves it in the database, and sends the saved record back so the page can refresh. Filters and monthly totals also come from requests to the service.

## Folder and file guide

### `Frontend/` - the visible website

- **`index.html`** lays out the page: the expense form, summary cards, filters, expense table, and delete confirmation dialog. It also contains suggested categories.
- **`style.css`** gives the page a minimal, classic look with warm neutral surfaces, muted green accents, restrained borders, simple typography, and layouts that adapt to small screens. It also styles the delete dialog.
- **`script.js`** makes the page interactive. It talks to the backend, checks required form fields, draws the table and totals, applies filters, and handles add, edit, and delete actions. The currency display is currently set to Indian rupees.

### `backend/` - the service and database logic

- **`main.py`** starts the FastAPI web service, provides the web API, enables browser requests from a separately opened frontend, and serves the frontend files at the website root.
- **`database.py`** reads `DATABASE_URL` from environment settings and opens database connections. Each request gets a database session that is closed afterward.
- **`models.py`** describes how an expense is stored: title, amount, category, date, optional note, and an automatically assigned ID.
- **`schemas.py`** describes the information the API accepts and returns. It checks that required text is present and that the amount is positive and has at most two decimal places.
- **`crud.py`** contains the database actions: create, find, filter, update, delete, list categories, and calculate monthly totals.
- **`requirements.txt`** lists the Python packages needed by the service, including FastAPI, SQLAlchemy, the PostgreSQL driver, and environment-file support.
- **`.env`** is a local settings file used for the database connection. It is intentionally excluded from Git; do not copy its real connection string into documentation, source code, or chat.

## What the API can do

The main API path is `/api/expenses`:

- `GET /api/expenses` lists expenses. Optional filters are `title`, `category`, `from_date`, and `to_date`.
- `POST /api/expenses` creates an expense.
- `GET /api/expenses/{id}` returns one expense.
- `PUT /api/expenses/{id}` replaces an expense's editable fields.
- `DELETE /api/expenses/{id}` removes an expense.
- `GET /api/expenses/categories` lists the categories already used.
- `GET /api/expenses/summary/monthly?month=...&year=...` returns monthly totals and a category breakdown.
- `GET /health` reports whether the service is responding.

The interactive API reference is available at `/docs` while the service is running.

## Run it on your computer

You need Python and a PostgreSQL database. Create a database, then create `backend/.env` with this format, replacing the example values locally:

```text
DATABASE_URL=postgresql+psycopg://USER:PASSWORD@HOST:5432/DATABASE_NAME
```

From the project folder, install dependencies and start the service:

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
uvicorn main:app --reload
```

Open `http://127.0.0.1:8000/` in a browser. The service creates the expense table when it starts if that table does not exist yet. The frontend is already served by the service, so opening `Frontend/index.html` separately is optional.

## Keeping credentials out of GitHub

The root `.gitignore` excludes `.env` files, virtual environments, Python-generated files, local database files, private-key files, and common credential bundle names. A safe example settings file may be named `.env.example`; it must contain placeholders only, never working passwords or tokens.

Ignore rules only prevent *untracked* files from being added automatically. They do not remove a secret that was committed earlier. This supplied folder currently has no `.git` directory, so its Git history and tracked-file status cannot be inspected here. Before pushing from the actual Git checkout, run:

```powershell
git status --short
git ls-files -- .env backend/.env
git check-ignore -v .env backend/.env
```

The `git ls-files` command should print nothing for environment files. If a real credential was committed at any point, remove it from Git tracking and rotate or replace that credential; adding it to `.gitignore` alone is not enough.

## Current scope and limitations

- There is no login or user separation. Anyone who can reach the service can access its expense data; keep it private unless authentication and access controls are added.
- The app uses a database connection string supplied outside source control. Back up the database separately; `.gitignore` does not protect database contents or backups stored elsewhere.
- The monthly summary is calculated by the backend. The top "Total (list)" and entry count reflect the currently filtered list.
- The project has no automated test suite or database migration setup in the files currently present.

## Frontend interactions

The expense list's **Delete** button opens a separate confirmation dialog in the page. The browser's native confirmation alert is not used. A deletion request is sent only after the person chooses **Delete expense**. Choosing **Keep expense** or pressing Escape closes the dialog without deleting. The dialog is labeled for assistive technology and uses the browser's native `<dialog>` element for modal focus handling.

On narrow screens, the expense table changes into stacked labeled rows.
