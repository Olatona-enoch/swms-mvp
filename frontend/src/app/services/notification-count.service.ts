import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class NotificationCountService {
  private countSubject = new BehaviorSubject<number>(0);
  count$ = this.countSubject.asObservable();

  setCount(count: number): void {
    this.countSubject.next(count);
  }

  decrement(): void {
    const current = this.countSubject.value;
    if (current > 0) this.countSubject.next(current - 1);
  }

  clear(): void {
    this.countSubject.next(0);
  }

  increment(): void {
    this.countSubject.next(this.countSubject.value + 1);
  }
}
