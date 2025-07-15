import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DonationsPage } from './donations.page';

describe('DonationsPage', () => {
  let component: DonationsPage;
  let fixture: ComponentFixture<DonationsPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(DonationsPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
