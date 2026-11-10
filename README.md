# Personal Expense Tracker

A small website for recording personal expenses. You can add an expense, see it in a list, search and filter the list, edit or delete an entry, and review totals for the visible list and current month.

## How the pieces fit together

Think of the app as three parts:

1. **The page (`Frontend/`)** is what a person sees and uses in a web browser.
2. **The service (`backend/main.py`)** receives the page's requests, checks the data, and decides what to do.
3. **The database** keeps the expense records after the browser is closed. Its connection details come from `backend/.env`.

When you submit the form, the browser sends the expense to the service. The service validates it, saves it in the database, and sends the saved record back so the page can refresh. Filters and monthly totals also come from requests to the service.

## Technology stack and why it is used

The project uses a lightweight full-stack design. The tools keep the frontend simple, provide a structured API, and store expense information in a relational database.

### Backend - Python and FastAPI

FastAPI is used to build the web API. It is a modern Python framework with automatic request validation through Pydantic, generated interactive API documentation, and dependency injection for sharing and closing database sessions. It also supports asynchronous endpoints if the service needs them later.

In this application, FastAPI handles creating, retrieving, updating, deleting, filtering, and summarizing expenses.

### Frontend - HTML, CSS, and JavaScript

HTML structures the form, summary cards, filters, table, and confirmation dialog. Custom CSS provides a responsive interface without a UI framework. JavaScript handles form interactions and communicates with the backend using the browser Fetch API. This keeps the frontend lightweight and avoids extra package dependencies.

### Database - PostgreSQL

PostgreSQL is an open-source relational database with transactional consistency and support for structured values such as dates, decimal amounts, and text. Its filtering and aggregation features fit the expense list and monthly/category summaries, and it can support larger datasets as the application grows.

In this application, PostgreSQL stores each expense's title, amount, category, date, and optional note.

### ORM - SQLAlchemy

SQLAlchemy connects the Python service to the database through Python objects and queries. It keeps the expense model and database actions organized, avoids writing raw SQL for each operation, and supports other relational databases if the project changes later.

In this application, SQLAlchemy defines the `Expense` model, manages connections and sessions, and performs create, read, update, and delete operations.

### Data validation - Pydantic

Pydantic checks incoming data types and field rules and helps FastAPI return clear validation errors. Here, it checks expense data such as required titles and categories, positive amounts, and decimal precision before the data is saved.

### Environment settings - python-dotenv

`python-dotenv` loads local settings from an environment file so configuration and database credentials do not need to be hardcoded in the Python source. In this project, `backend/.env` supplies the PostgreSQL connection URL through `DATABASE_URL`.

## Overall architecture

The application follows a client-server flow:

1. HTML, CSS, and JavaScript present the interface in the browser.
2. JavaScript sends HTTP requests to the FastAPI backend.
3. FastAPI validates request data using Pydantic schemas.
4. SQLAlchemy runs the database operations.
5. PostgreSQL stores or retrieves expense records.
6. FastAPI returns JSON for the frontend to display.

This separation keeps page presentation, request handling, validation, and data storage in distinct parts of the codebase, which makes the application easier to understand and extend.

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

## Set up and run the project

You need Python and PostgreSQL installed, plus a PostgreSQL database for the application. You can create the database using a PostgreSQL tool such as pgAdmin or `psql`. For example, the database could be named `expense_tracker`.

### 1. Configure the database connection

Create `backend/.env` and put your own local connection details in it. The format is:

```text
DATABASE_URL=postgresql+psycopg://USER:PASSWORD@HOST:5432/DATABASE_NAME
```

Replace `USER`, `PASSWORD`, `HOST`, and `DATABASE_NAME` with your PostgreSQL username, password, server address, and database name. For a local default PostgreSQL server, `HOST` is often `localhost` and the port is commonly `5432`. Keep real credentials in `backend/.env`; do not paste them into source files or commit them.

### 2. Install Python dependencies

Open PowerShell in the project folder and run:

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
uvicorn main:app --reload
```

The first commands create and activate a private Python environment for this project and install the packages listed in `backend/requirements.txt`. If PowerShell blocks environment activation, run `./.venv/Scripts/python.exe -m pip install -r requirements.txt` and then `./.venv/Scripts/python.exe -m uvicorn main:app --reload` from the `backend` folder instead.

### 3. Open the application

Keep the terminal running and open `http://127.0.0.1:8000/` in a browser. The backend serves the frontend from this address. The database table is created automatically at startup if it does not already exist.

The interactive API reference is at `http://127.0.0.1:8000/docs`. To stop the server, focus the terminal and press `Ctrl+C`.

## Keeping credentials out of GitHub

The root `.gitignore` excludes `.env` files, virtual environments, Python-generated files, local database files, private-key files, and common credential bundle names. A safe example settings file may be named `.env.example`; it must contain placeholders only, never working passwords or tokens.

Ignore rules only prevent *untracked* files from being added automatically. They do not remove a secret that was committed earlier. In the current checkout, `.env` and `backend/.env` are ignored and are not tracked by Git. Before pushing, you can verify the status with:

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

## Responsive layout

The page adapts to desktop, tablet, and phone widths using CSS only; responsive styling does not change the application's features or data behavior. On smaller screens, the content margins and cards tighten, the form and filter fields reflow into columns that fit the available width, and the summary cards stack for easier reading. The expense table becomes stacked rows with labels for each value instead of requiring a wide table. Buttons and the delete dialog also fit narrow screens, including small phones.
