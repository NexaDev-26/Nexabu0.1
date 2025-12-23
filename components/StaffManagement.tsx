
import React, { useState, useEffect, useMemo } from 'react';
import { UserRole, User, StaffTask, StaffPerformance, StaffPermissions } from '../types';
import { Users, Plus, Trash2, Edit2, Save, X, ShieldCheck, Mail, User as UserIcon, Briefcase, CheckCircle, Clock, Trophy, Flame, ListChecks, Target, Lock } from 'lucide-react';
import { useAppContext } from '../hooks/useAppContext';
import { db, isFirebaseEnabled } from '../firebaseConfig';
import { collection, addDoc, deleteDoc, doc, updateDoc, query, where, onSnapshot, getDocs } from 'firebase/firestore';
import { ApiService } from '../services/apiService';

export const StaffManagement: React.FC = () => {
  const { user, showNotification } = useAppContext();
  const [activeView, setActiveView] = useState<'staff' | 'tasks' | 'leaderboard'>('staff');
  const [staffList, setStaffList] = useState<User[]>([]);
  const [tasks, setTasks] = useState<StaffTask[]>([]);
  const [leaderboard, setLeaderboard] = useState<StaffPerformance[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [isPermissionsModalOpen, setIsPermissionsModalOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<User | null>(null);
  const [staffForPermissions, setStaffForPermissions] = useState<User | null>(null);
  const [permissions, setPermissions] = useState<StaffPermissions>({});
  const [formData, setFormData] = useState<{ name: string; email: string; role: UserRole }>({ 
    name: '', 
    email: '', 
    role: UserRole.SELLER 
  });
  const [taskForm, setTaskForm] = useState<Partial<StaffTask>>({
    title: '',
    description: '',
    assignedTo: '',
    dueDate: '',
    points: 10
  });

  const targetUid = useMemo(() => {
    return user?.role === UserRole.VENDOR || user?.role === UserRole.PHARMACY ? user.uid : user?.employerId;
  }, [user]);

  // Load staff - from both users and pending_staff collections
  useEffect(() => {
    if (isFirebaseEnabled && user && db && targetUid) {
      const handleError = (e: any) => console.warn("Staff sync error:", e.code);
      
      // Query active staff from users collection
      const usersQuery = query(collection(db, "users"), where("employerId", "==", targetUid));
      const usersUnsub = onSnapshot(
          usersQuery, 
          (snapshot) => {
            const activeStaff = snapshot.docs.map(doc => ({ ...doc.data(), uid: doc.id, isPending: false } as User & { isPending?: boolean }));
            
            // Also get pending staff
            const pendingQuery = query(collection(db, "pending_staff"), where("employerId", "==", targetUid));
            getDocs(pendingQuery).then((pendingSnapshot) => {
              const pendingStaff = pendingSnapshot.docs.map(doc => {
                const data = doc.data();
                return { 
                  ...data, 
                  uid: doc.id, 
                  isPending: true,
                  // Map pending_staff fields to User type
                  name: data.name,
                  email: data.email,
                  role: data.role,
                  employerId: data.employerId,
                  status: 'Pending'
                } as User & { isPending?: boolean };
              });
              
              // Combine both lists
              setStaffList([...activeStaff, ...pendingStaff] as User[]);
            }).catch(handleError);
          },
          handleError
      );
      
      return () => {
        usersUnsub();
      };
    }
  }, [isFirebaseEnabled, user, targetUid]);

  // Load tasks
  useEffect(() => {
    if (isFirebaseEnabled && db && targetUid) {
      const handleError = (e: any) => console.warn("Tasks sync error:", e.code);
      const q = query(collection(db, "staff_tasks"), where("uid", "==", targetUid));
      const unsubscribe = onSnapshot(
          q,
          (snapshot) => setTasks(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as StaffTask))),
          handleError
      );
      return () => unsubscribe();
    }
  }, [isFirebaseEnabled, targetUid]);

  // Calculate leaderboard from tasks
  useEffect(() => {
    if (tasks.length > 0 && staffList.length > 0) {
      const performanceMap = new Map<string, StaffPerformance>();

      // Initialize all staff
      staffList.forEach(staff => {
        performanceMap.set(staff.uid, {
          uid: staff.uid,
          name: staff.name,
          email: staff.email,
          photoURL: staff.photoURL,
          totalPoints: 0,
          completedTasks: 0,
          streak: 0,
          lastActiveDate: undefined
        });
      });

      // Calculate performance from completed tasks
      tasks.filter(t => t.completed && t.completedBy).forEach(task => {
        const perf = performanceMap.get(task.completedBy!);
        if (perf) {
          perf.completedTasks++;
          perf.totalPoints += task.points || 0;
          if (task.completedAt) {
            const taskDate = new Date(task.completedAt).toDateString();
            if (!perf.lastActiveDate || new Date(task.completedAt) > new Date(perf.lastActiveDate)) {
              perf.lastActiveDate = task.completedAt;
            }
          }
        }
      });

      // Calculate streaks (simplified - consecutive days with tasks)
      const today = new Date().toDateString();
      staffList.forEach(staff => {
        const perf = performanceMap.get(staff.uid);
        if (perf) {
          const completedDates = tasks
            .filter(t => t.completed && t.completedBy === staff.uid && t.completedAt)
            .map(t => new Date(t.completedAt!).toDateString())
            .filter((date, index, arr) => arr.indexOf(date) === index)
            .sort()
            .reverse();

          let streak = 0;
          let checkDate = new Date();
          for (let i = 0; i < completedDates.length; i++) {
            const expectedDate = new Date(checkDate).toDateString();
            if (completedDates[i] === expectedDate) {
              streak++;
              checkDate.setDate(checkDate.getDate() - 1);
            } else {
              break;
            }
          }
          perf.streak = streak;
        }
      });

      const leaderboardData = Array.from(performanceMap.values())
        .sort((a, b) => b.totalPoints - a.totalPoints || b.completedTasks - a.completedTasks);
      setLeaderboard(leaderboardData);
    } else {
      setLeaderboard([]);
    }
  }, [tasks, staffList]);

  const handleSave = async () => {
    if (!formData.name || !formData.email || !user) {
        alert("Please fill in all fields.");
        return;
    }
    
    const employerId = user.role === UserRole.VENDOR || user.role === UserRole.PHARMACY ? user.uid : user.employerId;
    
    // Set default permissions based on role if not editing existing staff
    const defaultPermissions: StaffPermissions = editingStaff?.permissions || {
      canAccessDashboard: true,
      canAccessOrders: formData.role === UserRole.SELLER || formData.role === UserRole.MANAGER,
      canAccessPOS: formData.role === UserRole.SELLER || formData.role === UserRole.MANAGER,
      canAccessCustomers: formData.role === UserRole.MANAGER,
      canAccessInventory: formData.role === UserRole.MANAGER,
      canAccessInvoices: formData.role === UserRole.MANAGER,
      canAccessDelivery: false,
      canAccessExpenses: false,
      canAccessPrescriptions: formData.role === UserRole.PHARMACIST || formData.role === UserRole.MANAGER,
      canCreateOrders: formData.role === UserRole.SELLER || formData.role === UserRole.MANAGER,
      canEditOrders: formData.role === UserRole.MANAGER,
      canCreateProducts: formData.role === UserRole.MANAGER,
      canEditProducts: formData.role === UserRole.MANAGER,
    };
    
    const staffData: any = { 
        ...formData, 
        employerId,
        employerRole: user.role, // Pass down the employer's role (e.g., PHARMACY) so staff inherit view logic
        storeName: user.storeName, // Inherit store name
        createdAt: editingStaff?.createdAt || new Date().toISOString(),
        status: 'Active',
        permissions: defaultPermissions
    };

    // Add commission rate for sales reps
    if (formData.role === UserRole.SALES_REP && formData.commissionRate !== undefined) {
      staffData.commissionRate = formData.commissionRate;
    }
    
    if (isFirebaseEnabled && db) {
      try {
        if (editingStaff) {
          await updateDoc(doc(db, "users", editingStaff.uid), staffData);
          showNotification("Staff member updated successfully!", "success");
        } else {
          // Create a pending staff entry. 
          // In a real app, this would trigger an email invite or Cloud Function to create Auth user.
          await addDoc(collection(db, "pending_staff"), { 
              ...staffData, 
              defaultPassword: "password123", // Temporary default
              isDefaultPassword: true 
          });
          showNotification(`Staff member "${formData.name}" added successfully! They can sign up with email: ${formData.email}`, "success");
        }
      } catch (e) { 
        console.error(e);
        showNotification("Failed to save staff member.", "error");
      }
    } else {
        alert("Database connection is unavailable.");
    }
    setIsModalOpen(false);
    setEditingStaff(null);
    setFormData({ name: '', email: '', role: UserRole.SELLER });
  };

  const handleDelete = async (staff: User) => {
      if (confirm(`Are you sure you want to remove ${staff.name}?`)) {
          if (isFirebaseEnabled && db) {
              try {
                  // Try deleting from users collection first
                  try {
                      await deleteDoc(doc(db, "users", staff.uid));
                      showNotification("Staff member removed successfully", "success");
                  } catch (userError: any) {
                      // If not found in users, try pending_staff collection
                      if (userError.code === 'not-found' || userError.code === 'permission-denied') {
                          await deleteDoc(doc(db, "pending_staff", staff.uid));
                          showNotification("Pending staff invitation removed", "success");
                      } else {
                          throw userError;
                      }
                  }
              } catch(e: any) { 
                  console.error(e);
                  showNotification(`Failed to remove staff member: ${e.message}`, "error");
              }
          }
      }
  };
  
  const openAddModal = () => { 
      setEditingStaff(null); 
      setFormData({ name: '', email: '', role: UserRole.SELLER }); 
      setIsModalOpen(true); 
  };

  const openEditModal = (staff: User) => {
      setEditingStaff(staff);
      setFormData({ name: staff.name, email: staff.email, role: staff.role, commissionRate: staff.commissionRate || 0 });
      setIsModalOpen(true);
  };

  const openPermissionsModal = (staff: User) => {
    setStaffForPermissions(staff);
    // Initialize permissions with staff's current permissions or defaults
    setPermissions(staff.permissions || {
      canAccessDashboard: true,
      canAccessOrders: true,
      canAccessPOS: true,
    });
    setIsPermissionsModalOpen(true);
  };

  const handleSavePermissions = async () => {
    if (!staffForPermissions?.uid || !db) return;
    
    try {
      await updateDoc(doc(db, "users", staffForPermissions.uid), {
        permissions: permissions
      });
      showNotification("Permissions updated successfully!", "success");
      setIsPermissionsModalOpen(false);
      setStaffForPermissions(null);
    } catch (error: any) {
      console.error("Error updating permissions:", error);
      showNotification("Failed to update permissions.", "error");
    }
  };

  // Task handlers
  const handleCreateTask = async () => {
    if (!taskForm.title || !targetUid || !user?.uid) {
      showNotification('Please fill in task title', 'error');
      return;
    }

    try {
      const newTask: Omit<StaffTask, 'id'> = {
        uid: targetUid,
        title: taskForm.title!,
        description: taskForm.description,
        assignedTo: taskForm.assignedTo || undefined,
        assignedToName: taskForm.assignedTo ? staffList.find(s => s.uid === taskForm.assignedTo)?.name : undefined,
        dueDate: taskForm.dueDate || undefined,
        completed: false,
        points: taskForm.points || 10,
        createdAt: new Date().toISOString(),
        createdBy: user.uid,
        createdByName: user.name
      };

      if (db) {
        await addDoc(collection(db, 'staff_tasks'), newTask);
        showNotification('Task created successfully', 'success');
        setIsTaskModalOpen(false);
        setTaskForm({ title: '', description: '', assignedTo: '', dueDate: '', points: 10 });
      }
    } catch (error: any) {
      showNotification('Failed to create task: ' + error.message, 'error');
    }
  };

  const handleCompleteTask = async (task: StaffTask, completedBy: string) => {
    if (!db || !user) return;

    try {
      await updateDoc(doc(db, 'staff_tasks', task.id), {
        completed: true,
        completedBy,
        completedByName: staffList.find(s => s.uid === completedBy)?.name || user.name,
        completedAt: new Date().toISOString()
      });
      showNotification('Task marked as complete', 'success');
    } catch (error: any) {
      showNotification('Failed to complete task: ' + error.message, 'error');
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!confirm('Are you sure you want to delete this task?')) return;

    try {
      if (db) {
        await deleteDoc(doc(db, 'staff_tasks', taskId));
        showNotification('Task deleted', 'success');
      }
    } catch (error: any) {
      showNotification('Failed to delete task: ' + error.message, 'error');
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
            <h2 className="text-2xl font-bold text-neutral-900 dark:text-white">Staff & Sellers</h2>
            <p className="text-neutral-500 dark:text-neutral-400 text-sm">Manage access, tasks, and track performance for your team.</p>
        </div>
        <div className="flex gap-2">
          {activeView === 'tasks' && (
            <button onClick={() => setIsTaskModalOpen(true)} className="flex items-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white rounded-lg transition-colors shadow-lg shadow-orange-900/20">
              <Plus className="w-4 h-4" />
              <span>Add Task</span>
            </button>
          )}
          {activeView === 'staff' && (
            <button onClick={openAddModal} className="flex items-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white rounded-lg transition-colors shadow-lg shadow-orange-900/20">
              <Plus className="w-4 h-4" />
              <span>Add New Staff</span>
            </button>
          )}
        </div>
      </div>

      {/* View Tabs */}
      <div className="flex gap-2 border-b border-neutral-200 dark:border-neutral-800">
        <button
          onClick={() => setActiveView('staff')}
          className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
            activeView === 'staff'
              ? 'text-orange-600 border-orange-600'
              : 'text-neutral-500 border-transparent hover:text-neutral-700 dark:hover:text-neutral-300'
          }`}
        >
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4" />
            Staff
          </div>
        </button>
        <button
          onClick={() => setActiveView('tasks')}
          className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
            activeView === 'tasks'
              ? 'text-orange-600 border-orange-600'
              : 'text-neutral-500 border-transparent hover:text-neutral-700 dark:hover:text-neutral-300'
          }`}
        >
          <div className="flex items-center gap-2">
            <ListChecks className="w-4 h-4" />
            Tasks
          </div>
        </button>
        <button
          onClick={() => setActiveView('leaderboard')}
          className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
            activeView === 'leaderboard'
              ? 'text-orange-600 border-orange-600'
              : 'text-neutral-500 border-transparent hover:text-neutral-700 dark:hover:text-neutral-300'
          }`}
        >
          <div className="flex items-center gap-2">
            <Trophy className="w-4 h-4" />
            Leaderboard
          </div>
        </button>
      </div>

      {/* Staff View */}
      {activeView === 'staff' && (
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
                <thead className="bg-neutral-50 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400">
                    <tr>
                        <th className="p-4 font-medium">Name</th>
                        <th className="p-4 font-medium">Role</th>
                        <th className="p-4 font-medium">Status</th>
                        <th className="p-4 font-medium text-right">Actions</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                    {staffList.length > 0 ? staffList.map(staff => (
                        <tr key={staff.uid} className="hover:bg-neutral-50/50 dark:hover:bg-neutral-800/50 transition-colors">
                            <td className="p-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center text-neutral-500">
                                        <UserIcon className="w-4 h-4" />
                                    </div>
                                    <div>
                                        <div className="font-medium text-neutral-900 dark:text-white">{staff.name}</div>
                                        <div className="text-xs text-neutral-500">{staff.email}</div>
                                    </div>
                                </div>
                            </td>
                            <td className="p-4">
                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${
                                    staff.role === UserRole.MANAGER ? 'bg-purple-50 border-purple-200 text-purple-700 dark:bg-purple-900/20 dark:border-purple-800 dark:text-purple-300' :
                                    staff.role === UserRole.PHARMACIST ? 'bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-300' :
                                    'bg-orange-50 border-orange-200 text-orange-700 dark:bg-orange-900/20 dark:border-orange-800 dark:text-orange-300'
                                }`}>
                                    <ShieldCheck className="w-3 h-3" />
                                    {staff.role}
                                </span>
                            </td>
                            <td className="p-4">
                                <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-bold ${
                                    staff.status === 'Pending' ? 'text-yellow-600 bg-yellow-50 dark:bg-yellow-900/20' :
                                    staff.status === 'Active' ? 'text-green-600 bg-green-50 dark:bg-green-900/20' : 
                                    'text-neutral-600 bg-neutral-50 dark:bg-neutral-900/20'
                                }`}>
                                    {staff.status || 'Active'}
                                </span>
                            </td>
                            <td className="p-4 text-right">
                                <div className="flex justify-end gap-2">
                                    <button 
                                      onClick={() => openPermissionsModal(staff)} 
                                      className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg text-neutral-500 hover:text-blue-600 transition-colors"
                                      title="Manage Permissions"
                                    >
                                        <Lock className="w-4 h-4" />
                                    </button>
                                    <button onClick={() => openEditModal(staff)} className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg text-neutral-500 hover:text-orange-600 transition-colors">
                                        <Edit2 className="w-4 h-4" />
                                    </button>
                                    <button onClick={() => handleDelete(staff)} className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg text-neutral-500 hover:text-red-600 transition-colors">
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </td>
                        </tr>
                    )) : (
                        <tr>
                            <td colSpan={4} className="p-8 text-center text-neutral-400">No staff members found. Click "Add New Staff" to get started.</td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
      </div>
      )}

      {/* Tasks View */}
      {activeView === 'tasks' && (
        <div className="space-y-4">
          {tasks.length === 0 ? (
            <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-12 text-center">
              <ListChecks className="w-12 h-12 text-neutral-300 mx-auto mb-4" />
              <p className="text-neutral-500 mb-4">No tasks yet. Create your first task to get started.</p>
              <button onClick={() => setIsTaskModalOpen(true)} className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-500">
                Create Task
              </button>
            </div>
          ) : (
            <div className="grid gap-4">
              {tasks.map(task => (
                <div
                  key={task.id}
                  className={`bg-white dark:bg-neutral-900 border rounded-xl p-4 ${
                    task.completed
                      ? 'border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-900/10'
                      : 'border-neutral-200 dark:border-neutral-800'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        {task.completed ? (
                          <CheckCircle className="w-5 h-5 text-green-600" />
                        ) : (
                          <Clock className="w-5 h-5 text-orange-600" />
                        )}
                        <h3 className={`font-medium ${task.completed ? 'line-through text-neutral-500' : 'text-neutral-900 dark:text-white'}`}>
                          {task.title}
                        </h3>
                        {task.points && (
                          <span className="px-2 py-1 bg-orange-100 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300 text-xs font-medium rounded">
                            +{task.points} pts
                          </span>
                        )}
                      </div>
                      {task.description && (
                        <p className="text-sm text-neutral-500 ml-8 mb-2">{task.description}</p>
                      )}
                      <div className="flex items-center gap-4 ml-8 text-xs text-neutral-500">
                        {task.assignedToName && (
                          <span>Assigned to: <span className="font-medium">{task.assignedToName}</span></span>
                        )}
                        {!task.assignedTo && <span>Assigned to: <span className="font-medium">All Staff</span></span>}
                        {task.dueDate && (
                          <span>Due: {new Date(task.dueDate).toLocaleDateString()}</span>
                        )}
                        {task.completed && task.completedByName && (
                          <span>Completed by: <span className="font-medium">{task.completedByName}</span></span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {!task.completed && (
                        <button
                          onClick={() => user?.uid && handleCompleteTask(task, user.uid)}
                          className="p-2 hover:bg-green-100 dark:hover:bg-green-900/20 rounded-lg text-green-600"
                          title="Mark as complete"
                        >
                          <CheckCircle className="w-5 h-5" />
                        </button>
                      )}
                      <button
                        onClick={() => handleDeleteTask(task.id)}
                        className="p-2 hover:bg-red-100 dark:hover:bg-red-900/20 rounded-lg text-red-600"
                        title="Delete task"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Leaderboard View */}
      {activeView === 'leaderboard' && (
        <div className="space-y-4">
          {leaderboard.length === 0 ? (
            <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-12 text-center">
              <Trophy className="w-12 h-12 text-neutral-300 mx-auto mb-4" />
              <p className="text-neutral-500">No performance data yet. Complete tasks to see leaderboard rankings.</p>
            </div>
          ) : (
            <>
              {/* Top 3 */}
              {leaderboard.slice(0, 3).length > 0 && (
                <div className="grid grid-cols-3 gap-4 mb-6">
                  {leaderboard.slice(0, 3).map((perf, index) => {
                    const staff = staffList.find(s => s.uid === perf.uid);
                    const rank = index + 1;
                    const size = rank === 2 ? 'w-20 h-20' : 'w-16 h-16';
                    const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : '🥉';
                    return (
                      <div
                        key={perf.uid}
                        className={`bg-white dark:bg-neutral-900 border rounded-xl p-4 text-center ${
                          rank === 2
                            ? 'border-orange-500 shadow-lg scale-105'
                            : 'border-neutral-200 dark:border-neutral-800'
                        }`}
                      >
                        <div className={`${size} mx-auto mb-3 rounded-full bg-orange-100 dark:bg-orange-900/20 flex items-center justify-center text-2xl relative`}>
                          {staff?.photoURL ? (
                            <img src={staff.photoURL} alt={perf.name} className="w-full h-full object-cover rounded-full" />
                          ) : (
                            <UserIcon className={`${rank === 2 ? 'w-10 h-10' : 'w-8 h-8'} text-orange-600`} />
                          )}
                          <div className="absolute -top-1 -right-1 text-2xl">{medal}</div>
                        </div>
                        <h3 className="font-bold text-neutral-900 dark:text-white">{perf.name}</h3>
                        <p className="text-2xl font-bold text-orange-600 mt-2">{perf.totalPoints}</p>
                        <p className="text-xs text-neutral-500">points</p>
                        <div className="flex items-center justify-center gap-4 mt-2 text-xs text-neutral-500">
                          <span>{perf.completedTasks} tasks</span>
                          {perf.streak > 0 && (
                            <span className="flex items-center gap-1 text-orange-600">
                              <Flame className="w-3 h-3" />
                              {perf.streak} day streak
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Rest of leaderboard */}
              <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-neutral-50 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400">
                      <tr>
                        <th className="p-4 font-medium">Rank</th>
                        <th className="p-4 font-medium">Name</th>
                        <th className="p-4 font-medium">Points</th>
                        <th className="p-4 font-medium">Tasks</th>
                        <th className="p-4 font-medium">Streak</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                      {leaderboard.slice(3).map((perf, index) => {
                        const staff = staffList.find(s => s.uid === perf.uid);
                        const rank = index + 4;
                        return (
                          <tr key={perf.uid} className="hover:bg-neutral-50/50 dark:hover:bg-neutral-800/50">
                            <td className="p-4 font-bold text-neutral-500">#{rank}</td>
                            <td className="p-4">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center overflow-hidden">
                                  {staff?.photoURL ? (
                                    <img src={staff.photoURL} alt={perf.name} className="w-full h-full object-cover" />
                                  ) : (
                                    <UserIcon className="w-4 h-4 text-neutral-400" />
                                  )}
                                </div>
                                <span className="font-medium text-neutral-900 dark:text-white">{perf.name}</span>
                              </div>
                            </td>
                            <td className="p-4">
                              <span className="font-bold text-orange-600">{perf.totalPoints}</span>
                            </td>
                            <td className="p-4">
                              <span className="text-neutral-700 dark:text-neutral-300">{perf.completedTasks}</span>
                            </td>
                            <td className="p-4">
                              {perf.streak > 0 ? (
                                <span className="flex items-center gap-1 text-orange-600">
                                  <Flame className="w-4 h-4" />
                                  {perf.streak} days
                                </span>
                              ) : (
                                <span className="text-neutral-400">-</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Add/Edit Staff Modal */}
      {isModalOpen && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
              <div className="bg-white dark:bg-neutral-900 p-6 rounded-2xl w-full max-w-md shadow-2xl border border-neutral-200 dark:border-neutral-800">
                  <div className="flex justify-between items-center mb-6">
                      <h3 className="font-bold text-lg text-neutral-900 dark:text-white">{editingStaff ? 'Edit Profile' : 'Add New Team Member'}</h3>
                      <button onClick={() => setIsModalOpen(false)} className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200">
                          <X className="w-5 h-5"/>
                      </button>
                  </div>
                  
                  <div className="space-y-4">
                      <div>
                          <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">Full Name</label>
                          <div className="relative">
                              <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                              <input 
                                type="text" 
                                placeholder="e.g. Juma Ali" 
                                value={formData.name} 
                                onChange={e => setFormData({...formData, name: e.target.value})} 
                                className="w-full pl-10 pr-4 py-2.5 border border-neutral-200 dark:border-neutral-700 rounded-xl bg-neutral-50 dark:bg-neutral-800 text-sm outline-none focus:ring-2 focus:ring-orange-500 dark:text-white"
                              />
                          </div>
                      </div>
                      
                      <div>
                          <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">Email Address</label>
                          <div className="relative">
                              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                              <input 
                                type="email" 
                                placeholder="e.g. juma@nexabu.com" 
                                value={formData.email} 
                                onChange={e => setFormData({...formData, email: e.target.value})} 
                                className="w-full pl-10 pr-4 py-2.5 border border-neutral-200 dark:border-neutral-700 rounded-xl bg-neutral-50 dark:bg-neutral-800 text-sm outline-none focus:ring-2 focus:ring-orange-500 dark:text-white"
                                disabled={!!editingStaff} // Prevent email edit for simplicity
                              />
                          </div>
                      </div>

                      <div>
                          <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">Role & Permissions</label>
                          <div className="relative">
                              <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                              <select 
                                value={formData.role} 
                                onChange={e => setFormData({...formData, role: e.target.value as UserRole})} 
                                className="w-full pl-10 pr-4 py-2.5 border border-neutral-200 dark:border-neutral-700 rounded-xl bg-neutral-50 dark:bg-neutral-800 text-sm outline-none focus:ring-2 focus:ring-orange-500 dark:text-white appearance-none"
                              >
                                  <option value={UserRole.SELLER}>Seller (POS & Orders)</option>
                                  <option value={UserRole.SALES_REP}>Sales Representative</option>
                                  <option value={UserRole.MANAGER}>Manager (Full Access)</option>
                                  <option value={UserRole.PHARMACIST}>Pharmacist (Prescriptions)</option>
                              </select>
                          </div>
                          {formData.role === UserRole.SALES_REP && (
                            <div>
                              <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                                Commission Rate (%)
                              </label>
                              <input
                                type="number"
                                min="0"
                                max="100"
                                step="0.1"
                                value={formData.commissionRate || 0}
                                onChange={e => setFormData({...formData, commissionRate: parseFloat(e.target.value) || 0})}
                                className="w-full p-2.5 border border-neutral-200 dark:border-neutral-700 rounded-xl bg-neutral-50 dark:bg-neutral-800 text-sm outline-none focus:ring-2 focus:ring-orange-500 dark:text-white"
                                placeholder="e.g., 5.0"
                              />
                              <p className="text-xs text-neutral-400 mt-1">Percentage of order total (0-100%)</p>
                            </div>
                          )}
                      </div>
                  </div>

                  <div className="flex gap-3 mt-8">
                      <button 
                        onClick={() => setIsModalOpen(false)} 
                        className="flex-1 py-2.5 border border-neutral-200 dark:border-neutral-700 rounded-xl text-sm font-medium text-neutral-600 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors"
                      >
                          Cancel
                      </button>
                      <button 
                        onClick={handleSave} 
                        className="flex-1 py-2.5 bg-orange-600 hover:bg-orange-500 text-white rounded-xl text-sm font-bold transition-colors shadow-lg shadow-orange-900/20 flex justify-center items-center gap-2"
                      >
                          <Save className="w-4 h-4" />
                          {editingStaff ? 'Update Changes' : 'Save Staff'}
                      </button>
                  </div>
              </div>
          </div>
      )}

      {/* Permissions Modal */}
      {isPermissionsModalOpen && staffForPermissions && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white dark:bg-neutral-900 p-6 rounded-2xl w-full max-w-2xl shadow-2xl border border-neutral-200 dark:border-neutral-800 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="font-bold text-lg text-neutral-900 dark:text-white">Manage Permissions</h3>
                <p className="text-sm text-neutral-500 mt-1">{staffForPermissions.name} ({staffForPermissions.role})</p>
              </div>
              <button onClick={() => setIsPermissionsModalOpen(false)} className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-6">
              {/* Core Features */}
              <div>
                <h4 className="text-sm font-bold text-neutral-900 dark:text-white mb-3 flex items-center gap-2">
                  <Briefcase className="w-4 h-4" />
                  Core Features
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { key: 'canAccessDashboard', label: 'Dashboard' },
                    { key: 'canAccessOrders', label: 'Orders' },
                    { key: 'canAccessCustomers', label: 'Customers' },
                    { key: 'canAccessInventory', label: 'Inventory' },
                    { key: 'canAccessInvoices', label: 'Invoices' },
                    { key: 'canAccessDelivery', label: 'Delivery' },
                    { key: 'canAccessExpenses', label: 'Expenses' },
                    { key: 'canAccessPOS', label: 'POS / Storefront' },
                  ].map(({ key, label }) => (
                    <label key={key} className="flex items-center gap-2 p-2 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-800 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={permissions[key as keyof StaffPermissions] || false}
                        onChange={(e) => setPermissions({ ...permissions, [key]: e.target.checked })}
                        className="w-4 h-4 text-orange-600 rounded focus:ring-orange-500"
                      />
                      <span className="text-sm text-neutral-700 dark:text-neutral-300">{label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Management Features */}
              <div>
                <h4 className="text-sm font-bold text-neutral-900 dark:text-white mb-3 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4" />
                  Management Features
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { key: 'canAccessStaff', label: 'Staff Management' },
                    { key: 'canAccessProcurement', label: 'Procurement' },
                    { key: 'canAccessTransfers', label: 'Warehouse Transfers' },
                    { key: 'canAccessBills', label: 'Bills' },
                    { key: 'canAccessWallet', label: 'Wallet' },
                    { key: 'canAccessMarketing', label: 'Marketing' },
                    { key: 'canAccessShopBuilder', label: 'Shop Builder' },
                    ...(user?.role === UserRole.PHARMACY ? [{ key: 'canAccessPrescriptions', label: 'Prescriptions' }] : []),
                  ].map(({ key, label }) => (
                    <label key={key} className="flex items-center gap-2 p-2 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-800 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={permissions[key as keyof StaffPermissions] || false}
                        onChange={(e) => setPermissions({ ...permissions, [key]: e.target.checked })}
                        className="w-4 h-4 text-orange-600 rounded focus:ring-orange-500"
                      />
                      <span className="text-sm text-neutral-700 dark:text-neutral-300">{label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div>
                <h4 className="text-sm font-bold text-neutral-900 dark:text-white mb-3 flex items-center gap-2">
                  <Target className="w-4 h-4" />
                  Actions & Permissions
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { key: 'canCreateOrders', label: 'Create Orders' },
                    { key: 'canEditOrders', label: 'Edit Orders' },
                    { key: 'canDeleteOrders', label: 'Delete Orders' },
                    { key: 'canCreateProducts', label: 'Create Products' },
                    { key: 'canEditProducts', label: 'Edit Products' },
                    { key: 'canDeleteProducts', label: 'Delete Products' },
                    { key: 'canCreateCustomers', label: 'Create Customers' },
                    { key: 'canEditCustomers', label: 'Edit Customers' },
                    { key: 'canDeleteCustomers', label: 'Delete Customers' },
                    { key: 'canCreateInvoices', label: 'Create Invoices' },
                    { key: 'canEditInvoices', label: 'Edit Invoices' },
                    { key: 'canDeleteInvoices', label: 'Delete Invoices' },
                    { key: 'canViewReports', label: 'View Reports' },
                    { key: 'canManageSettings', label: 'Manage Settings' },
                  ].map(({ key, label }) => (
                    <label key={key} className="flex items-center gap-2 p-2 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-800 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={permissions[key as keyof StaffPermissions] || false}
                        onChange={(e) => setPermissions({ ...permissions, [key]: e.target.checked })}
                        className="w-4 h-4 text-orange-600 rounded focus:ring-orange-500"
                      />
                      <span className="text-sm text-neutral-700 dark:text-neutral-300">{label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-8">
              <button
                onClick={() => setIsPermissionsModalOpen(false)}
                className="flex-1 py-2.5 border border-neutral-200 dark:border-neutral-700 rounded-xl text-sm font-medium text-neutral-600 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSavePermissions}
                className="flex-1 py-2.5 bg-orange-600 hover:bg-orange-500 text-white rounded-xl text-sm font-bold transition-colors shadow-lg shadow-orange-900/20 flex justify-center items-center gap-2"
              >
                <Save className="w-4 h-4" />
                Save Permissions
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Task Modal */}
      {isTaskModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white dark:bg-neutral-900 p-6 rounded-2xl w-full max-w-md shadow-2xl border border-neutral-200 dark:border-neutral-800">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-bold text-lg text-neutral-900 dark:text-white">Create New Task</h3>
              <button onClick={() => setIsTaskModalOpen(false)} className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">Task Title *</label>
                <input
                  type="text"
                  value={taskForm.title || ''}
                  onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })}
                  className="w-full p-2.5 border border-neutral-200 dark:border-neutral-700 rounded-xl bg-neutral-50 dark:bg-neutral-800 text-sm outline-none focus:ring-2 focus:ring-orange-500 dark:text-white"
                  placeholder="e.g. Complete inventory count"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">Description</label>
                <textarea
                  value={taskForm.description || ''}
                  onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })}
                  className="w-full p-2.5 border border-neutral-200 dark:border-neutral-700 rounded-xl bg-neutral-50 dark:bg-neutral-800 text-sm outline-none focus:ring-2 focus:ring-orange-500 dark:text-white"
                  rows={3}
                  placeholder="Task details..."
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">Assign To</label>
                <select
                  value={taskForm.assignedTo || ''}
                  onChange={(e) => setTaskForm({ ...taskForm, assignedTo: e.target.value })}
                  className="w-full p-2.5 border border-neutral-200 dark:border-neutral-700 rounded-xl bg-neutral-50 dark:bg-neutral-800 text-sm outline-none focus:ring-2 focus:ring-orange-500 dark:text-white"
                >
                  <option value="">All Staff</option>
                  {staffList.map(staff => (
                    <option key={staff.uid} value={staff.uid}>{staff.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">Due Date</label>
                  <input
                    type="date"
                    value={taskForm.dueDate || ''}
                    onChange={(e) => setTaskForm({ ...taskForm, dueDate: e.target.value })}
                    className="w-full p-2.5 border border-neutral-200 dark:border-neutral-700 rounded-xl bg-neutral-50 dark:bg-neutral-800 text-sm outline-none focus:ring-2 focus:ring-orange-500 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">Points</label>
                  <input
                    type="number"
                    min="1"
                    value={taskForm.points || 10}
                    onChange={(e) => setTaskForm({ ...taskForm, points: parseInt(e.target.value) || 10 })}
                    className="w-full p-2.5 border border-neutral-200 dark:border-neutral-700 rounded-xl bg-neutral-50 dark:bg-neutral-800 text-sm outline-none focus:ring-2 focus:ring-orange-500 dark:text-white"
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-8">
              <button
                onClick={() => setIsTaskModalOpen(false)}
                className="flex-1 py-2.5 border border-neutral-200 dark:border-neutral-700 rounded-xl text-sm font-medium text-neutral-600 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateTask}
                className="flex-1 py-2.5 bg-orange-600 hover:bg-orange-500 text-white rounded-xl text-sm font-bold transition-colors shadow-lg shadow-orange-900/20 flex justify-center items-center gap-2"
              >
                <Save className="w-4 h-4" />
                Create Task
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
