import { Component } from '@angular/core';
import { RouterOutlet, Router, NavigationEnd } from '@angular/router';
import { SidebarComponent } from "./features/sidebar/sidebar.component";
import { CommonModule } from '@angular/common';
import { AuthService } from './services/auth.service';
import { filter } from 'rxjs';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, SidebarComponent],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent {
  title = 'swms_web_app';
  showSidebar: boolean = false;

  constructor(public authService: AuthService, private router: Router) {
    // Hide sidebar on login/register pages
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe((event: any) => {
      const url = event.urlAfterRedirects || event.url;
      const authPages = ['/login', '/register'];
      this.showSidebar = this.authService.isLoggedIn && !authPages.includes(url);
    });
  }
}
