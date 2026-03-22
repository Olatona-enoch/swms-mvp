import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { HeaderComponent } from '../../../header/header.component';
import { ApiService } from '../../../../services/api.service';
import { AuthService } from '../../../../services/auth.service';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink, HeaderComponent],
  templateUrl: './admin-dashboard.component.html',
  styleUrl: './admin-dashboard.component.scss'
})
export class AdminDashboardComponent implements OnInit {
  stats: any = {};
  userName = '';
  userInitials = '';
  areaDemand: any[] = [];
  weeklyPattern: any[] = [];
  forecast: any[] = [];
  maxDemand = 1;

  constructor(private apiService: ApiService, private authService: AuthService) {}

  ngOnInit(): void {
    const user = this.authService.currentUser;
    if (user) {
      this.userName = user.name;
      this.userInitials = user.name.split(' ').map((n: string) => n[0]).join('').toUpperCase();
    }
    this.apiService.getAdminStats().subscribe({ next: (data) => this.stats = data });

    this.apiService.getAreaDemand().subscribe({
      next: (data) => this.areaDemand = data
    });
    this.apiService.getWeeklyPattern().subscribe({
      next: (data) => {
        this.weeklyPattern = data;
        this.maxDemand = Math.max(1, ...data.map((d: any) => d.demand));
      }
    });
    this.apiService.getUpcomingForecast().subscribe({
      next: (data) => this.forecast = data
    });
  }

  barHeight(demand: number): string {
    return Math.max(8, (demand / this.maxDemand) * 100) + '%';
  }

  priorityBadge(priority: string): string {
    const map: any = { high: 'bg-red-100 text-red-700', medium: 'bg-amber-100 text-amber-700', low: 'bg-emerald-100 text-emerald-700' };
    return map[priority] || 'bg-gray-100 text-gray-600';
  }

  levelColor(level: string): string {
    const map: any = { high: 'text-red-600', medium: 'text-amber-600', low: 'text-emerald-600' };
    return map[level] || 'text-gray-500';
  }
}
