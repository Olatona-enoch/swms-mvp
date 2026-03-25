import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { HeaderComponent } from '../../../header/header.component';
import { AuthService } from '../../../../services/auth.service';
import { ApiService } from '../../../../services/api.service';

@Component({
  selector: 'app-admin-settings',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, HeaderComponent],
  templateUrl: './admin-settings.component.html',
  styleUrl: './admin-settings.component.scss'
})
export class AdminSettingsComponent implements OnInit {

  userName = '';
  userInitials = '';

  // Admin Profile 
  profileForm!: FormGroup;
  isProfileSubmitted = false;
  profileLoading = false;
  profileMessage = '';
  profileIsError = false;

  //Change Password 
  passwordForm!: FormGroup;
  isPasswordSubmitted = false;
  passwordLoading = false;
  passwordMessage = '';
  passwordIsError = false;
  showCurrentPassword = false;
  showNewPassword = false;
  showConfirmPassword = false;
  showPasswordForm = false;

  // pickup Pricing 
  standardFee = 0;
  emergencyFee = 0;
  discountPercent = 0;
  pricingLoading = false;
  pricingMessage = '';
  pricingIsError = false;

  // Service Areas 
  serviceAreas: string[] = [];
  newArea = '';
  areasLoading = false;
  areasMessage = '';
  showAddArea = false;

  // Notification Settings 
  notifSettings = {
    emailNotifications: true,
    smsNotifications: true,
    paymentAlerts: true
  };
  notifLoading = false;
  notifMessage = '';

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private apiService: ApiService
  ) {}

  ngOnInit(): void {
    const u = this.authService.currentUser;
    if (u) {
      this.userName = u.name;
      this.userInitials = u.name.split(' ').map((n: string) => n[0]).join('').toUpperCase();
    }
    this.initProfileForm();
    this.initPasswordForm();
    this.loadSettings();
  }

  // Profile 
  private initProfileForm(): void {
    const u = this.authService.currentUser;
    this.profileForm = this.fb.group({
      name: [u?.name || '', Validators.required],
      email: [u?.email || '', [Validators.required, Validators.email]],
      phone: [u?.phone || '']
    });
  }

  private initPasswordForm(): void {
    this.passwordForm = this.fb.group({
      currentPassword: ['', Validators.required],
      newPassword: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', Validators.required]
    }, { validators: this.passwordMatchValidator });
  }

  private passwordMatchValidator(c: AbstractControl): ValidationErrors | null {
    const np = c.get('newPassword');
    const cp = c.get('confirmPassword');
    if (!np || !cp) return null;
    return np.value === cp.value ? null : { passwordMismatch: true };
  }

  isFieldInvalid(field: string, form: FormGroup, submitted: boolean): boolean {
    const f = form.get(field);
    return !!(f && f.invalid && (f.dirty || f.touched || submitted));
  }

  saveProfile(): void {
    this.isProfileSubmitted = true;
    if (this.profileForm.invalid) { this.profileForm.markAllAsTouched(); return; }
    this.profileLoading = true;
    const val = this.profileForm.value;
    this.authService.updateProfile(this.authService.userId, {
      name: val.name,
      email: val.email,
      phone: val.phone,
      address: this.authService.currentUser?.address || ''
    }).subscribe({
      next: () => {
        this.profileLoading = false;
        this.profileIsError = false;
        this.profileMessage = 'Profile updated successfully!';
        const u = this.authService.currentUser;
        if (u) this.authService.updateStoredUser({ ...u, name: val.name, email: val.email, phone: val.phone });
        this.userName = val.name;
        this.userInitials = val.name.split(' ').map((n: string) => n[0]).join('').toUpperCase();
        setTimeout(() => this.profileMessage = '', 3000);
      },
      error: (err) => {
        this.profileLoading = false;
        this.profileIsError = true;
        this.profileMessage = err.error?.message || 'Error updating profile';
      }
    });
  }

  togglePasswordForm(): void {
    this.showPasswordForm = !this.showPasswordForm;
    if (!this.showPasswordForm) {
      this.passwordForm.reset();
      this.passwordMessage = '';
      this.isPasswordSubmitted = false;
    }
  }

  savePassword(): void {
    this.isPasswordSubmitted = true;
    if (this.passwordForm.invalid) { this.passwordForm.markAllAsTouched(); return; }
    this.passwordLoading = true;
    this.authService.changePassword(
      this.authService.userId,
      this.passwordForm.get('currentPassword')?.value,
      this.passwordForm.get('newPassword')?.value
    ).subscribe({
      next: () => {
        this.passwordLoading = false;
        this.passwordIsError = false;
        this.passwordMessage = 'Password updated successfully!';
        this.passwordForm.reset();
        this.isPasswordSubmitted = false;
        this.showPasswordForm = false;
        setTimeout(() => this.passwordMessage = '', 3000);
      },
      error: (err) => {
        this.passwordLoading = false;
        this.passwordIsError = true;
        this.passwordMessage = err.error?.message || 'Error updating password';
      }
    });
  }

  toggleVisibility(f: 'current' | 'new' | 'confirm'): void {
    if (f === 'current') this.showCurrentPassword = !this.showCurrentPassword;
    else if (f === 'new') this.showNewPassword = !this.showNewPassword;
    else this.showConfirmPassword = !this.showConfirmPassword;
  }

  //Settings loader 
  loadSettings(): void {
    this.apiService.getAdminSettings().subscribe({
      next: (s: any) => {
        this.standardFee = s.standard_fee ?? 25;
        this.emergencyFee = s.emergency_fee ?? 50;
        this.discountPercent = s.discount_percent ?? 0;
        this.serviceAreas = s.service_areas ? JSON.parse(s.service_areas) : [];
        this.notifSettings.emailNotifications = !!s.email_notifications;
        this.notifSettings.smsNotifications = !!s.sms_notifications;
        this.notifSettings.paymentAlerts = !!s.payment_alerts;
      },
      error: () => {}
    });
  }

  //  Pricing 
  updatePricing(): void {
    if (this.standardFee < 0 || this.emergencyFee < 0) {
      this.pricingMessage = 'Fees cannot be negative';
      this.pricingIsError = true;
      return;
    }
    this.pricingLoading = true;
    this.apiService.updateAdminSettings({
      standard_fee: this.standardFee,
      emergency_fee: this.emergencyFee,
      discount_percent: this.discountPercent
    }).subscribe({
      next: () => {
        this.pricingLoading = false;
        this.pricingIsError = false;
        this.pricingMessage = 'Pricing updated successfully!';
        setTimeout(() => this.pricingMessage = '', 3000);
      },
      error: () => {
        this.pricingLoading = false;
        this.pricingIsError = true;
        this.pricingMessage = 'Error updating pricing';
      }
    });
  }

  // Service Areas 
  addArea(): void {
    const trimmed = this.newArea.trim();
    if (!trimmed) return;
    if (this.serviceAreas.includes(trimmed)) {
      this.areasMessage = 'Area already exists';
      return;
    }
    this.serviceAreas = [...this.serviceAreas, trimmed];
    this.newArea = '';
    this.showAddArea = false;
    this.saveAreas();
  }

  removeArea(area: string): void {
    this.serviceAreas = this.serviceAreas.filter(a => a !== area);
    this.saveAreas();
  }

  private saveAreas(): void {
    this.areasLoading = true;
    this.apiService.updateAdminSettings({
      service_areas: JSON.stringify(this.serviceAreas)
    }).subscribe({
      next: () => {
        this.areasLoading = false;
        this.areasMessage = 'Areas updated!';
        setTimeout(() => this.areasMessage = '', 2000);
      },
      error: () => {
        this.areasLoading = false;
        this.areasMessage = 'Error saving areas';
      }
    });
  }

  //  Notification toggles 
  saveNotifSettings(): void {
    this.notifLoading = true;
    this.apiService.updateAdminSettings({
      email_notifications: this.notifSettings.emailNotifications ? 1 : 0,
      sms_notifications: this.notifSettings.smsNotifications ? 1 : 0,
      payment_alerts: this.notifSettings.paymentAlerts ? 1 : 0
    }).subscribe({
      next: () => {
        this.notifLoading = false;
        this.notifMessage = 'Saved!';
        setTimeout(() => this.notifMessage = '', 2000);
      },
      error: () => { this.notifLoading = false; }
    });
  }
}