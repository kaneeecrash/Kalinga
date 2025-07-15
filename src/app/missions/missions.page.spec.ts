import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MissionsPage } from './missions.page';

describe('MissionsPage', () => {
  let component: MissionsPage;
  let fixture: ComponentFixture<MissionsPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(MissionsPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
