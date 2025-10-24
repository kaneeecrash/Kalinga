import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { PushTestPage } from './push-test.page';

const routes: Routes = [
  {
    path: '',
    component: PushTestPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class PushTestPageRoutingModule {}