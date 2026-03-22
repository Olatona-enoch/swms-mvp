import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormGroup, FormBuilder, Validators, AbstractControl, ValidationErrors, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { HeaderComponent } from '../../../header/header.component';
import { AuthService } from '../../../../services/auth.service';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule, HeaderComponent],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.scss'
})
export class SettingsComponent implements OnInit {
  profileForm!: FormGroup;
  passwordForm!: FormGroup;
  isEditingProfile: boolean = false;
  isProfileSubmitted: boolean = false;
  isPasswordSubmitted: boolean = false;
  showCurrentPassword: boolean = false;
  showNewPassword: boolean = false;
  showConfirmPassword: boolean = false;
  profileMessage: string = '';
  passwordMessage: string = '';
  passwordIsError: boolean = false;
  userName: string = '';
  userInitials: string = '';

  notifications = {
    pickupReminders: true,
    paymentUpdates: true,
    binReportUpdates: false,
    systemAnnouncements: true
  };

  constructor(private fb: FormBuilder, private router: Router, private authService: AuthService) {}

  ngOnInit(): void {
    this.initProfileForm();
    this.initPasswordForm();
    const user = this.authService.currentUser;
    if (user) {
      this.userName = user.name;
      this.userInitials = user.name.split(' ').map(n => n[0]).join('').toUpperCase();
    }
  }

  private initProfileForm(): void {
    const user = this.authService.currentUser;
    this.profileForm = this.fb.group({
      fullName: [user?.name || '', Validators.required],
      email: [user?.email || '', [Validators.required, Validators.email]],
      phone: [user?.phone || '', [Validators.required, Validators.minLength(10)]],
      homeAddress: [user?.address || '', Validators.required]
    });
    this.profileForm.disable();
  }

  private initPasswordForm(): void {
    this.passwordForm = this.fb.group({
      currentPassword: ['', Validators.required],
      newPassword: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', Validators.required]
    }, { validators: this.passwordMatchValidator });
  }

  private passwordMatchValidator(control: AbstractControl): ValidationErrors | null {
    const np = control.get('newPassword');
    const cp = control.get('confirmPassword');
    if (!np || !cp) return null;
    return np.value === cp.value ? null : { passwordMismatch: true };
  }

  isFieldInvalid(fieldName: string, form: FormGroup, isSubmitted: boolean): boolean {
    const field = form.get(fieldName);
    return !!(field && field.invalid && (field.dirty || field.touched || isSubmitted));
  }

  togglePasswordVisibility(field: 'current' | 'new' | 'confirm'): void {
    if (field === 'current') this.showCurrentPassword = !this.showCurrentPassword;
    else if (field === 'new') this.showNewPassword = !this.showNewPassword;
    else this.showConfirmPassword = !this.showConfirmPassword;
  }

  onProfileAction(): void {
    if (!this.isEditingProfile) {
      this.isEditingProfile = true;
      this.profileForm.enable();
      this.isProfileSubmitted = false;
    } else {
      this.isProfileSubmitted = true;
      if (this.profileForm.valid) {
        const val = this.profileForm.value;
        this.authService.updateProfile(this.authService.userId, {
          name: val.fullName, email: val.email, phone: val.phone, address: val.homeAddress
        }).subscribe({
          next: () => {
            // Update local stored user
            const user = this.authService.currentUser;
            if (user) {
              this.authService.updateStoredUser({
                ...user, name: val.fullName, email: val.email, phone: val.phone, address: val.homeAddress
              });
            }
            this.isEditingProfile = false;
            this.profileForm.disable();
            this.profileMessage = 'Profile updated successfully!';
            setTimeout(() => this.profileMessage = '', 3000);
          },
          error: () => { this.profileMessage = 'Error updating profile'; }
        });
      } else {
        this.profileForm.markAllAsTouched();
      }
    }
  }

  onPasswordUpdate(): void {
    this.isPasswordSubmitted = true;
    this.passwordMessage = '';
    if (this.passwordForm.valid) {
      this.authService.changePassword(
        this.authService.userId,
        this.passwordForm.get('currentPassword')?.value,
        this.passwordForm.get('newPassword')?.value
      ).subscribe({
        next: () => {
          this.passwordIsError = false;
          this.passwordMessage = 'Password updated successfully!';
          this.passwordForm.reset();
          this.isPasswordSubmitted = false;
          setTimeout(() => this.passwordMessage = '', 3000);
        },
        error: (err) => {
          this.passwordIsError = true;
          this.passwordMessage = err.error?.message || 'Error updating password';
        }
      });
    } else {
      this.passwordForm.markAllAsTouched();
    }
  }

  onLogout(): void {
    this.authService.logout();
  }

  onDeleteAccount(): void {
    const confirmed = confirm('Are you sure you want to delete your account? This action cannot be undone.');
    if (confirmed) {
      this.authService.logout();
    }
  }
}
