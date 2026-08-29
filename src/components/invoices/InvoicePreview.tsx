import React, { useRef, useState } from 'react';
import html2pdf from 'html2pdf.js';
import { Download } from 'lucide-react';
import { Spinner } from '../ui';
import { Logo } from '../logo';
import { supabase } from '../../lib/supabase';
import { getDocumentSignedUrl } from '../../lib/storage';

interface InvoicePreviewProps {
  invoice: any;
  onPdfGenerated?: (pdfUrl: string) => void;
}

export default function InvoicePreview({ invoice, onPdfGenerated }: InvoicePreviewProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const handleDownload = async () => {
    if (!contentRef.current) return;
    setIsGenerating(true);

    try {
      const element = contentRef.current;
      const opt = {
        margin: 0.5,
        filename: `${invoice.invoice_number}.pdf`,
        image: { type: 'jpeg' as const, quality: 0.98 },
        html2canvas: { scale: 2 },
        jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' as const }
      };

      // Generate the PDF
      const pdf = await html2pdf().set(opt).from(element).output('blob');

      // Upload to Supabase Storage
      const fileName = `${invoice.id}/${invoice.invoice_number}.pdf`;
      const { data, error } = await supabase.storage.from('invoice-pdfs').upload(fileName, pdf, {
        contentType: 'application/pdf',
        upsert: true
      });

      if (!error && data) {
        // invoice-pdfs is a private bucket (see migration 0095) — store the
        // permanent storage PATH, not a public URL, and mint a fresh signed
        // URL for immediate use here. Consumers must call
        // getDocumentSignedUrl('invoice-pdfs', pdf_url) to reopen it later.
        await supabase.from('txn_invoices').update({ pdf_url: fileName }).eq('id', invoice.id);

        const { url: signedUrl } = await getDocumentSignedUrl('invoice-pdfs', fileName);
        if (onPdfGenerated && signedUrl) onPdfGenerated(signedUrl);
      }

      // Trigger user download
      html2pdf().set(opt).from(element).save();
    } catch (err) {
      console.error('PDF Generation Error:', err);
      alert('Failed to generate PDF');
    } finally {
      setIsGenerating(false);
    }
  };

  if (!invoice) return null;

  return (
    <div className="flex flex-col items-center">
      <div className="w-full flex justify-end mb-4">
        <button
          onClick={handleDownload}
          disabled={isGenerating}
          className="bg-blue-600 text-white px-4 py-2 rounded-md font-medium flex items-center gap-2 hover:bg-blue-700 disabled:opacity-50"
        >
          {isGenerating ? <Spinner className="w-4 h-4" /> : <Download className="w-4 h-4" />}
          {isGenerating ? 'Generating...' : 'Download PDF'}
        </button>
      </div>

      <div 
        ref={contentRef} 
        className="w-full max-w-4xl bg-white p-12 shadow-sm border"
        style={{ minHeight: '1056px' }} // 11 inches at 96 PPI
      >
        <div className="flex justify-between items-start border-b pb-8 mb-8">
          <div>
            <Logo size={180} to="/" />
            <div className="mt-4 text-gray-500 text-sm">
              <p>RealtyNow Private Limited</p>
              <p>123 Real Estate Avenue</p>
              <p>Tech Park, Bangalore 560001</p>
              <p>GSTIN: 29XXXXX1234X1ZX</p>
            </div>
          </div>
          <div className="text-right">
            <h1 className="text-4xl font-bold text-gray-800 tracking-wider">INVOICE</h1>
            <p className="text-gray-500 mt-2 font-mono">{invoice.invoice_number}</p>
            <div className="mt-4 text-sm text-gray-600">
              <p><span className="font-semibold">Date:</span> {new Date(invoice.invoice_date).toLocaleDateString()}</p>
              <p><span className="font-semibold">Due Date:</span> {new Date(invoice.due_date).toLocaleDateString()}</p>
            </div>
          </div>
        </div>

        <div className="flex justify-between mb-8">
          <div className="w-1/2">
            <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-2">Billed To</h3>
            <p className="font-bold text-gray-800 text-lg">{invoice.customer?.name}</p>
            <p className="text-gray-600">{invoice.customer?.address}</p>
            <p className="text-gray-600">{invoice.customer?.city}, {invoice.customer?.pincode}</p>
            <p className="text-gray-600 mt-2">{invoice.customer?.email}</p>
            <p className="text-gray-600">{invoice.customer?.phone}</p>
          </div>
          {invoice.property_id && (
            <div className="w-1/2 text-right">
              <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-2">Property Details</h3>
              <p className="font-medium text-gray-800">{invoice.property?.title}</p>
              <p className="text-gray-600 text-sm">ID: {invoice.property_id}</p>
            </div>
          )}
        </div>

        <table className="w-full text-left mb-8">
          <thead className="border-y bg-gray-50">
            <tr>
              <th className="py-3 px-2 font-semibold text-gray-700">Description</th>
              <th className="py-3 px-2 font-semibold text-gray-700 text-right">Qty</th>
              <th className="py-3 px-2 font-semibold text-gray-700 text-right">Unit Price</th>
              <th className="py-3 px-2 font-semibold text-gray-700 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {(invoice.items || []).map((item: any) => (
              <tr key={item.id} className="border-b text-gray-600">
                <td className="py-3 px-2">{item.title}</td>
                <td className="py-3 px-2 text-right">{item.quantity}</td>
                <td className="py-3 px-2 text-right">₹{Number(item.unit_price).toLocaleString()}</td>
                <td className="py-3 px-2 text-right font-medium text-gray-800">₹{Number(item.total).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="flex justify-end mb-16">
          <div className="w-64 space-y-3">
            <div className="flex justify-between text-gray-600">
              <span>Subtotal:</span>
              <span>₹{Number(invoice.subtotal).toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-gray-600">
              <span>Tax ({invoice.tax_percentage}%):</span>
              <span>₹{Number(invoice.tax_amount).toLocaleString()}</span>
            </div>
            {invoice.discount > 0 && (
              <div className="flex justify-between text-green-600">
                <span>Discount:</span>
                <span>-₹{Number(invoice.discount).toLocaleString()}</span>
              </div>
            )}
            <div className="flex justify-between text-xl font-bold text-gray-800 border-t pt-3">
              <span>Total:</span>
              <span>₹{Number(invoice.total_amount).toLocaleString()}</span>
            </div>
          </div>
        </div>

        <div className="flex justify-between items-end border-t pt-8 text-sm text-gray-500">
          <div>
            <h4 className="font-semibold text-gray-700 mb-1">Payment Instructions</h4>
            <p>Make all checks payable to RealtyNow Pvt Ltd.</p>
            <p>If you have any questions concerning this invoice, contact support@realtynow.in</p>
          </div>
          <div className="text-center">
            <div className="w-40 border-b border-gray-400 mb-2"></div>
            <p>Authorized Signature</p>
          </div>
        </div>
      </div>
    </div>
  );
}
