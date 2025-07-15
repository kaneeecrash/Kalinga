import { Component } from '@angular/core';
import { NavController } from '@ionic/angular';
import { Router } from '@angular/router';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
  standalone: false,
})
export class AppComponent {
  constructor(
    private nav: NavController,
    private router: Router
  ) {}

  isActive(url: string): boolean {
    return this.router.url === url;
  }
  isLoginPage(): boolean {
    return this.router.url === '/login' || this.router.url === '/register';
  }
}



