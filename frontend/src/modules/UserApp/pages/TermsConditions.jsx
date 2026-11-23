import { FiFileText, FiArrowLeft, FiDownload } from "react-icons/fi";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import MobileLayout from "../components/Layout/MobileLayout";
import PageTransition from "../../../shared/components/PageTransition";
import { useBusinessBuyer } from "../hooks/useBusinessBuyer";
import { useAuthStore } from "../../../shared/store/authStore";
import { useB2bStore } from "../../../shared/store/b2bStore";

const TermsConditions = () => {
  const navigate = useNavigate();
  const { isBusiness } = useBusinessBuyer();
  const { user } = useAuthStore();
  const b2bUserRole = useB2bStore((state) => state.userRole);

  const isB2BUser = isBusiness || user?.role === 'b2bAdmin' || user?.role === 'b2bEmployee' || user?.isEmployee || b2bUserRole === 'business_buyer';

  const b2bSections = [
    {
      title: "BUSINESS TERMS & CONDITIONS (B2B)",
      content: `Peoples League Of Electronics Private Limited\nVersion: 1.0`
    },
    {
      title: "Chapter 1 – Introduction",
      content: `Welcome to the business-to-business ("B2B") platform operated by Peoples League Of Electronics Private Limited ("Company", "PLE", "we", "our", or "us"). These Business Terms & Conditions ("Terms") govern the access to and use of the Company's B2B platform, website, mobile applications, procurement services, products, software, and related commercial services by business customers. These Terms constitute a legally binding agreement between the Company and every Business Customer accessing or using the Platform for commercial purposes. By registering a business account, submitting a quotation request, placing a Purchase Order, purchasing Products or Services, or otherwise using the Platform, the Business Customer acknowledges that it has read, understood, and agrees to be legally bound by these Terms and all applicable policies incorporated by reference.

A. Purpose
The purpose of these Terms is to establish the rights, responsibilities, obligations, and commercial relationship between the Company and Business Customers in connection with:
• the purchase and sale of Products;
• procurement services;
• marketplace transactions;
• quotations;
• Purchase Orders;
• commercial deliveries;
• warranties;
• returns and replacements;
• payment obligations;
• business accounts; and
• all other services provided through the Company's B2B Platform.
These Terms are intended to promote fair, transparent, efficient, and legally compliant commercial transactions.

B. Applicability
These Terms apply exclusively to transactions conducted for business, commercial, institutional, governmental, educational, charitable, or professional purposes through the Company's B2B Platform. Business Customers may include, without limitation:
• companies;
• limited liability partnerships (LLPs);
• partnership firms;
• sole proprietorships;
• government departments;
• public sector undertakings (PSUs);
• statutory authorities;
• educational institutions;
• healthcare institutions;
• non-governmental organizations (NGOs);
• charitable organizations; and
• any other legally recognized business or institutional entity.
These Terms do not apply to consumer purchases made through the Company's B2C Platform, which are governed by separate consumer-facing Terms and Policies.

C. Commercial Nature of Transactions
All transactions conducted under these Terms are deemed to be commercial transactions. The Business Customer represents and warrants that:
• Products and Services are being acquired for business, professional, institutional, or commercial use;
• it is not acting as a consumer purchasing goods for personal, domestic, or household use unless expressly permitted by the Company;
• it possesses the legal authority to enter into commercial agreements; and
• all transactions are undertaken in good faith and for lawful purposes.

D. Relationship Between the Parties
Nothing contained in these Terms shall be interpreted as creating:
• a partnership;
• a joint venture;
• an agency relationship;
• an employer-employee relationship;
• a franchise;
• a fiduciary relationship; or
• any other legal association beyond that of independent contracting parties.
Each party shall remain solely responsible for its own business operations, personnel, taxes, liabilities, and regulatory obligations.

E. Incorporated Policies
These Terms should be read together with all applicable Company policies, including, where applicable:
• Business Privacy Policy;
• Business Customer Agreement;
• Shipping & Delivery Policy (B2B);
• Warranty Policy (B2B);
• Returns, RMA & Cancellation Policy (B2B);
• Payment Terms;
• Credit Policy;
• any Product-specific terms;
• Seller-specific conditions, where applicable; and
• any additional agreements expressly accepted by the Business Customer.
In the event of any inconsistency between these Terms and a separately executed written agreement signed by both parties, the signed agreement shall prevail to the extent of the inconsistency.

F. Amendments
The Company reserves the right to amend, revise, modify, or update these Terms from time to time to reflect changes in applicable laws, regulatory requirements, business practices, operational processes, technology, or services. Unless otherwise required by law or expressly agreed in writing, revised Terms shall become effective on the Effective Date specified in the updated version. Continued use of the Platform after the effective date constitutes acceptance of the revised Terms.

G. Acceptance of Terms
By accessing or using the Company's B2B Platform, registering a Business Account, requesting quotations, placing Purchase Orders, purchasing Products or Services, or otherwise engaging in commercial transactions with the Company, the Business Customer confirms that:
• it has carefully read these Terms;
• it understands its rights and obligations;
• it has the legal authority to enter into these Terms;
• the individual accepting these Terms is duly authorized to bind the Business Customer; and
• it agrees to comply with these Terms and all applicable laws, regulations, and Company policies.

H. Governing Principles
The Company is committed to conducting its business in accordance with the principles of:
• integrity;
• transparency;
• fairness;
• professionalism;
• regulatory compliance;
• responsible commercial practices;
• information security; and
• mutual respect in business relationships.
Business Customers are expected to uphold these principles while interacting with the Company and using the Platform.

I. Compliance with Applicable Law
These Terms shall be interpreted and enforced in accordance with the applicable laws of the Republic of India. Nothing contained in these Terms shall be construed as excluding, restricting, or limiting any legal obligation that cannot lawfully be excluded under applicable legislation.`
    },
    {
      title: "Chapter 2 – Definitions",
      content: `For the purposes of these Business Terms & Conditions, unless the context otherwise requires, the following terms shall have the meanings assigned to them below. Words importing the singular include the plural and vice versa, and references to one gender include all genders where the context so requires.

A. Account
"Account" means the registered business account created on the Company's B2B Platform through which a Business Customer accesses Products, Services, quotations, Purchase Orders, invoices, account information, and other commercial features.

B. Affiliate
"Affiliate" means any entity that directly or indirectly controls, is controlled by, or is under common control with a party, where "control" means ownership of more than fifty percent (50%) of the voting rights or the ability to direct the management and policies of such entity.

C. Authorized Representative
"Authorized Representative" means an individual who has been duly authorized by the Business Customer to act on its behalf in relation to the use of the Platform, placement of Orders, execution of agreements, acceptance of deliveries, and other commercial transactions.

D. Business Customer
"Business Customer" means any legally recognized business or institutional entity registered with the Company for commercial transactions, including but not limited to:
• companies;
• limited liability partnerships (LLPs);
• partnership firms;
• sole proprietorships;
• government departments;
• public sector undertakings (PSUs);
• statutory authorities;
• educational institutions;
• healthcare institutions;
• non-governmental organizations (NGOs);
• charitable organizations; and
• any other commercial or institutional entity approved by the Company.

E. Company
"Company", "PLE", "we", "our", or "us" means Peoples League Of Electronics Private Limited, together with its successors and permitted assigns.

F. Confidential Information
"Confidential Information" means any non-public information disclosed by either party relating to business operations, pricing, quotations, trade secrets, customer information, procurement strategies, technical information, software, financial information, intellectual property, security procedures, or any information designated as confidential or that would reasonably be understood to be confidential.

G. Contract
"Contract" means the legally binding agreement formed between the Company and the Business Customer upon acceptance of a Purchase Order, quotation, or any other commercial arrangement accepted by both parties.

H. Delivery
"Delivery" means the transfer of possession of Products to the Business Customer, its Authorized Representative, designated recipient, carrier, or any other person authorized to receive the Products.

I. Distributor
"Distributor" means an entity authorized by a Manufacturer to distribute or supply Products through the Company's Platform.

J. Force Majeure Event
"Force Majeure Event" means any event beyond the reasonable control of the affected party, including but not limited to natural disasters, war, terrorism, civil unrest, pandemics, governmental actions, transportation disruptions, cyber incidents, utility failures, strikes, or any similar event materially affecting performance under these Terms.

K. Goods / Products
"Goods" or "Products" means all hardware, software, peripherals, accessories, equipment, components, digital products, subscriptions, licenses, or other items offered through the Company's B2B Platform.

L. Intellectual Property
"Intellectual Property" means all present and future intellectual property rights, including copyrights, trademarks, service marks, trade names, logos, patents, industrial designs, domain names, trade secrets, know-how, software, databases, source code, object code, documentation, and any other proprietary rights recognized under applicable law.

M. Invoice
"Invoice" means the tax invoice, commercial invoice, debit note, credit note, or any other billing document issued by the Company or, where applicable, an authorized Seller in relation to a commercial transaction.

N. Logistics Partner
"Logistics Partner" means any third-party courier, freight carrier, transporter, warehouse operator, fulfillment provider, or logistics service provider engaged in connection with the transportation, storage, or delivery of Products.

O. Manufacturer
"Manufacturer" means the original equipment manufacturer (OEM) or producer responsible for designing, manufacturing, assembling, or branding a Product.

P. Order
"Order" means any request submitted by a Business Customer through the Platform or any other approved channel for the purchase of Products or Services.

Q. Platform
"Platform" means the Company's B2B website, mobile applications, procurement portal, APIs, software systems, and any other digital or electronic interface through which Products or Services are offered.

R. Purchase Order (PO)
"Purchase Order" or "PO" means a formal commercial order issued by a Business Customer specifying the Products or Services to be purchased, including applicable quantities, specifications, pricing, delivery requirements, and other commercial terms.

S. Quotation
"Quotation" means a written commercial proposal issued by the Company specifying pricing, availability, specifications, validity period, delivery estimates, payment terms, and other applicable commercial conditions for Products or Services.

T. Seller
"Seller" means the Company or any independent third-party business authorized to list and sell Products through the Company's B2B Platform.

U. Services
"Services" means procurement services, marketplace services, logistics coordination, technical support, installation, consulting, software services, subscription services, aftersales support, and any other commercial services provided by or through the Company.

V. Supplier
"Supplier" means any manufacturer, distributor, wholesaler, importer, or other business entity supplying Products to the Company or through the Platform.

W. Taxes
"Taxes" means all applicable taxes, duties, levies, cess, GST, customs duties, withholding taxes, or any other governmental charges imposed under applicable law.

X. Warranty
"Warranty" means the applicable manufacturer's warranty, the Company's warranty (where expressly provided), or any extended warranty separately purchased by the Business Customer.

Y. Working Day
"Working Day" means any day, other than a Saturday, Sunday, or public holiday, on which banks are generally open for business in the jurisdiction of the Company's registered office, unless otherwise specified in writing.

Z. Interpretation
Unless the context otherwise requires:
• headings are included for convenience only and shall not affect the interpretation of these Terms;
• references to any law include amendments, modifications, re-enactments, and subordinate legislation;
• references to the singular include the plural and vice versa;
• references to one gender include all genders;
• the words "including", "includes", and "such as" shall be interpreted as "including without limitation";
• references to a person include individuals, companies, partnerships, LLPs, trusts, government bodies, statutory authorities, and other legal entities; and
• any ambiguity shall not be interpreted against either party solely because that party drafted or proposed these Terms.`
    },
    {
      title: "Chapter 3 – Eligibility",
      content: `This Chapter sets out the eligibility requirements for accessing and using the Company's Business-to-Business ("B2B") Platform and entering into commercial transactions with Peoples League Of Electronics Private Limited ("Company", "PLE", "we", "our", or "us"). Only eligible Business Customers satisfying the requirements of this Chapter may register, access, purchase Products or Services, submit quotations, place Purchase Orders, or otherwise transact through the Platform.

A. Eligible Business Customers
The Platform is intended exclusively for legitimate commercial, institutional, governmental, and professional use. Eligible Business Customers may include, without limitation:
• private limited companies;
• public limited companies;
• one person companies (OPCs);
• limited liability partnerships (LLPs);
• partnership firms;
• sole proprietorships;
• government departments;
• public sector undertakings (PSUs);
• statutory authorities;
• educational institutions;
• healthcare institutions;
• research organizations;
• non-governmental organizations (NGOs);
• charitable or non-profit organizations;
• startups;
• micro, small and medium enterprises (MSMEs); and
• any other legally recognized business or institutional entity approved by the Company.
The Company reserves the right to determine whether an applicant qualifies as a Business Customer.

B. Legal Capacity
Every Business Customer represents and warrants that it:
• is validly existing under the applicable laws governing its establishment;
• possesses the legal capacity to enter into binding commercial agreements;
• has obtained all necessary registrations, licenses, approvals, and authorizations required for its business operations;
• is authorized to purchase the Products or Services ordered through the Platform; and
• shall comply with all applicable laws throughout its use of the Platform.

C. Authorized Representatives
Business Customers shall ensure that every individual accessing or using the Platform on their behalf:
• has been duly authorized by the Business Customer;
• acts within the scope of such authority;
• possesses the necessary authority to submit Purchase Orders, approve quotations, accept deliveries, make payments, and communicate with the Company; and
• complies with these Terms and all applicable Company policies.
The Company may rely upon instructions received from an Authorized Representative unless notified otherwise in writing.

D. Business Verification
The Company may require Business Customers to complete verification procedures before granting or continuing access to the Platform. Verification may include, where applicable:
• business registration certificates;
• GST registration details;
• Permanent Account Number (PAN);
• Tax Deduction and Collection Account Number (TAN), where applicable;
• Import Export Code (IEC), where applicable;
• UDYAM/MSME registration, where applicable;
• proof of registered office or principal place of business;
• identity and authorization documents of Authorized Representatives;
• banking information;
• beneficial ownership information, where legally required; and
• any additional information reasonably requested by the Company.
Submission of documentation does not guarantee approval.

E. Know Your Customer (KYC) Compliance
The Business Customer agrees to cooperate with all reasonable Know Your Customer ("KYC"), Anti-Money Laundering ("AML"), fraud prevention, and regulatory compliance procedures implemented by the Company. The Company may:
• request additional documentation;
• verify information through government or authorized third-party databases;
• conduct periodic compliance reviews;
• re-verify Business Customers from time to time; and
• refuse or suspend access where verification requirements are not satisfied.

F. Accuracy of Information
Business Customers shall ensure that all information provided to the Company is:
• accurate;
• complete;
• current;
• truthful; and
• not misleading.
Business Customers shall promptly update any information that becomes inaccurate or outdated. The Company may rely upon the information provided by the Business Customer unless notified otherwise.

G. Restricted Persons and Entities
The Platform shall not be used by any person or entity that:
• is prohibited from entering into commercial transactions under applicable law;
• is subject to applicable trade sanctions, embargoes, or government restrictions;
• has been suspended or debarred by a competent authority from carrying on business;
• has previously been suspended or terminated by the Company for material violations of these Terms, unless expressly reinstated by the Company; or
• is otherwise determined by the Company, acting reasonably, to present an unacceptable legal, regulatory, security, or fraud risk.

H. Right to Refuse or Reject Registration
The Company reserves the right, at its reasonable discretion, to:
• approve or reject any registration application;
• request additional information before approval;
• suspend the verification process pending clarification;
• reject incomplete or inaccurate applications; or
• decline to establish a commercial relationship where required for legal, regulatory, operational, or risk management reasons.
The Company is not obligated to provide detailed reasons for every decision where disclosure is restricted by law, confidentiality obligations, or security considerations.

I. Ongoing Eligibility
Eligibility to use the Platform is a continuing obligation. Business Customers shall immediately notify the Company of any material change affecting their eligibility, including:
• changes in legal status;
• mergers, acquisitions, or restructuring;
• insolvency or bankruptcy proceedings;
• suspension or cancellation of business registrations;
• changes in ownership or authorized representatives; or
• any event that may materially affect the Business Customer's ability to perform its obligations under these Terms.
Failure to provide such notification may result in suspension or termination of the Business Account.

J. Compliance with Applicable Laws
Business Customers shall ensure that their use of the Platform complies with all applicable laws, regulations, industry standards, and governmental requirements, including those relating to:
• taxation;
• import and export controls;
• consumer protection, where applicable;
• anti-corruption and anti-bribery;
• competition law;
• data protection and privacy;
• environmental regulations; and
• any licensing or certification requirements relevant to their business.

K. No Consumer Transactions
The B2B Platform is intended solely for commercial transactions. Individuals purchasing Products for personal, household, or domestic use should use the Company's consumer (B2C) Platform, which is governed by separate Terms and Policies. The Company reserves the right to redirect, refuse, or cancel transactions that are determined to be consumer purchases submitted through the B2B Platform.

L. Statutory Compliance
Nothing contained in this Chapter shall:
• exclude, restrict, or limit any legal obligation imposed upon the Company under applicable law;
• exempt the Business Customer from compliance with applicable legal or regulatory requirements; or
• affect any rights or obligations that cannot lawfully be excluded by contract.
Where any provision of this Chapter conflicts with mandatory legal requirements, the applicable law shall prevail to the extent of such inconsistency.`
    },
    {
      title: "Chapter 4 – Business Accounts",
      content: `This Chapter governs the creation, administration, maintenance, and use of Business Accounts on the Business-to-Business ("B2B") Platform operated by Peoples League Of Electronics Private Limited ("Company", "PLE", "we", "our", or "us"). A Business Account enables eligible Business Customers to access Products, Services, quotations, Purchase Orders, invoices, procurement tools, and other commercial features made available through the Platform.

A. Account Registration
To access the Company's B2B Platform, a Business Customer may be required to register a Business Account. During registration, the Company may request information including, but not limited to:
• legal business name;
• business registration details;
• GSTIN, where applicable;
• PAN and other tax identifiers;
• registered office address;
• principal place of business;
• billing and shipping addresses;
• contact information;
• Authorized Representative details;
• banking information, where applicable; and
• any additional information reasonably required for commercial or regulatory purposes.
Registration shall not create a contractual obligation for the Company to accept any future Order or provide any Product or Service.

B. Account Approval
Submission of a registration application does not automatically create a Business Account. The Company may, at its reasonable discretion:
• approve or reject any application;
• request additional documentation or clarification;
• conduct verification procedures;
• perform risk assessments;
• delay activation pending completion of verification; or
• refuse registration where required by law, regulatory obligations, operational requirements, or legitimate business considerations.
The Company is under no obligation to establish a commercial relationship with every applicant.

C. Authorized Users
A Business Customer may designate one or more Authorized Users to access and operate its Business Account. The Business Customer shall ensure that each Authorized User:
• acts within the authority granted by the Business Customer;
• complies with these Terms;
• protects confidential business information;
• maintains appropriate security practices; and
• uses the Platform solely for lawful business purposes.
The Business Customer remains fully responsible for all actions performed through its Business Account, whether undertaken by its Authorized Users or any person using valid account credentials.

D. Account Credentials and Security
Business Customers are responsible for maintaining the confidentiality and security of:
• usernames;
• passwords;
• authentication credentials;
• security tokens;
• application programming interface (API) keys, where applicable; and
• any other account access credentials.
Business Customers shall:
• implement appropriate internal access controls;
• prevent unauthorized access;
• promptly change compromised credentials;
• notify the Company immediately upon becoming aware of any actual or suspected unauthorized access or security incident; and
• cooperate with the Company in investigating and mitigating any such incident.
The Company shall not be responsible for losses arising from the Business Customer's failure to maintain reasonable account security.

E. Accuracy and Maintenance of Account Information
Business Customers shall ensure that all account information remains:
• accurate;
• complete;
• current;
• truthful; and
• capable of receiving official communications.
The Business Customer shall promptly update any material changes, including changes relating to:
• business name;
• legal structure;
• registered office;
• GST registration;
• billing information;
• shipping locations;
• banking details;
• Authorized Representatives; or
• contact information.
The Company may rely on the information available in the Business Account unless notified otherwise.

F. Multiple Locations and Business Units
Subject to the Company's approval, a Business Customer may maintain multiple business locations, branches, warehouses, cost centers, departments, or procurement units under a single Business Account or through linked accounts. The Company may provide administrative tools enabling the Business Customer to:
• manage multiple delivery locations;
• assign purchasing authority;
• allocate budgets;
• manage departmental procurement;
• monitor transactions; and
• administer user permissions.
Availability of such features may depend upon the Platform's capabilities or the applicable commercial arrangement.

G. Account Verification and Periodic Review
The Company may conduct periodic reviews of Business Accounts to:
• verify continued eligibility;
• confirm regulatory compliance;
• update business information;
• assess creditworthiness, where applicable;
• prevent fraud;
• satisfy legal obligations; and
• maintain the integrity of the Platform.
Business Customers shall reasonably cooperate with such reviews and provide updated information when requested.

H. Suspension or Restriction of Accounts
The Company may suspend, restrict, or temporarily disable a Business Account where it reasonably believes that:
• information provided is inaccurate, incomplete, or misleading;
• verification requirements have not been satisfied;
• unauthorized access is suspected;
• fraudulent, unlawful, or abusive activity is detected;
• payment obligations remain materially overdue;
• these Terms have been materially breached;
• continued access presents a legal, regulatory, operational, or security risk; or
• suspension is otherwise required by applicable law or a lawful order of a competent authority.
Where reasonably practicable, the Company shall notify the Business Customer of the suspension and, where appropriate, provide an opportunity to remedy the issue.

I. Account Termination
A Business Account may be terminated:
• by the Business Customer upon written request, subject to the completion of outstanding contractual obligations;
• by mutual written agreement between the parties; or
• by the Company in accordance with these Terms or applicable law.
Termination of a Business Account shall not:
• affect outstanding payment obligations;
• cancel completed transactions;
• extinguish accrued rights or liabilities;
• affect confidentiality obligations; or
• prejudice any legal remedies available to either party.

J. Record Retention
The Company may retain account records, transaction history, invoices, communications, verification documents, and other business records for such period as is reasonably necessary to:
• comply with applicable law;
• satisfy taxation and accounting requirements;
• resolve disputes;
• prevent fraud;
• enforce contractual rights; or
• meet legitimate business and regulatory obligations.
Such records shall be handled in accordance with the Company's Business Privacy Policy and applicable data protection laws.

K. Business Customer Responsibilities
The Business Customer is responsible for:
• maintaining internal controls over account access;
• ensuring that Authorized Users comply with these Terms;
• protecting confidential credentials;
• promptly reporting suspected security incidents;
• reviewing account activity on a regular basis;
• ensuring that Orders submitted through the Account are authorized; and
• complying with all applicable laws and Company policies.
The Business Customer acknowledges that actions performed through its Business Account may be relied upon by the Company as authorized business instructions unless proven otherwise.

L. Statutory Compliance
Nothing contained in this Chapter shall:
• exclude, restrict, or limit any legal obligation imposed upon the Company under applicable law;
• prevent the Company from complying with lawful requests or regulatory requirements;
• affect rights or obligations arising under separate written agreements; or
• limit any rights that cannot lawfully be excluded or restricted.
Where any provision of this Chapter conflicts with mandatory legal requirements, the applicable law shall prevail to the extent of such inconsistency.`
    },
    {
      title: "Chapter 5 – Products & Services",
      content: `This Chapter governs the Products and Services made available through the Business-to-Business ("B2B") Platform operated by Peoples League Of Electronics Private Limited ("Company", "PLE", "we", "our", or "us"). The Company provides a commercial procurement platform through which Business Customers may purchase Products and access related Services offered by the Company and, where applicable, by authorized Sellers, Suppliers, Distributors, and Manufacturers. Availability of any Product or Service shall always remain subject to stock availability, commercial feasibility, regulatory requirements, and acceptance of the relevant Purchase Order or Contract.

A. Products Offered
The Company may offer a wide range of Products through its B2B Platform, including but not limited to:
• computer hardware;
• networking equipment;
• servers and storage solutions;
• consumer electronics;
• enterprise IT equipment;
• peripherals and accessories;
• office automation products;
• security and surveillance equipment;
• software and software licenses;
• cloud-based subscriptions;
• digital products;
• electrical and electronic components;
• industrial electronics; and
• any other Products introduced by the Company from time to time.
Product availability may vary based on region, inventory, Supplier availability, regulatory requirements, or other commercial considerations.

B. Marketplace Model
The Company operates a commercial marketplace and procurement platform. Products available through the Platform may be:
• sold directly by the Company;
• supplied through authorized Suppliers;
• distributed through authorized Distributors;
• manufactured by Original Equipment Manufacturers (OEMs);
• listed by authorized third-party Sellers; or
• fulfilled through one or more logistics or fulfillment partners.
Unless expressly stated otherwise, the Company is not the manufacturer of Products listed on the Platform.

C. Procurement Services
The Company may provide procurement-related services, including:
• sourcing Products from approved Suppliers;
• obtaining commercial quotations;
• coordinating with Manufacturers and Distributors;
• facilitating bulk procurement;
• assisting with commercial product selection;
• managing procurement workflows;
• coordinating deliveries; and
• providing post-sale commercial support.
Provision of procurement services does not guarantee Product availability or acceptance of any Purchase Order.

D. Product Information
The Company endeavours to provide accurate Product information, including:
• specifications;
• technical descriptions;
• compatibility information;
• model numbers;
• images;
• pricing;
• certifications;
• warranty information; and
• availability.
Product descriptions are provided for general commercial information. Business Customers remain responsible for verifying that Products are suitable for their intended business, operational, technical, regulatory, and compatibility requirements before placing an Order.

E. Product Availability
All Products are offered subject to availability. The Company reserves the right to:
• discontinue any Product;
• modify Product offerings;
• substitute equivalent Products where agreed by the Business Customer;
• limit available quantities;
• allocate inventory among customers;
• refuse Orders due to inventory shortages; or
• suspend Product availability due to operational, legal, regulatory, or commercial reasons.
Listing a Product on the Platform does not constitute a guarantee of availability.

F. Product Specifications
Manufacturers may revise Product specifications, packaging, firmware, software, documentation, or technical features without prior notice. Unless expressly agreed in writing:
• minor variations shall not constitute a breach of these Terms;
• Product images are illustrative and may differ from the actual Product;
• packaging may vary between production batches; and
• software or firmware versions may differ from those displayed on the Platform.
Where a material specification changes before shipment, the Company shall use reasonable efforts to notify the Business Customer where practicable.

G. Software and Digital Products
Where Products include software, firmware, digital content, cloud services, or subscription-based offerings:
• use may be governed by separate license agreements issued by the relevant Manufacturer or software provider;
• license terms shall remain binding upon the Business Customer;
• activation may require registration with the software provider;
• subscription periods shall be governed by the applicable license; and
• the Company is not responsible for third-party licensing decisions or software usage restrictions.
Business Customers agree to comply with all applicable software licensing terms.

H. Third-Party Products
Products supplied by independent Sellers, Suppliers, Distributors, or Manufacturers may be subject to additional commercial terms imposed by those parties. Where applicable:
• Manufacturer warranties shall be governed by the Manufacturer's warranty documentation;
• software licenses shall be governed by the applicable licensor;
• installation services may be performed by authorized service providers; and
• technical certifications may originate from the Manufacturer.
Nothing in this Section limits the Company's obligations expressly undertaken under these Terms or under any separate written agreement.

I. Value-Added Services
The Company may offer value-added business services, including but not limited to:
• product sourcing;
• commercial quotations;
• procurement assistance;
• logistics coordination;
• installation coordination;
• technical consultation;
• extended warranty offerings;
• after-sales support coordination;
• project procurement assistance;
• enterprise account management; and
• other commercial services introduced from time to time.
Availability of such services may depend upon location, Product category, Supplier participation, and applicable commercial agreements.

J. Product Compliance
The Company endeavours to source Products from legitimate Manufacturers, Suppliers, Distributors, and authorized Sellers. Where applicable, Products may comply with relevant:
• safety standards;
• certification requirements;
• regulatory approvals;
• environmental regulations; and
• quality standards.
Business Customers remain responsible for ensuring that Products comply with any industry-specific, organizational, contractual, or regulatory requirements applicable to their intended use.

K. Product Pricing
Product pricing is governed by the applicable quotation, Purchase Order, invoice, Contract, or commercial agreement. Prices displayed on the Platform:
• may change without prior notice until an Order is accepted;
• may vary based on quantity, availability, negotiated commercial terms, promotional offers, or Supplier pricing;
• may exclude applicable Taxes, shipping charges, installation charges, insurance, customs duties, or other fees unless expressly stated otherwise; and
• remain subject to correction in the event of genuine clerical, technical, or pricing errors.
Final pricing shall be determined in accordance with the accepted commercial documentation governing the transaction.

L. Business Customer Responsibilities
Business Customers are responsible for:
• reviewing Product specifications before purchase;
• ensuring Product compatibility with their systems and intended applications;
• obtaining any required regulatory approvals, licenses, or permits for their intended use;
• complying with applicable laws governing the use, installation, storage, export, or resale of Products; and
• using Products in accordance with the Manufacturer's instructions and applicable safety requirements.
The Company shall not be responsible for losses arising from improper installation, misuse, unauthorized modifications, or use inconsistent with the Product's intended purpose.

M. Statutory Compliance
Nothing contained in this Chapter shall:
• exclude, restrict, or limit any legal obligation imposed upon the Company under applicable law;
• affect any express warranty or contractual commitment provided by the Company;
• limit any rights or remedies that cannot lawfully be excluded by contract; or
• prevent the Company from complying with applicable legal or regulatory requirements.
Where any provision of this Chapter conflicts with mandatory legal requirements, the applicable law shall prevail to the extent of such inconsistency.`
    },
    {
      title: "Chapter 6 – Quotations & Pricing",
      content: `This Chapter governs the issuance of quotations, pricing, commercial offers, and related pricing terms applicable to Products and Services offered through the Business-to-Business ("B2B") Platform operated by Peoples League Of Electronics Private Limited ("Company", "PLE", "we", "our", or "us"). All quotations and pricing are provided solely for legitimate commercial purposes and are subject to these Terms, any applicable Purchase Order, executed Contract, and any separate written agreement between the parties.

A. Quotations
The Company may issue written quotations upon request from a Business Customer. A quotation may include, where applicable:
• Product descriptions;
• model numbers;
• technical specifications;
• quantities;
• unit pricing;
• total pricing;
• applicable Taxes;
• estimated delivery timelines;
• payment terms;
• warranty information;
• quotation validity period; and
• any special commercial conditions.
Unless expressly stated otherwise, a quotation is an invitation to negotiate and does not constitute a legally binding offer capable of acceptance by the Business Customer.

B. Quotation Validity
Each quotation shall remain valid only for the period expressly specified in the quotation. Where no validity period is specified, the Company reserves the right to withdraw, modify, or revise the quotation at any time before acceptance of the corresponding Purchase Order. Upon expiry of the quotation validity period, pricing and commercial terms may be revised without prior notice.

C. Pricing
Product and Service pricing may be determined based on factors including:
• Manufacturer pricing;
• Supplier pricing;
• Distributor pricing;
• market conditions;
• exchange rate fluctuations;
• Product availability;
• order quantities;
• procurement costs;
• freight and logistics costs;
• insurance costs;
• applicable Taxes;
• negotiated commercial arrangements; and
• any other relevant commercial considerations.
Pricing may vary between Business Customers based on negotiated agreements or approved commercial programs.

D. Taxes and Government Charges
Unless expressly stated otherwise in writing:
• all prices are exclusive of applicable Taxes;
• Goods and Services Tax (GST) shall be charged at the applicable statutory rate;
• customs duties, import duties, levies, cess, withholding taxes, or similar governmental charges shall be borne by the party responsible under applicable law or the relevant commercial agreement; and
• the Business Customer shall provide any documentation reasonably required for tax compliance.
The Company shall issue invoices in accordance with applicable taxation laws.

E. Freight, Insurance and Additional Charges
Unless expressly included within the quotation, pricing may exclude:
• shipping charges;
• freight charges;
• insurance;
• packaging charges;
• installation costs;
• commissioning services;
• unloading charges;
• customs clearance expenses;
• storage charges;
• handling fees; and
• any other ancillary charges.
Such charges shall be separately communicated or reflected in the applicable quotation, Purchase Order, invoice, or Contract.

F. Pricing Errors
Despite reasonable efforts, pricing errors, typographical mistakes, calculation errors, technical issues, or system malfunctions may occasionally occur. If the Company discovers a genuine pricing error before accepting a Purchase Order, it may:
• correct the pricing;
• issue a revised quotation;
• request confirmation from the Business Customer; or
• decline the Order without liability.
Where an Order has already been accepted, the Company shall work with the Business Customer in good faith to resolve the issue in accordance with applicable law and any executed Contract.

G. Price Revisions
The Company reserves the right to revise Product or Service pricing before acceptance of a Purchase Order due to:
• Manufacturer price revisions;
• Supplier cost changes;
• changes in Taxes;
• regulatory changes;
• exchange rate fluctuations;
• freight or logistics cost increases;
• changes in Product availability;
• discontinuation of Products; or
• other commercially reasonable circumstances beyond the Company's control.
No price revision shall affect an accepted Purchase Order unless expressly permitted under the applicable Contract or required by law.

H. Discounts and Promotional Pricing
The Company may, at its sole discretion, offer:
• volume discounts;
• negotiated commercial pricing;
• promotional pricing;
• project-specific pricing;
• tender pricing;
• institutional pricing;
• reseller pricing;
• channel partner pricing; or
• other commercial incentives.
Unless expressly agreed in writing:
• discounts shall not be cumulative;
• promotional pricing shall remain subject to availability;
• discounts shall not create an ongoing entitlement for future Orders; and
• promotional programs may be modified or withdrawn without prior notice.

I. Currency
Unless otherwise agreed in writing, all quotations, invoices, Purchase Orders, and commercial transactions shall be denominated in the currency specified by the Company. Where foreign currency transactions are agreed, pricing may be adjusted to reflect:
• exchange rate movements;
• banking charges;
• import costs;
• regulatory requirements; and
• other agreed commercial terms.

J. Custom Quotations
For project-based procurement, enterprise deployments, government tenders, institutional procurements, or other specialized commercial transactions, the Company may issue customized quotations containing additional commercial terms, including:
• milestone-based pricing;
• phased deliveries;
• project implementation schedules;
• customized warranty terms;
• service-level commitments;
• installation services;
• support arrangements; and
• other mutually agreed commercial conditions.
In the event of any inconsistency, the mutually executed written agreement or accepted quotation shall prevail over this Chapter to the extent of the inconsistency.

K. Non-Binding Estimates
Any indicative pricing, budgetary estimates, preliminary quotations, catalog prices, or verbal pricing information provided by the Company are for informational purposes only and do not constitute binding commercial commitments. Only a written quotation or other commercial document issued by the Company and accepted in accordance with these Terms shall form the basis of a commercial transaction.

L. Business Customer Responsibilities
The Business Customer shall:
• review quotations carefully before placing a Purchase Order;
• verify Product specifications and quantities;
• notify the Company of any discrepancies without undue delay;
• ensure that Purchase Orders accurately reflect the agreed commercial terms; and
• obtain any internal approvals required before accepting a quotation or placing an Order.
Failure to identify obvious discrepancies before acceptance may delay Order processing or require the issuance of revised commercial documentation.

M. Good Faith
Both parties shall act in good faith during quotation, pricing negotiations, and commercial discussions. Neither party shall knowingly provide false, misleading, or fraudulent information or engage in conduct intended to manipulate pricing or procurement processes.

N. Compliance with Applicable Law
Nothing contained in this Chapter shall:
• exclude, restrict, or limit any legal obligation imposed upon either party under applicable law;
• prevent the Company from correcting genuine pricing errors in accordance with applicable law;
• affect any binding pricing terms contained in an executed written agreement; or
• limit any rights or remedies that cannot lawfully be excluded by contract.
Where any provision of this Chapter conflicts with mandatory legal requirements, the applicable law shall prevail to the extent of such inconsistency.`
    },
    {
      title: "Chapter 7 – Purchase Orders",
      content: `This Chapter governs the submission, acceptance, modification, execution, and administration of Purchase Orders ("POs") placed through the Business-to-Business ("B2B") Platform operated by Peoples League Of Electronics Private Limited ("Company", "PLE", "we", "our", or "us"). All Purchase Orders shall be subject to these Terms, the applicable quotation, executed commercial agreements, and any other mutually agreed written terms.

A. Submission of Purchase Orders
A Business Customer may submit a Purchase Order through:
• the Company's B2B Platform;
• an approved procurement portal;
• email;
• electronic data interchange (EDI), where supported;
• application programming interfaces (APIs), where available; or
• any other method expressly approved by the Company.
Each Purchase Order should accurately specify, where applicable:
• Product descriptions;
• model numbers;
• quantities;
• pricing;
• delivery location(s);
• billing information;
• requested delivery schedule;
• reference quotation;
• payment terms; and
• any other applicable commercial requirements.
Submission of a Purchase Order does not obligate the Company to accept or fulfill it.

B. Review and Acceptance
Upon receipt of a Purchase Order, the Company may review it for:
• Product availability;
• pricing accuracy;
• technical specifications;
• commercial feasibility;
• payment arrangements;
• compliance with applicable laws;
• internal approval requirements; and
• consistency with any applicable quotation or commercial agreement.
A Purchase Order shall become binding only upon the Company's written acceptance, issuance of an Order Confirmation, commencement of performance, or any other form of acceptance expressly communicated by the Company. Until such acceptance, the Company may accept, reject, or request modifications to the Purchase Order.

C. Order Confirmation
Where a Purchase Order is accepted, the Company may issue an Order Confirmation containing, as applicable:
• Order reference number;
• accepted Products or Services;
• confirmed quantities;
• pricing;
• delivery schedule;
• payment terms;
• shipping arrangements;
• estimated fulfillment timeline; and
• any special commercial conditions.
The Business Customer should promptly review the Order Confirmation and notify the Company of any discrepancies without undue delay.

D. Modification and Fulfillment of Purchase Orders
A Purchase Order may only be modified before acceptance by the Company unless otherwise agreed in writing. Following acceptance, any changes requested by the Business Customer regarding quantities, delivery schedules, product specifications, or shipping locations shall require mutual written consent and may result in adjustments to pricing, delivery timelines, or ancillary fees. Fulfillment of Purchase Orders shall be carried out in accordance with agreed commercial terms, logistics procedures, and applicable laws.`
    }
  ];

  const sections = [
    {
      title: "1. Definitions",
      content: `For the purposes of these Terms & Conditions, the following terms shall have the meanings assigned to them below unless the context otherwise requires: 1. "Company", "PLE", "we", "our", or "us" means Peoples League Of Electronics Private Limited, its successors, affiliates, subsidiaries, assigns, directors, officers, employees, representatives, and authorized partners.  2. "Platform" means the PLE mobile application, website(s), web applications, software, APIs, digital services, and any other products or services owned, operated, or provided by the Company.  3. "User", "Customer", "you", or "your" means any individual who accesses, browses, registers, purchases from, or otherwise uses the Platform.  4. "Account" means a registered user profile created to access certain features and services available on the Platform.  5. "Products" means all physical goods, digital goods, software, subscriptions, accessories, services, warranties, or any other items offered through the Platform.  6. "Order" means a request submitted by a User to purchase one or more Products through the Platform.  7. "Seller" means Peoples League Of Electronics Private Limited and, where applicable, any authorized third-party seller, vendor, distributor, manufacturer, or merchant permitted to offer Products through the Platform.  8. "Content" includes text, graphics, logos, trademarks, software, images, videos, product descriptions, audio, data, documentation, designs, code, and all other material available on the Platform.  9. "Applicable Laws" means all laws, regulations, notifications, rules, circulars, judicial decisions, and governmental directives applicable within the Republic of India and any other jurisdiction where the Platform legally operates.  10. "Business Day" means any day other than Saturdays, Sundays, and public holidays on which banks are generally open for business in India, unless otherwise specified.  11. "Services" means all services, features, functionalities, support, digital tools, promotions, offers, customer assistance, and related facilities made available through the Platform.  12. "Third-Party Services" means services, software, payment gateways, logistics providers, financing partners, manufacturers, warranty providers, advertisers, analytics providers, or any external entity integrated with or accessible through the Platform.  13. Words importing the singular include the plural and vice versa. Headings are provided solely for convenience and shall not affect the interpretation of these Terms.`
    },
    {
      title: "2. Acceptance of Terms",
      content: `1. These Terms & Conditions ("Terms") constitute a legally binding agreement between Peoples League Of Electronics Private Limited ("Company", "PLE", "we", "our", or "us") and any person who accesses, browses, registers, purchases from, or otherwise uses the Platform ("User", "Customer", "you", or "your").  2. By accessing or using the Platform, creating an Account, placing an Order, purchasing any Product or Service, or otherwise interacting with the Platform, you acknowledge that you have read, understood, and agree to be bound by these Terms, our Privacy Policy, and all other policies incorporated by reference.  3. If you do not agree to these Terms or any incorporated policy, you must immediately discontinue use of the Platform and refrain from accessing or using any of its Products or Services.  4. These Terms apply to all visitors, registered users, purchasers, and any other individuals or entities accessing or using the Platform, whether through the website, mobile application, or any other authorized channel operated by the Company.  5. Certain Products, Services, promotional offers, payment methods, or Platform features may be subject to additional terms, conditions, guidelines, or agreements. In the event of a conflict between these Terms and such specific terms, the specific terms shall prevail only to the extent of such conflict.  6. The Company reserves the right to modify, amend, update, or replace these Terms at any time in its sole discretion to reflect changes in law, business operations, technology, security requirements, or Platform functionality. Updated Terms shall become effective upon publication on the Platform unless otherwise stated.  7. Your continued access to or use of the Platform after any modification to these Terms constitutes your acceptance of the revised Terms. If you do not agree to any revised Terms, you must discontinue use of the Platform.  8. Nothing in these Terms shall be construed as creating any partnership, agency, joint venture, employment, franchise, or fiduciary relationship between you and the Company.  9. These Terms are governed by the applicable laws of India and are intended to comply with all applicable legal and regulatory requirements governing electronic commerce and consumer transactions, to the extent applicable.`
    },
    {
      title: "3. Eligibility",
      content: `1. The Platform is intended for use only by individuals who are legally competent to enter into binding contracts under the applicable laws of India.  2. By accessing or using the Platform, you represent and warrant that:  o You are at least eighteen (18) years of age, or have attained the age of majority under the laws applicable to you;  o You possess the legal capacity and authority to enter into and comply with these Terms;  o All information provided by you is true, accurate, complete, and up to date; and  o Your use of the Platform does not violate any applicable law, regulation, court order, or contractual obligation.  3. Individuals below the age of eighteen (18) years ("Minors") may use the Platform only under the supervision and consent of a parent or lawful guardian who agrees to be bound by these Terms. Any transaction carried out by or on behalf of a Minor shall be deemed to have been authorized by such parent or guardian, who shall remain responsible for the Minor's actions and obligations arising from the use of the Platform.  4. The Company reserves the right to request proof of identity, age, or any other information reasonably necessary to verify a User's eligibility at any time. Failure to provide satisfactory information may result in suspension, restriction, or termination of access to the Platform or cancellation of any pending Order, where permitted by applicable law.  5. The Company may, at its sole discretion and subject to applicable law, refuse access to the Platform, decline registration, restrict certain features, or reject any Order if it reasonably believes that a User:  o Is not eligible to use the Platform;  o Has provided false, misleading, or incomplete information;  o Has violated these Terms or any applicable policy;  o Is engaging in fraudulent, abusive, unlawful, or suspicious activities; or  o Poses a security, financial, operational, or legal risk to the Company, other Users, Sellers, or third parties.  6. Where a User is acting on behalf of another individual or organization, such User represents and warrants that they possess all necessary authority to bind such individual or organization to these Terms.  7. The Company shall not be liable for any loss, damage, liability, or claim arising from a User's misrepresentation regarding their identity, age, authority, or legal capacity to use the Platform.`
    },
    {
      title: "2. Account Registration & Safety",
      content:
        "When registering, you agree to supply authentic, exact, and complete registration details. You are responsible for preserving credentials and password confidentiality and assume liability for actions occurring under your account.",
    },
    {
      title: "3. Acceptable Platform Use",
      content:
        "You must not abuse, disrupt, or exploit platform assets. Attempting unauthorized penetration, reverse-engineering our codebases, or executing automated scripts without permission is strictly prohibited.",
    },
    {
      title: "4. Purchasing & Payments",
      content:
        "We support diverse secure online payments. You warrant that you own or possess legal rights to use any selected credit card, mobile wallet, or online instrument. All transactions are final unless stated otherwise in our Return Policy.",
    },
    {
      title: "5. Intellectual Property Rights",
      content:
        "All visual designs, text assets, product lists, interactive widgets, scripts, source code, logo, and brand images are proprietary and intellectual properties of our system. No redistribution or cloning is permitted without consent.",
    },
  ];

  const activeSections = isB2BUser ? b2bSections : sections;

  const handleDownload = () => {
    const title = isB2BUser ? "BUSINESS TERMS & CONDITIONS (B2B) - Peoples League Of Electronics Private Limited" : "Terms & Conditions";
    const date = isB2BUser ? "Version: 1.0" : "Last updated: June 2026";
    const intro = isB2BUser
      ? "Welcome to the business-to-business (\"B2B\") platform operated by Peoples League Of Electronics Private Limited."
      : "Please read these Terms and Conditions carefully before utilizing our applications or placing orders on our store.";
    const content = activeSections.map((s) => `${s.title}\n${s.content}`).join("\n\n");
    const footer = isB2BUser
      ? "If you have questions about these Business Terms & Conditions, please contact our B2B legal desk at b2blegal@peoplesleagueofelectronics.com."
      : "If you have questions about these Terms, please reach out to our legal desk at legal@ple.com.";
    const fullText = `${title}\n${date}\n\n${intro}\n\n${content}\n\n${footer}`;

    const blob = new Blob([fullText], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = isB2BUser ? "B2B_Terms_And_Conditions.txt" : "Terms_Conditions.txt";
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <PageTransition>
      <MobileLayout showBottomNav={true} showCartBar={true}>
        <div className="max-w-3xl mx-auto px-4 py-6 pb-24 min-h-screen">
          {/* Header */}
          <div className="flex items-center justify-between gap-3 mb-6">
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  if (window.history.state && window.history.state.idx > 0) {
                    navigate(-1);
                  } else {
                    navigate("/profile");
                  }
                }}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors bg-white shadow-sm border border-gray-200"
              >
                <FiArrowLeft className="text-xl text-gray-700" />
              </button>
              <div>
                <h1 className="text-xl md:text-2xl font-extrabold text-gray-800 flex items-center gap-2">
                  <FiFileText className="text-[#7B0A0A]" /> {isB2BUser ? "Business Terms & Conditions (B2B)" : "Terms & Conditions"}
                </h1>
                <p className="text-xs text-gray-500 font-medium">
                  {isB2BUser ? "Peoples League Of Electronics Private Limited | Version 1.0" : "Last updated: June 2026"}
                </p>
              </div>
            </div>
            {isB2BUser ? (
              <button
                onClick={handleDownload}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-primary-600 text-white rounded-xl text-xs font-bold shadow-sm hover:bg-primary-700 transition-colors"
              >
                <FiDownload className="text-sm" />
                <span>Download</span>
              </button>
            ) : (
              isBusiness && (
                <button
                  onClick={handleDownload}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-primary-600 text-white rounded-xl text-xs font-bold shadow-sm hover:bg-primary-700 transition-colors"
                >
                  <FiDownload className="text-sm" />
                  <span>Download</span>
                </button>
              )
            )}
          </div>

          {/* Content Card */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-2xl border border-gray-100 p-6 md:p-8 shadow-sm space-y-6"
          >
            <p className="text-sm text-gray-600 leading-relaxed">
              {isB2BUser
                ? "Please read these Business Terms & Conditions (B2B) carefully before registering a business account, submitting quotations, or placing Purchase Orders on our B2B Platform."
                : "Please read these Terms and Conditions carefully before utilizing our applications or placing orders on our store."}
            </p>

            <div className="border-t border-gray-100 pt-6 space-y-6">
              {activeSections.map((section, idx) => (
                <div key={idx} className="space-y-2">
                  <h3 className="text-base font-bold text-gray-800">{section.title}</h3>
                  <div className="text-sm text-gray-600 leading-relaxed whitespace-pre-line">{section.content}</div>
                </div>
              ))}
            </div>

            <div className="border-t border-gray-100 pt-6 text-center">
              <p className="text-xs text-gray-500">
                {isB2BUser
                  ? "If you have questions about these Business Terms & Conditions, please contact our B2B legal desk at b2blegal@peoplesleagueofelectronics.com."
                  : "If you have questions about these Terms, please reach out to our legal desk at legal@ple.com."}
              </p>
            </div>
          </motion.div>
        </div>
      </MobileLayout>
    </PageTransition>
  );
};

export default TermsConditions;
