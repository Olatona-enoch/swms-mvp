import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HeaderComponent } from '../../../header/header.component';
import { ApiService } from '../../../../services/api.service';
import { AuthService } from '../../../../services/auth.service';

@Component({
  selector: 'app-admin-pickups',
  standalone: true,
  imports: [CommonModule, FormsModule, HeaderComponent],
  templateUrl: './admin-pickups.component.html',
  styleUrl: './admin-pickups.component.scss'
})
export class AdminPickupsComponent implements OnInit {
  pickups: any[] = [];
  userName = ''; userInitials = '';

  constructor(private apiService: ApiService, private authService: AuthService) {}

  ngOnInit(): void {
    const u = this.authService.currentUser;
    if (u) { this.userName = u.name; this.userInitials = u.name.split(' ').map(n => n[0]).join('').toUpperCase(); }
    this.load();
  }

  load(): void {
    this.apiService.getAllPickups().subscribe({ next: (d) => this.pickups = d });
  }

  assignTruck(pickup: any): void {
    const truck = prompt('Enter truck ID (e.g., TRK-01):');
    if (truck) {
      this.apiService.assignTruck(pickup.id, truck).subscribe({ next: () => this.load() });
    }
  }

  updateStatus(id: number, status: string): void {
    this.apiService.updatePickupStatus(id, status).subscribe({ next: () => this.load() });
  }

  getStatusClass(status: string): string {
    const c: any = { scheduled: 'bg-amber-100 text-amber-600', assigned: 'bg-blue-100 text-blue-600', completed: 'bg-emerald-100 text-emerald-600', cancelled: 'bg-red-100 text-red-600' };
    return c[status] || 'bg-gray-100 text-gray-600';
  }
}
