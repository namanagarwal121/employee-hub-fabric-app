//-----------------------------------------------------------------------
// <copyright company="Microsoft Corporation">
//        Copyright (c) Microsoft Corporation.  All rights reserved.
//        Licensed under the MIT license. See LICENSE file in the project root for full license information.
// </copyright>
//-----------------------------------------------------------------------

import { useState } from 'react';

import { AccessProvider } from './features/access/AccessProvider';
import { AdminConsole } from './features/admin/AdminConsole';
import { Dashboard } from './features/dashboard/Dashboard';
import { useChartColor } from './features/dashboard/chart-color';
import type { ChartFilter } from './features/dashboard/chart-filter';
import { DataManagement } from './features/employees/DataManagement';
import { EmployeesProvider } from './features/employees/EmployeesProvider';
import { AppShell } from './features/shell/AppShell';
import { useSection } from './features/shell/use-section';

function App() {
  const [section, setSection] = useSection();
  const [chartColor, setChartColor] = useChartColor();
  const [filter, setFilter] = useState<ChartFilter | null>(null);

  return (
    <AccessProvider>
    <EmployeesProvider>
      <AppShell section={section} onNavigate={setSection}>
        {section === 'admin' ? (
          <AdminConsole />
        ) : section === 'dashboard' ? (
          <Dashboard
            chartColor={chartColor}
            onChartColorChange={setChartColor}
            onDrill={(next) => {
              setFilter(next);
              setSection('data');
            }}
          />
        ) : (
          <DataManagement
            filter={filter}
            onClearFilter={() => setFilter(null)}
            onBackToDashboard={() => setSection('dashboard')}
          />
        )}
      </AppShell>
    </EmployeesProvider>
    </AccessProvider>
  );
}

export default App;
