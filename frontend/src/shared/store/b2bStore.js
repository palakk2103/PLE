import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

const DEFAULT_BUSINESS_PROFILE = {
  companyName: 'Apex General Enterprises',
  gstNumber: '27AAPCG9838F1Z1',
  businessAddress: '404 Business Hub, BKC, Mumbai, MH - 400051',
  creditLimit: 500000,
  creditUsed: 125000,
  creditTerms: 'NET 30 Days',
  businessEmail: 'procurement@apexenterprises.in',
  businessPhone: '9876543210',
};

const DEFAULT_QUOTATIONS = [];

const DEFAULT_STOCK_REQUESTS = [
  {
    id: 'SR-7821',
    date: '24 May 2026',
    productId: 2,
    productName: 'Premium Basmati Rice',
    requiredQuantity: 500,
    unit: 'Kg',
    status: 'Seller Responded',
    businessName: 'Apex General Enterprises',
    expectedDeliveryDate: '2026-06-15',
    budgetRange: '₹50,000 - ₹75,000',
    notes: 'Need bulk order for upcoming festival season.',
  },
  {
    id: 'SR-7822',
    date: '25 May 2026',
    productId: 5,
    productName: 'Organic Olive Oil',
    requiredQuantity: 200,
    unit: 'Litre',
    status: 'Pending',
    businessName: 'Apex General Enterprises',
    expectedDeliveryDate: '2026-06-20',
    budgetRange: '₹30,000 - ₹50,000',
    notes: 'Premium quality required for retail chain.',
  },
];

const DEFAULT_COMPANIES = [
  {
    id: 'comp_apex_123',
    companyName: 'Apex General Enterprises',
    gstNumber: '27AAPCG9838F1Z1',
    businessEmail: 'procurement@apexenterprises.in',
    businessPhone: '9876543210',
    businessAddress: '404 Business Hub, BKC, Mumbai, MH - 400051',
    businessType: 'Wholesaler',
    website: 'https://apexenterprises.in',
    status: 'Active',
    admin: {
      name: 'Sarkar Raj',
      email: 'sarkarraj0766@gmail.com',
      phone: '9876543210'
    },
    employees: [
      {
        name: 'Rajesh Kumar',
        email: 'rajesh@kumarelectronics.com',
        phone: '9876500001',
        designation: 'Procurement Specialist',
        status: 'Active'
      },
      {
        name: 'Amit Patel',
        email: 'amit@pateltraders.com',
        phone: '9876500002',
        designation: 'Supply Manager',
        status: 'Active'
      }
    ]
  }
];

export const useB2bStore = create(
  persist(
    (set, get) => ({
      userRole: 'customer', // 'customer' or 'business_buyer'
      businessProfile: DEFAULT_BUSINESS_PROFILE,
      quotations: DEFAULT_QUOTATIONS,
      stockRequests: DEFAULT_STOCK_REQUESTS,
      companies: DEFAULT_COMPANIES,

      setUserRole: (role) => set({ userRole: role }),

      isBusinessBuyer: () => get().userRole === 'business_buyer',

      updateBusinessProfile: (updatedData) =>
        set((state) => ({
          businessProfile: { ...state.businessProfile, ...updatedData },
        })),

      addQuotation: (newQuote) =>
        set((state) => ({
          quotations: [
            {
              id: `RFQ-${Math.floor(1000 + Math.random() * 9000)}`,
              date: new Date().toLocaleDateString('en-IN', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
              }),
              status: 'Pending',
              ...newQuote,
            },
            ...state.quotations,
          ],
        })),

      addStockRequest: (newRequest) =>
        set((state) => ({
          stockRequests: [
            {
              id: `SR-${Math.floor(1000 + Math.random() * 9000)}`,
              date: new Date().toLocaleDateString('en-IN', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
              }),
              status: 'Pending',
              ...newRequest,
            },
            ...state.stockRequests,
          ],
        })),

      updateStockRequestStatus: (requestId, newStatus) =>
        set((state) => ({
          stockRequests: state.stockRequests.map((req) =>
            req.id === requestId ? { ...req, status: newStatus } : req
          ),
        })),

      // Company actions
      registerCompany: (companyData, adminData, employeesList = []) => {
        const companyId = `comp_${Math.floor(1000 + Math.random() * 9000)}`;
        const newCompany = {
          id: companyId,
          ...companyData,
          status: 'Active',
          admin: {
            name: adminData.name,
            email: adminData.email,
            phone: adminData.phone,
            password: adminData.password,
          },
          employees: employeesList.map(emp => ({
            ...emp,
            status: 'Active'
          }))
        };

        set((state) => ({
          companies: [...state.companies, newCompany],
          businessProfile: {
            companyName: newCompany.companyName,
            gstNumber: newCompany.gstNumber,
            businessAddress: newCompany.businessAddress,
            businessEmail: newCompany.businessEmail,
            businessPhone: newCompany.businessPhone,
            businessType: newCompany.businessType,
            website: newCompany.website,
          }
        }));

        return newCompany;
      },

      updateCompanyDetails: (companyId, details) => {
        set((state) => {
          const updatedCompanies = state.companies.map((c) =>
            c.id === companyId ? { ...c, ...details } : c
          );
          const currentCompany = updatedCompanies.find(c => c.id === companyId);
          return {
            companies: updatedCompanies,
            businessProfile: currentCompany ? {
              companyName: currentCompany.companyName,
              gstNumber: currentCompany.gstNumber,
              businessAddress: currentCompany.businessAddress,
              businessEmail: currentCompany.businessEmail,
              businessPhone: currentCompany.businessPhone,
              businessType: currentCompany.businessType,
              website: currentCompany.website,
            } : state.businessProfile
          };
        });
      },

      updateCompanyStatus: (companyId, status) => {
        set((state) => ({
          companies: state.companies.map((c) =>
            c.id === companyId ? { ...c, status } : c
          )
        }));
      },

      // Employee actions
      addEmployee: (companyId, employee) => {
        set((state) => ({
          companies: state.companies.map((c) => {
            if (c.id !== companyId) return c;
            // Avoid duplicate email
            if (c.employees.some(emp => emp.email.toLowerCase() === employee.email.toLowerCase())) {
              return c;
            }
            return {
              ...c,
              employees: [...c.employees, { ...employee, status: 'Active' }]
            };
          })
        }));
      },

      updateEmployee: (companyId, employeeEmail, updatedData) => {
        set((state) => ({
          companies: state.companies.map((c) => {
            if (c.id !== companyId) return c;
            return {
              ...c,
              employees: c.employees.map((emp) =>
                emp.email.toLowerCase() === employeeEmail.toLowerCase() ? { ...emp, ...updatedData } : emp
              )
            };
          })
        }));
      },

      toggleEmployeeStatus: (companyId, employeeEmail) => {
        set((state) => ({
          companies: state.companies.map((c) => {
            if (c.id !== companyId) return c;
            return {
              ...c,
              employees: c.employees.map((emp) =>
                emp.email.toLowerCase() === employeeEmail.toLowerCase()
                  ? { ...emp, status: emp.status === 'Active' ? 'Deactivated' : 'Active' }
                  : emp
              )
            };
          })
        }));
      },

      removeEmployee: (companyId, employeeEmail) => {
        set((state) => ({
          companies: state.companies.map((c) => {
            if (c.id !== companyId) return c;
            return {
              ...c,
              employees: c.employees.filter((emp) => emp.email.toLowerCase() !== employeeEmail.toLowerCase())
            };
          })
        }));
      },

      resetB2b: () => set({
        userRole: 'customer',
        businessProfile: DEFAULT_BUSINESS_PROFILE,
        quotations: DEFAULT_QUOTATIONS,
        stockRequests: DEFAULT_STOCK_REQUESTS,
        companies: DEFAULT_COMPANIES,
      }),
    }),
    {
      name: 'b2b-storage',
      storage: createJSONStorage(() => localStorage),
    }
  )
);
