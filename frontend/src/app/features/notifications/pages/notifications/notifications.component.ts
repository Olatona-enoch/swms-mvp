import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { HeaderComponent } from "../../../header/header.component";
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../../services/auth.service';
import { ApiService } from '../../../../services/api.service';
import { NotificationCountService } from '../../../../services/notification-count.service';

@Component({
  selector: 'app-notifications',
  standalone: true,
  imports: [CommonModule, HeaderComponent],
  templateUrl: './notifications.component.html',
  styleUrl: './notifications.component.scss'
})
export class NotificationsComponent implements OnInit {
  notifications: any[] = [];
  userName: string = '';
  userInitials: string = '';
  expandedId: number | null = null;

  constructor(private authService: AuthService, private apiService: ApiService, private router: Router, private notifCount: NotificationCountService) {}

  ngOnInit(): void {
    const user = this.authService.currentUser;
    if (user) {
      this.userName = user.name;
      this.userInitials = user.name.split(' ').map(n => n[0]).join('').toUpperCase();
    }
    this.loadNotifications();
  }

  loadNotifications(): void {
    this.apiService.getNotifications(this.authService.userId).subscribe({
      next: (data) => {
        this.notifications = data.map(n => ({
          ...n,
          read: !!n.is_read,
          time: this.timeAgo(n.created_at),
          route: this.getRoute(n),
          queryParams: this.getQueryParams(n)
        }));
      },
      error: () => {}
    });
  }

  onNotificationClick(notification: any): void {
    if (!notification.read) {
      this.apiService.markNotificationRead(notification.id).subscribe({
        next: () => {
          notification.read = true;
          this.notifCount.decrement();
        }
      });
    }
    
    this.expandedId = this.expandedId === notification.id ? null : notification.id;
  }

  goToAction(notification: any): void {
    if (notification.route) {
      this.router.navigate([notification.route], { queryParams: notification.queryParams || {} });
    }
  }

  private getRoute(n: any): string | null {
    const t = (n.title || '').toLowerCase();
    if (t.includes('pickup') || t.includes('truck')) return '/schedule-pickup';
    if (t.includes('payment')) return '/payments';
    if (t.includes('report') || t.includes('bin')) return '/report-bin';
    if (t.includes('complaint')) return '/complaints';
    return null;
  }

  private getQueryParams(n: any): any {
    const t = (n.title || '').toLowerCase();
    if (t.includes('welcome')) return {};
    return { tab: 'history' };
  }

  getActionLabel(n: any): string {
    const t = (n.title || '').toLowerCase();
    if (t.includes('pickup') || t.includes('truck')) return 'View My Pickups';
    if (t.includes('payment')) return 'Payment History';
    if (t.includes('report') || t.includes('bin')) return 'View My Reports';
    if (t.includes('complaint')) return 'View Complaints';
    return '';
  }

  markAllAsRead(): void {
    this.apiService.markAllNotificationsRead(this.authService.userId).subscribe({
      next: () => {
        this.notifications = this.notifications.map(n => ({ ...n, read: true }));
        this.notifCount.clear();
      }
    });
  }

  private timeAgo(dateStr: string): string {
    if (!dateStr) return '';
    
    const utcStr = dateStr.endsWith('Z') || dateStr.includes('+') ? dateStr : dateStr + 'Z';
    const date = new Date(utcStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const mins = Math.floor(diff / 60000);

    // Under 1 minute: "Just now"
    if (mins < 1) return 'Just now';
    // Under 5 minutes: "X mins ago"
    if (mins < 5) return `${mins} min${mins > 1 ? 's' : ''} ago`;

    // Same day: show time only "2:36 PM"
    if (date.toDateString() === now.toDateString()) {
      return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    }

    // Yesterday
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday, ' + date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    }

    // Same year: "Feb 22, 2:36 PM"
    if (date.getFullYear() === now.getFullYear()) {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ', ' +
        date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    }

    // Different year: "Feb 22, 2025"
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  formatFullDate(dateStr: string): string {
    if (!dateStr) return '';
    const utcStr = dateStr.endsWith('Z') || dateStr.includes('+') ? dateStr : dateStr + 'Z';
    return new Date(utcStr).toLocaleString('en-US', { 
      month: 'short', day: 'numeric', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  }
}
