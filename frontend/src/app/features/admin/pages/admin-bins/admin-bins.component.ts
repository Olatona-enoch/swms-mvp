import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { HeaderComponent } from '../../../header/header.component';
import { ApiService } from '../../../../services/api.service';
import { AuthService } from '../../../../services/auth.service';

@Component({ selector: 'app-admin-bins', standalone: true, imports: [CommonModule, ReactiveFormsModule, HeaderComponent], templateUrl: './admin-bins.component.html', styleUrl: './admin-bins.component.scss' })
export class AdminBinsComponent implements OnInit {
  bins: any[] = [];
  binForm!: FormGroup;
  showForm = false;
  successMessage = '';
  errorMessage = '';
  userName = ''; userInitials = '';
  qrModalBin: any = null;

  constructor(private fb: FormBuilder, private apiService: ApiService, private authService: AuthService) {}

  ngOnInit(): void {
    const u = this.authService.currentUser;
    if (u) { this.userName = u.name; this.userInitials = u.name.split(' ').map((n: string) => n[0]).join('').toUpperCase(); }
    this.binForm = this.fb.group({
      bin_code: ['', Validators.required],
      location: ['', Validators.required],
      area: ['']
    });
    this.load();
  }

  load(): void { this.apiService.getAllBins().subscribe({ next: (d) => this.bins = d }); }

  onSubmit(): void {
    if (this.binForm.valid) {
      this.apiService.createBin(this.binForm.value).subscribe({
        next: () => {
          this.successMessage = 'Bin created successfully!';
          this.binForm.reset();
          this.showForm = false;
          this.load();
          setTimeout(() => this.successMessage = '', 3000);
        },
        error: (err: any) => { this.errorMessage = err.error?.message || 'Error creating bin'; }
      });
    }
  }

  getQRUrl(binCode: string): string {
    return `http://localhost:4200/report-bin?bin=${binCode}`;
  }

  getQRImageUrl(binCode: string): string {
    return `http://localhost:3000/bins/${binCode}/qr-image?size=300`;
  }

  copyQRUrl(binCode: string): void {
    navigator.clipboard.writeText(this.getQRUrl(binCode));
    this.successMessage = 'QR link URL copied to clipboard!';
    setTimeout(() => this.successMessage = '', 3000);
  }

  openQRModal(bin: any): void {
    this.qrModalBin = bin;
  }

  closeQRModal(): void {
    this.qrModalBin = null;
  }

  downloadQR(binCode: string): void {
    const url = `http://localhost:3000/bins/${binCode}/qr-image?size=600`;
    fetch(url)
      .then(r => r.blob())
      .then(blob => {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `QR-${binCode}.png`;
        a.click();
        URL.revokeObjectURL(a.href);
      });
  }

  printQR(bin: any): void {
    const imgUrl = `http://localhost:3000/bins/${bin.bin_code}/qr-image?size=600`;
    const w = window.open('', '_blank', 'width=450,height=600');
    if (!w) return;
    w.document.write(`
      <html><head><title>QR Code - ${bin.bin_code}</title>
      <style>
        body { font-family: Arial, sans-serif; text-align: center; padding: 40px; margin: 0; }
        img { width: 280px; height: 280px; margin: 20px 0; }
        h2 { margin: 0 0 4px; font-size: 22px; }
        p { margin: 4px 0; color: #555; font-size: 14px; }
        .label { font-size: 11px; color: #999; margin-top: 16px; }
        @media print { body { padding: 20px; } }
      </style></head><body>
      <h2>${bin.bin_code}</h2>
      <p>${bin.location}</p>
      ${bin.area ? '<p>' + bin.area + '</p>' : ''}
      <img src="${imgUrl}" onload="setTimeout(function(){window.print();},300)">
      <p class="label">Scan to report this bin</p>
      </body></html>
    `);
    w.document.close();
  }
}
