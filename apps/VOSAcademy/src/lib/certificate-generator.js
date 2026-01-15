/**
 * Certificate Generation Utility
 * Generates PDF certificates for VOS Academy certifications
 */
import jsPDF from 'jspdf';
export function generateCertificatePDF(data) {
    return new Promise(function (resolve) {
        var pdf = new jsPDF({
            orientation: 'landscape',
            unit: 'mm',
            format: 'a4'
        });
        var width = pdf.internal.pageSize.getWidth();
        var height = pdf.internal.pageSize.getHeight();
        // Background gradient
        var gradientColors = {
            bronze: ['#CD7F32', '#8B4513'],
            silver: ['#C0C0C0', '#808080'],
            gold: ['#FFD700', '#FFA500']
        };
        var colors = gradientColors[data.tier];
        // Header background
        pdf.setFillColor(colors[0]);
        pdf.rect(0, 0, width, 40, 'F');
        // Main content background
        pdf.setFillColor(255, 255, 255);
        pdf.rect(0, 40, width, height - 80, 'F');
        // Footer background
        pdf.setFillColor(colors[1]);
        pdf.rect(0, height - 20, width, 20, 'F');
        // Title
        pdf.setFontSize(32);
        pdf.setTextColor(255, 255, 255);
        pdf.setFont('helvetica', 'bold');
        pdf.text('VOS Academy', width / 2, 25, { align: 'center' });
        // Subtitle
        pdf.setFontSize(18);
        pdf.setTextColor(255, 255, 255);
        pdf.text('Certificate of Achievement', width / 2, 35, { align: 'center' });
        // Main content
        pdf.setTextColor(0, 0, 0);
        pdf.setFont('helvetica', 'normal');
        // Awarded to
        pdf.setFontSize(16);
        pdf.text('This is to certify that', width / 2, 70, { align: 'center' });
        // Name
        pdf.setFontSize(24);
        pdf.setFont('helvetica', 'bold');
        pdf.text(data.userName, width / 2, 85, { align: 'center' });
        // Achievement text
        pdf.setFontSize(14);
        pdf.setFont('helvetica', 'normal');
        var achievementText = "has successfully completed the ".concat(data.pillarTitle, " training and demonstrated proficiency in applying Value Operating System methodologies as a ").concat(data.vosRole, ".");
        var lines = pdf.splitTextToSize(achievementText, width - 40);
        pdf.text(lines, width / 2, 105, { align: 'center' });
        // Tier badge
        pdf.setFontSize(18);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor.apply(pdf, getTierColor(data.tier));
        pdf.text("".concat(data.tier.charAt(0).toUpperCase() + data.tier.slice(1), " Tier Certification"), width / 2, 130, { align: 'center' });
        // Score
        pdf.setFontSize(12);
        pdf.setTextColor(100, 100, 100);
        pdf.text("Certification Score: ".concat(data.score, "/100"), width / 2, 145, { align: 'center' });
        // Date
        pdf.setFontSize(12);
        pdf.text("Awarded on ".concat(data.awardedAt.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        })), width / 2, 160, { align: 'center' });
        // Certificate ID
        pdf.setFontSize(10);
        pdf.setTextColor(150, 150, 150);
        pdf.text("Certificate ID: ".concat(data.certificateId), 20, height - 30);
        // Footer
        pdf.setFontSize(12);
        pdf.setTextColor(255, 255, 255);
        pdf.setFont('helvetica', 'bold');
        pdf.text('VOS Academy - Mastering Value Operating System', width / 2, height - 8, { align: 'center' });
        // Convert to blob
        var pdfBlob = pdf.output('blob');
        resolve(pdfBlob);
    });
}
function getTierColor(tier) {
    switch (tier) {
        case 'bronze':
            return [205, 127, 50]; // #CD7F32
        case 'silver':
            return [192, 192, 192]; // #C0C0C0
        case 'gold':
            return [255, 215, 0]; // #FFD700
        default:
            return [0, 0, 0];
    }
}
export function generateCertificateId() {
    var timestamp = Date.now().toString(36);
    var random = Math.random().toString(36).substr(2, 5);
    return "VOS-".concat(timestamp, "-").concat(random).toUpperCase();
}
