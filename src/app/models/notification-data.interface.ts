export interface NotificationData {
  title: string;
  body: string;
  missionId?: string;
  route?: string;
  data?: any;
}

export interface DeviceTokenData {
  userId: string;
  token: string;
  deviceInfo: {
    platform: string;
    model?: string;
    version?: string;
  };
  updatedAt: any; // Firestore timestamp
}
