import React, { useState, useEffect } from 'react';
import { Truck, MapPin, Clock, User, Phone, MoreVertical, Navigation, X, Plus, Trash2, Loader2, RefreshCw } from 'lucide-react';
import { useAppContext } from '../hooks/useAppContext';
import { DeliveryTask, Driver, UserRole } from '../types';
import { db, isFirebaseEnabled } from '../firebaseConfig';
import { collection, query, where, onSnapshot, addDoc, deleteDoc, doc, updateDoc } from 'firebase/firestore';

export const Delivery: React.FC = () => {
  const { user, showNotification } = useAppContext();
  const [deliveries, setDeliveries] = useState<DeliveryTask[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [isDriverModalOpen, setIsDriverModalOpen] = useState(false);
  const [newDriver, setNewDriver] = useState({ name: '', phone: '', plateNumber: '' });
  const [isAddingDriver, setIsAddingDriver] = useState(false);

  useEffect(() => {
    if (isFirebaseEnabled && db && user?.uid) {
        // Resolve targetUid: Use own ID for Vendor/Pharmacy/Admin, otherwise use employerId
        const targetUid = (user.role === UserRole.VENDOR || user.role === UserRole.PHARMACY || user.role === UserRole.ADMIN) 
            ? user.uid 
            : user.employerId;

        const handleError = (e: any) => { 
            if(e.code !== 'permission-denied') console.warn("Delivery sync error:", e.code); 
        };

        if (!targetUid) return;

        // Fetch Deliveries
        const qDeliveries = query(collection(db, 'deliveries'), where('uid', '==', targetUid));
        const unsubDeliveries = onSnapshot(
            qDeliveries, 
            (snapshot) => setDeliveries(snapshot.docs.map(d => ({ ...d.data(), id: d.id } as DeliveryTask))),
            handleError
        );

        // Fetch Drivers
        const qDrivers = query(collection(db, 'drivers'), where('uid', '==', targetUid));
        const unsubDrivers = onSnapshot(
            qDrivers, 
            (snapshot) => setDrivers(snapshot.docs.map(d => ({ ...d.data(), id: d.id } as Driver))),
            handleError
        );

        return () => { unsubDeliveries(); unsubDrivers(); };
    }
  }, [isFirebaseEnabled, user]);

  const assignDriver = async (deliveryId: string) => {
    const availableDrivers = drivers.filter(d => d.status === 'Available');
    const promptMsg = availableDrivers.length > 0 
        ? `Assign a driver (Available: ${availableDrivers.map(d => d.name).join(', ')}):`
        : "Enter driver name (No registered drivers available):";

    const driverName = prompt(promptMsg);
    
    if (driverName) {
      const registeredDriver = drivers.find(d => d.name.toLowerCase() === driverName.toLowerCase());
      
      if (isFirebaseEnabled && db) {
          try {
              await updateDoc(doc(db, 'deliveries', deliveryId), {
                  driver: driverName,
                  status: 'In Transit',
                  eta: 'Calculating...'
              });
              
              if (registeredDriver) {
                  await updateDoc(doc(db, 'drivers', registeredDriver.id), { status: 'Busy' });
              }
              showNotification("Driver assigned successfully!", "success");
          } catch(e) {
              console.error(e);
              showNotification("Failed to assign driver.", "error");
          }
      }
    }
  };

  const handleAddDriver = async () => {
    // Validation
    if (!newDriver.name.trim() || !newDriver.phone.trim()) {
        showNotification("Driver Name and Phone are required.", "error");
        return;
    }
    if (!user?.uid) {
        showNotification("User session not found.", "error");
        return;
    }

    setIsAddingDriver(true);
    
    // Resolve targetUid
    const targetUid = (user.role === UserRole.VENDOR || user.role === UserRole.PHARMACY || user.role === UserRole.ADMIN) 
        ? user.uid 
        : user.employerId;

    if (!targetUid) {
        showNotification("Organization ID missing. Cannot add driver.", "error");
        setIsAddingDriver(false);
        return;
    }

    const driverData = {
        uid: targetUid,
        name: newDriver.name.trim(),
        phone: newDriver.phone.trim(),
        plateNumber: newDriver.plateNumber?.trim() || '',
        status: 'Available',
        createdAt: new Date().toISOString()
    };

    try {
        if (isFirebaseEnabled && db) {
            await addDoc(collection(db, 'drivers'), driverData);
            setNewDriver({ name: '', phone: '', plateNumber: '' });
            showNotification("Driver added to fleet successfully.", "success");
        } else {
             showNotification("Database connection unavailable.", "error");
        }
    } catch(e: any) {
        console.error("Add Driver Error:", e);
        const msg = e.code === 'permission-denied' ? "Permission denied." : e.message;
        showNotification(`Error adding driver: ${msg}`, "error");
    } finally {
        setIsAddingDriver(false);
    }
  };

  const handleDeleteDriver = async (id: string) => {
    if (confirm('Are you sure you want to remove this driver?')) {
        if (isFirebaseEnabled && db) {
            try {
                await deleteDoc(doc(db, 'drivers', id));
                showNotification("Driver removed.", "success");
            } catch(e) { showNotification("Error removing driver.", "error"); }
        }
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-bold text-neutral-900 dark:text-white">Delivery Logistics</h2>
          <p className="text-neutral-500 dark:text-neutral-400 text-sm">Assign drivers and track real-time delivery status.</p>
        </div>
        <button 
            onClick={() => setIsDriverModalOpen(true)}
            className="bg-orange-600 hover:bg-orange-500 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors shadow-lg shadow-orange-900/20"
        >
           <Truck className="w-4 h-4" /> Manage Drivers
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Active Map Placeholder */}
        <div className="lg:col-span-2 bg-neutral-100 dark:bg-neutral-800 rounded-2xl min-h-[300px] lg:min-h-[500px] relative overflow-hidden group border border-neutral-200 dark:border-neutral-700">
            <div className="absolute inset-0 flex items-center justify-center text-neutral-400 dark:text-neutral-500 bg-neutral-50 dark:bg-neutral-900">
                 <div className="text-center">
                    <MapPin className="w-12 h-12 mx-auto mb-2 text-orange-200 dark:text-orange-900/50" />
                    <p className="text-sm font-medium">Interactive Map View</p>
                    <p className="text-xs">(Google Maps Grounding Integration)</p>
                 </div>
            </div>
            {/* Active Fleet Overlay */}
            <div className="absolute top-4 right-4 bg-white/90 dark:bg-neutral-900/90 backdrop-blur p-3 rounded-xl shadow-sm border border-neutral-200 dark:border-neutral-700 z-10 max-w-[200px]">
                <div className="text-xs font-bold text-neutral-500 dark:text-neutral-400 uppercase mb-2">Active Fleet</div>
                <div className="space-y-2 max-h-40 overflow-y-auto custom-scrollbar">
                    {drivers.filter(d => d.status === 'Busy').length > 0 ? (
                        drivers.filter(d => d.status === 'Busy').map(driver => (
                            <div key={driver.id} className="flex items-center gap-2 text-sm">
                                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse flex-shrink-0"></span>
                                <div className="truncate">
                                    <span className="font-medium text-neutral-700 dark:text-neutral-300 block truncate">{driver.name}</span>
                                    <span className="text-xs text-neutral-400 block truncate">{driver.plateNumber}</span>
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="text-xs text-neutral-400 italic">No drivers in transit.</div>
                    )}
                </div>
            </div>
        </div>

        {/* Delivery List */}
        <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl shadow-sm overflow-hidden flex flex-col h-[400px] lg:h-[500px]">
            <div className="p-4 border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 font-medium text-neutral-700 dark:text-neutral-300 flex justify-between items-center">
                <span>Today's Deliveries</span>
                <span className="text-xs bg-neutral-200 dark:bg-neutral-800 px-2 py-1 rounded-full text-neutral-600 dark:text-neutral-400">{deliveries.length}</span>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-2 custom-scrollbar">
                {deliveries.length > 0 ? deliveries.map(d => (
                    <div key={d.id} className="p-3 border border-neutral-100 dark:border-neutral-800 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors group relative">
                        <div className="flex justify-between items-start mb-1">
                            <span className="font-mono text-xs text-neutral-400">#{d.id.substring(0,6)}</span>
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                                d.status === 'Unassigned' ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400' :
                                d.status === 'In Transit' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' :
                                'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400'
                            }`}>
                                {d.status}
                            </span>
                        </div>
                        <div className="flex items-start gap-2 mb-2">
                            <MapPin className="w-4 h-4 text-neutral-400 mt-0.5 flex-shrink-0" />
                            <div>
                                <p className="text-sm font-medium text-neutral-900 dark:text-white line-clamp-1">{d.address}</p>
                                <p className="text-xs text-neutral-500 dark:text-neutral-400 line-clamp-1">Customer: {d.customer}</p>
                            </div>
                        </div>
                        
                        <div className="flex items-center justify-between pt-2 border-t border-neutral-100 dark:border-neutral-800">
                            <div className="flex items-center gap-2">
                                <User className="w-3 h-3 text-neutral-400" />
                                <span className="text-xs text-neutral-600 dark:text-neutral-400 truncate max-w-[100px]">
                                    {d.driver || 'No Driver'}
                                </span>
                            </div>
                            {d.eta && (
                                <div className="flex items-center gap-1 text-xs text-orange-600 dark:text-orange-400 font-medium">
                                    <Clock className="w-3 h-3" /> {d.eta}
                                </div>
                            )}
                        </div>

                        {d.status === 'Unassigned' && (
                            <button 
                                onClick={() => assignDriver(d.id)}
                                className="mt-2 w-full py-1.5 text-xs font-medium text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20 hover:bg-orange-100 dark:hover:bg-orange-900/40 rounded transition-colors"
                            >
                                Assign Driver
                            </button>
                        )}
                    </div>
                )) : (
                     <div className="flex flex-col items-center justify-center h-full text-neutral-400 text-sm">
                         <Truck className="w-8 h-8 mb-2 opacity-20" />
                         No delivery tasks found.
                     </div>
                )}
            </div>
        </div>
      </div>

      {/* Manage Drivers Modal */}
      {isDriverModalOpen && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
              <div className="bg-white dark:bg-neutral-900 rounded-xl shadow-xl w-full max-w-md p-6 animate-fade-in border border-neutral-200 dark:border-neutral-800 flex flex-col max-h-[90vh]">
                  <div className="flex justify-between items-center mb-4">
                      <h3 className="text-lg font-bold text-neutral-900 dark:text-white">Fleet Management</h3>
                      <button onClick={() => setIsDriverModalOpen(false)} className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200">
                          <X className="w-5 h-5"/>
                      </button>
                  </div>

                  <div className="overflow-y-auto custom-scrollbar flex-1 space-y-4">
                      {/* Add Driver Form */}
                      <div className="bg-neutral-50 dark:bg-neutral-800 p-4 rounded-lg border border-neutral-200 dark:border-neutral-700">
                          <h4 className="text-xs font-bold text-neutral-500 dark:text-neutral-400 uppercase mb-2">Add New Driver</h4>
                          <div className="space-y-2">
                              <input 
                                  type="text" placeholder="Driver Name" 
                                  className="w-full px-3 py-2 rounded border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-sm focus:ring-2 focus:ring-orange-500 outline-none dark:text-white"
                                  value={newDriver.name}
                                  onChange={e => setNewDriver({...newDriver, name: e.target.value})}
                              />
                              <div className="flex flex-col sm:flex-row gap-2">
                                  <input 
                                      type="text" placeholder="Phone" 
                                      className="flex-1 px-3 py-2 rounded border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-sm focus:ring-2 focus:ring-orange-500 outline-none dark:text-white"
                                      value={newDriver.phone}
                                      onChange={e => setNewDriver({...newDriver, phone: e.target.value})}
                                  />
                                  <input 
                                      type="text" placeholder="Plate No." 
                                      className="flex-1 px-3 py-2 rounded border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-sm focus:ring-2 focus:ring-orange-500 outline-none dark:text-white"
                                      value={newDriver.plateNumber}
                                      onChange={e => setNewDriver({...newDriver, plateNumber: e.target.value})}
                                  />
                              </div>
                              <button 
                                onClick={handleAddDriver}
                                disabled={isAddingDriver}
                                className="w-full bg-orange-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-orange-500 flex justify-center items-center gap-2"
                              >
                                  {isAddingDriver ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                                  Add Driver
                              </button>
                          </div>
                      </div>

                      {/* Driver List */}
                      <div>
                          <h4 className="text-xs font-bold text-neutral-500 dark:text-neutral-400 uppercase mb-2">Current Fleet</h4>
                          <div className="space-y-2">
                              {drivers.length > 0 ? drivers.map(driver => (
                                  <div key={driver.id} className="flex justify-between items-center p-3 bg-white dark:bg-neutral-900 border border-neutral-100 dark:border-neutral-800 rounded-lg shadow-sm hover:border-orange-100 dark:hover:border-orange-900 transition-colors">
                                      <div>
                                          <div className="font-medium text-sm text-neutral-900 dark:text-white">{driver.name}</div>
                                          <div className="text-xs text-neutral-500 dark:text-neutral-400 font-mono">{driver.plateNumber} • {driver.phone}</div>
                                      </div>
                                      <div className="flex items-center gap-2">
                                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                                              driver.status === 'Available' ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400' : 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400'
                                          }`}>
                                              {driver.status}
                                          </span>
                                          <button 
                                            onClick={() => handleDeleteDriver(driver.id)}
                                            className="text-neutral-400 hover:text-red-500 p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                                          >
                                              <Trash2 className="w-4 h-4" />
                                          </button>
                                      </div>
                                  </div>
                              )) : (
                                  <div className="text-center text-xs text-neutral-400 py-4 bg-neutral-50 dark:bg-neutral-800/50 rounded-lg">No registered drivers.</div>
                              )}
                          </div>
                      </div>
                  </div>
                  
                  <div className="pt-4 border-t border-neutral-200 dark:border-neutral-800 mt-2">
                      <button 
                          onClick={() => setIsDriverModalOpen(false)}
                          className="w-full py-2 rounded-lg font-medium text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors text-sm"
                      >
                          Close
                      </button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};