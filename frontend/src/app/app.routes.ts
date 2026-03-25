import { Routes } from '@angular/router';
import { DashboardComponent } from './features/dashboard/pages/dashboard/dashboard.component';
import { SchedulePickupPageComponent } from './features/pickup/pages/schedule-pickup-page/schedule-pickup-page.component';
import { ReportBinComponent } from './features/bin-reports/pages/report-bin/report-bin.component';
import { MakePaymentComponent } from './features/payments/pages/make-payment/make-payment.component';
import { SettingsComponent } from './features/settings/pages/settings/settings.component';
import { NotificationsComponent } from './features/notifications/pages/notifications/notifications.component';
import { RegisterComponent } from './features/auth/pages/register/register.component';
import { LoginComponent } from './features/auth/pages/login/login.component';
import { ComplaintsComponent } from './features/complaints/pages/complaints/complaints.component';
import { AdminDashboardComponent } from './features/admin/pages/admin-dashboard/admin-dashboard.component';
import { AdminPickupsComponent } from './features/admin/pages/admin-pickups/admin-pickups.component';
import { AdminReportsComponent } from './features/admin/pages/admin-reports/admin-reports.component';
import { AdminPaymentsComponent } from './features/admin/pages/admin-payments/admin-payments.component';
import { AdminBinsComponent } from './features/admin/pages/admin-bins/admin-bins.component';
import { AdminComplaintsComponent } from './features/admin/pages/admin-complaints/admin-complaints.component';
import { AdminUsersComponent } from './features/admin/pages/admin-users/admin-users.component';
import { AdminNotificationsComponent } from './features/admin/pages/admin-notifications/admin-notifications.component';
import { AdminSettingsComponent } from './features/admin/pages/admin-settings/admin-settings.component';
import { authGuard, adminGuard } from './guards/auth.guard';

export const routes: Routes = [
  { path: '', redirectTo: '/login', pathMatch: 'full' },
  { path: 'login', component: LoginComponent },
  { path: 'register', component: RegisterComponent },

  // User routes
  { path: 'dashboard', component: DashboardComponent, canActivate: [authGuard] },
  { path: 'schedule-pickup', component: SchedulePickupPageComponent, canActivate: [authGuard] },
  { path: 'report-bin', component: ReportBinComponent, canActivate: [authGuard] },
  { path: 'payments', component: MakePaymentComponent, canActivate: [authGuard] },
  { path: 'notifications', component: NotificationsComponent, canActivate: [authGuard] },
  { path: 'settings', component: SettingsComponent, canActivate: [authGuard] },
  { path: 'complaints', component: ComplaintsComponent, canActivate: [authGuard] },

  // Admin routes
  { path: 'admin', component: AdminDashboardComponent, canActivate: [authGuard, adminGuard] },
  { path: 'admin/pickups', component: AdminPickupsComponent, canActivate: [authGuard, adminGuard] },
  { path: 'admin/reports', component: AdminReportsComponent, canActivate: [authGuard, adminGuard] },
  { path: 'admin/payments', component: AdminPaymentsComponent, canActivate: [authGuard, adminGuard] },
  { path: 'admin/bins', component: AdminBinsComponent, canActivate: [authGuard, adminGuard] },
  { path: 'admin/complaints', component: AdminComplaintsComponent, canActivate: [authGuard, adminGuard] },
  { path: 'admin/users', component: AdminUsersComponent, canActivate: [authGuard, adminGuard] },
  { path: 'admin/notifications', component: AdminNotificationsComponent, canActivate: [authGuard, adminGuard] },
  { path: 'admin/settings', component: AdminSettingsComponent, canActivate: [authGuard, adminGuard] },

  { path: '**', redirectTo: '/login' },
];
