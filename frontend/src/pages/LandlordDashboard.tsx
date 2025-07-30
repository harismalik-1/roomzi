import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Home, User, Settings, MapPin, Calendar, MessageCircle, Plus, LogOut, Wrench, Eye, Clock, CheckCircle, XCircle } from 'lucide-react';
import { sampleProperties, Property } from '@/data/sampleProperties';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabaseClient';
import { apiFetch, getApiBaseUrl } from '@/utils/api';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { format } from 'date-fns';

const LandlordDashboard = () => {
  const [properties, setProperties] = useState<Property[]>(sampleProperties);
  const navigate = useNavigate();
  const location = useLocation();
  const { signOut, user } = useAuth();
  const [pendingMaintenanceCount, setPendingMaintenanceCount] = useState(0);
  const [showBanner, setShowBanner] = useState(false);
  const [pendingViewingCount, setPendingViewingCount] = useState(0);
  const [showViewingBanner, setShowViewingBanner] = useState(false);
  const [viewingRequests, setViewingRequests] = useState([]);
  const [loadingViewings, setLoadingViewings] = useState(true);
  const [showProposeModal, setShowProposeModal] = useState(false);
  const [proposeRequestId, setProposeRequestId] = useState(null);
  const [proposedDate, setProposedDate] = useState('');
  const [proposedTime, setProposedTime] = useState('');

  const userId = user?.id || '';
  const [profile, setProfile] = useState({
    fullName: '',
    email: '',
    phone: '',
    location: '',
    profilePhoto: '',
  });

  // Helper to format date safely
  const formatDateSafe = (dateString) => {
    if (!dateString) return 'Not set';
    const d = new Date(dateString);
    return isNaN(d.getTime()) ? 'Not set' : d.toLocaleString();
  };

  const handleCreateListing = () => {
    navigate('/create-listing');
  };

  const handleManageListing = (listingId) => {
    navigate(`/manage-listing/${listingId}`);
  }

  const handleViewPayments = () => {
    navigate('/payments');
  }

  const totalIncome = properties.reduce((sum, property) => property.landlord_id === userId ? sum + property.price : sum, 0);
  const occupiedProperties = properties.filter(p => p.landlord_id === userId && !p.available).length;

  // Fetch landlord profile
  const fetchProfile = async () => {
    if (!user) return;
    try {
      console.log('Fetching landlord profile for user ID:', user.id);
      const response = await apiFetch(`${getApiBaseUrl()}/api/landlords/${user.id}`);
      console.log('Landlord profile response:', response);
      if (response.success && response.data) {
        const data = response.data;
        console.log('Landlord profile data:', data);
        setProfile({
          fullName: data.full_name || '',
          email: data.email || '',
          phone: data.phone || '',
          location: data.address || '',
          profilePhoto: data.image_url || '',
        });
      }
    } catch (err) {
      console.error('Error fetching landlord profile:', err);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, [user]);

  useEffect(() => {
    const handleFocus = () => {
      fetchProfile();
    };
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, []);

  useEffect(() => {
    const handleProfileUpdated = (e: any) => {
      if (e.detail) {
        setProfile(e.detail);
      }
    };
    window.addEventListener('landlordProfileUpdated', handleProfileUpdated);
    return () => window.removeEventListener('landlordProfileUpdated', handleProfileUpdated);
  }, []);

  useEffect(() => {
    if (location.state && location.state.profileUpdated) {
      fetchProfile();
      // Clear the state so it doesn't refetch on every render
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  useEffect(() => {
    async function fetchProperties() {
      if (!userId) return;
      
      console.log('Fetching properties for user ID:', userId);
      
      const response = await fetch(`http://localhost:3001/api/landlords/${userId}/listings`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
      });
      const data = await response.json();
      console.log('API response:', data);
      
      if (response.ok) {
        // The backend returns data wrapped in successResponse format
        const listings = data.data || data;
        console.log('Filtered listings:', listings);
        setProperties(listings);
      } else {
        console.error('Failed to fetch properties:', data);
      }
    }

    fetchProperties();
  }, [userId]);

  useEffect(() => {
    async function fetchPendingMaintenance() {
      if (!userId) return;
      const lastSeen = localStorage.getItem('maintenance_last_seen') || '0';
      const { data, error } = await supabase
        .from('maintenance_requests')
        .select('createdAt', { count: 'exact' })
        .eq('landlordId', userId)
        .eq('status', 'Pending');
      if (!error && data) {
        const newRequests = data.filter((r) => new Date(r.createdAt).getTime() > Number(lastSeen));
        setPendingMaintenanceCount(newRequests.length);
        setShowBanner(newRequests.length > 0);
      }
    }
    fetchPendingMaintenance();
  }, [userId]);

  useEffect(() => {
    const fetchViewingRequests = async () => {
      if (!userId) return;
      setLoadingViewings(true);
      try {
        const response = await apiFetch(`${getApiBaseUrl()}/api/viewings?landlordId=${userId}`);
        setViewingRequests(response);
      } catch (error) {
        setViewingRequests([]);
      } finally {
        setLoadingViewings(false);
      }
    };
    fetchViewingRequests();
  }, [userId]);

  const handleStatusUpdate = async (requestId, status, proposedDateTime) => {
    try {
      await apiFetch(`${getApiBaseUrl()}/api/viewings/${requestId}`, {
        method: 'PATCH',
        body: JSON.stringify(status === 'Proposed' ? { status, proposedDateTime } : { status }),
      });
      setViewingRequests(prev => prev.map(r => r.id === requestId ? { ...r, status, proposedDateTime: status === 'Proposed' ? proposedDateTime : null } : r));
    } catch (error) {
      // handle error
    }
  };

  const openProposeModal = (requestId) => {
    setProposeRequestId(requestId);
    setShowProposeModal(true);
    setProposedDate('');
    setProposedTime('');
  };

  const submitProposeTime = () => {
    if (!proposedDate || !proposedTime) return;
    const [hours, minutes] = proposedTime.split(':');
    const dateTime = new Date(proposedDate);
    dateTime.setHours(Number(hours));
    dateTime.setMinutes(Number(minutes));
    handleStatusUpdate(proposeRequestId, 'Proposed', dateTime.toISOString());
    setShowProposeModal(false);
  };

  // Filter requests: show all except 'Closed', but always show 'Approved' as reminders
  const approvedRequests = viewingRequests.filter(v => v.status === 'Approved');
  const otherRequests = viewingRequests.filter(v => v.status !== 'Closed');

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 pb-24">
      {/* Header */}
      <header className="bg-white shadow-sm border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <h1 className="text-2xl font-bold text-roomzi-blue">Room<span className="text-yellow-500">zi</span></h1>
              <Badge className="ml-3 bg-green-100 text-green-800">Landlord</Badge>
            </div>
            <div className="flex items-center space-x-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => signOut()}
                className="hover:bg-red-50 text-red-600"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome Section */}
        <div className="mb-8 flex flex-col md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-3xl font-bold text-gray-900 mb-2">Welcome Back, {profile.fullName || 'Landlord'}!</h2>
            <p className="text-gray-600">Manage your properties and connect with tenants</p>
          </div>
        </div>

        {/* Notification banners for pending requests */}
        {showBanner && (
          <div className="bg-yellow-100 text-yellow-800 px-4 py-2 rounded mb-4 flex items-center gap-2 shadow">
            <Wrench className="w-5 h-5" />
            {pendingMaintenanceCount} new maintenance request{pendingMaintenanceCount > 1 ? 's' : ''}!
            <Button size="sm" variant="link" onClick={() => {
              navigate('/landlord/maintenance-requests');
            }}>
              View
            </Button>
          </div>
        )}

        {/* Viewing Requests Section */}
        <Card className="p-6 mb-8 shadow-lg bg-white/80 backdrop-blur-sm border-0">
          <h2 className="text-xl font-semibold mb-4 text-gray-900 flex items-center">
            <Eye className="w-5 h-5 mr-2 text-blue-500" />
            Viewing Requests
          </h2>
          {loadingViewings ? (
            <div className="text-gray-500">Loading...</div>
          ) : viewingRequests.length === 0 ? (
            <div className="text-gray-500">No viewing requests yet.</div>
          ) : (
            <div className="space-y-4">
              {/* Approved requests as reminders */}
              {approvedRequests.map((v) => (
                <div key={v.id} className="flex items-center justify-between p-3 rounded-lg border bg-green-50">
                  <div>
                    <div className="font-medium">{v.listings?.title || 'Property'}</div>
                    <div className="text-sm text-gray-600">
                      Requested: {formatDateSafe(v.requestedDateTime)}
                    </div>
                    <div className="text-xs text-blue-700">
                      Proposed: {v.proposedDateTime ? formatDateSafe(v.proposedDateTime) : 'Not set'}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-600" />
                    <span className="text-sm font-semibold text-green-700">Approved</span>
                  </div>
                </div>
              ))}
              {/* Other requests (not closed) */}
              {otherRequests.map((v) => (
                <div key={v.id} className="flex items-center justify-between p-3 rounded-lg border bg-gray-50">
                  <div>
                    <div className="font-medium">{v.listings?.title || 'Property'}</div>
                    <div className="text-sm text-gray-600">
                      Requested: {formatDateSafe(v.requestedDateTime)}
                    </div>
                    <div className="text-xs text-blue-700">
                      Proposed: {v.proposedDateTime ? formatDateSafe(v.proposedDateTime) : 'Not set'}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {v.status === 'Pending' && <Clock className="w-4 h-4 text-yellow-500" />}
                    {v.status === 'Declined' && <XCircle className="w-4 h-4 text-red-500" />}
                    {v.status === 'Proposed' && <Clock className="w-4 h-4 text-blue-500" />}
                    <span className={`text-sm font-semibold ${v.status === 'Pending' ? 'text-yellow-600' : v.status === 'Declined' ? 'text-red-600' : v.status === 'Proposed' ? 'text-blue-700' : 'text-gray-500'}`}>{v.status}</span>
                  </div>
                  <div className="flex gap-2">
                    {v.status === 'Pending' && (
                      <>
                        <Button type="button" size="sm" variant="default" onClick={() => handleStatusUpdate(v.id, 'Approved', undefined)}>Approve</Button>
                        <Button type="button" size="sm" variant="destructive" onClick={() => openProposeModal(v.id)}>Decline/Propose New Time</Button>
                      </>
                    )}
                    {v.status !== 'Closed' && (
                      <Button type="button" size="sm" variant="outline" onClick={() => handleStatusUpdate(v.id, 'Closed', undefined)}>Close Request</Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Propose New Time Modal */}
        <Dialog open={showProposeModal} onOpenChange={setShowProposeModal}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Propose New Time</DialogTitle>
            </DialogHeader>
            <div className="flex flex-col gap-4">
              <Input type="date" value={proposedDate} onChange={e => setProposedDate(e.target.value)} />
              <Input type="time" value={proposedTime} onChange={e => setProposedTime(e.target.value)} />
            </div>
            <DialogFooter>
              <Button onClick={submitProposeTime} disabled={!proposedDate || !proposedTime} type="button">Submit</Button>
              <Button variant="destructive" onClick={() => handleStatusUpdate(proposeRequestId, 'Declined', undefined)} type="button">Decline Without Proposing</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Stats Overview */}
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          <Card className="p-6 bg-gradient-to-r from-blue-500 to-blue-600 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-100 mb-1">Total Properties</p>
                <p className="text-3xl font-bold">{properties.filter(property => property.landlord_id === userId).length}</p>
              </div>
              <div className="w-12 h-12 bg-blue-400 rounded-lg flex items-center justify-center">
                <Home className="w-6 h-6 text-white" />
              </div>
            </div>
          </Card>

          <Card className="p-6 bg-gradient-to-r from-green-500 to-green-600 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-green-100 mb-1">Monthly Income</p>
                <p className="text-3xl font-bold">${totalIncome.toLocaleString()}</p>
              </div>
              <Button className="w-12 h-12 bg-green-400 rounded-lg flex items-center justify-center hover:bg-green-600" onClick={handleViewPayments}>
                <Calendar className="w-6 h-6 text-white" />
              </Button>
            </div>
          </Card>

          <Card className="p-6 bg-gradient-to-r from-purple-500 to-purple-600 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-purple-100 mb-1">Occupied Units</p>
                <p className="text-3xl font-bold">{occupiedProperties}</p>
              </div>
              <div className="w-12 h-12 bg-purple-400 rounded-lg flex items-center justify-center">
                <User className="w-6 h-6 text-white" />
              </div>
            </div>
          </Card>
        </div>

        {/* My Properties Section */}
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-900">My Properties</h2>
          <Button onClick={handleCreateListing} className="roomzi-gradient shadow-lg hover:shadow-xl">
            <Plus className="w-4 h-4 mr-2" />
            Add New Property
          </Button>
        </div>

        {/* Properties Grid */}
        <div className="grid lg:grid-cols-2 xl:grid-cols-3 gap-8">
          {properties.map((property) => (
            <Card key={property.id} className="overflow-hidden hover:shadow-xl transition-all duration-300 bg-white">
              <div className="aspect-video overflow-hidden">
                <img
                  src={Array.isArray(property.images) ? property.images[0] : JSON.parse(property.images)[0]}
                  alt={property.title}
                  className="w-full h-full object-cover transition-transform duration-300 hover:scale-110"
                />
              </div>
              <div className="p-6">
                <div className="flex justify-between items-start mb-3">
                  <h3 className="text-xl font-semibold text-gray-900 line-clamp-1">{property.title}</h3>
                  <Badge 
                    variant={property.available ? "default" : "secondary"}
                    className={property.available ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}
                  >
                    {property.available ? 'Available' : 'Occupied'}
                  </Badge>
                </div>
                
                <div className="flex items-center text-gray-600 mb-3">
                  <MapPin className="w-4 h-4 mr-2 shrink-0" />
                  <span className="text-sm line-clamp-1">{property.address}, {property.city}</span>
                </div>

                <div className="flex items-center text-gray-600 mb-4">
                  <Home className="w-4 h-4 mr-2 shrink-0" />
                  <span className="text-sm">
                    {property.bedrooms} bed • {property.bathrooms} bath • {property.area} sq ft
                  </span>
                </div>

                <div className="flex items-center justify-between mb-4">
                  <div className="text-2xl font-bold text-roomzi-blue">
                    ${property.price.toLocaleString()}
                    <span className="text-sm font-normal text-gray-500">/month</span>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button size="sm" variant="outline" className="flex-1" onClick={() => handleManageListing(property.id)}>
                    Manage
                  </Button>
                  <Button size="sm" variant="outline" className="flex-1">
                    Edit
                  </Button>
                  <Button size="sm" variant="destructive">
                    Delete
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>

        {properties.length === 0 && (
          <div className="text-center py-12">
            <div className="text-gray-500 mb-4">
              <Home className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <h3 className="text-lg font-medium">No properties yet</h3>
              <p>Create your first listing to get started</p>
            </div>
            <Button onClick={handleCreateListing} className="roomzi-gradient mt-4">
              Create Your First Listing
            </Button>
          </div>
        )}
      </div>

      {/* Fixed Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-2 shadow-lg">
        <div className="flex justify-around items-center max-w-md mx-auto">
          <Button 
            variant="ghost" 
            size="sm" 
            className="flex-col h-auto py-2 text-roomzi-blue"
            onClick={() => navigate('/landlord')}
          >
            <Home className="w-5 h-5 mb-1" />
            <span className="text-xs">Properties</span>
          </Button>
          <Button 
            variant="ghost" 
            size="sm" 
            className="flex-col h-auto py-2"
            onClick={() => navigate('/landlord/matches')}
          >
            <MessageCircle className="w-5 h-5 mb-1" />
            <span className="text-xs">Matches</span>
          </Button>
          <Button 
            variant="ghost" 
            size="sm" 
            className="flex-col h-auto py-2 relative"
            onClick={() => navigate('/landlord/maintenance-requests')}
          >
            <Wrench className="w-5 h-5 mb-1" />
            <span className="text-xs">Maintenance</span>
            {pendingMaintenanceCount > 0 && (
              <span className="absolute top-0 right-0 bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5">
                {pendingMaintenanceCount}
              </span>
            )}
          </Button>
          <Button 
            variant="ghost" 
            size="sm" 
            className="flex-col h-auto py-2 relative"
            onClick={() => navigate('/landlord/profile')}
          >
            <Settings className="w-5 h-5 mb-1" />
            <span className="text-xs">Profile</span>
          </Button>
        </div>
      </nav>
    </div>
  );
};

export default LandlordDashboard;
