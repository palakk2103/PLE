import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { FiSearch, FiPlus, FiEdit2, FiTrash2, FiEye, FiEyeOff, FiX, FiDollarSign, FiShoppingBag } from 'react-icons/fi';
import DataTable from '../../Admin/components/DataTable';
import ConfirmModal from '../../Admin/components/ConfirmModal';
import { useB2BAdminStore } from '../store/b2bAdminStore';

const EmployeeManagement = () => {
  const navigate = useNavigate();
  const { employees, fetchEmployees, createEmployee, updateEmployee, deleteEmployee, allotEmployeeWallet, isLoading } = useB2BAdminStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [deleteModal, setDeleteModal] = useState({ isOpen: false, id: null, name: '' });
  
  // Allot funds modal state
  const [allotModal, setAllotModal] = useState({ isOpen: false, employeeId: null, name: '', amount: '' });

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    id: null,
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    password: '',
    department: '',
    designation: '',
    status: 'Active',
    b2bWalletBalance: 0,
    b2bSpendingLimit: 0
  });

  useEffect(() => {
    fetchEmployees();
  }, [fetchEmployees]);

  const filteredEmployees = employees.filter(emp =>
    `${emp.firstName} ${emp.lastName}`.toLowerCase().includes(searchQuery.toLowerCase()) ||
    emp.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (emp.department && emp.department.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const handleDelete = async (id) => {
    await deleteEmployee(id);
    setDeleteModal({ isOpen: false, id: null, name: '' });
  };

  const openAddModal = () => {
    setIsEditing(false);
    setShowPassword(false);
    setFormData({ id: null, firstName: '', lastName: '', email: '', phone: '', password: '', department: '', designation: '', status: 'Active', b2bWalletBalance: 0, b2bSpendingLimit: 0 });
    setIsModalOpen(true);
  };

  const openEditModal = (employee) => {
    setIsEditing(true);
    setShowPassword(false);
    setFormData({
      id: employee._id,
      firstName: employee.firstName,
      lastName: employee.lastName,
      email: employee.email,
      phone: employee.phone || '',
      password: '', // Leave blank when editing unless changing
      department: employee.department || '',
      designation: employee.designation || '',
      status: employee.isActive === false ? 'Inactive' : 'Active',
      b2bWalletBalance: employee.b2bWalletBalance || 0,
      b2bSpendingLimit: employee.b2bSpendingLimit || 0
    });
    setIsModalOpen(true);
  };

  const openAllotModal = (employee) => {
    setAllotModal({
      isOpen: true,
      employeeId: employee._id,
      name: `${employee.firstName} ${employee.lastName}`,
      amount: ''
    });
  };

  const handleAllotSubmit = async (e) => {
    e.preventDefault();
    const success = await allotEmployeeWallet(allotModal.employeeId, Number(allotModal.amount));
    if (success) {
      setAllotModal({ isOpen: false, employeeId: null, name: '', amount: '' });
    }
  };

  const handleModalSubmit = async (e) => {
    e.preventDefault();
    if (isEditing) {
      const success = await updateEmployee(formData.id, formData);
      if (success) setIsModalOpen(false);
    } else {
      const success = await createEmployee(formData);
      if (success) setIsModalOpen(false);
    }
  };

  const columns = [
    {
      key: 'name',
      label: 'Employee Name',
      sortable: true,
      render: (_, row) => (
        <div className="flex items-center">
          <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold mr-3 flex-shrink-0">
            {row.firstName?.charAt(0) || ''}{row.lastName?.charAt(0) || ''}
          </div>
          <div>
            <p className="font-medium text-gray-800">{row.firstName} {row.lastName}</p>
            <p className="text-xs text-gray-500">{row.email}</p>
          </div>
        </div>
      )
    },
    {
      key: 'department',
      label: 'Department',
      sortable: true,
      render: (value) => <span className="text-sm text-gray-700">{value || '-'}</span>
    },
    {
      key: 'designation',
      label: 'Designation',
      sortable: true,
      render: (value) => <span className="text-sm text-gray-700">{value || '-'}</span>
    },
    {
      key: 'b2bWalletBalance',
      label: 'Allotted Wallet',
      sortable: true,
      render: (value) => <span className="text-sm font-bold text-gray-700">₹{(value || 0).toLocaleString()}</span>
    },
    {
      key: 'b2bSpendingLimit',
      label: 'Spending Limit',
      sortable: true,
      render: (value) => <span className="text-sm text-gray-700">{value ? `₹${value.toLocaleString()}` : 'Unlimited'}</span>
    },
    {
      key: 'isActive',
      label: 'Status',
      sortable: true,
      render: (value) => {
        const displayStatus = value ? 'Active' : 'Inactive';
        return (
          <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${value ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
            }`}>
            {displayStatus}
          </span>
        );
      }
    },
    {
      key: 'actions',
      label: 'Actions',
      sortable: false,
      render: (_, row) => (
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate(`/b2b-dashboard/employees/${row._id}`)}
            className="p-1.5 text-gray-700 hover:bg-gray-100 rounded transition-colors"
            title="View Purchases"
          >
            <FiShoppingBag />
          </button>
          <button
            onClick={() => openAllotModal(row)}
            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors"
            title="Allot Funds"
          >
            <FiDollarSign />
          </button>
          <button
            onClick={() => openEditModal(row)}
            className="p-1.5 text-green-600 hover:bg-green-50 rounded transition-colors"
            title="Edit"
          >
            <FiEdit2 />
          </button>
          <button
            onClick={() => setDeleteModal({ isOpen: true, id: row._id, name: `${row.firstName} ${row.lastName}` })}
            className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
            title="Delete"
          >
            <FiTrash2 />
          </button>
        </div>
      )
    }
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Employee Management</h1>
          <p className="text-gray-600 text-sm mt-1">Manage your company's employees and their access.</p>
        </div>
        <button
          onClick={openAddModal}
          className="flex items-center justify-center px-4 py-2 bg-[#D71920] text-white rounded-lg hover:bg-[#B51218] transition-colors shadow-sm font-medium"
        >
          <FiPlus className="mr-2" /> Add Employee
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search employees by name, email, or department..."
              className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#D71920] text-sm"
            />
          </div>
        </div>

        {isLoading && employees.length === 0 ? (
          <div className="flex justify-center items-center h-48"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#D71920]"></div></div>
        ) : filteredEmployees.length > 0 ? (
          <DataTable
            data={filteredEmployees}
            columns={columns}
            pagination={true}
            itemsPerPage={10}
          />
        ) : (
          <div className="text-center py-12 text-gray-500">
            No employees found matching your criteria.
          </div>
        )}
      </div>

      <ConfirmModal
        isOpen={deleteModal.isOpen}
        onClose={() => setDeleteModal({ isOpen: false, id: null, name: '' })}
        onConfirm={() => handleDelete(deleteModal.id)}
        title="Remove Employee"
        message={`Are you sure you want to remove ${deleteModal.name}? They will no longer be able to access the B2B portal.`}
        confirmText="Remove"
        cancelText="Cancel"
        type="danger"
      />

      {/* Employee Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-xl shadow-xl w-full max-w-xl overflow-hidden"
          >
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h2 className="text-xl font-bold text-gray-800">{isEditing ? 'Edit Employee' : 'Add New Employee'}</h2>
              <button onClick={() => setIsModalOpen(false)} className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition-colors">
                <FiX className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleModalSubmit} className="p-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">First Name *</label>
                  <input type="text" required value={formData.firstName} onChange={e => setFormData({ ...formData, firstName: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D71920] outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Last Name *</label>
                  <input type="text" required value={formData.lastName} onChange={e => setFormData({ ...formData, lastName: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D71920] outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                  <input type="email" required disabled={isEditing} value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D71920] outline-none disabled:bg-gray-100" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                  <input type="text" value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D71920] outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Password {isEditing ? '(Leave blank to keep)' : '*'}</label>
                  <div className="relative">
                    <input type={showPassword ? 'text' : 'password'} required={!isEditing} minLength={6} value={formData.password} onChange={e => setFormData({ ...formData, password: e.target.value })} className="w-full pl-3 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D71920] outline-none" />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400">
                      {showPassword ? <FiEyeOff size={18} /> : <FiEye size={18} />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
                  <input type="text" value={formData.department} onChange={e => setFormData({ ...formData, department: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D71920] outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Designation</label>
                  <input type="text" value={formData.designation} onChange={e => setFormData({ ...formData, designation: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D71920] outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <select value={formData.status} onChange={e => setFormData({ ...formData, status: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D71920] outline-none">
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                    <option value="Suspended">Suspended</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Monthly Spending Limit (₹) (0 for unlimited)</label>
                  <input type="number" min={0} value={formData.b2bSpendingLimit} onChange={e => setFormData({ ...formData, b2bSpendingLimit: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D71920] outline-none" />
                </div>
                {!isEditing && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Initial Wallet Allotment (₹)</label>
                    <input type="number" min={0} value={formData.b2bWalletBalance} onChange={e => setFormData({ ...formData, b2bWalletBalance: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D71920] outline-none" />
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-100">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-gray-600 bg-gray-50 rounded-lg hover:bg-gray-100 font-medium">Cancel</button>
                <button type="submit" disabled={isLoading} className="px-4 py-2 bg-[#D71920] text-white rounded-lg hover:bg-[#B51218] font-medium disabled:opacity-50 flex items-center">
                  {isLoading && <span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full mr-2"></span>}
                  {isEditing ? 'Save Changes' : 'Create Employee'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* Allot Wallet Modal */}
      {allotModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden"
          >
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h2 className="text-xl font-bold text-gray-800">Allot Wallet Funds</h2>
              <button onClick={() => setAllotModal({ ...allotModal, isOpen: false })} className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition-colors">
                <FiX className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAllotSubmit} className="p-5 space-y-4">
              <div>
                <p className="text-sm text-gray-600">Allotting wallet funds to <strong>{allotModal.name}</strong> from the company wallet.</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Amount to Allot (₹) *</label>
                <input type="number" required min={1} value={allotModal.amount} onChange={e => setAllotModal({ ...allotModal, amount: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D71920] outline-none" placeholder="Enter amount to transfer" />
              </div>

              <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-100">
                <button type="button" onClick={() => setAllotModal({ ...allotModal, isOpen: false })} className="px-4 py-2 text-gray-600 bg-gray-50 rounded-lg hover:bg-gray-100 font-medium">Cancel</button>
                <button type="submit" disabled={isLoading} className="px-4 py-2 bg-[#D71920] text-white rounded-lg hover:bg-[#B51218] font-medium disabled:opacity-50 flex items-center">
                  {isLoading && <span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full mr-2"></span>}
                  Confirm Allotment
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </motion.div>
  );
};

export default EmployeeManagement;
