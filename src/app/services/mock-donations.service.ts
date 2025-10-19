import { Injectable } from '@angular/core';
import { Observable, of, delay } from 'rxjs';

export interface DonationStats {
  livesImpacted: number;
  totalRaised: number;
  activeDonors: number;
}

export interface RecentDonation {
  id: string;
  name: string;
  amount: number;
  time: string;
  purpose: string;
  avatar?: string;
  isAnonymous?: boolean;
}

export interface DonationPurpose {
  id: string;
  name: string;
  description: string;
  icon: string;
}

export interface PaymentMethod {
  id: string;
  name: string;
  description: string;
  icon: string;
  isAvailable: boolean;
}

export interface DonationData {
  amount: number;
  method: string;
  purpose: string;
  donorName: string;
  donorEmail: string;
  donorMessage?: string;
}

@Injectable({
  providedIn: 'root'
})
export class MockDonationsService {
  
  private donationStats: DonationStats = {
    livesImpacted: 1247,
    totalRaised: 45230,
    activeDonors: 89
  };

  private recentDonations: RecentDonation[] = [
    {
      id: '1',
      name: 'Maria Santos',
      amount: 1000,
      time: '2 hours ago',
      purpose: 'Medical',
      avatar: 'assets/avatar.png'
    },
    {
      id: '2',
      name: 'Juan Dela Cruz',
      amount: 500,
      time: '5 hours ago',
      purpose: 'Education',
      avatar: 'assets/avatar.png'
    },
    {
      id: '3',
      name: 'Anonymous',
      amount: 2500,
      time: '1 day ago',
      purpose: 'Disaster',
      isAnonymous: true
    },
    {
      id: '4',
      name: 'Carlos Mendoza',
      amount: 750,
      time: '2 days ago',
      purpose: 'Community',
      avatar: 'assets/avatar.png'
    },
    {
      id: '5',
      name: 'Sofia Garcia',
      amount: 1500,
      time: '3 days ago',
      purpose: 'General',
      avatar: 'assets/avatar.png'
    },
    {
      id: '6',
      name: 'Ana Rodriguez',
      amount: 300,
      time: '4 days ago',
      purpose: 'Medical',
      avatar: 'assets/avatar.png'
    },
    {
      id: '7',
      name: 'Miguel Torres',
      amount: 2000,
      time: '5 days ago',
      purpose: 'Education',
      avatar: 'assets/avatar.png'
    },
    {
      id: '8',
      name: 'Isabella Cruz',
      amount: 800,
      time: '1 week ago',
      purpose: 'Community',
      avatar: 'assets/avatar.png'
    }
  ];

  private donationPurposes: DonationPurpose[] = [
    {
      id: 'general',
      name: 'General Fund',
      description: 'Support our overall mission and operations',
      icon: 'heart-outline'
    },
    {
      id: 'medical',
      name: 'Medical Missions',
      description: 'Fund healthcare services for underserved communities',
      icon: 'medical-outline'
    },
    {
      id: 'education',
      name: 'Education Programs',
      description: 'Support learning and development initiatives',
      icon: 'school-outline'
    },
    {
      id: 'disaster',
      name: 'Disaster Relief',
      description: 'Emergency response and recovery efforts',
      icon: 'warning-outline'
    },
    {
      id: 'community',
      name: 'Community Development',
      description: 'Local infrastructure and social programs',
      icon: 'home-outline'
    }
  ];

  private paymentMethods: PaymentMethod[] = [
    {
      id: 'gcash',
      name: 'GCash',
      description: 'Pay with your mobile wallet',
      icon: 'phone-portrait-outline',
      isAvailable: true
    },
    {
      id: 'paymaya',
      name: 'PayMaya',
      description: 'Digital wallet payment',
      icon: 'card-outline',
      isAvailable: true
    },
    {
      id: 'bank',
      name: 'Bank Transfer',
      description: 'Direct bank deposit',
      icon: 'business-outline',
      isAvailable: true
    },
    {
      id: 'grabpay',
      name: 'GrabPay',
      description: 'Pay using GrabPay wallet',
      icon: 'car-outline',
      isAvailable: false
    }
  ];

  constructor() {}

  // Get donation statistics
  getDonationStats(): Observable<DonationStats> {
    return of(this.donationStats).pipe(delay(500));
  }

  // Get recent donations
  getRecentDonations(limit: number = 10): Observable<RecentDonation[]> {
    const limitedDonations = this.recentDonations.slice(0, limit);
    return of(limitedDonations).pipe(delay(300));
  }

  // Get donation purposes
  getDonationPurposes(): Observable<DonationPurpose[]> {
    return of(this.donationPurposes).pipe(delay(200));
  }

  // Get payment methods
  getPaymentMethods(): Observable<PaymentMethod[]> {
    return of(this.paymentMethods).pipe(delay(200));
  }

  // Process donation
  processDonation(donationData: DonationData): Observable<{ success: boolean; transactionId: string; message: string }> {
    // Simulate API call delay
    return of({
      success: true,
      transactionId: `TXN-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      message: 'Donation processed successfully!'
    }).pipe(delay(2000));
  }

  // Add new donation to recent list
  addRecentDonation(donation: RecentDonation): void {
    this.recentDonations.unshift(donation);
    // Keep only last 20 donations
    if (this.recentDonations.length > 20) {
      this.recentDonations = this.recentDonations.slice(0, 20);
    }
  }

  // Update donation stats
  updateDonationStats(amount: number): void {
    this.donationStats.totalRaised += amount;
    this.donationStats.activeDonors += 1;
    this.donationStats.livesImpacted += Math.floor(amount / 50); // Rough estimate
  }

  // Get donation analytics
  getDonationAnalytics(): Observable<{
    totalDonations: number;
    averageDonation: number;
    topPurpose: string;
    monthlyGrowth: number;
  }> {
    const analytics = {
      totalDonations: this.recentDonations.length,
      averageDonation: Math.round(this.recentDonations.reduce((sum, d) => sum + d.amount, 0) / this.recentDonations.length),
      topPurpose: 'Medical',
      monthlyGrowth: 15.5
    };
    return of(analytics).pipe(delay(800));
  }

  // Get donation trends
  getDonationTrends(): Observable<{
    daily: { date: string; amount: number }[];
    weekly: { week: string; amount: number }[];
    monthly: { month: string; amount: number }[];
  }> {
    const trends = {
      daily: [
        { date: '2024-01-15', amount: 2500 },
        { date: '2024-01-16', amount: 1800 },
        { date: '2024-01-17', amount: 3200 },
        { date: '2024-01-18', amount: 2100 },
        { date: '2024-01-19', amount: 2800 },
        { date: '2024-01-20', amount: 1900 },
        { date: '2024-01-21', amount: 2400 }
      ],
      weekly: [
        { week: 'Week 1', amount: 12000 },
        { week: 'Week 2', amount: 15000 },
        { week: 'Week 3', amount: 18000 },
        { week: 'Week 4', amount: 20000 }
      ],
      monthly: [
        { month: 'Oct 2023', amount: 45000 },
        { month: 'Nov 2023', amount: 52000 },
        { month: 'Dec 2023', amount: 68000 },
        { month: 'Jan 2024', amount: 45000 }
      ]
    };
    return of(trends).pipe(delay(1000));
  }
}
