import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HeaderComponent } from '../../../header/header.component';
import { ApiService } from '../../../../services/api.service';
import { AuthService } from '../../../../services/auth.service';

@Component({ selector: 'app-admin-reports', standalone: true, imports: [CommonModule, HeaderComponent], templateUrl: './admin-reports.component.html', styleUrl: './admin-reports.component.scss' })
export class AdminReportsComponent implements OnInit {
  reports: any[] = [];
  userName = ''; userInitials = '';
  constructor(private apiService: ApiService, private authService: AuthService) {}
  ngOnInit(): void {
    const u = this.authService.currentUser;
    if (u) { this.userName = u.name; this.userInitials = u.name.split(' ').map(n => n[0]).join('').toUpperCase(); }
    this.load();
  }
  load(): void { this.apiService.getAllBinReports().subscribe({ next: (d) => this.reports = d }); }
  updateStatus(id: number, status: string): void { this.apiService.updateBinReportStatus(id, status).subscribe({ next: () => this.load() }); }
  getStatusClass(s: string): string {
    const c: any = {
      pending: 'bg-amber-100 text-amber-600',
      assigned: 'bg-blue-100 text-blue-600',
      resolved: 'bg-emerald-100 text-emerald-600',
      investigating: 'bg-purple-100 text-purple-600'
    };
    return c[s] || 'bg-gray-100 text-gray-600';
  }
}
