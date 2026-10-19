# Setup guide: building the data platform step by step

Follow these phases in order. Each one ends with a **checkpoint**, so you know it worked before moving on.
Fabric's menus change often. If a button isn't where this says, tell Claude what you see.
Steps marked 🧑‍💻 are things you do in the Fabric portal. Steps marked 🤖 are where Claude writes the code (notebooks, SQL, measures) for you to paste in or commit.

## What you need

Everything runs inside **Microsoft Fabric**. No Azure subscription is needed.

| Service | What it's for | Where |
| --- | --- | --- |
| Fabric capacity | Compute for everything below. Your trial (about 55 days left) is enough. | already active |
| Workspace `employee-hub-data-dev` | Keeps the analytics items separate from the app | new |
| Fabric SQL database `app-new` | Source: the app's tables, replicated to OneLake | exists (`fabric_project`) |
| Lakehouse `lh_employee_hub` | Bronze, silver and gold Delta tables | new |
| OneLake shortcut | Reads the app's replicated tables without copying them | new, inside the lakehouse |
| Notebooks (PySpark) | `nb_01_bronze_ingest`, `nb_02_silver_transform`, `nb_03_gold_dimensional` | new |
| Data pipeline | Runs the notebooks in order on a schedule | new |
| Semantic model (Direct Lake) | Measures over the gold tables | new |
| Power BI report | Visuals for the semantic model | new |
| Git integration (GitHub) | Saves all of the above into this repo | connect |
| Later: Eventstream + Eventhouse | Real-time extension | later |

You need to be **Admin** of the new workspace. If you're the admin of your trial tenant, also check two tenant settings in **Settings → Admin portal → Tenant settings**:
- **Users can create Fabric items**: on.
- **Users can synchronize workspace items with GitHub repositories**: on, under Git integration. This is needed in Phase 6.

---

## Phase 0: Check the source is replicated to OneLake

The whole design reads the app's data from its OneLake replica, never from the live database.

1. 🧑‍💻 Open `fabric_project` and open the **app-new** item of type **SQL database**.
2. 🧑‍💻 On the ribbon, open **Replication → Monitor replication**. You should see `Employees`, `Departments`, `JobTitles`, `AppUsers` and `AuditEvents`, each with a status of **Replicating** or **Running**.
3. 🧑‍💻 Switch to the **SQL analytics endpoint** item called `app-new` and run:
   ```sql
   SELECT COUNT(*) FROM dbo.Employees;
   ```

**Checkpoint:** the count matches the total on the app's Dashboard. If replication is off or the tables are missing, stop and tell Claude: the ingest step would then read from the database instead.

---

## Phase 1: Workspace and lakehouse

1. 🧑‍💻 **Workspaces → New workspace**. Name it `employee-hub-data-dev`. Under **Advanced**, choose **Trial** (or your capacity) as the license mode.
2. 🧑‍💻 In the new workspace, choose **New item → Lakehouse**, name it `lh_employee_hub`, and tick **Lakehouse schemas**. (If you don't see that option, create it without schemas. Table names will then use `bronze_` / `silver_` / `gold_` prefixes.)
3. 🧑‍💻 In the lakehouse, create the schemas `src`, `bronze`, `silver`, `gold` and `ops` (right-click **Tables → New schema**).

**Checkpoint:** the lakehouse shows the five empty schemas.

---

## Phase 2: Connect the source with a shortcut

1. 🧑‍💻 In `lh_employee_hub`, right-click the **src** schema and choose **New shortcut → Microsoft OneLake**.
2. 🧑‍💻 Pick the **app-new** SQL database from `fabric_project`, expand **Tables → dbo**, select all five tables, and choose **Create**.
3. 🧑‍💻 Open one shortcut table, for example `src.Employees`, in the lakehouse preview.

**Checkpoint:** the preview shows real rows. The shortcut always shows the replica's current state, and nothing is copied.

> **About change capture:** the replica holds each table's *current* state, not a change log. The pipeline works out changes itself:
> - **Inserts and edits:** rows whose `CreatedAt` / `UpdatedAt` is newer than the last run's watermark.
> - **Deletes:** `AuditEvents` with action `employee.delete`, plus an ID comparison as a safety net.
> - **Edits made directly in SQL without updating `UpdatedAt`:** a row-hash comparison.

---

## Phase 3: Bronze, silver and gold notebooks

1. 🤖 Claude writes three notebooks into `data-platform/notebooks/` in this repo. They'll be added to the workspace in Phase 6:
   - `nb_01_bronze_ingest`: incremental append into `bronze.*`, adding `_ingested_at`, `_op` and `_row_hash`. Stores the watermark in `ops.pipeline_state`.
   - `nb_02_silver_transform`: cleans and conforms the data (for example `HR` → `Human Resources`), keeps the latest row per ID, applies quality rules, and sends failing rows to `silver.rejects`.
   - `nb_03_gold_dimensional`: builds `gold.dim_date`, `dim_department`, `dim_job_title`, `dim_employee` (SCD Type 2), `fact_headcount_monthly` and `fact_employee_change`.
2. 🧑‍💻 Until Git sync is set up, you can paste each notebook into **New item → Notebook**. Attach `lh_employee_hub` as the default lakehouse and choose **Run all**: 01, then 02, then 03.

**Checkpoint:**
- Bronze row counts match the source.
- `silver.employee_current` has one row per employee.
- `gold.dim_employee` has one current row (`is_current = true`) per employee.
- Run 01 a second time: it should add **0 rows**, because nothing changed.

---

## Phase 4: Pipeline and schedule

1. 🧑‍💻 **New item → Data pipeline** named `pl_employee_hub_daily`. Add three **Notebook** activities (01 → 02 → 03), each connected **On success**.
2. 🧑‍💻 Add a **Fail** path from any activity to a notebook or activity that writes the failure to `ops.pipeline_runs`. 🤖 Claude provides this.
3. 🧑‍💻 Choose **Run** once, then **Schedule** (for example hourly or daily).

**Checkpoint:**
- Edit one employee in the app and run the pipeline. The change shows up in `gold.dim_employee` as a new version, and the old version gets an end date.
- Delete a test employee. Their row is closed in gold, not erased.

---

## Phase 5: Semantic model and report

1. 🧑‍💻 In the lakehouse, choose **New semantic model**, name it `sm_employee_hub`, and select only the `gold` tables.
2. 🧑‍💻 In the model view, create relationships from the facts to each dimension. The keys are `*_key` columns, one-to-many from dimension to fact.
3. 🤖 Claude writes the DAX measures: Headcount, Hires, Leavers, Attrition %, Average Salary, Max Salary, and Salary band share.
4. 🧑‍💻 Choose **New report**. Build a headcount trend, headcount by department, a salary distribution chart, and a hires vs leavers chart.

**Checkpoint:** headcount in the report equals the app's Dashboard total.

---

## Phase 6: Git integration

1. 🧑‍💻 On GitHub, create a **fine-grained personal access token** for `employee-hub-fabric-app` with **Contents: Read and write**. Keep it private and enter it only in Fabric.
2. 🧑‍💻 In the workspace, open **Workspace settings → Git integration → GitHub**. Add the token, then choose the repo, the branch `main` and the folder `data-platform/fabric`, and connect.
3. 🧑‍💻 Use **Source control → Commit** to save the lakehouse, notebooks, pipeline and semantic model as code.

**Checkpoint:** `data-platform/fabric/` appears on GitHub with one folder per item.

---

## Phase 7 (later): Dev → Test → Prod and real-time

- **Deployment pipelines:** create `employee-hub-data-test` and `-prod` workspaces, then **New deployment pipeline** and assign the three workspaces to its stages.
- **Real-time:**
  - an **Eventstream** fed by an event generator (attendance swipes)
  - an **Eventhouse** (KQL) for the stream
  - a Gold fact joined to `dim_employee`.

## Naming conventions

| Prefix | Item |
| --- | --- |
| `lh_` | Lakehouse |
| `nb_` | Notebook |
| `pl_` | Data pipeline |
| `sm_` | Semantic model |
| `rpt_` | Report |
| `ops.` | Pipeline state and run logs |
