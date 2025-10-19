import { Component, OnInit } from '@angular/core';
import { ToastController } from '@ionic/angular';

@Component({
  selector: 'app-leaderboards',
  templateUrl: './leaderboards.page.html',
  styleUrls: ['./leaderboards.page.scss'],
  standalone: false
})
export class LeaderboardsPage implements OnInit {
  selectedFilter: string = 'all';
  Math = Math; // Make Math available in template

  leaderboardData = [
    {
      name: 'Maria Santos',
      avatar: 'assets/avatar.png',
      points: 2450,
      pointsChange: 120,
      rankChange: 0,
      title: 'Community Champion',
      missionsCompleted: 15,
      hoursVolunteered: 120,
      isOnline: true,
      isVerified: true,
      isCurrentUser: false,
      achievements: [
        { name: 'First Mission', icon: 'star-outline' },
        { name: 'Volunteer Hero', icon: 'shield-outline' },
        { name: 'Community Builder', icon: 'people-outline' },
        { name: 'Early Bird', icon: 'sunny-outline' }
      ]
    },
    {
      name: 'Juan Dela Cruz',
      avatar: 'assets/avatar.png',
      points: 2180,
      pointsChange: 85,
      rankChange: 1,
      title: 'Volunteer Leader',
      missionsCompleted: 12,
      hoursVolunteered: 95,
      isOnline: false,
      isVerified: true,
      isCurrentUser: false,
      achievements: [
        { name: 'Team Player', icon: 'people-outline' },
        { name: 'Consistent Helper', icon: 'checkmark-circle-outline' },
        { name: 'Weekend Warrior', icon: 'calendar-outline' }
      ]
    },
    {
      name: 'Ana Rodriguez',
      avatar: 'assets/avatar.png',
      points: 1950,
      pointsChange: -15,
      rankChange: -1,
      title: 'Dedicated Volunteer',
      missionsCompleted: 10,
      hoursVolunteered: 80,
      isOnline: true,
      isVerified: false,
      isCurrentUser: false,
      achievements: [
        { name: 'Newcomer', icon: 'leaf-outline' },
        { name: 'Quick Learner', icon: 'school-outline' }
      ]
    },
    {
      name: 'Carlos Mendoza',
      avatar: 'assets/avatar.png',
      points: 1720,
      pointsChange: 200,
      rankChange: 2,
      title: 'Rising Star',
      missionsCompleted: 8,
      hoursVolunteered: 65,
      isOnline: false,
      isVerified: false,
      isCurrentUser: true,
      achievements: [
        { name: 'First Mission', icon: 'star-outline' },
        { name: 'Social Butterfly', icon: 'chatbubbles-outline' }
      ]
    },
    {
      name: 'Sofia Garcia',
      avatar: 'assets/avatar.png',
      points: 1580,
      pointsChange: 45,
      rankChange: 0,
      title: 'Active Member',
      missionsCompleted: 7,
      hoursVolunteered: 55,
      isOnline: true,
      isVerified: true,
      isCurrentUser: false,
      achievements: [
        { name: 'First Mission', icon: 'star-outline' },
        { name: 'Helper', icon: 'hand-left-outline' }
      ]
    },
    {
      name: 'Miguel Torres',
      avatar: 'assets/avatar.png',
      points: 1420,
      pointsChange: 30,
      rankChange: 0,
      title: 'Community Member',
      missionsCompleted: 6,
      hoursVolunteered: 45,
      isOnline: false,
      isVerified: false,
      isCurrentUser: false,
      achievements: [
        { name: 'First Mission', icon: 'star-outline' }
      ]
    },
    {
      name: 'Isabella Cruz',
      avatar: 'assets/avatar.png',
      points: 1280,
      pointsChange: 75,
      rankChange: 1,
      title: 'Community Member',
      missionsCompleted: 5,
      hoursVolunteered: 40,
      isOnline: true,
      isVerified: false,
      isCurrentUser: false,
      achievements: [
        { name: 'First Mission', icon: 'star-outline' }
      ]
    },
    {
      name: 'Diego Martinez',
      avatar: 'assets/avatar.png',
      points: 1150,
      pointsChange: 0,
      rankChange: -1,
      title: 'Community Member',
      missionsCompleted: 4,
      hoursVolunteered: 35,
      isOnline: false,
      isVerified: false,
      isCurrentUser: false,
      achievements: []
    }
  ];

  currentUserRank = {
    position: 4,
    name: 'Carlos Mendoza',
    avatar: 'assets/avatar.png',
    points: 1720,
    progressToNext: 65,
    pointsToNext: 230
  };

  achievementCategories = [
    {
      name: 'Volunteer',
      icon: 'people-outline',
      count: 12,
      total: 15,
      userProgress: 8
    },
    {
      name: 'Community',
      icon: 'home-outline',
      count: 8,
      total: 10,
      userProgress: 5
    },
    {
      name: 'Special',
      icon: 'star-outline',
      count: 5,
      total: 8,
      userProgress: 2
    },
    {
      name: 'Social',
      icon: 'chatbubbles-outline',
      count: 6,
      total: 8,
      userProgress: 4
    }
  ];

  recentActivity = [
    {
      icon: 'trophy-outline',
      text: 'Earned "Community Champion" achievement',
      time: '2 hours ago',
      points: 50
    },
    {
      icon: 'calendar-outline',
      text: 'Completed "Beach Cleanup" mission',
      time: '1 day ago',
      points: 100
    },
    {
      icon: 'people-outline',
      text: 'Referred a new volunteer',
      time: '2 days ago',
      points: 25
    },
    {
      icon: 'heart-outline',
      text: 'Made a donation',
      time: '3 days ago',
      points: 30
    },
    {
      icon: 'checkmark-circle-outline',
      text: 'Completed "Food Drive" mission',
      time: '5 days ago',
      points: 80
    }
  ];

  constructor(
    private toastController: ToastController
  ) {}

  ngOnInit() {
    // Initialize any required data
  }

  onFilterChange(event: any) {
    this.selectedFilter = event.detail.value;
    this.filterLeaderboard();
  }

  filterLeaderboard() {
    // In a real app, this would filter data based on selectedFilter
    // For now, we'll just show a toast
    this.presentToast(`Showing ${this.selectedFilter} rankings`, 'primary');
  }

  scrollToUser() {
    // Scroll to current user's position in the leaderboard
    const currentUserElement = document.querySelector('.current-user');
    if (currentUserElement) {
      currentUserElement.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'center' 
      });
    }
  }

  private async presentToast(message: string, color: string = 'primary') {
    const toast = await this.toastController.create({
      message: message,
      duration: 2000,
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