import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private apiUrl = 'http://localhost:3000';

  constructor(private http: HttpClient) {}

  // Pickups
  schedulePickup(data: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/pickups`, data);
  }

  payForPickup(data: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/pickups/pay`, data);
  }

  getPickupPrices(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/pickup-prices`);
  }

  getUserSubscription(userId: number, pickupDate?: string): Observable<any> {
    let url = `${this.apiUrl}/user-subscription?user_id=${userId}`;
    if (pickupDate) url += `&pickup_date=${pickupDate}`;
    return this.http.get(url);
  }

  getMyPickups(userId: number): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/pickups?user_id=${userId}`);
  }

  getAllPickups(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/pickups/all`);
  }

  updatePickupStatus(id: number, status: string): Observable<any> {
    return this.http.patch(`${this.apiUrl}/pickups/${id}/status`, { status });
  }

  assignTruck(id: number, truck: string): Observable<any> {
    return this.http.patch(`${this.apiUrl}/pickups/${id}/assign-truck`, { truck });
  }

  // Bin reports
  submitBinReport(data: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/bin-reports`, data);
  }

  getMyBinReports(userId: number): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/bin-reports?user_id=${userId}`);
  }

  getAllBinReports(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/bin-reports/all`);
  }

  updateBinReportStatus(id: number, status: string): Observable<any> {
    return this.http.patch(`${this.apiUrl}/bin-reports/${id}/status`, { status });
  }

  simulateBinReportResponse(id: number): Observable<any> {
    return this.http.patch(`${this.apiUrl}/bin-reports/${id}/simulate-response`, {});
  }

  // Payments
  getBillingPlans(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/billing-plans`);
  }

  submitPayment(data: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/payments`, data);
  }

  getMyPayments(userId: number): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/payments?user_id=${userId}`);
  }

  getAllPayments(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/payments/all`);
  }

  verifyPayment(id: number, status: string, adminId: number): Observable<any> {
    return this.http.patch(`${this.apiUrl}/payments/${id}/verify`, { status, admin_id: adminId });
  }

  autoVerifyPayment(id: number, paystackRef: string): Observable<any> {
    return this.http.patch(`${this.apiUrl}/payments/${id}/auto-verify`, { paystack_reference: paystackRef });
  }

  // Notifications
  getNotifications(userId: number): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/notifications?user_id=${userId}`);
  }

  markNotificationRead(id: number): Observable<any> {
    return this.http.patch(`${this.apiUrl}/notifications/${id}/read`, {});
  }

  markAllNotificationsRead(userId: number): Observable<any> {
    return this.http.patch(`${this.apiUrl}/notifications/read-all?user_id=${userId}`, {});
  }

  // Complaints
  submitComplaint(data: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/complaints`, data);
  }

  getMyComplaints(userId: number): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/complaints?user_id=${userId}`);
  }

  getAllComplaints(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/complaints/all`);
  }

  respondToComplaint(id: number, adminResponse: string, status: string): Observable<any> {
    return this.http.patch(`${this.apiUrl}/complaints/${id}/respond`, { admin_response: adminResponse, status });
  }

  simulateComplaintResponse(id: number): Observable<any> {
    return this.http.patch(`${this.apiUrl}/complaints/${id}/simulate-response`, {});
  }

  // Bins
  getAllBins(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/bins`);
  }

  getBinByCode(code: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/bins/${code}`);
  }

  createBin(data: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/bins`, data);
  }

  getBinQR(code: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/bins/${code}/qr`);
  }

  getUserStats(userId: number): Observable<any> {
    return this.http.get(`${this.apiUrl}/dashboard/stats?user_id=${userId}`);
  }

  getAdminStats(): Observable<any> {
    return this.http.get(`${this.apiUrl}/dashboard/admin-stats`);
  }

  getAllUsers(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/users`);
  }

  suspendUser(userId: number): Observable<any> {
    return this.http.patch(`${this.apiUrl}/users/${userId}/suspend`, {});
  }

  activateUser(userId: number): Observable<any> {
    return this.http.patch(`${this.apiUrl}/users/${userId}/activate`, {});
  }

  getAdminSettings(): Observable<any> {
    return this.http.get(`${this.apiUrl}/admin/settings`);
  }

  updateAdminSettings(data: any): Observable<any> {
    return this.http.patch(`${this.apiUrl}/admin/settings`, data);
  }
  
  getAllNotificationsAdmin(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/admin/notifications/all`);
  }

  markAllNotificationsReadAdmin(): Observable<any> {
    return this.http.patch(`${this.apiUrl}/admin/notifications/read-all`, {});
  }
  
  getAreaDemand(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/predictions/area-demand`);
  }

  getWeeklyPattern(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/predictions/weekly-pattern`);
  }

  getUpcomingForecast(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/predictions/upcoming`);
  }

  getPaymentConfig(): Observable<any> {
    return this.http.get(`${this.apiUrl}/payment-config`);
  }

  initializePaystack(data: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/paystack/initialize`, data);
  }

  verifyPaystack(reference: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/paystack/verify/${reference}`);
  }
}
