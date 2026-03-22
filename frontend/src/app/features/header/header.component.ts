import { Component, Input, OnInit, OnDestroy, HostListener } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { ApiService } from '../../services/api.service';
import { AuthService } from '../../services/auth.service';
import { NotificationCountService } from '../../services/notification-count.service';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './header.component.html',
  styleUrl: './header.component.scss'
})
export class HeaderComponent implements OnInit, OnDestroy {
  @Input() title: string = '';
  @Input() subtitle: string = '';
  @Input() userName: string = '';
  @Input() userInitials: string = '';
  unreadCount = 0;
  showUserMenu = false;
  private sub?: Subscription;

  constructor(
    private router: Router,
    private apiService: ApiService,
    private authService: AuthService,
    private notifCount: NotificationCountService
  ) {}

  ngOnInit(): void {
    
    this.sub = this.notifCount.count$.subscribe(c => this.unreadCount = c);

    
    const userId = this.authService.userId;
    if (userId) {
      this.apiService.getNotifications(userId).subscribe({
        next: (notifications) => {
          const count = notifications.filter(n => !n.is_read).length;
          this.notifCount.setCount(count);
        },
        error: () => {}
      });
    }
  }

  ngOnDestroy(): void { this.sub?.unsubscribe(); }

  goToNotifications(): void { this.router.navigate(['/notifications']); }
  goToDashboard(): void { this.router.navigate([this.authService.isAdmin ? '/admin' : '/dashboard']); }
  toggleUserMenu(): void { this.showUserMenu = !this.showUserMenu; }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: Event): void {
    const target = event.target as HTMLElement;
    if (!target.closest('.user-menu-container')) {
      this.showUserMenu = false;
    }
  }
}
