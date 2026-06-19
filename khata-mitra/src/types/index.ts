export type UserRole = 'retailer' | 'customer';
export type Language = 'en' | 'hi';

export interface UserProfile {
  id: string;
  role: UserRole;
  fullName: string;
  phone: string;
  shopName?: string;
}
