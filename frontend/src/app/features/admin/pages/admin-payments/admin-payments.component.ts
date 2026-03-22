import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HeaderComponent } from '../../../header/header.component';
import { ApiService } from '../../../../services/api.service';
import { AuthService } from '../../../../services/auth.service';

@Component({ selector: 'app-admin-payments', standalone: true, imports: [CommonModule, HeaderComponent], templateUrl: './admin-payments.component.html', styleUrl: './admin-payments.component.scss' })
export class AdminPaymentsComponent implements OnInit {
  payments: any[] = [];
  userName = ''; userInitials = '';
  constructor(private apiService: ApiService, private authService: AuthService) {}
  ngOnInit(): void {
    const u = this.authService.currentUser;
    if (u) { this.userName = u.name; this.userInitials = u.name.split(' ').map(n => n[0]).join('').toUpperCase(); }
    this.load();
  }
  load(): void { this.apiService.getAllPayments().subscribe({ next: (d) => this.payments = d }); }
  verify(id: number, status: string): void {
    this.apiService.verifyPayment(id, status, this.authService.userId).subscribe({ next: () => this.load() });
  }
  getStatusClass(s: string): string {
    const c: any = { pending: 'bg-amber-100 text-amber-600', verified: 'bg-emerald-100 text-emerald-600', rejected: 'bg-red-100 text-red-600' };
    return c[s] || 'bg-gray-100 text-gray-600';
  }
}
