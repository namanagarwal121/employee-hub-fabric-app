-- Two-way integration tests for Employee Hub (normalized schema).
-- Run in the Fabric portal: fabric_project -> "app-new" SQL database -> New query.
--
-- Tables
--   dbo.Employees    one row per employee; links by key to the tables below
--   dbo.Departments  one row per department     (Employees.dept_id    -> Departments.id)
--   dbo.JobTitles    one row per job title      (Employees.title_id   -> JobTitles.id)
--   dbo.AppUsers     one row per editing person (Employees.createdBy_id / updatedBy_id -> AppUsers.id)
-- `id` columns are UUID primary keys. EmployeeID is the human-facing number (unique).

-- 0. Read employees with their department, title and audit users --------------
SELECT e.EmployeeID, e.FullName, e.Email, d.Name AS Department, t.Title AS JobTitle,
       e.Salary, e.JoiningDate, e.CreatedAt, cu.Email AS CreatedBy,
       e.UpdatedAt, uu.Email AS UpdatedBy
FROM dbo.Employees e
LEFT JOIN dbo.Departments d ON d.id = e.dept_id
LEFT JOIN dbo.JobTitles  t ON t.id = e.title_id
LEFT JOIN dbo.AppUsers   cu ON cu.id = e.createdBy_id
LEFT JOIN dbo.AppUsers   uu ON uu.id = e.updatedBy_id
ORDER BY e.EmployeeID;

-- Test 1: Database -> UI ------------------------------------------------------
-- Insert directly, then press Refresh in the app. The department and title must
-- already exist (or be inserted first); EmployeeID continues the sequence.
-- CreatedBy is left empty: SQL inserts have no signed-in app user.
INSERT INTO dbo.Employees (id, EmployeeID, FullName, Email, Salary, JoiningDate, CreatedAt, dept_id, title_id)
SELECT NEWID(),
       ISNULL(MAX(e.EmployeeID), 0) + 1,
       N'Sofia Martins',
       N'sofia.martins@contoso.com',
       68000.00,
       '2024-11-04',
       SYSUTCDATETIME(),
       (SELECT id FROM dbo.Departments WHERE Name = N'Finance'),
       (SELECT TOP (1) id FROM dbo.JobTitles ORDER BY Title)
FROM dbo.Employees e WITH (UPDLOCK, HOLDLOCK);

-- Test 2: UI -> Database ------------------------------------------------------
-- After adding an employee in the app, confirm it and who created it:
SELECT TOP (5) e.EmployeeID, e.FullName, d.Name AS Department, cu.Email AS CreatedBy, e.CreatedAt
FROM dbo.Employees e
JOIN dbo.Departments d ON d.id = e.dept_id
LEFT JOIN dbo.AppUsers cu ON cu.id = e.createdBy_id
ORDER BY e.CreatedAt DESC;

-- Test 3a: Update in the database -> UI ----------------------------------------
-- Move an employee to another department by key, then press Refresh in the app.
UPDATE dbo.Employees
SET dept_id = (SELECT id FROM dbo.Departments WHERE Name = N'Analytics')
WHERE Email = N'sofia.martins@contoso.com';

-- Test 3b: Edit in the UI -> Database ------------------------------------------
-- After editing a field in the app, see the new value and who changed it:
SELECT e.EmployeeID, e.FullName, e.Salary, e.UpdatedAt, uu.Email AS UpdatedBy
FROM dbo.Employees e
LEFT JOIN dbo.AppUsers uu ON uu.id = e.updatedBy_id
WHERE e.Email = N'sofia.martins@contoso.com';

-- Test 3c: Delete in the UI -> Database ----------------------------------------
-- After deleting the employee in the app, this should return 0:
SELECT COUNT(*) AS remaining FROM dbo.Employees WHERE Email = N'sofia.martins@contoso.com';

-- Lookup tables: each value is stored once ------------------------------------
SELECT d.Name, COUNT(e.id) AS Employees
FROM dbo.Departments d LEFT JOIN dbo.Employees e ON e.dept_id = d.id
GROUP BY d.Name ORDER BY d.Name;
