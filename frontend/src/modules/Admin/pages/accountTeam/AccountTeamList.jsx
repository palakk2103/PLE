import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  FiUsers,
  FiUserCheck,
  FiUserX,
  FiSearch,
  FiFilter,
  FiKey,
  FiEdit2,
  FiPlus,
  FiCalendar,
  FiBriefcase,
  FiClock,
  FiShield
} from 'react-icons/fi';
import toast from 'react-hot-toast';
import {
  getAccountTeamMembers,
  toggleAccountTeamMemberStatus,
  updateAccountTeamMember
} from '../../services/adminService';
import ProvisionIdentityModal from './ProvisionIdentityModal';
import ResetCredentialsModal from './ResetCredentialsModal';
import ConfirmModal from '../../components/ConfirmModal';

class AccountTeamErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, errorInfo) {
    console.error('AccountTeam Error caught locally:', error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="p-8 bg-white dark:bg-[#16161A] border border-red-200 dark:border-red-900/30 rounded-2xl text-center space-y-4 my-6">
          <div className="w-14 h-14 bg-red-100 dark:bg-red-900/30 text-red-600 rounded-full flex items-center justify-center mx-auto text-2xl font-bold">
            !
          </div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Failed to load Account Team page</h2>
          <p className="text-sm text-red-600 font-mono max-w-xl mx-auto break-words bg-red-50 dark:bg-red-950/40 p-3 rounded-xl border border-red-200 dark:border-red-900/40">
            {this.state.error?.toString() || 'An unexpected rendering error occurred.'}
          </p>
          <button
            type="button"
            onClick={() => this.setState({ hasError: false, error: null })}
            className="px-5 py-2.5 bg-[#D71920] hover:bg-[#B51218] text-white rounded-xl text-sm font-semibold transition-colors shadow-sm cursor-pointer"
          >
            Try Again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

const AccountTeamListContent = () => {
  const [members, setMembers] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [limit] = useState(15);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRole, setSelectedRole] = useState('all');
  const [selectedClass, setSelectedClass] = useState('all');
  const [selectedDepartment, setSelectedDepartment] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');

  // Modals
  const [isProvisionOpen, setIsProvisionOpen] = useState(false);
  const [credentialModalMember, setCredentialModalMember] = useState(null);
  const [statusConfirmMember, setStatusConfirmMember] = useState(null);
  const [editMember, setEditMember] = useState(null);
  const [editForm, setEditForm] = useState({
    name: '',
    phone: '',
    department: '',
    designation: '',
    contractType: ''
  });

  const getSafeString = (val, fallback = '') => {
    if (typeof val === 'string') return val.trim();
    if (typeof val === 'number') return String(val);
    if (val && typeof val === 'object') {
      if (typeof val.name === 'string') return val.name.trim();
      if (typeof val.first === 'string') return `${val.first} ${val.last || ''}`.trim();
      if (typeof val.label === 'string') return val.label.trim();
      if (typeof val.title === 'string') return val.title.trim();
    }
    return fallback;
  };

  const formatDateTime = (val) => {
    if (!val) return null;
    try {
      const d = new Date(val);
      if (isNaN(d.getTime())) return null;
      return `${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}, ${d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`;
    } catch {
      try {
        return new Date(val).toISOString();
      } catch {
        return null;
      }
    }
  };

  const fetchMembers = async () => {
    setLoading(true);
    try {
      const res = await getAccountTeamMembers({
        page,
        limit,
        q: searchQuery || undefined,
        role: selectedRole !== 'all' ? selectedRole : undefined,
        identityClass: selectedClass !== 'all' ? selectedClass : undefined,
        department: selectedDepartment !== 'all' ? selectedDepartment : undefined,
        status: selectedStatus !== 'all' ? selectedStatus : undefined
      });
      const data = res?.data || res;
      const list = Array.isArray(data?.members)
        ? data.members
        : (Array.isArray(data?.data?.members)
          ? data.data.members
          : (Array.isArray(data) ? data : []));
      setMembers(list);
      setTotal(typeof data?.total === 'number' ? data.total : (typeof data?.data?.total === 'number' ? data.data.total : list.length));
    } catch (err) {
      toast.error('Failed to load personnel list');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMembers();
  }, [page, selectedRole, selectedClass, selectedDepartment, selectedStatus]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1);
      fetchMembers();
    }, 350);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const safeMembers = useMemo(() => (Array.isArray(members) ? members.filter(Boolean) : []), [members]);

  // Dynamic department list from existing members
  const departments = useMemo(() => {
    const set = new Set();
    safeMembers.forEach((m) => {
      const dept = getSafeString(m?.department);
      if (dept) set.add(dept);
    });
    return Array.from(set);
  }, [safeMembers]);

  const activeCount = useMemo(() => safeMembers.filter((m) => m?.status === 'active' || Boolean(m?.isActive)).length, [safeMembers]);
  const superAdminCount = useMemo(() => safeMembers.filter((m) => String(m?.role || '').toLowerCase() === 'superadmin' || String(m?.role || '').toLowerCase() === 'admin').length, [safeMembers]);
  const accountTeamCount = useMemo(() => safeMembers.filter((m) => String(m?.role || '').toLowerCase() === 'account_team').length, [safeMembers]);

  const handleToggleStatus = async () => {
    if (!statusConfirmMember) return;
    const nextStatus = statusConfirmMember.status === 'active' ? 'inactive' : 'active';
    try {
      await toggleAccountTeamMemberStatus(statusConfirmMember._id || statusConfirmMember.id, nextStatus);
      toast.success(`Account marked as ${nextStatus}`);
      setStatusConfirmMember(null);
      fetchMembers();
    } catch (err) {
      toast.error(err?.response?.data?.message || err?.message || 'Failed to update status');
    }
  };

  const handleOpenEdit = (m) => {
    if (!m) return;
    setEditMember(m);
    setEditForm({
      name: getSafeString(m.name),
      phone: getSafeString(m.phone),
      department: getSafeString(m.department),
      designation: getSafeString(m.designation),
      contractType: getSafeString(m.contractType, 'Full-Time')
    });
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editMember) return;
    try {
      await updateAccountTeamMember(editMember._id || editMember.id, editForm);
      toast.success('Member details updated');
      setEditMember(null);
      fetchMembers();
    } catch (err) {
      toast.error(err?.response?.data?.message || err?.message || 'Failed to update details');
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner / Heading */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-[#16161A] border border-gray-200 dark:border-white/10 p-5 rounded-2xl shadow-xs transition-colors">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#D71920] to-[#E53E3E] flex items-center justify-center text-white shadow-md">
            <FiUsers size={24} />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white tracking-tight">
              Personnel & Administrator Management
            </h1>
            <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
              Manage Super Admins, Account Team identities, personal credentials, and login/logout session tracking
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setIsProvisionOpen(true)}
          className="px-4 py-2.5 bg-[#D71920] hover:bg-[#B51218] text-white font-bold rounded-xl text-xs sm:text-sm shadow-sm transition-all flex items-center justify-center gap-2 active:scale-95 cursor-pointer"
        >
          <FiPlus size={16} />
          <span>Provision Administrator / Identity</span>
        </button>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="p-4 bg-white dark:bg-[#16161A] border border-gray-200 dark:border-white/10 rounded-2xl shadow-xs transition-colors">
          <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">Total Accounts</span>
          <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{total}</p>
        </div>
        <div className="p-4 bg-white dark:bg-[#16161A] border border-gray-200 dark:border-white/10 rounded-2xl shadow-xs transition-colors">
          <span className="text-xs text-amber-500 font-medium flex items-center gap-1">
            <FiShield size={12} />
            <span>Super Administrators</span>
          </span>
          <p className="text-2xl font-bold text-amber-500 mt-1">{superAdminCount}</p>
        </div>
        <div className="p-4 bg-white dark:bg-[#16161A] border border-gray-200 dark:border-white/10 rounded-2xl shadow-xs transition-colors">
          <span className="text-xs text-blue-500 font-medium flex items-center gap-1">
            <FiUserCheck size={12} />
            <span>Account Team Members</span>
          </span>
          <p className="text-2xl font-bold text-blue-500 mt-1">{accountTeamCount}</p>
        </div>
        <div className="p-4 bg-white dark:bg-[#16161A] border border-gray-200 dark:border-white/10 rounded-2xl shadow-xs transition-colors">
          <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">Active Personnel</span>
          <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">{activeCount}</p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 bg-white dark:bg-[#16161A] border border-gray-200 dark:border-white/10 rounded-2xl shadow-xs flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between transition-colors">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by Name, Identity ID, Email, Role..."
            className="w-full pl-9 pr-4 py-2 bg-gray-50 dark:bg-[#121216] border border-gray-200 dark:border-white/10 rounded-xl text-gray-900 dark:text-white text-xs placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:border-[#D71920] focus:ring-1 focus:ring-[#D71920] transition-colors"
          />
        </div>

        {/* Dropdowns */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Role Filter */}
          <select
            value={selectedRole}
            onChange={(e) => { setSelectedRole(e.target.value); setPage(1); }}
            className="px-3 py-2 bg-gray-50 dark:bg-[#121216] border border-gray-200 dark:border-white/10 rounded-xl text-xs text-gray-700 dark:text-gray-200 focus:outline-none focus:border-[#D71920] transition-colors"
          >
            <option value="all">All Roles</option>
            <option value="superadmin">Super Administrators</option>
            <option value="account_team">Account Team Members</option>
          </select>

          {/* Identity Class */}
          <select
            value={selectedClass}
            onChange={(e) => { setSelectedClass(e.target.value); setPage(1); }}
            className="px-3 py-2 bg-gray-50 dark:bg-[#121216] border border-gray-200 dark:border-white/10 rounded-xl text-xs text-gray-700 dark:text-gray-200 focus:outline-none focus:border-[#D71920] transition-colors"
          >
            <option value="all">All Classes</option>
            <option value="superadmin">Super Admin (PLE-SA-)</option>
            <option value="employee">Employees (PLE-EMP-)</option>
            <option value="director">Directors (PLE-DIR-)</option>
            <option value="consultant">Consultants (PLE-CON-)</option>
            <option value="intern">Interns (PLE-INT-)</option>
          </select>

          {/* Department */}
          <select
            value={selectedDepartment}
            onChange={(e) => { setSelectedDepartment(e.target.value); setPage(1); }}
            className="px-3 py-2 bg-gray-50 dark:bg-[#121216] border border-gray-200 dark:border-white/10 rounded-xl text-xs text-gray-700 dark:text-gray-200 focus:outline-none focus:border-[#D71920] transition-colors"
          >
            <option value="all">All Departments</option>
            {departments.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>

          {/* Status */}
          <select
            value={selectedStatus}
            onChange={(e) => { setSelectedStatus(e.target.value); setPage(1); }}
            className="px-3 py-2 bg-gray-50 dark:bg-[#121216] border border-gray-200 dark:border-white/10 rounded-xl text-xs text-gray-700 dark:text-gray-200 focus:outline-none focus:border-[#D71920] transition-colors"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
      </div>

      {/* Members Table */}
      <div className="bg-white dark:bg-[#16161A] border border-gray-200 dark:border-white/10 rounded-2xl overflow-hidden shadow-xs transition-colors">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50 dark:bg-[#121216] text-gray-600 dark:text-gray-400 uppercase font-bold text-[11px] tracking-wider border-b border-gray-200 dark:border-white/10">
              <tr>
                <th className="py-3.5 px-4">Identity ID</th>
                <th className="py-3.5 px-4">Personnel & Contact</th>
                <th className="py-3.5 px-4">Department & Designation</th>
                <th className="py-3.5 px-4">Role</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4">Login / Logout Tracking</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-white/5 text-gray-800 dark:text-gray-200">
              {loading ? (
                <tr>
                  <td colSpan="7" className="py-12 text-center text-gray-500 dark:text-gray-400">
                    Loading personnel identities and credentials...
                  </td>
                </tr>
              ) : safeMembers.length === 0 ? (
                <tr>
                  <td colSpan="7" className="py-12 text-center text-gray-500 dark:text-gray-400">
                    No personnel records found matching your search.
                  </td>
                </tr>
              ) : (
                safeMembers.map((member, index) => {
                  if (!member) return null;
                  const isSuper = String(member.role || '').toLowerCase() === 'superadmin' || String(member.role || '').toLowerCase() === 'admin';
                  const memberName = getSafeString(member.name, member.email || 'Personnel');
                  const memberEmail = getSafeString(member.email, 'N/A');
                  const memberPhone = getSafeString(member.phone);
                  const memberDept = getSafeString(member.department, isSuper ? 'PLE Executive Board' : 'PLE Operations');
                  const memberDesignation = getSafeString(member.designation, isSuper ? 'Super Administrator' : 'Staff Member');
                  const memberContract = getSafeString(member.contractType, 'Full-Time');
                  const memberIdentityId = getSafeString(member.identityId, isSuper ? 'PLE-SA-000001' : 'PLE-EMP-N/A');
                  const isMemberActive = member.status === 'active' || Boolean(member.isActive);

                  const loginFormatted = formatDateTime(member.lastLoginAt);
                  const logoutFormatted = formatDateTime(member.lastLogoutAt);
                  const isCurrentlyInSession = Boolean(
                    member.lastLoginAt && (
                      !member.lastLogoutAt ||
                      (new Date(member.lastLoginAt).getTime() > new Date(member.lastLogoutAt).getTime())
                    )
                  );

                  return (
                    <tr key={String(member._id || member.id || member.identityId || index)} className="hover:bg-gray-50/80 dark:hover:bg-white/[0.02] transition-colors">
                      {/* Identity ID */}
                      <td className="py-3 px-4 font-mono font-bold">
                        {isSuper ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-500 border border-amber-500/20 font-bold font-mono">
                            <FiShield size={12} />
                            <span>{memberIdentityId}</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#D71920]/10 text-[#D71920] border border-[#D71920]/20 font-bold font-mono">
                            <FiUserCheck size={12} />
                            <span>{memberIdentityId}</span>
                          </span>
                        )}
                      </td>

                      {/* Member Name & Email */}
                      <td className="py-3 px-4">
                        <div className="font-semibold text-gray-900 dark:text-white flex items-center gap-1.5">
                          <span>{memberName}</span>
                          {isSuper && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-500 border border-amber-500/20 font-semibold uppercase">
                              Admin
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-gray-500 dark:text-gray-400">{memberEmail}</div>
                        {memberPhone && (
                          <div className="text-[10px] text-gray-400 dark:text-gray-500">{memberPhone}</div>
                        )}
                      </td>

                      {/* Department & Designation */}
                      <td className="py-3 px-4">
                        <div className="text-gray-800 dark:text-white font-medium">
                          {memberDept}
                        </div>
                        <div className="text-[11px] text-gray-500 dark:text-gray-400">
                          {memberDesignation} · {memberContract}
                        </div>
                      </td>

                      {/* Role */}
                      <td className="py-3 px-4">
                        {isSuper ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-[10px] font-bold uppercase bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-500/20 dark:text-amber-300 dark:border-amber-500/30">
                            <FiShield size={10} />
                            <span>Super Admin</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-[10px] font-bold uppercase bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-500/20 dark:text-blue-300 dark:border-blue-500/30">
                            <FiUserCheck size={10} />
                            <span>Account Team</span>
                          </span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4">
                        {isMemberActive ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-400 dark:border-emerald-500/30">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-red-50 text-red-700 border border-red-200 dark:bg-red-500/20 dark:text-red-400 dark:border-red-500/30">
                            <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                            Inactive
                          </span>
                        )}
                      </td>

                      {/* Login / Logout Session Tracking */}
                      <td className="py-3 px-4 font-mono text-[11px]">
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5 text-gray-800 dark:text-gray-200">
                            <span className="text-emerald-600 dark:text-emerald-400 font-semibold text-[10px] uppercase">
                              Login:
                            </span>
                            <span>
                              {loginFormatted || 'Never'}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400 text-[10px]">
                            <span className="text-rose-500 font-semibold uppercase">Logout:</span>
                            <span>
                              {isCurrentlyInSession ? (
                                <span className="text-emerald-500 font-medium font-sans">● In-Session</span>
                              ) : (
                                logoutFormatted || 'N/A'
                              )}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(member)}
                            className="p-1.5 rounded-lg text-gray-500 hover:text-gray-900 hover:bg-gray-100 dark:hover:text-white dark:hover:bg-white/5 transition-colors cursor-pointer"
                            title="Edit Details"
                          >
                            <FiEdit2 size={14} />
                          </button>

                          <button
                            type="button"
                            onClick={() => setCredentialModalMember(member)}
                            className="p-1.5 rounded-lg text-gray-500 hover:text-[#D71920] hover:bg-gray-100 dark:hover:bg-white/5 transition-colors cursor-pointer"
                            title="Reset Credentials"
                          >
                            <FiKey size={14} />
                          </button>

                          <button
                            type="button"
                            onClick={() => setStatusConfirmMember(member)}
                            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                              isMemberActive
                                ? 'text-gray-500 hover:text-red-600 hover:bg-red-50 dark:hover:text-red-400 dark:hover:bg-red-500/10'
                                : 'text-gray-500 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:text-emerald-400 dark:hover:bg-emerald-500/10'
                            }`}
                            title={isMemberActive ? 'Deactivate Personnel' : 'Activate Personnel'}
                          >
                            {isMemberActive ? <FiUserX size={14} /> : <FiUserCheck size={14} />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Provision Identity Modal */}
      {isProvisionOpen && (
        <ProvisionIdentityModal
          isOpen={isProvisionOpen}
          onClose={() => setIsProvisionOpen(false)}
          onMemberCreated={() => fetchMembers()}
        />
      )}

      {/* Reset Credentials Modal */}
      {credentialModalMember && (
        <ResetCredentialsModal
          isOpen={!!credentialModalMember}
          member={credentialModalMember}
          onClose={() => setCredentialModalMember(null)}
          onSuccess={() => fetchMembers()}
        />
      )}

      {/* Toggle Status Confirmation Modal */}
      {statusConfirmMember && (
        <ConfirmModal
          isOpen={!!statusConfirmMember}
          onClose={() => setStatusConfirmMember(null)}
          onConfirm={handleToggleStatus}
          title={statusConfirmMember.status === 'active' ? 'Deactivate Team Member' : 'Activate Team Member'}
          message={`Are you sure you want to ${
            statusConfirmMember.status === 'active' ? 'deactivate' : 'activate'
          } ${getSafeString(statusConfirmMember.name, statusConfirmMember.email)} (${getSafeString(statusConfirmMember.identityId || statusConfirmMember.email)})? ${
            statusConfirmMember.status === 'active'
              ? 'They will immediately be blocked from logging into the Admin Dashboard.'
              : 'They will be allowed to log into the Admin Dashboard.'
          }`}
          confirmText={statusConfirmMember.status === 'active' ? 'Deactivate' : 'Activate'}
          type={statusConfirmMember.status === 'active' ? 'danger' : 'info'}
        />
      )}

      {/* Edit Member Details Modal */}
      {editMember && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-md bg-white dark:bg-[#16161A] border border-gray-200 dark:border-white/10 rounded-2xl p-6 text-gray-900 dark:text-gray-100 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between border-b border-gray-200 dark:border-white/10 pb-3">
              <h3 className="font-bold text-gray-900 dark:text-white text-base">Edit Team Member</h3>
              <button onClick={() => setEditMember(null)} className="text-gray-400 hover:text-gray-700 dark:hover:text-white">✕</button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Full Name</label>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={(e) => setEditForm((p) => ({ ...p, name: e.target.value }))}
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-[#121216] border border-gray-200 dark:border-white/10 rounded-xl text-gray-900 dark:text-white text-xs focus:outline-none focus:border-[#D71920] transition-colors"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Phone Number</label>
                <input
                  type="text"
                  value={editForm.phone}
                  onChange={(e) => setEditForm((p) => ({ ...p, phone: e.target.value }))}
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-[#121216] border border-gray-200 dark:border-white/10 rounded-xl text-gray-900 dark:text-white text-xs focus:outline-none focus:border-[#D71920] transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Department</label>
                <input
                  type="text"
                  value={editForm.department}
                  onChange={(e) => setEditForm((p) => ({ ...p, department: e.target.value }))}
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-[#121216] border border-gray-200 dark:border-white/10 rounded-xl text-gray-900 dark:text-white text-xs focus:outline-none focus:border-[#D71920] transition-colors"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Designation</label>
                <input
                  type="text"
                  value={editForm.designation}
                  onChange={(e) => setEditForm((p) => ({ ...p, designation: e.target.value }))}
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-[#121216] border border-gray-200 dark:border-white/10 rounded-xl text-gray-900 dark:text-white text-xs focus:outline-none focus:border-[#D71920] transition-colors"
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-200 dark:border-white/10">
                <button
                  type="button"
                  onClick={() => setEditMember(null)}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-white/5 dark:hover:bg-white/10 text-gray-700 dark:text-gray-300 rounded-xl text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#D71920] hover:bg-[#B51218] text-white rounded-xl text-xs font-bold shadow-xs"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
};

const AccountTeamList = () => {
  return (
    <AccountTeamErrorBoundary>
      <AccountTeamListContent />
    </AccountTeamErrorBoundary>
  );
};

export default AccountTeamList;
