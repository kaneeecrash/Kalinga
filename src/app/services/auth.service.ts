import { Injectable} from '@angular/core';
import { Auth, createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile, signOut, User } from '@angular/fire/auth';
import { from, Observable, of } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class AuthService {
  constructor(
    private auth: Auth,
  
  ) {}

  register(email: string, password: string, displayName: string, userName: string) {
    return from(
      createUserWithEmailAndPassword(this.auth, email, password)
        .then(({ user }) => {
          if (user) {
            return updateProfile(user, { displayName }).then(() => {
              // Pass the user object with the new displayName set
              return { ...user, displayName, userName };
            });
          }
          throw new Error('No user');
        })
    );
  }

  login(email: string, password: string) {
    return from(signInWithEmailAndPassword(this.auth, email, password));
  }

  logout() {
    return from(signOut(this.auth));
  }

  getCurrentUser(): Observable<User | null> {
    return of(this.auth.currentUser);
  }
}
