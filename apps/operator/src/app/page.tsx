/**
 * Operator console — main dashboard (server component).
 *
 * Renders a server-side KPI strip above the existing client-side
 * OperatorConsole (reducer-driven pull/review/publish flow). The KPI
 * strip will grow as we surface more server-truth counts; the console
 * itself is mock until the 6-state flow gets real backing.
 */

import OperatorConsoleView from "@/components/OperatorConsole";
import QueueKpi from "@/components/QueueKpi";

export const revalidate = 300;

export default function Page() {
  return (
    <div className="flex flex-col gap-10">
      <QueueKpi />
      <OperatorConsoleView />
    </div>
  );
}
