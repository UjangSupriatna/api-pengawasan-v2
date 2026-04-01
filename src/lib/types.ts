export interface PengawasanRecord {
  id: string;
  timestamp: string;
  userId: string;
  userName: string;
  prediction: string;
  reason: string | null;
  imageUrl: string | null;
}
