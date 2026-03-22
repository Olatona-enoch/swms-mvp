import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { HeaderComponent } from "../../../header/header.component";
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../../services/auth.service';
import { ApiService } from '../../../../services/api.service';
import { NotificationCountService } from '../../../../services/notification-count.service';

type ScheduleStep = 'form' | 'payment' | 'processing' | 'success';

@Component({
  selector: 'app-schedule-pickup-page',
  standalone: true,
  imports: [CommonModule, HeaderComponent, ReactiveFormsModule, FormsModule, RouterModule],
  templateUrl: './schedule-pickup-page.component.html',
  styleUrl: './schedule-pickup-page.component.scss'
})
export class SchedulePickupPageComponent implements OnInit {
  pickupForm!: FormGroup;
  minDate!: string;
  errorMessage = '';
  isLoading = false;
  userName = ''; userInitials = '';
  allPickups: any[] = [];
  activeTab: 'schedule' | 'history' = 'schedule';
  scheduleStep: ScheduleStep = 'form';

  // Subscription & pricing
  isSubscribed = false;
  subscriptionPlan: any = null;
  currentMonth = '';
  pickupPrices: any[] = [];
  currentPickupPrice = 0;
  createdPickupId = 0;

  // Card form
  cardNumber = ''; cardExpiry = ''; cardCvv = ''; cardName = '';
  paymentMethod = '';
  paystackEnabled = false;
  paystackPublicKey = '';

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
    this.minDate = new Date().toISOString().split('T')[0];
    const user = this.authService.currentUser;
    if (user) {
      this.userName = user.name;
      this.userInitials = user.name.split(' ').map(n => n[0]).join('').toUpperCase();
      this.cardName = user.name;
      if (user.address) this.pickupForm.patchValue({ location: user.address });
      this.loadPickups();
      this.checkSubscription();
      this.loadPrices();
    }
    
    const initialTab = this.route.snapshot.queryParamMap.get('tab');
    if (initialTab === 'history') this.activeTab = 'history';
    this.route.queryParams.subscribe(params => {
      if (params['tab'] === 'history') this.activeTab = 'history';
    });

    this.apiService.getPaymentConfig().subscribe({
      next: (cfg) => {
        this.paystackEnabled = cfg.paystack_enabled;
        this.paystackPublicKey = cfg.paystack_public_key || '';
        if (this.paystackEnabled && !(window as any).PaystackPop) {
          const s = document.createElement('script');
          s.src = 'https://js.paystack.co/v2/inline.js';
          s.async = true;
          document.head.appendChild(s);
        }
      },
      error: () => {}
    });
  }

  checkSubscription(pickupDate?: string): void {
    this.apiService.getUserSubscription(this.authService.userId, pickupDate).subscribe({
      next: (data) => {
        this.isSubscribed = data.subscribed;
        this.subscriptionPlan = data.plan;
        this.currentMonth = data.month;
      },
      error: () => {}
    });
  }

  onDateChange(): void {
    const date = this.pickupForm.value.pickupDate;
    if (date) this.checkSubscription(date);
  }

  loadPrices(): void {
    this.apiService.getPickupPrices().subscribe({
      next: (prices) => { this.pickupPrices = prices; },
      error: () => {
        this.pickupPrices = [
          { bin_type: 'general', name: 'General Waste', amount: 1000 },
          { bin_type: 'recyclable', name: 'Recyclable', amount: 1500 },
          { bin_type: 'organic', name: 'Organic / Compost', amount: 2000 },
          { bin_type: 'hazardous', name: 'Hazardous', amount: 3000 }
        ];
      }
    });
  }

  loadPickups(): void {
    this.apiService.getMyPickups(this.authService.userId).subscribe({
      next: (pickups) => { this.allPickups = pickups || []; },
      error: () => {}
    });
  }

  getPriceForBinType(binType: string): number {
    const p = this.pickupPrices.find(x => x.bin_type === binType);
    return p ? p.amount : 1000;
  }

  getRemainingForType(binType: string): number {
    if (!this.subscriptionPlan?.typeUsage) return 0;
    return this.subscriptionPlan.typeUsage[binType]?.remaining ?? 0;
  }

  isTypeAvailable(binType: string): boolean {
    if (!this.isSubscribed || !this.subscriptionPlan?.typeUsage) return false;
    return this.getRemainingForType(binType) > 0;
  }

  getTypeUsedLabel(binType: string): string {
    if (!this.subscriptionPlan?.typeUsage?.[binType]) return '';
    const t = this.subscriptionPlan.typeUsage[binType];
    return `${t.used}/${t.limit} used`;
  }

  getStatusClass(s: string): string {
    const m: any = { scheduled: 'bg-emerald-100 text-emerald-700', assigned: 'bg-blue-100 text-blue-700', completed: 'bg-gray-100 text-gray-600', cancelled: 'bg-red-100 text-red-600' };
    return m[s] || 'bg-gray-100 text-gray-600';
  }

  getPaymentStatusClass(s: string): string {
    const m: any = { paid: 'bg-emerald-100 text-emerald-700', subscription: 'bg-blue-100 text-blue-700', pending: 'bg-amber-100 text-amber-700', unpaid: 'bg-red-100 text-red-700' };
    return m[s] || 'bg-gray-100 text-gray-600';
  }

  getPaymentStatusLabel(s: string): string {
    const m: any = { paid: 'Paid', subscription: 'Subscription', pending: 'Payment Pending', unpaid: 'Unpaid' };
    return m[s] || s;
  }

  private initForm(): void {
    this.pickupForm = this.fb.group({
      location: ['', Validators.required],
      binType: ['', Validators.required],
      pickupDate: ['', Validators.required],
      timeSlot: ['', Validators.required],
      notes: ['']
    });
  }

  isFieldInvalid(fieldName: string): boolean {
    const field = this.pickupForm.get(fieldName);
    return !!(field && field.invalid && (field.dirty || field.touched));
  }

  // Step 1 → Step 2 (or direct submit if subscribed)
  onFormSubmit(): void {
    if (!this.pickupForm.valid) { this.pickupForm.markAllAsTouched(); return; }
    const binType = this.pickupForm.value.binType;
    const pickupDate = this.pickupForm.value.pickupDate;
    this.currentPickupPrice = this.getPriceForBinType(binType);

    // Re-verify subscription for the specific pickup month before proceeding
    this.apiService.getUserSubscription(this.authService.userId, pickupDate).subscribe({
      next: (data) => {
        this.isSubscribed = data.subscribed;
        this.subscriptionPlan = data.plan;
        this.currentMonth = data.month;

        if (this.isSubscribed && this.isTypeAvailable(binType)) {
          this.submitPickup('subscription');
        } else if (this.isSubscribed && !this.isTypeAvailable(binType)) {
          // This specific type is used up
          const typeName = binType.charAt(0).toUpperCase() + binType.slice(1);
          this.errorMessage = `Your ${data.plan.name} plan's ${typeName} pickup limit has been reached (${data.plan.perType} per month). You can pay for this pickup individually or upgrade your plan.`;
          this.scheduleStep = 'payment';
        } else {
          this.scheduleStep = 'payment';
        }
      },
      error: () => {
        this.isSubscribed = false;
        this.scheduleStep = 'payment';
      }
    });
  }

  
  onCardPayment(): void {
    if (this.paystackEnabled && (window as any).PaystackPop) {
      this.openPaystackForPickup();
      return;
    }
    const err = this.validateCard();
    if (err) { this.errorMessage = err; return; }
    this.errorMessage = '';
    this.paymentMethod = 'card';
    this.scheduleStep = 'processing';
    this.submitPickupAndPay('card');
  }

  private openPaystackForPickup(): void {
    this.scheduleStep = 'processing';
    const user = this.authService.currentUser;
    const popup = new (window as any).PaystackPop();
    popup.newTransaction({
      key: this.paystackPublicKey,
      email: user?.email || '',
      amount: this.currentPickupPrice * 100,
      currency: 'NGN',
      metadata: { type: 'pickup', bin_type: this.pickupForm.value.binType },
      onSuccess: (tx: any) => {
        this.paymentMethod = 'card';
        this.submitPickupAndPay('card');
      },
      onCancel: () => { this.scheduleStep = 'payment'; },
      onError: () => { this.scheduleStep = 'payment'; this.errorMessage = 'Payment gateway error.'; }
    });
  }

  
  onBankPayment(): void {
    this.paymentMethod = 'bank_transfer';
    this.submitPickupAndPay('bank_transfer');
  }

  
  onPayLater(): void {
    this.submitPickup('unpaid');
  }

  private submitPickup(paymentStatus: string): void {
    this.isLoading = true; this.errorMessage = '';
    const val = this.pickupForm.value;
    const userId = this.authService.userId;
    if (!userId) { this.isLoading = false; this.errorMessage = 'Session expired.'; return; }

    this.apiService.schedulePickup({
      user_id: userId, location: val.location, bin_type: val.binType,
      pickup_date: val.pickupDate, time_slot: val.timeSlot, notes: val.notes,
      payment_status: paymentStatus
    }).subscribe({
      next: (res) => {
        this.isLoading = false;
        this.createdPickupId = res.id;
        this.scheduleStep = 'success';
        this.loadPickups();
        this.checkSubscription(); // Refresh remaining pickup count
        this.notifCount.increment();
      },
      error: (err) => {
        this.isLoading = false;
        this.errorMessage = err.error?.message || 'Error scheduling pickup';
      }
    });
  }

  private submitPickupAndPay(method: string): void {
    this.isLoading = true; this.errorMessage = '';
    const val = this.pickupForm.value;
    const userId = this.authService.userId;

    
    this.apiService.schedulePickup({
      user_id: userId, location: val.location, bin_type: val.binType,
      pickup_date: val.pickupDate, time_slot: val.timeSlot, notes: val.notes,
      payment_status: 'pending'
    }).subscribe({
      next: (res) => {
        this.createdPickupId = res.id;
        this.notifCount.increment();
        const ref = method === 'card' ? `CARD-${Date.now()}` : `REF-${Date.now().toString(36).toUpperCase()}`;

        // Now pay for the pickup
        this.apiService.payForPickup({
          user_id: userId, pickup_id: res.id,
          amount: this.currentPickupPrice, payment_method: method, reference_number: ref
        }).subscribe({
          next: () => {
            this.isLoading = false;
            if (method === 'card') {
              
              setTimeout(() => { this.scheduleStep = 'success'; this.loadPickups(); }, 2000);
            } else {
              this.scheduleStep = 'success';
              this.loadPickups();
            }
          },
          error: () => {
            this.isLoading = false;
            this.scheduleStep = 'success'; // Still scheduled, payment failed
            this.loadPickups();
          }
        });
      },
      error: (err) => {
        this.isLoading = false;
        this.errorMessage = err.error?.message || 'Error scheduling pickup';
        this.scheduleStep = 'payment';
      }
    });
  }

  goBackToForm(): void { this.scheduleStep = 'form'; this.errorMessage = ''; }

  switchTab(tab: 'schedule' | 'history'): void {
    this.activeTab = tab;
    if (tab === 'schedule') {
      this.scheduleStep = 'form';
      this.initForm();
      this.checkSubscription(); // Refresh remaining pickup count
      const u = this.authService.currentUser;
      if (u?.address) this.pickupForm.patchValue({ location: u.address });
    }
  }

  scheduleAnother(): void {
    this.scheduleStep = 'form';
    this.activeTab = 'schedule';
    this.initForm();
    this.checkSubscription(); // Refresh remaining pickup count
    const u = this.authService.currentUser;
    if (u?.address) this.pickupForm.patchValue({ location: u.address });
  }

  formatCardNumber(): void { let v = this.cardNumber.replace(/\D/g, '').substring(0, 16); this.cardNumber = v.replace(/(\d{4})(?=\d)/g, '$1 '); }
  formatExpiry(): void {
    let v = this.cardExpiry.replace(/\D/g, '').substring(0, 4);
    if (v.length >= 1) {
      let mm = parseInt(v.substring(0, Math.min(2, v.length)), 10);
      if (v.length === 1 && mm > 1) v = '0' + v;
      if (v.length >= 2 && (mm < 1 || mm > 12)) v = '12' + v.substring(2);
    }
    if (v.length >= 2) v = v.substring(0, 2) + '/' + v.substring(2);
    this.cardExpiry = v;
  }

  private validateCard(): string | null {
    const num = this.cardNumber.replace(/\s/g, '');
    if (num.length < 13 || num.length > 19 || !/^\d+$/.test(num)) return 'Enter a valid card number (13-19 digits).';
    const parts = this.cardExpiry.split('/');
    if (parts.length !== 2) return 'Enter expiry as MM/YY.';
    const month = parseInt(parts[0], 10);
    const year = parseInt(parts[1], 10);
    if (isNaN(month) || month < 1 || month > 12) return 'Expiry month must be 01–12.';
    const now = new Date();
    const currentYear = now.getFullYear() % 100;
    const currentMonth = now.getMonth() + 1;
    if (isNaN(year) || year < currentYear || (year === currentYear && month < currentMonth)) return 'Card has expired.';
    const cvv = this.cardCvv.replace(/\D/g, '');
    if (cvv.length < 3 || cvv.length > 4) return 'CVV must be 3 or 4 digits.';
    if (!this.cardName.trim()) return 'Enter the cardholder name.';
    return null;
  }

  goToPayments(): void { this.router.navigate(['/payments'], { queryParams: { tab: 'history' } }); }
  goToReportBin(): void { this.router.navigate(['/report-bin']); }
  goToDashboard(): void { this.router.navigate(['/dashboard']); }
  formatDate(d: string): string { return d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : ''; }
}
