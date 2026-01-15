/**
 * Certificate Generation Utility
 * Generates PDF certificates for VOS Academy certifications
 */
export interface CertificateData {
    userName: string;
    pillarTitle: string;
    vosRole: string;
    tier: 'bronze' | 'silver' | 'gold';
    score: number;
    awardedAt: Date;
    certificateId: string;
}
export declare function generateCertificatePDF(data: CertificateData): Promise<Blob>;
export declare function generateCertificateId(): string;
