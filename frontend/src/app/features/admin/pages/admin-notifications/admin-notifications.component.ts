import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HeaderComponent } from '../../../header/header.component';
import { ApiService } from '../../../../services/api.service';
import { AuthService } from '../../../../services/auth.service';
import { NotificationCountService } from '../../../../services/notification-count.service';

@Component({
  selector: 'app-admin-notifications',
  standalone: true,
  imports: [CommonModule, HeaderComponent],
  templateUrl: './admin-notifications.component.html',
  styleUrl: './admin-notifications.component.scss'
})
export class AdminNotificationsComponent implements OnInit {
  allNotifications: any[] = [];
  visibleNotifications: any[] = [];
  userName = '';
  userInitials = '';
  isLoading = false;
  pageSize = 10;
  currentCount = 10;

  constructor(
    private apiService: ApiService,
    private authService: AuthService,
    private notifCount: NotificationCountService
  ) {}

  ngOnInit(): void {
    const u = this.authService.currentUser;
    if (u) {
      this.userName = u.name;
      this.userInitials = u.name.split(' ').map((n: string) => n[0]).join('').toUpperCase();
    }
    this.load();
  }

  load(): void {
    this.isLoading = true;
    this.apiService.getAllNotificationsAdmin().subscribe({
      next: (data) => {
        this.allNotifications = data.map(n => ({
          ...n,
          read: !!n.is_read,
          time: this.timeAgo(n.created_at)
        }));
        this.updateVisible();
        this.isLoading = false;
      },
      error: () => { this.isLoading = false; }
    });
  }

  updateVisible(): void {
    this.visibleNotifications = this.allNotifications.slice(0, this.currentCount);
  }

  loadMore(): void {
    this.currentCount += this.pageSize;
    this.updateVisible();
  }

  get hasMore(): boolean {
    return this.currentCount < this.allNotifications.length;
  }

  get unreadCount(): number {
    return this.allNotifications.filter(n => !n.read).length;
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
  }
  markAllAsRead(): void {
    this.apiService.markAllNotificationsReadAdmin().subscribe({
      next: () => {
        this.allNotifications = this.allNotifications.map(n => ({ ...n, read: true }));
        this.updateVisible();
        this.notifCount.clear();
      }
    });
  }

  getIconBg(n: any): string {
    const t = (n.title || '').toLowerCase();
    if (t.includes('payment')) return 'bg-amber-100';
    if (t.includes('bin') || t.includes('report')) return 'bg-red-100';
    if (t.includes('pickup') || t.includes('completed')) return 'bg-emerald-100';
    if (t.includes('user') || t.includes('registered')) return 'bg-blue-100';
    if (t.includes('system') || t.includes('alert') || t.includes('maintenance')) return 'bg-orange-100';
    if (n.type === 'success') return 'bg-emerald-100';
    if (n.type === 'warning') return 'bg-amber-100';
    return 'bg-blue-100';
  }

  getIconType(n: any): string {
    const t = (n.title || '').toLowerCase();
    if (t.includes('payment')) return 'payment';
    if (t.includes('bin') || t.includes('report')) return 'report';
    if (t.includes('pickup') || t.includes('completed')) return 'pickup';
    if (t.includes('user') || t.includes('registered')) return 'user';
    if (t.includes('system') || t.includes('alert') || t.includes('maintenance')) return 'alert';
    return 'info';
  }

  timeAgo(dateStr: string): string {
    if (!dateStr) return '';
    const utcStr = dateStr.endsWith('Z') || dateStr.includes('+') ? dateStr : dateStr + 'Z';
    const date = new Date(utcStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins} minute${mins > 1 ? 's' : ''} ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    const days = Math.floor(hours / 24);
    if (days === 1) return '1 day ago';
    if (days < 7) return `${days} days ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }
}