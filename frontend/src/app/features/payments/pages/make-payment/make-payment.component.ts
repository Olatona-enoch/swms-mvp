import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { HeaderComponent } from "../../../header/header.component";
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../../services/auth.service';
import { ApiService } from '../../../../services/api.service';
import { NotificationCountService } from '../../../../services/notification-count.service';

type PaymentState = 'plan' | 'method' | 'card_form' | 'bank_details' | 'processing' | 'success';

@Component({
  selector: 'app-make-payment',
  standalone: true,
  imports: [CommonModule, HeaderComponent, FormsModule],
  templateUrl: './make-payment.component.html',
  styleUrl: './make-payment.component.scss'
})
export class MakePaymentComponent implements OnInit {
  activeTab: 'pay' | 'history' = 'pay';
  paymentState: PaymentState = 'plan';
  userName = ''; userInitials = ''; userEmail = '';
  paymentId = 0; errorMessage = ''; copiedAccount = false; isSubmitting = false;
  plans: any[] = []; selectedPlan: any = null;
  billingMonth = ''; billingMonths: string[] = [];
  paymentMethod = ''; referenceNumber = '';
  cardNumber = ''; cardExpiry = ''; cardCvv = ''; cardName = '';
  verifiedAmount = 0; verifiedRef = '';
  allPayments: any[] = [];
  paidMonths: Set<string> = new Set();

  paystackEnabled = false;
  paystackPublicKey = '';

  constructor(private route: ActivatedRoute, private router: Router, private authService: AuthService, private apiService: ApiService, private notifCount: NotificationCountService) {}

  ngOnInit(): void {
    const user = this.authService.currentUser;
    if (user) {
      this.userName = user.name; this.userEmail = user.email || '';
      this.userInitials = user.name.split(' ').map(n => n[0]).join('').toUpperCase();
      this.cardName = user.name;
    }
    this.generateBillingMonths();
    this.loadPlans();
    this.loadPayments();
    this.route.queryParams.subscribe(p => { if (p['tab'] === 'history') this.activeTab = 'history'; });
    this.apiService.getPaymentConfig().subscribe({
      next: (cfg) => {
        this.paystackEnabled = cfg.paystack_enabled;
        this.paystackPublicKey = cfg.paystack_public_key || '';
        if (this.paystackEnabled) this.loadPaystackScript();
      },
      error: () => {}
    });
  }

  loadPlans(): void {
    this.apiService.getBillingPlans().subscribe({
      next: (plans) => { this.plans = plans; },
      error: () => {
        this.plans = [
          { id: 'basic', name: 'Basic', amount: 7000, description: '1 pickup per waste type/month', savings: 'Save ₦500 vs per-pickup (₦7,500)' },
          { id: 'standard', name: 'Standard', amount: 13000, description: '2 pickups per waste type/month', savings: 'Save ₦2,000 vs per-pickup (₦15,000)' },
          { id: 'premium', name: 'Premium', amount: 18000, description: '3 pickups per waste type/month', savings: 'Save ₦4,500 vs per-pickup (₦22,500)' },
          { id: 'commercial', name: 'Commercial', amount: 30000, description: '5 pickups per waste type/month', savings: 'Save ₦7,500 vs per-pickup (₦37,500)' }
        ];
      }    
    });
  }

  loadPayments(): void {
    this.apiService.getMyPayments(this.authService.userId).subscribe({
      next: (payments) => {
        this.allPayments = payments || [];
        // Only subscription payments count toward month-paid status
        this.paidMonths = new Set(
          this.allPayments.filter(p => p.status === 'verified' && p.payment_type === 'subscription').map(p => p.billing_month)
        );
      },
      error: () => {}
    });
  }

  generateBillingMonths(): void {
    const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    const now = new Date();
    for (let i = 0; i < 6; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      this.billingMonths.push(`${months[d.getMonth()]} ${d.getFullYear()}`);
    }
    this.billingMonth = this.billingMonths[0];
  }

  isMonthPaid(month: string): boolean { return this.paidMonths.has(month); }
  isMonthPending(month: string): boolean {
    return this.allPayments.some(p => p.billing_month === month && p.status === 'pending' && p.payment_type === 'subscription');
  }

  selectPlan(plan: any): void { this.selectedPlan = plan; }
  onProceedToMethod(): void { if (this.selectedPlan && this.billingMonth) this.paymentState = 'method'; }
  onSelectCard(): void {
    if (this.paystackEnabled && (window as any).PaystackPop) {
      this.openPaystack();
    } else {
      this.paymentMethod = 'card'; this.paymentState = 'card_form';
    }
  }
  onSelectBankTransfer(): void {
    this.paymentMethod = 'bank_transfer';
    this.referenceNumber = `REF-${Date.now().toString(36).toUpperCase()}`;
    this.paymentState = 'bank_details';
  }

  private loadPaystackScript(): void {
    if ((window as any).PaystackPop) return;
    const s = document.createElement('script');
    s.src = 'https://js.paystack.co/v2/inline.js';
    s.async = true;
    document.head.appendChild(s);
  }

  private openPaystack(): void {
    this.paymentState = 'processing';
    const popup = new (window as any).PaystackPop();
    popup.newTransaction({
      key: this.paystackPublicKey,
      email: this.userEmail,
      amount: this.selectedPlan.amount * 100,
      currency: 'NGN',
      metadata: { billing_month: this.billingMonth, plan: this.selectedPlan.name },
      onSuccess: (tx: any) => {
        const ref = tx.reference;
        this.apiService.submitPayment({
          user_id: this.authService.userId, amount: this.selectedPlan.amount,
          billing_month: this.billingMonth, payment_method: 'card', reference_number: ref,
          payment_type: 'subscription'
        }).subscribe({
          next: (res) => {
            this.paymentId = res.id;
            this.apiService.verifyPaystack(ref).subscribe({
              next: (v) => {
                if (v.verified) {
                  this.apiService.autoVerifyPayment(this.paymentId, ref).subscribe({ next: () => {}, error: () => {} });
                }
              },
              error: () => {}
            });
            this.verifiedAmount = this.selectedPlan.amount;
            this.verifiedRef = ref;
            this.paymentState = 'success';
            this.loadPayments();
            this.notifCount.increment();
          },
          error: () => { this.paymentState = 'method'; this.errorMessage = 'Payment record failed.'; }
        });
      },
      onCancel: () => { this.paymentState = 'method'; },
      onError: () => { this.paymentState = 'method'; this.errorMessage = 'Payment gateway error. Try card form instead.'; }
    });
  }

  onCardSubmit(): void {
    const err = this.validateCard();
    if (err) { this.errorMessage = err; return; }
    this.errorMessage = ''; this.paymentState = 'processing';
    const ref = `CARD-${Date.now()}`;
    this.apiService.submitPayment({
      user_id: this.authService.userId, amount: this.selectedPlan.amount,
      billing_month: this.billingMonth, payment_method: 'card', reference_number: ref,
      payment_type: 'subscription'
    }).subscribe({
      next: (res) => {
        this.paymentId = res.id;
        this.notifCount.increment();
        setTimeout(() => {
          this.apiService.autoVerifyPayment(this.paymentId, ref).subscribe({
            next: () => { this.verifiedAmount = this.selectedPlan.amount; this.verifiedRef = ref; this.paymentState = 'success'; this.loadPayments(); },
            error: () => { this.verifiedAmount = this.selectedPlan.amount; this.verifiedRef = ref; this.paymentState = 'success'; this.loadPayments(); }
          });
        }, 2500);
      },
      error: (err) => { this.paymentState = 'card_form'; this.errorMessage = err.error?.message || 'Payment failed.'; }
    });
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

  onBankTransferConfirm(): void {
    this.isSubmitting = true; this.errorMessage = '';
    this.apiService.submitPayment({
      user_id: this.authService.userId, amount: this.selectedPlan.amount,
      billing_month: this.billingMonth, payment_method: 'bank_transfer', reference_number: this.referenceNumber,
      payment_type: 'subscription'
    }).subscribe({
      next: (res) => {
        this.paymentId = res.id; this.isSubmitting = false;
        this.verifiedAmount = this.selectedPlan.amount; this.verifiedRef = this.referenceNumber;
        this.paymentState = 'success'; this.loadPayments();
        this.notifCount.increment();
      },
      error: (err) => { this.isSubmitting = false; this.errorMessage = err.error?.message || 'Failed to submit payment'; }
    });
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
  copyAccountNumber(): void { navigator.clipboard.writeText('0123456789').then(() => { this.copiedAccount = true; setTimeout(() => this.copiedAccount = false, 2000); }); }

  getStatusClass(s: string): string {
    const m: any = { pending: 'bg-amber-100 text-amber-700', verified: 'bg-emerald-100 text-emerald-700', rejected: 'bg-red-100 text-red-700' };
    return m[s] || 'bg-gray-100 text-gray-600';
  }

  switchTab(tab: 'pay' | 'history'): void { this.activeTab = tab; }
  goBack(): void {
    if (this.paymentState === 'method') this.paymentState = 'plan';
    else if (this.paymentState === 'bank_details' || this.paymentState === 'card_form') this.paymentState = 'method';
  }
  goToDashboard(): void { this.router.navigate(['/dashboard']); }
  goToPickups(): void { this.router.navigate(['/schedule-pickup']); }
  goToNotifications(): void { this.router.navigate(['/notifications']); }
  makeAnother(): void { this.paymentState = 'plan'; this.selectedPlan = null; this.errorMessage = ''; this.cardNumber = ''; this.cardExpiry = ''; this.cardCvv = ''; }
  formatDate(d: string): string { return d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : ''; }
}
