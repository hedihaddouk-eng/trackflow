
export type Role = 'supervisor' | 'operator' | 'engineering';

export interface Order {
  id: string;
  of: string;
  refProduct: string;
  quantityToProduce: number;
  numberOfLabels: number;
  scanRequired: boolean;
  status: 'pending' | 'in_progress' | 'completed' | 'deleted';
  createdAt: number;
  completedAt?: number;
  operatorId?: string;
  destination?: string;
  lotNumber?: string;
  standardBoxSize?: number;
  numberOfBoxes?: number;
  snStart?: number;
  snEnd?: number;
}

export interface Scan {
  id: string;
  orderId: string;
  labelIndex?: number;
  serialNumber: string;
  scannedAt: number;
  operatorId: string;
}

export interface OperatorAccount {
  login: string;
  password: string;
}

export interface Settings {
  snRangeStart: number;
  snRangeEnd: number;
  zebraTemplate: string;
  unitZebraTemplate: string;
  supervisorPassword: string;
  operatorPassword: string;
  engineeringPassword: string;
  defaultLotPrefix?: string;
  operatorAccounts?: OperatorAccount[];
  logoUrl?: string;
  senderName?: string;
  senderAddress?: string;
  senderCity?: string;
  senderCountry?: string;
  senderPhone?: string;
  recipientName?: string;
  recipientAddress?: string;
  recipientCity?: string;
  recipientCountry?: string;
  recipientPhone?: string;
  defaultRecipientName?: string;
  defaultRecipientAddress?: string;
}

export interface User {
  id: string;
  role: Role;
  name: string;
}

export interface Report {
  id?: string;
  orderId?: string;
  orderOf: string;
  refProduct: string;
  qtyRequested: number;
  qtyScanned: number;
  startTime: number;
  endTime: number;
  operatorName: string;
  destination: string;
  lotNumber: string;
  scans: string[];
}
