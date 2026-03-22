import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { HeaderComponent } from '../../../header/header.component';
import { AuthService } from '../../../../services/auth.service';
import { ApiService } from '../../../../services/api.service';
import { NotificationCountService } from '../../../../services/notification-count.service';

@Component({
  selector: 'app-complaints',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, HeaderComponent],
  templateUrl: './complaints.component.html',
  styleUrl: './complaints.component.scss'
})
export class ComplaintsComponent implements OnInit {
  complaintForm!: FormGroup;
  complaints: any[] = [];
  errorMessage = '';
  isLoading = false;
  showSuccess = false;
  userName = '';
  userInitials = '';
  activeTab: 'submit' | 'history' = 'submit';
  simulatingId: number | null = null;

  constructor(private fb: FormBuilder, private router: Router, private authService: AuthService, private apiService: ApiService, private notifCount: NotificationCountService) {}

  ngOnInit(): void {
    this.complaintForm = this.fb.group({
      subject: ['', Validators.required],
      message: ['', [Validators.required, Validators.minLength(10)]]
    });
    const user = this.authService.currentUser;
    if (user) {
      this.userName = user.name;
      this.userInitials = user.name.split(' ').map(n => n[0]).join('').toUpperCase();
    }
    this.loadComplaints();
  }

  loadComplaints(): void {
    this.apiService.getMyComplaints(this.authService.userId).subscribe({
      next: (data) => this.complaints = data,
      error: () => {}
    });
  }

  onSubmit(): void {
    if (this.complaintForm.valid) {
      this.isLoading = true; this.errorMessage = '';
      this.apiService.submitComplaint({
        user_id: this.authService.userId,
        subject: this.complaintForm.value.subject,
        message: this.complaintForm.value.message
      }).subscribe({
        next: () => {
          this.isLoading = false;
          this.showSuccess = true;
          this.complaintForm.reset();
          this.loadComplaints();
          this.notifCount.increment();
        },
        error: (err) => {
          this.isLoading = false;
          this.errorMessage = (err.error?.message || 'Server error') + (err.error?.detail ? ` (${err.error.detail})` : '');
        }
      });
    }
  }

  simulateResponse(id: number): void {
    this.simulatingId = id;
    this.apiService.simulateComplaintResponse(id).subscribe({
      next: () => { this.simulatingId = null; this.loadComplaints(); this.notifCount.increment(); },
      error: () => { this.simulatingId = null; }
    });
  }

  switchTab(tab: 'submit' | 'history'): void {
    this.activeTab = tab;
    if (tab === 'submit') { this.showSuccess = false; this.complaintForm.reset(); }
  }

  getStatusClass(s: string): string {
    const m: any = { open: 'bg-amber-100 text-amber-700', responded: 'bg-blue-100 text-blue-700', resolved: 'bg-emerald-100 text-emerald-700' };
    return m[s] || 'bg-gray-100 text-gray-600';
  }

  goToDashboard(): void { this.router.navigate(['/dashboard']); }
  goToNotifications(): void { this.router.navigate(['/notifications']); }
  formatDate(d: string): string { return d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : ''; }
}
