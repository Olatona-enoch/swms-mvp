import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HeaderComponent } from '../../../header/header.component';
import { ApiService } from '../../../../services/api.service';
import { AuthService } from '../../../../services/auth.service';

@Component({
  selector: 'app-admin-users',
  standalone: true,
  imports: [CommonModule, FormsModule, HeaderComponent],
  templateUrl: './admin-users.component.html',
  styleUrl: './admin-users.component.scss'
})
export class AdminUsersComponent implements OnInit {
  allUsers: any[] = [];
  filteredUsers: any[] = [];
  pagedUsers: any[] = [];
  userName = '';
  userInitials = '';
  searchQuery = '';
  filterStatus = 'all';
  currentPage = 1;
  pageSize = 10;
  totalPages = 1;
  selectedUser: any = null;
  showViewModal = false;
  isLoading = false;
  actionLoadingId: number | null = null;

  constructor(private apiService: ApiService, private authService: AuthService) {}

  ngOnInit(): void {
    const u = this.authService.currentUser;
    if (u) {
      this.userName = u.name;
      this.userInitials = u.name.split(' ').map((n: string) => n[0]).join('').toUpperCase();
    }
    this.load();
  }

  load(): void {
    this.isLoading = true;
    this.apiService.getAllUsers().subscribe({
      next: (data) => {
        this.allUsers = data.filter((u: any) => u.role !== 'admin');
        this.applyFilters();
        this.isLoading = false;
      },
      error: () => { this.isLoading = false; }
    });
  }

  applyFilters(): void {
    let result = [...this.allUsers];
    if (this.searchQuery.trim()) {
      const q = this.searchQuery.toLowerCase();
      result = result.filter(u =>
        u.name?.toLowerCase().includes(q) ||
        u.email?.toLowerCase().includes(q) ||
        this.formatUserId(u.id).toLowerCase().includes(q)
      );
    }
    if (this.filterStatus === 'active') result = result.filter(u => !u.is_suspended);
    else if (this.filterStatus === 'suspended') result = result.filter(u => u.is_suspended);
    this.filteredUsers = result;
    this.currentPage = 1;
    this.updatePagination();
  }

  updatePagination(): void {
    this.totalPages = Math.max(1, Math.ceil(this.filteredUsers.length / this.pageSize));
    this.currentPage = Math.min(this.currentPage, this.totalPages);
    const start = (this.currentPage - 1) * this.pageSize;
    this.pagedUsers = this.filteredUsers.slice(start, start + this.pageSize);
  }

  goToPage(page: number): void {
    if (page < 1 || page > this.totalPages) return;
    this.currentPage = page;
    this.updatePagination();
  }

  getPageNumbers(): number[] {
    const pages: number[] = [];
    const total = this.totalPages;
    if (total <= 5) {
      for (let i = 1; i <= total; i++) pages.push(i);
    } else {
      pages.push(1);
      if (this.currentPage > 3) pages.push(-1);
      const start = Math.max(2, this.currentPage - 1);
      const end = Math.min(total - 1, this.currentPage + 1);
      for (let i = start; i <= end; i++) pages.push(i);
      if (this.currentPage < total - 2) pages.push(-1);
      pages.push(total);
    }
    return pages;
  }

  onSearchChange(): void { this.applyFilters(); }
  onFilterChange(status: string): void { this.filterStatus = status; this.applyFilters(); }
  viewUser(user: any): void { this.selectedUser = user; this.showViewModal = true; }
  closeModal(): void { this.showViewModal = false; this.selectedUser = null; }

  suspendUser(user: any): void {
    if (!confirm(`Suspend ${user.name}? They will lose access to the app.`)) return;
    this.actionLoadingId = user.id;
    this.apiService.suspendUser(user.id).subscribe({
      next: () => { this.actionLoadingId = null; this.load(); },
      error: () => { this.actionLoadingId = null; }
    });
  }

  activateUser(user: any): void {
    this.actionLoadingId = user.id;
    this.apiService.activateUser(user.id).subscribe({
      next: () => { this.actionLoadingId = null; this.load(); },
      error: () => { this.actionLoadingId = null; }
    });
  }

  get totalUsers(): number { return this.allUsers.length; }
  get activeUsers(): number { return this.allUsers.filter(u => !u.is_suspended).length; }
  get suspendedUsers(): number { return this.allUsers.filter(u => u.is_suspended).length; }
  get showingStart(): number { return this.filteredUsers.length === 0 ? 0 : (this.currentPage - 1) * this.pageSize + 1; }
  get showingEnd(): number { return Math.min(this.currentPage * this.pageSize, this.filteredUsers.length); }

  formatUserId(id: number): string { return `USR-${String(id).padStart(4, '0')}`; }
  getInitials(name: string): string {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
  }
  formatDate(dateStr: string): string {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }
}