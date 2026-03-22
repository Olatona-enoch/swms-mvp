import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { BehaviorSubject, Observable, tap } from 'rxjs';

export interface User {
  id: number;
  name: string;
  email: string;
  role: string;
  phone?: string;
  address?: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private apiUrl = 'http://localhost:3000';
  private currentUserSubject = new BehaviorSubject<User | null>(null);
  currentUser$ = this.currentUserSubject.asObservable();
  private isBrowser: boolean;

  constructor(
    private http: HttpClient,
    private router: Router,
    @Inject(PLATFORM_ID) platformId: Object
  ) {
    this.isBrowser = isPlatformBrowser(platformId);
    if (this.isBrowser) {
      const stored = localStorage.getItem('swms_user');
      if (stored) {
        try {
          const user = JSON.parse(stored);
          this.currentUserSubject.next(user);
          // Verify session is still valid against the database
          this.http.get<any>(`${this.apiUrl}/verify-session?user_id=${user.id}`).subscribe({
            next: (res) => {
              if (!res.valid) {
                this.forceLogout();
              }
            },
            error: () => {
              // Server unreachable or session invalid — clear stale data
              this.forceLogout();
            }
          });
        } catch {
          localStorage.removeItem('swms_user');
        }
      }
    }
  }

  private forceLogout(): void {
    if (this.isBrowser) localStorage.removeItem('swms_user');
    this.currentUserSubject.next(null);
    this.router.navigate(['/login']);
  }

  register(data: { name: string; email: string; password: string; phone?: string; address?: string }): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/register`, data).pipe(
      tap(response => {
        if (response.user) {
          if (this.isBrowser) localStorage.setItem('swms_user', JSON.stringify(response.user));
          this.currentUserSubject.next(response.user);
        }
      })
    );
  }

  login(email: string, password: string): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/login`, { email, password }).pipe(
      tap(response => {
        if (response.user) {
          if (this.isBrowser) localStorage.setItem('swms_user', JSON.stringify(response.user));
          this.currentUserSubject.next(response.user);
        }
      })
    );
  }

  logout(): void {
    if (this.isBrowser) localStorage.removeItem('swms_user');
    this.currentUserSubject.next(null);
    this.router.navigate(['/login']);
  }

  updateStoredUser(user: User): void {
    if (this.isBrowser) localStorage.setItem('swms_user', JSON.stringify(user));
    this.currentUserSubject.next(user);
  }

  updateProfile(userId: number, data: any): Observable<any> {
    return this.http.patch(`${this.apiUrl}/user/${userId}`, data);
  }

  changePassword(userId: number, currentPassword: string, newPassword: string): Observable<any> {
    return this.http.patch(`${this.apiUrl}/user/${userId}/password`, { currentPassword, newPassword });
  }

  get currentUser(): User | null {
    return this.currentUserSubject.value;
  }

  get isLoggedIn(): boolean {
    return !!this.currentUser;
  }

  get isAdmin(): boolean {
    return this.currentUser?.role === 'admin';
  }

  get userId(): number {
    return this.currentUser?.id || 0;
  }
}
