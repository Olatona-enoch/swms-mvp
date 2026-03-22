import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HeaderComponent } from '../../../header/header.component';
import { ApiService } from '../../../../services/api.service';
import { AuthService } from '../../../../services/auth.service';

@Component({ selector: 'app-admin-complaints', standalone: true, imports: [CommonModule, FormsModule, HeaderComponent], templateUrl: './admin-complaints.component.html', styleUrl: './admin-complaints.component.scss' })
export class AdminComplaintsComponent implements OnInit {
  complaints: any[] = [];
  userName = ''; userInitials = '';
  constructor(private apiService: ApiService, private authService: AuthService) {}
  ngOnInit(): void {
    const u = this.authService.currentUser;
    if (u) { this.userName = u.name; this.userInitials = u.name.split(' ').map(n => n[0]).join('').toUpperCase(); }
    this.load();
  }
  load(): void { this.apiService.getAllComplaints().subscribe({ next: (d) => this.complaints = d }); }

  respond(complaint: any): void {
    const response = prompt('Enter your response:');
    if (response) {
      this.apiService.respondToComplaint(complaint.id, response, 'resolved').subscribe({ next: () => this.load() });
    }
  }

  getStatusClass(s: string): string {
    const c: any = { open: 'bg-amber-100 text-amber-600', responded: 'bg-blue-100 text-blue-600', resolved: 'bg-emerald-100 text-emerald-600' };
    return c[s] || 'bg-gray-100 text-gray-600';
  }
}
