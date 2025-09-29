import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { RouterModule, Routes } from '@angular/router';
import { EmergencyPage } from './emergency.page';

const routes: Routes = [
  { path: '', component: EmergencyPage }
];

@NgModule({
  declarations: [EmergencyPage],
  imports: [CommonModule, FormsModule, IonicModule, RouterModule.forChild(routes)],
})
export class EmergencyPageModule {}


