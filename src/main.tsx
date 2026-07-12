import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { AppShell } from "./components/layout/AppShell";
import { RoleProvider, useRole } from "./lib/RoleContext";
import { routes } from "./lib/routes";
import type { RouteMeta } from "./types";
import { AcceptInvitePage } from "./pages/AcceptInvitePage";
import { CompanyFormPage } from "./pages/CompanyFormPage";
import { CompanyManagementPage } from "./pages/CompanyManagementPage";
import { DashboardPage } from "./pages/DashboardPage";
import { ForgotPasswordPage } from "./pages/ForgotPasswordPage";
import { InviteUserPage } from "./pages/InviteUserPage";
import { PlaceholderPage } from "./pages/PlaceholderPage";
import { SignInPage } from "./pages/SignInPage";
import { TaskBulkCreatePage } from "./pages/TaskBulkCreatePage";
import { TaskCreatePage } from "./pages/TaskCreatePage";
import { TaskDetailsPage } from "./pages/TaskDetailsPage";
import { TaskGridPage } from "./pages/TaskGridPage";
import { UserManagementPage } from "./pages/UserManagementPage";
import { NotificationsPage } from "./pages/NotificationsPage";
import { ProfilePage } from "./pages/ProfilePage";
import { ReportsPage } from "./pages/ReportsPage";
import { PlatformAdminShell } from "./components/layout/PlatformAdminShell";
import { CreateTenantPage, SystemOverviewPage, TenantDetailPage, TenantListPage } from "./pages/PlatformAdminPages";
import "./index.css";

function PublicPage({ route }: { route: RouteMeta }) {
  if (route.path === "/signin") return <SignInPage />;
  if (route.path === "/invite/accept") return <AcceptInvitePage />;
  if (route.path === "/forgot-password") return <ForgotPasswordPage />;
  return <PlaceholderPage route={route} />;
}

function ProtectedRoute({ route }: { route: RouteMeta }) {
  const { isAuthenticated, role } = useRole();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/signin" replace state={{ from: location.pathname }} />;
  }

  if (Array.isArray(route.access) && !route.access.includes(role)) {
    return <Navigate to={role === "Platform admin" ? "/admin/tenants" : "/dashboard"} replace />;
  }

  if (route.path === "/tasks/new") {
    return <TaskCreatePage />;
  }

  if (route.path === "/tasks/bulk-upload") {
    return <TaskBulkCreatePage />;
  }

  if (route.path === "/companies/new" || route.path === "/companies/:companyId/edit") {
    return <CompanyFormPage />;
  }

  if (route.path === "/users/new") {
    return <InviteUserPage />;
  }

  if (route.path.startsWith("/admin/")) {
    return <PlatformAdminShell>{route.path === "/admin/tenants" ? <TenantListPage /> : route.path === "/admin/tenants/new" ? <CreateTenantPage /> : route.path === "/admin/tenants/:tenantId" ? <TenantDetailPage /> : route.path === "/admin/system" ? <SystemOverviewPage /> : <PlaceholderPage route={route} />}</PlatformAdminShell>;
  }

  return (
    <AppShell>
      {route.path === "/dashboard" ? (
        <DashboardPage />
      ) : route.path === "/dashboard/executive" ? (
        <DashboardPage forceExecutive />
      ) : route.path === "/tasks" ? (
        <TaskGridPage mode="week" />
      ) : route.path === "/tasks/all" ? (
        <TaskGridPage mode="all" />
      ) : route.path === "/tasks/:taskId" ? (
        <TaskDetailsPage />
      ) : route.path === "/companies" ? (
        <CompanyManagementPage />
      ) : route.path === "/users" ? (
        <UserManagementPage />
      ) : route.path === "/notifications" ? (
        <NotificationsPage />
      ) : route.path === "/profile" ? (
        <ProfilePage />
      ) : route.path === "/reports" ? (
        <ReportsPage />
      ) : (
        <PlaceholderPage route={route} />
      )}
    </AppShell>
  );
}

function HomeRedirect() {
  const { isAuthenticated } = useRole();
  return <Navigate to={isAuthenticated ? "/dashboard" : "/signin"} replace />;
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <RoleProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<HomeRedirect />} />
          {routes.map((route) => (
            <Route
              key={route.path}
              path={route.path}
              element={route.public ? <PublicPage route={route} /> : <ProtectedRoute route={route} />}
            />
          ))}
          <Route path="*" element={<HomeRedirect />} />
        </Routes>
      </BrowserRouter>
    </RoleProvider>
  </React.StrictMode>,
);
