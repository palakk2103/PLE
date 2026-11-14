import { FiEye, FiDownload } from 'react-icons/fi';
import { getDownloadUrl } from '../../../../shared/utils/documentUrl';

const Row = ({ label, value, span }) => (
  <div className={span ? 'col-span-2' : ''}>
    <p className="text-xs text-gray-500 font-medium">{label}</p>
    <p className="text-sm font-semibold text-gray-800 break-words">{value || <span className="text-gray-400">Not provided</span>}</p>
  </div>
);

const DocRow = ({ label, doc, testId }) => (
  <div className="col-span-2 flex items-center justify-between gap-2 bg-white border border-gray-200 rounded-lg px-3 py-2" data-testid={testId}>
    <div className="min-w-0">
      <p className="text-xs text-gray-500 font-medium">{label}</p>
      <p className="text-sm font-semibold text-gray-800 truncate">{doc?.url ? doc.fileName || 'Document' : <span className="text-red-600">Missing</span>}</p>
    </div>
    {doc?.url && (
      <div className="flex gap-1.5 shrink-0">
        <a href={doc.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 bg-blue-50 px-2.5 py-1.5 rounded-lg"><FiEye /> View</a>
        <a href={getDownloadUrl(doc.url)} download={doc.fileName} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-bold text-gray-700 bg-gray-100 px-2.5 py-1.5 rounded-lg"><FiDownload /> Download</a>
      </div>
    )}
  </div>
);

const Card = ({ title, children, testId }) => (
  <div data-testid={testId}>
    <h3 className="text-sm font-semibold uppercase text-blue-600 mb-3 tracking-wider">{title}</h3>
    <div className="grid grid-cols-2 gap-4 bg-gray-50 p-4 rounded-xl">{children}</div>
  </div>
);

const fmt = (d) => (d ? new Date(d).toLocaleString() : '');

/** Lists the registration data that is missing so reviewers can spot incomplete applications. */
const missingItems = (c) => {
  const m = [];
  if (c.registrationInfo?.version !== 2) return m;
  if (!c.addressProof?.url) m.push('Address proof');
  if (!(c.bankStatement?.url || c.cancelledCheque?.url)) m.push('Bank document');
  if (c.gstRegistered && !c.gstCertificate?.url) m.push('GST certificate');
  if (!c.authorisedSignatory?.identityDocument?.url) m.push('Signatory identity document');
  if (!c.authorisedSignatory?.authorisationDocument?.url) m.push('Authorisation document');
  if (!c.authorisedSignatory?.declaration?.accepted) m.push('Signatory declaration');
  return m;
};

const RegistrationDetailsSections = ({ company, employees = [], admin }) => {
  if (!company) return null;
  const a = company.addressDetails || {};
  const b = company.bankDetails || {};
  const s = company.authorisedSignatory || {};
  const isV2 = company.registrationInfo?.version === 2;
  const bankDoc = company.bankDocumentType === 'bank_statement' ? company.bankStatement : company.cancelledCheque;
  const missing = missingItems(company);

  return (
    <div className="space-y-6" data-testid="registration-sections">
      {!isV2 && (
        <p className="text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded-lg p-3">
          Legacy registration - address, bank, GST and signatory sections were not collected for this company.
        </p>
      )}
      {isV2 && missing.length > 0 && (
        <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-3" data-testid="missing-info">
          Missing information: {missing.join(', ')}
        </p>
      )}

      {isV2 && (
        <>
          <Card title="Company Address" testId="sec-address">
            <Row label="Address Line 1" value={a.line1} />
            <Row label="Address Line 2" value={a.line2} />
            <Row label="City" value={a.city} />
            <Row label="State" value={a.state} />
            <Row label="Country" value={a.country} />
            <Row label="Pincode" value={a.pincode} />
            <Row label="Company Registration No." value={company.companyRegistrationNumber} span />
            <DocRow label="Address Proof" doc={company.addressProof} testId="doc-addressProof" />
          </Card>

          <Card title="Bank Details" testId="sec-bank">
            <Row label="Account Holder" value={b.accountHolderName} />
            <Row label="Bank Name" value={b.bankName} />
            <Row label={`Account Number${b.masked ? ' (masked)' : ''}`} value={b.accountNumber} />
            <Row label="IFSC" value={b.ifscCode} />
            <Row label="Branch" value={b.branchName} />
            <Row label="Account Type" value={b.accountType} />
            <DocRow label={company.bankDocumentType === 'bank_statement' ? 'Bank Statement' : 'Cancelled Cheque'} doc={bankDoc} testId="doc-bank" />
          </Card>

          <Card title="GST Details" testId="sec-gst">
            <Row label="GST Registered" value={company.gstRegistered ? 'Yes' : 'No'} />
            {company.gstRegistered ? (
              <>
                <Row label="GST Number" value={company.gstNumber} />
                <Row label="Legal Business Name" value={company.gstDetails?.legalName} />
                <Row label="Registration Type" value={company.gstDetails?.registrationType} />
                <Row label="State / Jurisdiction" value={company.gstDetails?.state} />
                <DocRow label="GST Certificate" doc={company.gstCertificate} testId="doc-gst" />
              </>
            ) : (
              <Row label="Note" value="Non-GST registrant - no GST details required." span />
            )}
          </Card>

          <Card title="Authorised Signatory" testId="sec-signatory">
            <Row label="Full Name" value={s.fullName} />
            <Row label="Designation" value={s.designation} />
            <Row label="Email" value={s.email} />
            <Row label="Mobile" value={s.mobile} />
            <DocRow label="Identity Document" doc={s.identityDocument} testId="doc-identity" />
            <DocRow label="Authorisation Document" doc={s.authorisationDocument} testId="doc-authorisation" />
            <Row label="Declaration Accepted" value={s.declaration?.accepted ? 'Yes' : 'No'} />
            <Row label="Accepted At" value={fmt(s.declaration?.acceptedAt)} />
          </Card>
        </>
      )}

      <Card title="Admin Information" testId="sec-admin">
        <Row label="Name" value={company.adminInfo?.name || admin?.adminName || admin?.name} />
        <Row label="Email" value={company.adminInfo?.email || admin?.adminEmail || admin?.email} />
        <Row label="Mobile" value={company.adminInfo?.phone || admin?.phone} />
        {isV2 && <Row label="Designation" value={company.adminInfo?.designation} />}
        {isV2 && <Row label="Same as Authorised Signatory" value={company.adminInfo?.sameAsSignatory ? 'Yes' : 'No'} />}
      </Card>

      <div data-testid="sec-employees">
        <h3 className="text-sm font-semibold uppercase text-blue-600 mb-3 tracking-wider">Employee Information ({employees.length})</h3>
        {employees.length === 0 ? (
          <p className="text-sm text-gray-500 bg-gray-50 p-4 rounded-xl">No employees registered.</p>
        ) : (
          <div className="bg-gray-50 rounded-xl divide-y divide-gray-200">
            {employees.map((e) => (
              <div key={e._id} className="p-3 text-sm">
                <p className="font-semibold text-gray-800">{e.name}</p>
                <p className="text-xs text-gray-500">{e.email} - {e.phone} - {e.designation || 'N/A'}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      <Card title="Registration Information" testId="sec-registration">
        <Row label="Status" value={company.verificationStatus} />
        <Row label="Submitted" value={fmt(company.registrationInfo?.submittedAt || company.createdAt)} />
        <Row label="Registration Flow" value={isV2 ? 'Version 2 (4-step)' : 'Legacy'} />
        <Row label="GST Status" value={isV2 ? (company.gstRegistered ? 'GST registered' : 'Non-GST') : (company.gstNumber ? 'GST registered' : 'Unknown')} />
        {company.documentResubmitNotes && <Row label="Review Notes" value={company.documentResubmitNotes} span />}
      </Card>
    </div>
  );
};

export default RegistrationDetailsSections;
