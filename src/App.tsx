import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AppShell } from "@/components/AppShell";
import { RequireAuth } from "@/components/RequireAuth";
import { RequireAdmin } from "@/components/RequireAdmin";
import { DashboardPage } from "@/routes/DashboardPage";
import { DocumentsPage } from "@/routes/DocumentsPage";
import { UploadPage } from "@/routes/UploadPage";
import { DocumentReviewPage } from "@/routes/DocumentReviewPage";
import { ExportCenterPage } from "@/routes/ExportCenterPage";
import { VendorsPage } from "@/routes/VendorsPage";
import { RatesPage } from "@/routes/RatesPage";
import { ItemMasterPage } from "@/routes/ItemMasterPage";
import { AuditLogsPage } from "@/routes/AuditLogsPage";
import { TrashPage } from "@/routes/TrashPage";
import { SettingsPage } from "@/routes/SettingsPage";
import { LoginPage } from "@/routes/LoginPage";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<RequireAuth />}>
          <Route element={<AppShell />}>
            {/* Available to every signed-in user, admin or not */}
            <Route path="/upload" element={<UploadPage />} />
            <Route path="/queue" element={<DocumentsPage />} />
            <Route path="/documents/:id" element={<DocumentReviewPage />} />

            {/* Admin-only — RequireAdmin bounces non-admins to /upload */}
            <Route element={<RequireAdmin />}>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/export" element={<ExportCenterPage />} />
              <Route path="/vendors" element={<VendorsPage />} />
              <Route path="/rates" element={<RatesPage />} />
              <Route path="/items" element={<ItemMasterPage />} />
              <Route path="/audit-logs" element={<AuditLogsPage />} />
              <Route path="/trash" element={<TrashPage />} />
              <Route path="/settings" element={<SettingsPage />} />
            </Route>
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
