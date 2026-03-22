import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { HeaderComponent } from "../../../header/header.component";
import { AuthService } from '../../../../services/auth.service';
import { ApiService } from '../../../../services/api.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule, HeaderComponent],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss'
})
export class DashboardComponent implements OnInit {
  userName: string = '';
  userInitials: string = '';
  stats: any = {
    nextPickup: null,
    pendingReports: 0,
    completedPickups: 0,
    outstandingPayment: 0,
    recentActivity: []
  };

  constructor(private authService: AuthService, private apiService: ApiService, private router: Router) {}

  ngOnInit(): void {
    if (this.authService.isAdmin) {
      this.router.navigate(['/admin']);
      return;
    }
    const user = this.authService.currentUser;
    if (user) {
      this.userName = user.name;
      this.userInitials = user.name.split(' ').map(n => n[0]).join('').toUpperCase();
      this.loadStats();
    }
  }

  loadStats(): void {
    this.apiService.getUserStats(this.authService.userId).subscribe({
      next: (data) => { this.stats = data; },
      error: () => {}
    });
  }

  formatDate(dateStr: string): string {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  formatTime(dateStr: string): string {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  }

  getActivityIcon(type: string): string {
    const icons: any = { pickup: 'emerald', report: 'blue', payment: 'amber' };
    return icons[type] || 'gray';
  }
}
