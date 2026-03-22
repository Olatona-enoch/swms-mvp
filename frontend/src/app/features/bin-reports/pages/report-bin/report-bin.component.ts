import { CommonModule } from '@angular/common';
import { Component, OnInit, HostListener } from '@angular/core';
import { FormGroup, FormBuilder, Validators, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { HeaderComponent } from "../../../header/header.component";
import { AuthService } from '../../../../services/auth.service';
import { ApiService } from '../../../../services/api.service';
import { NotificationCountService } from '../../../../services/notification-count.service';

@Component({
  selector: 'app-report-bin',
  standalone: true,
  imports: [CommonModule, HeaderComponent, ReactiveFormsModule],
  templateUrl: './report-bin.component.html',
  styleUrl: './report-bin.component.scss'
})
export class ReportBinComponent implements OnInit {
  reportForm!: FormGroup;
  isSubmitted: boolean = false;
  selectedFileName: string = '';
  errorMessage: string = '';
  isLoading: boolean = false;
  showSuccess: boolean = false;
  userName: string = '';
  userInitials: string = '';
  activeTab: 'report' | 'history' = 'report';
  allReports: any[] = [];
  knownBins: any[] = [];
  showBinDropdown: boolean = false;
  simulatingId: number | null = null;

  constructor(
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private router: Router,
    private authService: AuthService,
    private apiService: ApiService,
    private notifCount: NotificationCountService
  ) {}

  ngOnInit(): void {
    this.initForm();
    const user = this.authService.currentUser;
    if (user) {
      this.userName = user.name;
      this.userInitials = user.name.split(' ').map(n => n[0]).join('').toUpperCase();
      this.loadReports();
    }
    this.loadBins();
    this.route.queryParams.subscribe(params => {
      if (params['tab'] === 'history') this.activeTab = 'history';
      if (params['bin']) {
        this.reportForm.patchValue({ binId: params['bin'] });
        this.loadBinDetails(params['bin']);
      }
    });
  }

  private initForm(): void {
    this.reportForm = this.fb.group({
      binId: ['', [Validators.required, Validators.pattern(/^BIN-\d{1,5}$/i)]],
      issueType: ['', Validators.required],
      location: ['', Validators.required],
      notes: ['', Validators.maxLength(500)]
    });
  }

  loadReports(): void {
    this.apiService.getMyBinReports(this.authService.userId).subscribe({
      next: (reports) => { this.allReports = reports || []; },
      error: () => {}
    });
  }

  loadBins(): void {
    this.apiService.getAllBins().subscribe({
      next: (bins) => { this.knownBins = bins || []; },
      error: () => {}
    });
  }

  private loadBinDetails(binCode: string): void {
    this.apiService.getBinByCode(binCode).subscribe({
      next: (bin) => { this.reportForm.patchValue({ location: bin.location }); },
      error: () => {}
    });
  }

  selectBin(bin: any): void {
    this.reportForm.patchValue({ binId: bin.bin_code, location: bin.location });
    this.showBinDropdown = false;
  }

  toggleBinDropdown(): void {
    this.showBinDropdown = !this.showBinDropdown;
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: Event): void {
    const target = event.target as HTMLElement;
    if (!target.closest('.bin-lookup-container')) {
      this.showBinDropdown = false;
    }
  }

  isFieldInvalid(fieldName: string): boolean {
    const field = this.reportForm.get(fieldName);
    return !!(field && field.invalid && (field.dirty || field.touched || this.isSubmitted));
  }

  onSubmit(): void {
    this.isSubmitted = true;
    this.errorMessage = '';
    if (this.reportForm.valid) {
      this.isLoading = true;
      const val = this.reportForm.value;
      this.apiService.submitBinReport({
        user_id: this.authService.userId,
        bin_code: val.binId, issue_type: val.issueType,
        location: val.location, notes: val.notes
      }).subscribe({
        next: () => { this.isLoading = false; this.showSuccess = true; this.loadReports(); this.notifCount.increment(); },
        error: (err) => {
          this.isLoading = false;
          this.errorMessage = (err.error?.message || 'Server error') + (err.error?.detail ? ` (${err.error.detail})` : '');
        }
      });
    } else { this.reportForm.markAllAsTouched(); }
  }

  switchTab(tab: 'report' | 'history'): void {
    this.activeTab = tab;
    if (tab === 'report') {
      this.showSuccess = false;
      this.showBinDropdown = false;
      this.errorMessage = '';
      this.isSubmitted = false;
      this.selectedFileName = '';
      this.reportForm.reset();
      this.reportForm.patchValue({ binId: '', issueType: '', location: '', notes: '' });
      this.reportForm.markAsPristine();
      this.reportForm.markAsUntouched();
    }
  }
  reportAnother(): void {
    this.showSuccess = false;
    this.showBinDropdown = false;
    this.errorMessage = '';
    this.isSubmitted = false;
    this.selectedFileName = '';
    this.activeTab = 'report';
    this.reportForm.reset();
    this.reportForm.patchValue({ binId: '', issueType: '', location: '', notes: '' });
    this.reportForm.markAsPristine();
    this.reportForm.markAsUntouched();
  }

  closeBinDropdown(): void { this.showBinDropdown = false; }

  simulateResponse(id: number): void {
    this.simulatingId = id;
    this.apiService.simulateBinReportResponse(id).subscribe({
      next: () => { this.simulatingId = null; this.loadReports(); this.notifCount.increment(); },
      error: () => { this.simulatingId = null; }
    });
  }

  getStatusClass(s: string): string {
    const m: any = { pending: 'bg-amber-100 text-amber-700', investigating: 'bg-blue-100 text-blue-700', resolved: 'bg-emerald-100 text-emerald-700', acknowledged: 'bg-blue-100 text-blue-700' };
    return m[s] || 'bg-gray-100 text-gray-600';
  }

  goToSchedulePickup(): void { this.router.navigate(['/schedule-pickup']); }
  goToPayments(): void { this.router.navigate(['/payments']); }
  goToDashboard(): void { this.router.navigate(['/dashboard']); }

  formatDate(d: string): string { return d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : ''; }

  private resetForm(): void {
    this.reportForm.reset({ binId: '', issueType: '', location: '', notes: '' });
    this.isSubmitted = false; this.selectedFileName = '';
  }
}
