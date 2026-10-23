// Helper function to convert number to words (Indian Rupee System)
function numberToWords(num) {
    if (!num || isNaN(num) || num === 0) return 'Zero Only';
    const a = ['', 'One ', 'Two ', 'Three ', 'Four ', 'Five ', 'Six ', 'Seven ', 'Eight ', 'Nine ', 'Ten ', 'Eleven ', 'Twelve ', 'Thirteen ', 'Fourteen ', 'Fifteen ', 'Sixteen ', 'Seventeen ', 'Eighteen ', 'Nineteen '];
    const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

    const intNum = Math.floor(Math.abs(num));
    if (intNum.toString().length > 9) return 'Amount Too Large';
    const n = ('000000000' + intNum).substr(-9).match(/^(\d{2})(\d{2})(\d{2})(\d{1})(\d{2})$/);
    if (!n) return '';
    let str = '';
    str += (n[1] != 0) ? (a[Number(n[1])] || b[n[1][0]] + ' ' + a[n[1][1]]) + 'Crore ' : '';
    str += (n[2] != 0) ? (a[Number(n[2])] || b[n[2][0]] + ' ' + a[n[2][1]]) + 'Lakh ' : '';
    str += (n[3] != 0) ? (a[Number(n[3])] || b[n[3][0]] + ' ' + a[n[3][1]]) + 'Thousand ' : '';
    str += (n[4] != 0) ? (a[Number(n[4])] || b[n[4][0]] + ' ' + a[n[4][1]]) + 'Hundred ' : '';
    str += (n[5] != 0) ? ((str != '') ? 'and ' : '') + (a[Number(n[5])] || b[n[5][0]] + ' ' + a[n[5][1]]) : '';
    return str.trim() + ' Only';
}

function buildQuotationHTML(quotation, settings = {}) {
    let headerImageBase64 = '';
    let signatureImageBase64 = '';
    try {
        const path = require('path');
        const fs = require('fs');
        let headerPath = path.join(__dirname, '../public/image.png');
        if (!fs.existsSync(headerPath)) {
            headerPath = path.join(__dirname, '../uploads/image.png');
        }
        if (!fs.existsSync(headerPath)) {
            headerPath = path.join(__dirname, '../public/quotation_header.png');
        }
        if (fs.existsSync(headerPath)) {
            headerImageBase64 = `data:image/png;base64,${fs.readFileSync(headerPath).toString('base64')}`;
        }
        let signaturePath = path.join(__dirname, '../public/image copy 2.png');
        if (!fs.existsSync(signaturePath)) {
            signaturePath = path.join(__dirname, '../uploads/image copy 2.png');
        }
        if (!fs.existsSync(signaturePath)) {
            signaturePath = path.join(__dirname, '../uploads/quotation_signature.png');
        }
        if (fs.existsSync(signaturePath)) {
            signatureImageBase64 = `data:image/png;base64,${fs.readFileSync(signaturePath).toString('base64')}`;
        }
    } catch (e) {
        console.error('Error loading banner or signature images:', e);
    }

    const lead = quotation.lead || {};
    const qDate = new Date(quotation.createdAt || Date.now()).toLocaleDateString('en-GB');
    const qNumber = quotation.quotationNumber || 'QTN-DRAFT';
    const clientName = lead.customerName || 'Valued Customer';
    const clientCompany = lead.companyName || '';
    const clientPhone = lead.contactNumber || '';
    const clientEmail = lead.email || '';

    const items = quotation.items || [];
    
    let totalTaxable = 0;
    let totalGstAmount = 0;
    let productTotal = 0;
    let serviceTotal = 0;

    const itemRows = items.map((item, idx) => {
        const qty = Number(item.quantity || 1);
        const rate = Number(item.price || 0);
        const gstPerc = Number(item.gstPercentage !== undefined ? item.gstPercentage : 18);
        const taxable = rate * qty;
        const gstAmount = (taxable * gstPerc) / 100;
        const totalWithGst = taxable + gstAmount;

        totalTaxable += taxable;
        totalGstAmount += gstAmount;

        if (item.itemType === 'Service' || item.itemType === 'Installation Package') {
            serviceTotal += totalWithGst;
        } else {
            productTotal += totalWithGst;
        }

        return {
            idx: idx + 1,
            name: item.name || 'Component / Service',
            description: item.description || '',
            qty,
            rate,
            gstPerc,
            taxable,
            gstAmount,
            totalWithGst
        };
    });

    const minRows = Math.max(7, itemRows.length);
    const emptyRowsCount = minRows - itemRows.length;
    const emptyRows = Array.from({ length: emptyRowsCount });

    const minTaxRows = Math.max(2, itemRows.length + 1);
    const emptyTaxRowsCount = minTaxRows - itemRows.length;
    const emptyTaxRows = Array.from({ length: emptyTaxRowsCount });

    const grandTotal = Number(quotation.totalAmount || (totalTaxable + totalGstAmount));
    const grandTotalWords = numberToWords(grandTotal);

    // Automatic 70% (Row A - Material/Product) & 30% (Row B - Services/Installation) Split
    const displayProductTotal = Math.round(grandTotal * 0.70 * 100) / 100;
    const displayServiceTotal = Math.round((grandTotal - displayProductTotal) * 100) / 100;

    // Tax Breakup 2-Row Split (Row 1: 5% GST on Product A, Row 2: 18% GST on Service B)
    const row1Taxable = Math.round((displayProductTotal / 1.05) * 100) / 100;
    const row1Gst = Math.round((displayProductTotal - row1Taxable) * 100) / 100;

    const row2Taxable = Math.round((displayServiceTotal / 1.18) * 100) / 100;
    const row2Gst = Math.round((displayServiceTotal - row2Taxable) * 100) / 100;

    const taxBreakupTotalTaxable = Math.round((row1Taxable + row2Taxable) * 100) / 100;
    const taxBreakupTotalGst = Math.round((row1Gst + row2Gst) * 100) / 100;

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=860, user-scalable=yes">
    <title>Estimate - ${qNumber} - Ram Milan Singh Charitable Trust</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
    <style>
        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
        }
        body {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background-color: #f1f5f9;
            color: #0f172a;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
        }
        .page-wrapper {
            width: 860px;
            margin: 25px auto;
            padding: 0 15px;
        }
        .action-toolbar {
            display: flex;
            justify-content: space-between;
            align-items: center;
            background: #ffffff;
            border-radius: 12px;
            padding: 12px 24px;
            margin-bottom: 20px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.06);
            border: 1px solid #e2e8f0;
        }
        .action-toolbar h2 {
            font-size: 15px;
            font-weight: 800;
            color: #005082;
        }
        .action-toolbar p {
            font-size: 11px;
            color: #64748b;
            margin-top: 2px;
        }
        .print-btn {
            background-color: #0B3A2C;
            color: #ffffff;
            border: none;
            padding: 9px 20px;
            font-size: 12px;
            font-weight: 700;
            border-radius: 8px;
            cursor: pointer;
            display: inline-flex;
            align-items: center;
            gap: 8px;
            transition: all 0.2s ease;
            box-shadow: 0 2px 6px rgba(11,58,44,0.25);
            text-decoration: none;
        }
        .print-btn:hover {
            background-color: #124b39;
            transform: translateY(-1px);
        }
        .whatsapp-btn {
            background-color: #25D366;
            color: #ffffff;
            border: none;
            padding: 9px 18px;
            font-size: 12px;
            font-weight: 700;
            border-radius: 8px;
            cursor: pointer;
            display: inline-flex;
            align-items: center;
            gap: 8px;
            transition: all 0.2s ease;
            box-shadow: 0 2px 6px rgba(37,211,102,0.3);
            text-decoration: none;
        }
        .whatsapp-btn:hover {
            background-color: #1eb956;
            transform: translateY(-1px);
        }
        .a4-sheet {
            background: #ffffff;
            width: 830px;
            min-height: 1123px;
            padding: 30px;
            border-radius: 8px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.08);
            border: 1px solid #cbd5e1;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
        }
        
        /* 1. OFFICIAL TRUST HEADER BANNER WITH DYNAMIC ESTIMATE & DATE */
        .header-banner-box {
            position: relative;
            width: 100%;
            margin-bottom: 8px;
            overflow: hidden;
            border-radius: 4px;
        }
        .header-banner-img {
            width: 100%;
            height: auto;
            display: block;
        }
        .banner-overlay-no {
            position: absolute;
            left: 81.2%;
            top: 80.8%;
            font-size: 12.5px;
            font-weight: 800;
            color: #00487C;
            font-family: monospace;
            letter-spacing: 0.5px;
            white-space: nowrap;
            line-height: 1;
            pointer-events: none;
        }
        .banner-overlay-date {
            position: absolute;
            left: 81.2%;
            top: 88.2%;
            font-size: 12.5px;
            font-weight: 800;
            color: #0f172a;
            font-family: monospace;
            letter-spacing: 0.5px;
            white-space: nowrap;
            line-height: 1;
            pointer-events: none;
        }

        /* 3. BILL TO */
        .bill-to-row {
            margin-top: 10px;
            margin-bottom: 12px;
            padding-bottom: 8px;
            border-bottom: 1.5px solid #1e293b;
            font-size: 13px;
            color: #0f172a;
        }
        .bill-to-title {
            font-weight: 900;
            color: #000000;
            font-size: 13.5px;
            letter-spacing: 0.2px;
        }
        .bill-to-name {
            font-weight: 800;
            color: #00487C;
            font-size: 13px;
            text-transform: uppercase;
            margin-left: 4px;
        }

        /* 4. MAIN ITEMS TABLE - SHARP & BRIGHT VISIBLE BORDERS */
        .table-section {
            margin-top: 8px;
            border-radius: 0px;
            overflow: hidden;
            border: 1.5px solid #334155;
            background: #ffffff;
        }
        .items-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 11px;
            background: #ffffff;
        }
        .items-table thead th {
            background-color: #C8EBD0;
            color: #000000;
            font-weight: 900;
            text-align: center;
            border-bottom: 2px solid #1e293b;
            border-right: 1.5px solid #334155;
            padding: 10px 6px;
            font-size: 12.5px;
            line-height: 1.3;
            vertical-align: middle;
            letter-spacing: 0.2px;
        }
        .items-table thead th:last-child {
            border-right: none;
        }
        .items-table tbody td {
            border-bottom: 1px solid #64748b;
            border-right: 1.5px solid #334155;
            padding: 8px 10px;
            height: 40px;
            vertical-align: middle;
        }
        .items-table tbody td.td-total-col {
            border-right: none;
            border-bottom: none;
            text-align: center;
            vertical-align: middle;
        }
        .items-table tbody tr.empty-row td {
            height: 36px;
            background: #ffffff;
        }
        .items-table tbody tr:last-child td {
            border-bottom: none;
        }
        .th-center, .td-center {
            text-align: center;
        }
        .th-right, .td-right {
            text-align: right;
        }
        .item-title {
            font-weight: 800;
            color: #0f172a;
            font-size: 12px;
        }
        .item-desc {
            font-size: 10px;
            color: #475569;
            margin-top: 2px;
            line-height: 1.35;
            white-space: pre-wrap;
        }
        /* 5. SEPARATE SUMMARY TABLE (A + B) WITH GAP */
        .summary-table-section {
            margin-top: 10px;
            border-radius: 0px;
            overflow: hidden;
            border: 1.5px solid #334155;
            background: #ffffff;
        }
        .summary-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 11.5px;
            background: #ffffff;
        }
        .summary-table td.col-code {
            width: 60px;
            border-right: 1.5px solid #334155;
            text-align: center;
            font-weight: 800;
            font-size: 13px;
        }
        .summary-table td.col-desc {
            border-right: 1.5px solid #334155;
            padding: 8px 12px;
            font-weight: 800;
            font-size: 12px;
        }
        .summary-table td.col-amt {
            width: 160px;
            padding: 8px 10px;
            text-align: right;
            font-family: monospace;
            font-weight: 900;
            font-size: 12.5px;
            border-right: none;
        }
        .summary-row-a {
            background-color: #CCE5FF;
            color: #000000;
        }
        .summary-row-a td {
            border-bottom: 1px solid #64748b;
            background-color: #CCE5FF;
        }
        .summary-row-b {
            background-color: #FBE5C8;
            color: #000000;
        }
        .summary-row-b td {
            border-bottom: 1px solid #64748b;
            background-color: #FBE5C8;
        }
        .summary-row-total {
            background-color: #C8EBD0;
            color: #000000;
        }
        .summary-row-total td {
            border-bottom: none;
            background-color: #C8EBD0;
            font-size: 12.5px;
            font-weight: 900;
            padding-top: 9px;
            padding-bottom: 9px;
        }
        .summary-row-total td.col-desc {
            font-weight: 900;
        }

        /* 6. TAX BREAKUP TABLE */
        .tax-breakup-section {
            margin-top: 9px;
        }
        .tax-header {
            background: linear-gradient(90deg, #00487C 0%, #06606A 50%, #0E8558 100%);
            color: #ffffff;
            font-size: 10.5px;
            font-weight: 900;
            text-transform: uppercase;
            padding: 4.5px 12px;
            border-top-left-radius: 4px;
            border-top-right-radius: 4px;
            letter-spacing: 0.5px;
        }
        .tax-table-container {
            border: 1.5px solid #334155;
            border-top: none;
            background: #ffffff;
            border-radius: 0 0 4px 4px;
            overflow: hidden;
        }
        .tax-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 10px;
            background: #ffffff;
        }
        .tax-table thead th {
            background-color: #C8EBD0;
            color: #000000;
            font-weight: 900;
            text-align: center;
            border-bottom: 1.5px solid #1e293b;
            border-right: 1.5px solid #334155;
            padding: 6px 6px;
            font-size: 10.5px;
            line-height: 1.2;
            vertical-align: middle;
        }
        .tax-table thead th:last-child {
            border-right: none;
        }
        .tax-table tbody td {
            border-bottom: 1px solid #64748b;
            border-right: 1.5px solid #334155;
            padding: 4.5px 8px;
            font-size: 10px;
            line-height: 1.25;
            vertical-align: middle;
        }
        .tax-table tbody td:last-child {
            border-right: none;
        }
        .tax-table tbody tr.empty-tax-row td {
            height: 22px;
            background: #ffffff;
        }
        .tax-table tbody tr:last-child td {
            border-bottom: none;
        }
        .tax-table tfoot tr {
            background-color: #C8EBD0;
            color: #000000;
            font-weight: 900;
            border-top: 1.5px solid #334155;
        }
        .tax-table tfoot td {
            border-right: 1.5px solid #334155;
            padding: 5px 8px;
            font-size: 10.5px;
            line-height: 1.25;
            vertical-align: middle;
        }
        .tax-table tfoot td:last-child {
            border-right: none;
        }

        /* 7. AMOUNT IN WORDS */
        .amount-words-box {
            margin-top: 6px;
            padding: 4px 10px;
            background-color: #DDF0FF;
            border-radius: 4px;
            font-size: 10px;
            display: flex;
            align-items: center;
            gap: 6px;
        }
        .amount-words-label {
            color: #00487C;
            font-weight: 800;
            white-space: nowrap;
        }
        .amount-words-val {
            color: #000000;
            font-weight: 800;
        }

        /* 8. FOOTER SECTION (COMPACT & REDUCED HEIGHT) */
        .footer-section {
            margin-top: 6px;
            padding-top: 0;
            page-break-inside: avoid;
        }
        .footer-grid-3col {
            display: grid;
            grid-template-columns: 4.4fr 2.9fr 2.7fr;
            gap: 8px;
            align-items: start;
        }
        .footer-left-col {
            display: flex;
            flex-direction: column;
            gap: 5px;
        }
        .info-card-box {
            border: 1px solid #7dd3fc;
            border-radius: 4px;
            overflow: hidden;
            background: #ffffff;
            font-size: 8.5px;
        }
        .info-card-header {
            background: linear-gradient(90deg, #00487C 0%, #06606A 60%, #0E8558 100%);
            color: #ffffff;
            font-weight: 900;
            padding: 3px 8px;
            font-size: 9.5px;
            display: flex;
            align-items: center;
            gap: 5px;
            letter-spacing: 0.2px;
        }
        .info-card-header svg {
            flex-shrink: 0;
            width: 11px;
            height: 11px;
        }
        .info-card-body {
            padding: 4px 8px;
            color: #0f172a;
            line-height: 1.25;
        }
        .terms-list-ol {
            padding-left: 12px;
            font-size: 8px;
            line-height: 1.25;
            color: #0f172a;
            font-weight: 600;
        }
        .terms-list-ol li {
            margin-bottom: 1.5px;
        }
        .account-table-grid {
            width: 100%;
            border-collapse: collapse;
            font-size: 8px;
            line-height: 1.25;
        }
        .account-table-grid td {
            padding: 1px 0;
            vertical-align: top;
        }
        .acc-lbl {
            width: 85px;
            color: #0f172a;
            font-weight: 700;
        }
        .acc-sep {
            width: 10px;
            text-align: center;
            color: #0f172a;
            font-weight: 700;
        }
        .acc-val {
            color: #000000;
            font-weight: 800;
        }
        .warranty-table-grid {
            width: 100%;
            border-collapse: collapse;
            font-size: 8px;
        }
        .warranty-table-grid td {
            padding: 3px 6px;
            border-bottom: 1px solid #e2e8f0;
            vertical-align: middle;
        }
        .w-item {
            width: 36%;
            font-weight: 900;
            color: #000000;
            font-size: 8.5px;
            border-right: 1px solid #e2e8f0;
            padding-left: 4px !important;
        }
        .w-dur {
            padding-left: 8px !important;
            color: #000000;
            font-weight: 800;
            font-size: 8.5px;
            line-height: 1.2;
        }
        .w-sub {
            font-size: 7px;
            font-weight: 600;
            color: #475569;
        }
        .signatory-column {
            display: flex;
            flex-direction: column;
            align-items: center;
            text-align: center;
            padding-top: 0;
        }
        .sign-for-label {
            font-size: 9px;
            font-weight: 800;
            color: #0f172a;
            margin-bottom: 1px;
        }
        .sign-img-wrap {
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 2px 0;
            width: 100%;
        }
        .sign-official-img {
            max-width: 125px;
            width: 100%;
            height: auto;
            display: block;
        }
        .sign-hr-line {
            width: 100%;
            height: 1.5px;
            background-color: #334155;
            margin-top: 3px;
            margin-bottom: 3px;
        }
        .sign-auth-label {
            font-size: 8.5px;
            font-weight: 800;
            color: #0f172a;
            letter-spacing: 0.2px;
        }

        /* PRINT STYLES */
        @media print {
            body {
                background: #ffffff !important;
                margin: 0 !important;
                padding: 0 !important;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
            }
            .action-toolbar {
                display: none !important;
            }
            .page-wrapper {
                max-width: 100% !important;
                margin: 0 !important;
                padding: 0 !important;
            }
            .a4-sheet {
                box-shadow: none !important;
                border: none !important;
                border-radius: 0 !important;
                padding: 8mm 10mm !important;
                min-height: auto !important;
            }
            .footer-section {
                page-break-inside: avoid !important;
            }
            .tax-breakup-section {
                page-break-inside: avoid !important;
            }
            .summary-table-section {
                page-break-inside: avoid !important;
            }
            @page {
                size: A4 portrait;
                margin: 6mm;
            }
        }
    </style>
</head>
<body>

<div class="page-wrapper">
    <!-- Top Action Toolbar -->
    <div class="action-toolbar">
        <div>
            <h2>Ram Milan Singh Charitable Trust — Official Estimate</h2>
            <p>Estimate Reference: <strong>${qNumber}</strong> | Date: ${qDate}</p>
        </div>
        <div style="display: flex; gap: 10px; align-items: center;">
            <button class="whatsapp-btn" onclick="shareOnWhatsApp()">
                💬 Share on WhatsApp
            </button>
            <button class="print-btn" onclick="window.print()">
                🖨️ Print / Save as PDF
            </button>
        </div>
    </div>

    <!-- Main A4 Estimate Sheet -->
    <div class="a4-sheet">
        <div>
            <!-- 1. OFFICIAL TRUST HEADER BANNER WITH DYNAMIC ESTIMATE & DATE -->
            <div class="header-banner-box">
                <img src="${headerImageBase64 || '/public/image.png'}" alt="Ram Milan Singh Charitable Trust" class="header-banner-img">
                <div class="banner-overlay-no">${qNumber}</div>
                <div class="banner-overlay-date">${qDate}</div>
            </div>

            <!-- 3. BILL TO -->
            <div class="bill-to-row">
                <span class="bill-to-title">Bill To : </span>
                <span class="bill-to-name">${clientName}</span>
                ${clientCompany ? `<span style="font-weight: 700; color: #475569; margin-left: 6px;">(${clientCompany})</span>` : ''}
                ${clientPhone ? `<span style="color: #64748b; font-family: monospace; margin-left: 10px;">Ph: ${clientPhone}</span>` : ''}
                ${clientEmail ? `<span style="color: #64748b; margin-left: 10px;">Email: ${clientEmail}</span>` : ''}
            </div>

            <!-- 4. MAIN LINE ITEMS TABLE -->
            <div class="table-section">
                <table class="items-table">
                    <thead>
                        <tr>
                            <th class="th-center" style="width: 60px;">S. No.</th>
                            <th class="th-center">Description</th>
                            <th class="th-center" style="width: 100px;">Quantity</th>
                            <th class="th-center" style="width: 90px;">GST</th>
                            <th class="th-center" style="width: 160px;">
                                Total Amount<br>
                                <span style="font-size: 10px; font-weight: 800; color: #1e293b;">(Including GST) (₹)</span>
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        ${itemRows.map((item, index) => `
                            <tr>
                                <td class="td-center" style="font-weight: 700; color: #475569;">${item.idx}</td>
                                <td>
                                    <div class="item-title">${item.name}</div>
                                    ${item.description ? `<div class="item-desc">${item.description}</div>` : ''}
                                </td>
                                <td class="td-center" style="font-weight: 800;">${item.qty}</td>
                                <td class="td-center" style="font-weight: 700;">${item.gstPerc}%</td>
                                ${index === 0 ? `
                                <td rowspan="${itemRows.length + emptyRows.length}" class="td-center td-total-col" style="font-weight: 900; font-family: monospace; vertical-align: middle; text-align: center; font-size: 22px; color: #000000; letter-spacing: 0.5px;">
                                    ₹${grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </td>
                                ` : ''}
                            </tr>
                        `).join('')}
                        ${emptyRows.map((_, emptyIdx) => `
                            <tr class="empty-row">
                                <td class="td-center">&nbsp;</td>
                                <td>&nbsp;</td>
                                <td class="td-center">&nbsp;</td>
                                <td class="td-center">&nbsp;</td>
                                ${itemRows.length === 0 && emptyIdx === 0 ? `
                                <td rowspan="${emptyRows.length}" class="td-center td-total-col" style="vertical-align: middle; text-align: center;">
                                    &nbsp;
                                </td>
                                ` : ''}
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>

            <!-- 5. COST SUMMARY TABLE (A + B) - SEPARATE TABLE WITH GAP -->
            <div class="summary-table-section">
                <table class="summary-table">
                    <tbody>
                        <tr class="summary-row-a">
                            <td class="td-center col-code">A</td>
                            <td class="col-desc">Panel + Inverter + Battery (Total Amount)</td>
                            <td class="td-right col-amt">₹${displayProductTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        </tr>
                        <tr class="summary-row-b">
                            <td class="td-center col-code">B</td>
                            <td class="col-desc">EPC & Installation (Total Amount)</td>
                            <td class="td-right col-amt">₹${displayServiceTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        </tr>
                        <tr class="summary-row-total">
                            <td class="td-center col-code">&nbsp;</td>
                            <td class="col-desc">Total Project Cost (A + B)</td>
                            <td class="td-right col-amt">₹${grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        </tr>
                    </tbody>
                </table>
            </div>

            <!-- 6. TAX BREAKUP TABLE (MATCHING USER REFERENCE) -->
            <div class="tax-breakup-section">
                <div class="tax-header">
                    TAX BREAKUP (GST ALREADY INCLUDED IN ABOVE AMOUNT)
                </div>
                <div class="tax-table-container">
                    <table class="tax-table">
                        <thead>
                            <tr>
                                <th class="th-center" style="width: 55px;">S. No.</th>
                                <th class="th-center">Particulars</th>
                                <th class="th-center" style="width: 120px;">
                                    Value Before GST<br>
                                    <span style="font-size: 9.5px; font-weight: 800;">(₹)</span>
                                </th>
                                <th class="th-center" style="width: 75px;">GST Rate</th>
                                <th class="th-center" style="width: 110px;">
                                    GST Amount<br>
                                    <span style="font-size: 9.5px; font-weight: 800;">(₹)</span>
                                </th>
                                <th class="th-center" style="width: 135px;">
                                    Total Amount<br>
                                    <span style="font-size: 9.5px; font-weight: 800;">(Including GST) (₹)</span>
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td class="td-center" style="font-weight: 700; color: #475569;">1</td>
                                <td style="font-weight: 700; color: #0f172a;">Panel + Inverter + Battery (Total Amount)</td>
                                <td class="td-right" style="font-family: monospace; font-weight: 700;">₹${row1Taxable.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                <td class="td-center" style="font-weight: 700;">5%</td>
                                <td class="td-right" style="font-family: monospace; font-weight: 700;">₹${row1Gst.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                <td class="td-right" style="font-family: monospace; font-weight: 800;">₹${displayProductTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                            </tr>
                            <tr>
                                <td class="td-center" style="font-weight: 700; color: #475569;">2</td>
                                <td style="font-weight: 700; color: #0f172a;">EPC & Installation (Total Amount)</td>
                                <td class="td-right" style="font-family: monospace; font-weight: 700;">₹${row2Taxable.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                <td class="td-center" style="font-weight: 700;">18%</td>
                                <td class="td-right" style="font-family: monospace; font-weight: 700;">₹${row2Gst.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                <td class="td-right" style="font-family: monospace; font-weight: 800;">₹${displayServiceTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                            </tr>
                        </tbody>
                        <tfoot>
                            <tr>
                                <td class="td-center">&nbsp;</td>
                                <td style="font-weight: 900; font-size: 11.5px; text-transform: uppercase;">Total Project Cost</td>
                                <td class="td-right" style="font-family: monospace; font-weight: 900;">₹${taxBreakupTotalTaxable.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                <td class="td-center" style="font-weight: 900;">-</td>
                                <td class="td-right" style="font-family: monospace; font-weight: 900; color: #166534;">+₹${taxBreakupTotalGst.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                <td class="td-right" style="font-family: monospace; font-size: 12px; font-weight: 900;">₹${grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>

            <!-- 7. AMOUNT IN WORDS (MATCHING REFERENCE) -->
            <div class="amount-words-box">
                <span class="amount-words-label">Amount in Words:</span>
                <span class="amount-words-val">${grandTotalWords} (Including GST).</span>
            </div>
        </div>

        <!-- 8. FOOTER SECTION (EXACT MATCH TO REFERENCE) -->
        <div class="footer-section">
            <div class="footer-grid-3col">
                <!-- Left Column: Terms + Account Details -->
                <div class="footer-left-col">
                    <!-- Box 1: Terms and Conditions -->
                    <div class="info-card-box">
                        <div class="info-card-header">
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                            Terms and Conditions
                        </div>
                        <div class="info-card-body">
                            <ol class="terms-list-ol">
                                <li>Prices are valid for ____ days from the date of this estimate.</li>
                                <li>GST as applicable and included in the above amounts.</li>
                                <li>Scope of supply, installation and specifications as mentioned above.</li>
                                <li>Any change in specifications or quantity may change the price.</li>
                                <li>This is a commercial estimate and not a binding contract.</li>
                                <li>Payment terms shall be mutually agreed.</li>
                            </ol>
                        </div>
                    </div>

                    <!-- Box 2: Account Details -->
                    <div class="info-card-box">
                        <div class="info-card-header">
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="3" y1="21" x2="21" y2="21"></line><line x1="3" y1="10" x2="21" y2="10"></line><polyline points="3 10 12 3 21 10"></polyline><line x1="6" y1="10" x2="6" y2="21"></line><line x1="10" y1="10" x2="10" y2="21"></line><line x1="14" y1="10" x2="14" y2="21"></line><line x1="18" y1="10" x2="18" y2="21"></line></svg>
                            Account Details
                        </div>
                        <div class="info-card-body">
                            <table class="account-table-grid">
                                <tr>
                                    <td class="acc-lbl">Company Name</td>
                                    <td class="acc-sep">:</td>
                                    <td class="acc-val">Ram Milan Singh Charitable Trust</td>
                                </tr>
                                <tr>
                                    <td class="acc-lbl">A/c No.</td>
                                    <td class="acc-sep">:</td>
                                    <td class="acc-val" style="font-family: monospace; font-weight: 800;">242502100025006</td>
                                </tr>
                                <tr>
                                    <td class="acc-lbl">IFSC</td>
                                    <td class="acc-sep">:</td>
                                    <td class="acc-val" style="font-family: monospace; font-weight: 800;">UCBA0002425</td>
                                </tr>
                                <tr>
                                    <td class="acc-lbl">Branch</td>
                                    <td class="acc-sep">:</td>
                                    <td class="acc-val">Kadipur, Sultanpur</td>
                                </tr>
                                <tr>
                                    <td class="acc-lbl">A/c Type</td>
                                    <td class="acc-sep">:</td>
                                    <td class="acc-val">Current Account</td>
                                </tr>
                            </table>
                        </div>
                    </div>
                </div>

                <!-- Middle Column: Warranty Details -->
                <div class="info-card-box">
                    <div class="info-card-header">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
                        Warranty Details
                    </div>
                    <div class="info-card-body" style="padding: 0;">
                        <table class="warranty-table-grid">
                            <tr>
                                <td class="w-item">Panel</td>
                                <td class="w-dur">
                                    <strong style="color: #0f172a;">25 Years</strong><br>
                                    <span class="w-sub">(as per manufacturer)</span>
                                </td>
                            </tr>
                            <tr>
                                <td class="w-item">Inverter</td>
                                <td class="w-dur">
                                    <strong style="color: #0f172a;">05 Years</strong><br>
                                    <span class="w-sub">(as per manufacturer)</span>
                                </td>
                            </tr>
                            <tr>
                                <td class="w-item" style="border-bottom: none;">Battery</td>
                                <td class="w-dur" style="border-bottom: none;">
                                    <strong style="color: #0f172a;">05 Years</strong><br>
                                    <span class="w-sub">(as per manufacturer)</span>
                                </td>
                            </tr>
                        </table>
                    </div>
                </div>

                <!-- Right Column: Authorized Signatory (MATCHING USER IMAGE) -->
                <div class="signatory-column">
                    <div class="sign-for-label">For : Ram Milan Singh Charitable Trust</div>
                    <div class="sign-img-wrap">
                        <img src="${signatureImageBase64 || '/public/image%20copy%202.png'}" alt="Managing Trustee Signature" class="sign-official-img">
                    </div>
                    <div class="sign-hr-line"></div>
                    <div class="sign-auth-label">Authorized Signatory</div>
                </div>
            </div>
        </div>

    </div>
</div>

<script>
    function shareOnWhatsApp() {
        const url = window.location.href.split('?')[0];
        const clientName = ${JSON.stringify(clientName)};
        const qNum = ${JSON.stringify(qNumber)};
        const grandTotal = ${JSON.stringify('₹' + grandTotal.toLocaleString('en-IN'))};
        const text = encodeURIComponent(
            "Hello " + clientName + ",\\n\\n" +
            "Please find your official Quotation / Estimate (" + qNum + ") from RAM MILAN SINGH CHARITABLE TRUST here:\\n" +
            url + "\\n\\n" +
            "Total Amount: " + grandTotal + "\\n\\nThank you!"
        );
        window.open("https://wa.me/?text=" + text, "_blank");
    }

    // Auto-trigger print if requested via ?download=true or ?print=true
    if (window.location.search.includes('print=true') || window.location.search.includes('download=true')) {
        window.addEventListener('load', function() {
            setTimeout(function() {
                window.print();
            }, 500);
        });
    }
</script>
</body>
</html>`;
}

// Generate PDF using Puppeteer (clean fallback if ever needed)
async function generateQuotationPDF(quotation, settings) {
    const puppeteer = require("puppeteer");
    const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    try {
        const page = await browser.newPage();
        const html = buildQuotationHTML(quotation, settings);
        await page.setContent(html, { waitUntil: 'networkidle0' });
        const pdf = await page.pdf({
            format: 'A4',
            printBackground: true,
            margin: { top: '0', bottom: '0', left: '0', right: '0' }
        });
        await browser.close();
        return pdf;
    } catch (err) {
        await browser.close();
        throw err;
    }
}

module.exports = {
    buildQuotationHTML,
    numberToWords,
    generateQuotationPDF
};
