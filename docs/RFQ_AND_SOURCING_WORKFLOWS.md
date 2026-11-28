# PLE eStore — How quotes, RFQs and sourcing work

Written for the Director's testing report (Feature 04 "RFQ Management" and Feature 06 "Source Now").
PLE eStore has **six separate ways** for a buyer and a seller to agree a price. They look similar but
work differently, which is why RFQ testing was confusing. This page explains each one end to end.

| # | Flow | Who starts it | Who answers | Super Admin involved? |
|---|------|---------------|-------------|-----------------------|
| 1 | **B2B RFQ** | Company admin or employee | Vendors chosen by the Super Admin | **Yes — required** |
| 2 | **Direct RFQ** | Company employee, to one vendor | That vendor | Monitors only |
| 3 | **Consumer RFQ** | Retail customer, on a product | The product's seller (vendor or PLE) | Only if PLE owns the product |
| 4 | **Source Now** | Any buyer, for a product not listed | Vendors, after the Super Admin opens it | **Yes — required** (for general requests) |
| 5 | **Chat offer (Transaction Box)** | Vendor, inside a chat | Buyer accepts or declines | No |
| 6 | **Enquire Now** | Buyer, from a product page | Seller, in chat | No |

---

## 1. B2B RFQ (company procurement)

1. **Company** — B2B Dashboard → *Sourcing / RFQs* → *New RFQ*. Choose a catalogue product or type a custom one, quantity, target price per unit, delivery date, attachment. *Save Draft* or *Submit*.
   Status: `Draft` → `Submitted`.
2. **Super Admin** — Admin → *B2B Enquiries* → open the RFQ → **Assign vendors** (only approved vendors are listed).
   Status: `Sent To Vendors`. **Vendors see nothing before this step.**
3. **Vendors** — Vendor panel → *B2B Enquiries* → open → *Create Quote* (unit price, total, delivery time, warranty, tax notes). The total cannot be less than unit price × quantity.
   Status: `Quotations Received`.
4. **Super Admin** — compares quotes, can message each vendor, then **Select vendor** → **Submit for B2B approval**.
   Status: `Vendor Selected` → `Awaiting B2B Approval`. From here the vendor can no longer change the quote.
5. **Company admin** — B2B Dashboard → open the RFQ → **Confirm quote**, **Reject**, or **Request renegotiation** (re-opens quoting: `Vendor Negotiation`). Employees can view but not approve.
6. On confirmation a **Purchase Order** is generated (`Purchase Order Generated`); the company admin pays it from *Purchase Orders*.

## 2. Direct RFQ (employee → one vendor)

- **Employee** — B2B Dashboard → *New RFQ* → pick a specific vendor → *Submit*. It goes straight to that vendor (no Super Admin step).
- **Vendor** — Vendor panel → *Direct RFQs* → reply in the thread.
- **Super Admin** — Admin → *Direct RFQs*: read-only monitoring.

## 3. Consumer RFQ (retail customer asks for a better price)

1. **Customer** — product page → *Request Quote* (quantity + expected price). Listed under Profile → *My Quotation Requests* (`/consumer-rfqs`).
2. **Seller** — if the product is a vendor's: Vendor panel → *Consumer RFQs*; if it is PLE's own: Admin → *Consumer RFQs*. Send a quotation.
3. Both sides can **counter-offer** and message until one side **accepts** (`Accepted`).
4. **Customer** — *Convert to order*: checkout at the agreed price (`Converted To Order`).

## 4. Source Now (product not on the platform)

1. **Buyer** — *Source Now* (`/product-requests/new`, or from a seller's store page for a store-specific request): product name, category, quantity, budget, optional photo (JPG/PNG/WEBP/GIF, max 10 MB — iPhone HEIC photos are not accepted).
   Status: `Submitted`.
   - **Store-specific request**: the chosen vendor is notified immediately.
   - **General request**: only the Super Admin is notified — **vendors do not see it yet**.
2. **Super Admin** — Admin → *Product Requests* → **Open vendor window** (sets how many days vendors have). All approved vendors are notified. Status: `Vendor Window Open`.
3. **Vendor** — Vendor panel → *Product Requests* → **Accept** to lock the request (`Vendor Accepted`), then **Submit quotation** (`Quotation Submitted`). A vendor can also release it or ask for more time.
4. **Buyer** — opens the request:
   - **Approve** the quotation, or
   - **Request changes** (message, desired price, desired delivery) → `Negotiation`. The vendor gets a notification **and** a message in their chat for this request. The buyer may add more change requests while waiting.
5. **Vendor** re-quotes → buyer approves → buyer **confirms with a delivery address and pays** (Razorpay). Status `Confirmed` only after the payment is verified.

## 5. Chat offer / Transaction Box

- In any buyer–vendor chat the **vendor** clicks *Propose Agreed Price* and picks one of their catalogue products, quantity, unit price, discount and delivery charge.
- **GST is calculated automatically** from the product's GST rate (it is no longer typed in by hand), and the discount cannot exceed the product amount.
- Total = quantity × unit price − discount + GST + delivery. The same numbers are used at checkout and on the invoice.
- **Buyer** accepts → *Proceed to Official Checkout* pays exactly that amount (coupons/loyalty points cannot be combined). Contact details in chat are blocked by the moderation layer so payment stays on-platform.

## 6. Enquire Now

- **Business buyer** — product page → *Enquire Now* opens a chat with the seller about that product. The **selected variant** (e.g. "Color: Red | Size: M") is sent and shown to the seller; choosing another variant later adds a note to the same chat.
- The seller can answer and, if a price is agreed, send a chat offer (flow 5).

---

### Where the Super Admin watches everything for one vendor

Admin → *Vendors* → open a vendor:
- **Products** tab — every product the vendor listed, with links to open each one.
- **Monitoring** tab — sales, returns, customer chats (open any transcript), and **RFQs, sourcing and enquiries** with links to each conversation.
