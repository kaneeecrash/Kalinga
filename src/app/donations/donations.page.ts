import { Component, OnInit } from '@angular/core';
import { ToastController, AlertController, ModalController } from '@ionic/angular';

export interface Organization {
  id: string;
  name: string;
  description: string;
  avatar?: string;
  isVerified: boolean;
  rating: number;
  totalDrives: number;
}

export interface DonationDrive {
  id: string;
  title: string;
  description: string;
  category: string;
  organization: Organization;
  targetAmount: number;
  amountRaised: number;
  donorCount: number;
  startDate: Date;
  endDate: Date;
  location: string;
  beneficiaries: string;
  status: 'active' | 'completed' | 'paused';
  isUrgent: boolean;
  isFeatured: boolean;
  recentDonations?: {
    name: string;
    amount: number;
    time: string;
  }[];
}

@Component({
  selector: 'app-donations',
  templateUrl: './donations.page.html',
  styleUrls: ['./donations.page.scss'],
  standalone: false
})
export class DonationsPage implements OnInit {
  searchQuery: string = '';
  selectedCategory: string = 'all';
  selectedDrive: DonationDrive | null = null;
  isDriveModalOpen: boolean = false;
  
  // Donation form data
  selectedAmount: number = 0;
  customAmount: number = 0;
  donorName: string = '';
  donorEmail: string = '';
  donorMessage: string = '';
  
  quickAmounts = [100, 500, 1000, 2500, 5000];

  // Mock data
  donationDrives: DonationDrive[] = [
    {
      id: '1',
      title: 'Emergency Medical Fund for Typhoon Victims',
      description: 'Help provide immediate medical assistance to families affected by the recent typhoon. Your donation will go directly to medical supplies, emergency care, and rehabilitation services.',
      category: 'medical',
      organization: {
        id: 'org1',
        name: 'Philippine Red Cross',
        description: 'Humanitarian organization providing emergency assistance',
        avatar: 'assets/avatar.png',
        isVerified: true,
        rating: 4.8,
        totalDrives: 45
      },
      targetAmount: 500000,
      amountRaised: 320000,
      donorCount: 1247,
      startDate: new Date('2024-01-01'),
      endDate: new Date('2024-02-28'),
      location: 'Eastern Visayas',
      beneficiaries: '500+ families',
      status: 'active',
      isUrgent: true,
      isFeatured: true,
      recentDonations: [
        { name: 'Maria Santos', amount: 1000, time: '2 hours ago' },
        { name: 'Juan Dela Cruz', amount: 500, time: '5 hours ago' },
        { name: 'Anonymous', amount: 2500, time: '1 day ago' }
      ]
    },
    {
      id: '2',
      title: 'School Supplies for Remote Communities',
      description: 'Support education in remote areas by providing essential school supplies, books, and learning materials to children who lack access to basic educational resources.',
      category: 'education',
      organization: {
        id: 'org2',
        name: 'Education First Foundation',
        description: 'Promoting quality education for all Filipino children',
        avatar: 'assets/avatar.png',
        isVerified: true,
        rating: 4.6,
        totalDrives: 23
      },
      targetAmount: 200000,
      amountRaised: 150000,
      donorCount: 89,
      startDate: new Date('2024-01-15'),
      endDate: new Date('2024-03-15'),
      location: 'Mindanao',
      beneficiaries: '300+ students',
      status: 'active',
      isUrgent: false,
      isFeatured: false,
      recentDonations: [
        { name: 'Ana Rodriguez', amount: 750, time: '1 day ago' },
        { name: 'Carlos Mendoza', amount: 1200, time: '2 days ago' }
      ]
    },
    {
      id: '3',
      title: 'Disaster Relief for Earthquake Victims',
      description: 'Provide immediate relief assistance including food, water, shelter, and emergency supplies to families affected by the recent earthquake in Northern Luzon.',
      category: 'disaster',
      organization: {
        id: 'org3',
        name: 'Disaster Response Philippines',
        description: 'Rapid response organization for natural disasters',
        avatar: 'assets/avatar.png',
        isVerified: true,
        rating: 4.9,
        totalDrives: 67
      },
      targetAmount: 1000000,
      amountRaised: 750000,
      donorCount: 2103,
      startDate: new Date('2024-01-10'),
      endDate: new Date('2024-02-10'),
      location: 'Northern Luzon',
      beneficiaries: '1000+ families',
      status: 'active',
      isUrgent: true,
      isFeatured: true,
      recentDonations: [
        { name: 'Sofia Garcia', amount: 1500, time: '3 hours ago' },
        { name: 'Miguel Torres', amount: 800, time: '6 hours ago' },
        { name: 'Anonymous', amount: 5000, time: '1 day ago' }
      ]
    },
    {
      id: '4',
      title: 'Community Health Center Renovation',
      description: 'Help renovate and equip a community health center to provide better healthcare services to underserved communities in rural areas.',
      category: 'medical',
      organization: {
        id: 'org4',
        name: 'Community Health Alliance',
        description: 'Improving healthcare access in rural communities',
        avatar: 'assets/avatar.png',
        isVerified: true,
        rating: 4.7,
        totalDrives: 34
      },
      targetAmount: 300000,
      amountRaised: 180000,
      donorCount: 156,
      startDate: new Date('2024-01-20'),
      endDate: new Date('2024-04-20'),
      location: 'Central Visayas',
      beneficiaries: '2000+ residents',
      status: 'active',
      isUrgent: false,
      isFeatured: false,
      recentDonations: [
        { name: 'Isabella Cruz', amount: 2000, time: '4 hours ago' },
        { name: 'Diego Martinez', amount: 600, time: '1 day ago' }
      ]
    },
    {
      id: '5',
      title: 'Youth Skills Development Program',
      description: 'Support a comprehensive skills development program for out-of-school youth, providing vocational training and job placement assistance.',
      category: 'education',
      organization: {
        id: 'org5',
        name: 'Youth Empowerment Network',
        description: 'Empowering young people through education and skills',
        avatar: 'assets/avatar.png',
        isVerified: true,
        rating: 4.5,
        totalDrives: 18
      },
      targetAmount: 150000,
      amountRaised: 95000,
      donorCount: 67,
      startDate: new Date('2024-02-01'),
      endDate: new Date('2024-05-01'),
      location: 'Metro Manila',
      beneficiaries: '150+ youth',
      status: 'active',
      isUrgent: false,
      isFeatured: false,
      recentDonations: [
        { name: 'Elena Ramos', amount: 300, time: '2 days ago' },
        { name: 'Roberto Silva', amount: 1200, time: '3 days ago' }
      ]
    }
  ];

  filteredDrives: DonationDrive[] = [];
  totalLivesImpacted: number = 0;
  totalRaised: number = 0;
  totalDonors: number = 0;

  constructor(
    private toastController: ToastController,
    private alertController: AlertController,
    private modalController: ModalController
  ) {}

  ngOnInit() {
    this.filteredDrives = [...this.donationDrives];
    this.calculateStats();
  }

  onSearchChange(event: any) {
    this.searchQuery = event.target.value.toLowerCase();
    this.applyFilters();
  }

  onCategoryChange(event: any) {
    this.selectedCategory = event.detail.value;
    this.applyFilters();
  }

  applyFilters() {
    this.filteredDrives = this.donationDrives.filter(drive => {
      const matchesSearch = drive.title.toLowerCase().includes(this.searchQuery) ||
                           drive.description.toLowerCase().includes(this.searchQuery) ||
                           drive.organization.name.toLowerCase().includes(this.searchQuery);
      
      const matchesCategory = this.selectedCategory === 'all' || 
                             drive.category === this.selectedCategory ||
                             (this.selectedCategory === 'urgent' && drive.isUrgent);
      
      return matchesSearch && matchesCategory;
    });
  }

  clearFilters() {
    this.searchQuery = '';
    this.selectedCategory = 'all';
    this.filteredDrives = [...this.donationDrives];
  }

  calculateStats() {
    this.totalRaised = this.donationDrives.reduce((sum, drive) => sum + drive.amountRaised, 0);
    this.totalDonors = this.donationDrives.reduce((sum, drive) => sum + drive.donorCount, 0);
    this.totalLivesImpacted = Math.floor(this.totalRaised / 50); // Rough estimate
  }

  getProgressPercentage(drive: DonationDrive): number {
    return Math.min(Math.round((drive.amountRaised / drive.targetAmount) * 100), 100);
  }

  getTimeRemaining(endDate: Date): string {
    const now = new Date();
    const end = new Date(endDate);
    const diffTime = end.getTime() - now.getTime();
    
    if (diffTime <= 0) return 'Ended';
    
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 1) return '1 day';
    if (diffDays < 7) return `${diffDays} days`;
    if (diffDays < 30) return `${Math.ceil(diffDays / 7)} weeks`;
    return `${Math.ceil(diffDays / 30)} months`;
  }

  viewDriveDetails(drive: DonationDrive) {
    this.selectedDrive = drive;
    this.isDriveModalOpen = true;
  }

  closeDriveModal() {
    this.isDriveModalOpen = false;
    this.selectedDrive = null;
    this.resetDonationForm();
  }

  donateToDrive(drive: DonationDrive, event: Event) {
    event.stopPropagation();
    this.selectedDrive = drive;
    this.isDriveModalOpen = true;
  }

  shareDrive(drive: DonationDrive, event: Event) {
    event.stopPropagation();
    const shareData = {
      title: drive.title,
      text: `${drive.description.substring(0, 100)}...`,
      url: window.location.href
    };

    if (navigator.share) {
      navigator.share(shareData).catch(err => {
        console.log('Error sharing:', err);
        this.presentToast('Sharing not supported on this device', 'warning');
      });
    } else {
      navigator.clipboard.writeText(`${shareData.text} ${shareData.url}`).then(() => {
        this.presentToast('Link copied to clipboard!', 'success');
      }).catch(() => {
        this.presentToast('Unable to share at this time', 'warning');
      });
    }
  }

  selectAmount(amount: number) {
    this.selectedAmount = amount;
    this.customAmount = 0;
  }

  onCustomAmountChange(event: any) {
    const value = parseFloat(event.target.value);
    if (!isNaN(value) && value > 0) {
      this.customAmount = value;
      this.selectedAmount = value;
    }
  }

  canDonate(): boolean {
    return this.selectedAmount > 0 && 
           this.donorName.trim() !== '' && 
           this.donorEmail.trim() !== '';
  }

  async processDonation() {
    if (!this.canDonate() || !this.selectedDrive) {
      await this.presentToast('Please fill in all required fields', 'warning');
      return;
    }

    const alert = await this.alertController.create({
      header: 'Confirm Donation',
      message: `Are you sure you want to donate ₱${this.selectedAmount.toLocaleString()} to "${this.selectedDrive.title}"?`,
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel'
        },
        {
          text: 'Confirm',
          handler: () => {
            this.executeDonation();
          }
        }
      ]
    });

    await alert.present();
  }

  async executeDonation() {
    const loadingToast = await this.toastController.create({
      message: 'Processing your donation...',
      duration: 2000,
      position: 'middle'
    });
    await loadingToast.present();

    // Simulate API call delay
    setTimeout(async () => {
      if (this.selectedDrive) {
        // Update drive data
        this.selectedDrive.amountRaised += this.selectedAmount;
        this.selectedDrive.donorCount += 1;
        
        // Add to recent donations
        if (!this.selectedDrive.recentDonations) {
          this.selectedDrive.recentDonations = [];
        }
        this.selectedDrive.recentDonations.unshift({
          name: this.donorName,
          amount: this.selectedAmount,
          time: 'Just now'
        });
        
        // Keep only last 5 donations
        if (this.selectedDrive.recentDonations.length > 5) {
          this.selectedDrive.recentDonations = this.selectedDrive.recentDonations.slice(0, 5);
        }
        
        // Update stats
        this.calculateStats();
      }
      
      await this.presentToast('Thank you for your generous donation!', 'success');
      this.closeDriveModal();
    }, 2000);
  }

  resetDonationForm() {
    this.selectedAmount = 0;
    this.customAmount = 0;
    this.donorName = '';
    this.donorEmail = '';
    this.donorMessage = '';
  }

  private async presentToast(message: string, color: string = 'primary') {
    const toast = await this.toastController.create({
      message: message,
      duration: 3000,
      position: 'top',
      color: color,
      buttons: [
        {
          text: 'Close',
          role: 'cancel'
        }
      ]
    });
    await toast.present();
  }
}