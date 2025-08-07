import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, DollarSign, Calendar, AlertCircle, User, UploadCloud, FileText, Home } from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import UpcomingPaymentBanner from '@/components/UpcomingPaymentBanner';
import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useSocket } from '@/context/SocketContext';

const FinancialAccount = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { socket, isConnected } = useSocket();
  const [showForm, setShowForm] = useState(false);
  const [amount, setAmount] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [selectedListingId, setSelectedListingId] = useState('');
  const [selectedMonth, setSelectedMonth] = useState('');
  const [listings, setListings] = useState([]);
  const [paymentRequests, setPaymentRequests] = useState([]);
  const [loadingPayments, setLoadingPayments] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [leases, setLeases] = useState([]);
  const [loadingLeases, setLoadingLeases] = useState(false);

  // Get name and avatar from user metadata, fallback to email/initials
  const name = user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email?.split('@')[0] || 'User';
  const avatar = user?.user_metadata?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=E0E7FF&color=3730A3`;

  // Calculate total paid from accepted payment requests
  const totalPaid = useMemo(() => {
    const approvedPayments = paymentRequests.filter(payment => payment.status === 'Approved');
    const total = approvedPayments.reduce((sum, payment) => sum + payment.amount, 0);
    
    return total;
  }, [paymentRequests]);

  // Calculate total rent from lease agreements
  const totalRent = useMemo(() => {
    const total = leases.reduce((total, lease) => {
      if (!lease.start_date || !lease.end_date || !lease.rent) return total;
      
      // Parse dates explicitly to avoid timezone issues
      const [startYear, startMonth, startDay] = lease.start_date.split('-').map(Number);
      const [endYear, endMonth, endDay] = lease.end_date.split('-').map(Number);
      const startDate = new Date(startYear, startMonth - 1, startDay);
      const endDate = new Date(endYear, endMonth - 1, endDay);
      const months = (endDate.getFullYear() - startDate.getFullYear()) * 12 + 
                    (endDate.getMonth() - startDate.getMonth()) + 1;
      
      return total + (lease.rent * months);
    }, 0);
    
    return total;
  }, [leases]);

  const outstanding = Math.max(0, totalRent - totalPaid);

  // Generate comprehensive rent history for all months of the lease
  const rentHistory = useMemo(() => {
    if (leases.length === 0) return [];

    const currentDate = new Date();
    const allMonths = [];

    leases.forEach(lease => {
      if (!lease.start_date || !lease.end_date) return;

      // Parse dates explicitly to avoid timezone issues
      const [startYear, startMonth, startDay] = lease.start_date.split('-').map(Number);
      const [endYear, endMonth, endDay] = lease.end_date.split('-').map(Number);
      const startDate = new Date(startYear, startMonth - 1, startDay);
      const endDate = new Date(endYear, endMonth - 1, endDay);
      const monthlyRent = lease.rent || 0;

      // Generate all months between start and end date
      let currentMonth = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
      
      while (currentMonth <= endDate) {
        const monthKey = currentMonth.toISOString().slice(0, 7); // YYYY-MM format
        const monthName = currentMonth.toLocaleDateString('en-US', { 
          year: 'numeric', 
          month: 'long' 
        });
        
        // Check if there are payments for this month
        const paymentsForMonth = paymentRequests.filter(payment => {
          if (payment.status !== 'Approved') return false;
          // Use the month field if available, otherwise fall back to payment date
          if (payment.month) {
            return payment.month === monthKey;
          } else {
            // Fallback to old logic for payments without month field
            const paymentDate = new Date(payment.date);
            return paymentDate.getFullYear() === currentMonth.getFullYear() && 
                   paymentDate.getMonth() === currentMonth.getMonth();
          }
        });

        // Calculate total amount paid for this month
        const totalPaidAmount = paymentsForMonth.reduce((sum, payment) => {
          return sum + parseFloat(payment.amount);
        }, 0);

        // Get the latest payment date for display
        const latestPayment = paymentsForMonth.length > 0 ? 
          paymentsForMonth.reduce((latest, payment) => {
            return new Date(payment.date) > new Date(latest.date) ? payment : latest;
          }) : null;

        // Determine status
        let status = 'Upcoming';
        if (currentMonth < currentDate) {
          if (paymentsForMonth.length > 0) {
            // Check if it's a partial payment
            if (totalPaidAmount < monthlyRent) {
              status = 'Partial';
            } else {
              status = 'Paid';
            }
          } else {
            status = 'Missed';
          }
        } else if (currentMonth.getFullYear() === currentDate.getFullYear() && 
                   currentMonth.getMonth() === currentDate.getMonth()) {
          if (paymentsForMonth.length > 0) {
            // Check if it's a partial payment
            if (totalPaidAmount < monthlyRent) {
              status = 'Partial';
            } else {
              status = 'Paid';
            }
          } else {
            status = 'Due';
          }
        }

        allMonths.push({
          month: monthName,
          monthKey,
          amount: totalPaidAmount,
          status,
          paymentDate: latestPayment ? new Date(latestPayment.date).toLocaleDateString() : null,
          leaseId: lease.id,
          propertyAddress: lease.listing?.address || 'Unknown Property'
        });

        // Move to next month
        currentMonth.setMonth(currentMonth.getMonth() + 1);
      }
    });

    // Sort by date (oldest first)
    const sortedMonths = allMonths.sort((a, b) => new Date(a.monthKey + '-01').getTime() - new Date(b.monthKey + '-01').getTime());
    
    return sortedMonths;
  }, [leases, paymentRequests]);

  // Calculate upcoming rent based on lease data
  const nextRentDue = useMemo(() => {
    if (leases.length === 0) {
      return {
        amount: 0,
        dueDate: 'No active lease',
      };
    }

    const currentDate = new Date();
    let nextDueAmount = 0;
    let nextDueDate = 'No upcoming rent';

    // Find the next unpaid month from rent history
    const nextUnpaidMonth = rentHistory.find(month => {
      const monthDate = new Date(month.monthKey + '-01');
      return monthDate >= currentDate && month.status !== 'Paid';
    });

    if (nextUnpaidMonth) {
      // For upcoming payments, we need to get the actual rent amount from the lease
      // since the rental record now shows 0 for unpaid months
      const leaseForNextMonth = leases.find(lease => {
        if (!lease.start_date || !lease.end_date) return false;
        const [startYear, startMonth, startDay] = lease.start_date.split('-').map(Number);
        const [endYear, endMonth, endDay] = lease.end_date.split('-').map(Number);
        const startDate = new Date(startYear, startMonth - 1, startDay);
        const endDate = new Date(endYear, endMonth - 1, endDay);
        const monthDate = new Date(nextUnpaidMonth.monthKey + '-01');
        return monthDate >= startDate && monthDate <= endDate;
      });
      
      const fullRentAmount = leaseForNextMonth ? leaseForNextMonth.rent : 0;
      
      // If it's a partial payment, calculate the remaining amount
      if (nextUnpaidMonth.status === 'Partial') {
        nextDueAmount = fullRentAmount - nextUnpaidMonth.amount;
      } else {
        nextDueAmount = fullRentAmount;
      }
      
      // Calculate the due date (typically 1st of the month)
      const [year, month] = nextUnpaidMonth.monthKey.split('-').map(Number);
      const dueDate = new Date(year, month - 1, 1);
      nextDueDate = dueDate.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    }

    return {
      amount: nextDueAmount,
      dueDate: nextDueDate,
    };
  }, [leases, rentHistory]);

  const progress = Math.min(100, Math.round((totalPaid / totalRent) * 100));

  // Get unpaid months for payment selection
  const unpaidMonths = useMemo(() => {
    return rentHistory.filter(month => month.status !== 'Paid');
  }, [rentHistory]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, []);

  // Fetch tenant's leased listings
  useEffect(() => {
    if (!user?.id) return;
    fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/api/tenants/${user.id}/listings`)
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          // This endpoint returns all listings where tenant_id matches the current user
          setListings(data.data || data.listings || []);
        }
      })
      .catch(err => console.error('Error fetching leased listings:', err));
  }, [user?.id]);

  // Fetch tenant's payment requests
  useEffect(() => {
    if (!user?.id) return;
    setLoadingPayments(true);
    fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/api/payments/tenant/${user.id}`)
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setPaymentRequests(data.payments || []);
          setLastUpdate(new Date());
        }
      })
      .catch(err => console.error('Error fetching payment requests:', err))
      .finally(() => setLoadingPayments(false));
  }, [user?.id]);

  // Fetch tenant's lease data
  useEffect(() => {
    if (!user?.id) return;
    setLoadingLeases(true);
    fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/api/tenants/${user.id}/leases`)
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setLeases(data.data || []);
        }
      })
      .catch(err => console.error('Error fetching lease data:', err))
      .finally(() => setLoadingLeases(false));
  }, [user?.id]);

  // Listen for payment status updates via WebSocket
  useEffect(() => {
    if (!socket || !isConnected || !user?.id) return;

    // Listen for payment status updates
    const handlePaymentStatusUpdate = (data: { paymentId: string; status: string; tenantId: string }) => {
      if (data.tenantId === user.id) {
        // Refresh payment requests when a payment status is updated
        fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/api/payments/tenant/${user.id}`)
          .then(res => res.json())
          .then(data => {
            if (data.success) {
              setPaymentRequests(data.payments || []);
              setLastUpdate(new Date());
            }
          })
          .catch(err => console.error('Error refreshing payment requests:', err));
      }
    };

    socket.on('payment-status-updated', handlePaymentStatusUpdate);

    return () => {
      socket.off('payment-status-updated', handlePaymentStatusUpdate);
    };
  }, [socket, isConnected, user?.id]);

  // Fallback: Refresh payment requests every 30 seconds if WebSocket is not available
  useEffect(() => {
    if (!user?.id) return;
    
    const interval = setInterval(() => {
      if (!isConnected) {
        fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/api/payments/tenant/${user.id}`)
          .then(res => res.json())
          .then(data => {
            if (data.success) {
              setPaymentRequests(data.payments || []);
              setLastUpdate(new Date());
            }
          })
          .catch(err => console.error('Error refreshing payment requests:', err));
      }
    }, 30000); // 30 seconds

    return () => clearInterval(interval);
  }, [user?.id, isConnected]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
    }
  };

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setAmount(e.target.value);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    
    if (!user?.id) {
      alert('User not found. Please log in again.');
      setSubmitting(false);
      return;
    }

    if (!selectedListingId) {
      alert('Please select a listing for this payment.');
      setSubmitting(false);
      return;
    }

    if (!selectedMonth) {
      alert('Please select a month to pay for.');
      setSubmitting(false);
      return;
    }
    
    try {
      const formData = new FormData();
      formData.append('tenantId', user.id);
      formData.append('listingId', selectedListingId);
      formData.append('amount', amount);
      formData.append('month', selectedMonth);
      if (file) formData.append('proof', file);

      const response = await fetch('http://localhost:3001/api/payments', {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        try {
          const result = await response.json();
          alert("Payment request successfully submitted. Waiting for landlord's approval.");
          setShowForm(false);
          setAmount('');
          setFile(null);
          setSelectedListingId('');
          setSelectedMonth('');
                  // Refresh payment requests
        fetch(`http://localhost:3001/api/payments/tenant/${user.id}`)
          .then(res => res.json())
          .then(data => {
            if (data.success) {
              setPaymentRequests(data.payments || []);
              setLastUpdate(new Date());
            }
          })
          .catch(err => console.error('Error refreshing payment requests:', err));
        } catch (jsonError) {
          console.error('JSON parsing error:', jsonError);
          alert("Payment request submitted successfully! (Response parsing issue)");
        }
      } else {
        try {
          const errorData = await response.json();
          alert(`Failed to submit payment: ${errorData.error || 'Unknown error'}`);
        } catch (jsonError) {
          alert(`Failed to submit payment. Server returned status: ${response.status}`);
        }
      }
    } catch (error) {
      console.error('Network error details:', error);
      if (error instanceof TypeError && error.message.includes('fetch')) {
        alert('Failed to submit payment. Please check your connection.');
      } else {
        alert('An unexpected error occurred. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/tenant/my-house')}
                className="mr-2"
              >
                <ArrowLeft className="w-4 h-4" />
              </Button>
              <h1 className="text-2xl font-bold text-roomzi-blue">Financial Account</h1>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Personalized Greeting */}
        <div className="flex items-center gap-4 mb-2">
          <img src={avatar} alt={name} className="w-12 h-12 rounded-full object-cover border-2 border-blue-200" />
          <div>
            <div className="text-lg font-semibold text-gray-800">Welcome back, {name}!</div>
            <div className="text-sm text-gray-500">Here's a summary of your financial account.</div>
          </div>
        </div>

        {/* Upcoming Payment Banner */}
        <UpcomingPaymentBanner amount={nextRentDue.amount} dueDate={nextRentDue.dueDate} />

        {/* Lease Information */}
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <Home className="w-5 h-5 text-blue-600" />
            <h3 className="text-lg font-semibold">Lease Information</h3>
          </div>
          {loadingLeases ? (
            <div className="text-center text-gray-500 py-4">Loading lease information...</div>
          ) : leases.length === 0 ? (
            <div className="text-center text-gray-500 py-4">
              No lease information found. If you have recently signed a lease, it may take a moment to appear.
            </div>
          ) : (
            <div className="space-y-4">
              {leases.map((lease) => (
                <div key={lease.id} className="border rounded-lg p-4 bg-gray-50">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <div className="font-semibold text-lg">
                        {lease.listing?.address || 'Property Address'}
                      </div>
                      <div className="text-sm text-gray-600">
                        {lease.listing?.city && lease.listing?.state 
                          ? `${lease.listing.city}, ${lease.listing.state}`
                          : 'Location not specified'
                        }
                      </div>
                    </div>
                    <Badge className={lease.signed ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}>
                      {lease.signed ? 'Signed' : 'Pending'}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-4 mt-3">
                    <div>
                      <div className="text-sm font-medium text-gray-700">Lease Start Date</div>
                      <div className="text-lg font-semibold text-blue-700">
                        {lease.start_date ? (() => {
                          const [year, month, day] = lease.start_date.split('-').map(Number);
                          return new Date(year, month - 1, day).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                          });
                        })() : 'Not set'}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm font-medium text-gray-700">Lease End Date</div>
                      <div className="text-lg font-semibold text-red-700">
                        {lease.end_date ? (() => {
                          const [year, month, day] = lease.end_date.split('-').map(Number);
                          return new Date(year, month - 1, day).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                          });
                        })() : 'Not set'}
                      </div>
                    </div>
                  </div>
                  {lease.rent && (
                    <div className="mt-3 pt-3 border-t">
                      <div className="text-sm font-medium text-gray-700">Monthly Rent</div>
                      <div className="text-lg font-semibold text-green-700">${lease.rent.toLocaleString()}</div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Progress Bar */}
        <Card className="p-6 flex flex-col items-center">
          <div className="w-full mb-2 flex justify-between text-xs text-gray-500">
            <span>Paid</span>
            <span>Total: ${totalRent.toLocaleString()}</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3 mb-2">
            <div
              className="bg-blue-500 h-3 rounded-full transition-all"
              style={{ width: `${progress}%` }}
            ></div>
          </div>
          <div className="w-full flex justify-between text-sm">
            <span className="font-bold text-green-700">${totalPaid.toLocaleString()}</span>
            <span className="font-bold text-red-700">${outstanding.toLocaleString()} owed</span>
          </div>
        </Card>

        {/* Payment Management */}
        <Card className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-semibold">Payment Management</h3>
            <Button className="roomzi-gradient" onClick={() => setShowForm(!showForm)}>
              {showForm ? 'Cancel' : 'Make a Payment'}
            </Button>
          </div>
          
          {/* Make a Payment Section */}
          <div className="mb-8">
          
          {listings.length === 0 && (
            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-md">
              <p className="text-yellow-800 text-sm">
                Note: You need to be associated with a property to make payments. If you don't see any listings, 
                you may not be renting any properties yet.
              </p>
            </div>
          )}
          
          {showForm && (
            <form onSubmit={handleSubmit} className="space-y-6 border rounded-md p-6 bg-gray-50">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Amount</label>
                <div className="flex items-center">
                  <DollarSign className="w-5 h-5 mr-2 text-gray-400" />
                  <Input
                    type="number"
                    min="0"
                    step="10.00"
                    placeholder="Enter amount"
                    value={amount}
                    onChange={handleAmountChange}
                    required
                    className="w-full text-center hide-number-input-arrows"
                    style={{ appearance: 'textfield', MozAppearance: 'textfield', WebkitAppearance: 'none' }}
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Proof of Payment</label>
                <div className="flex items-center">
                  <UploadCloud className="w-5 h-5 mr-2 text-gray-400" />
                  <Input
                    type="file"
                    accept="image/*,application/pdf"
                    onChange={handleFileChange}
                    required
                  />
                </div>
                {file && <div className="mt-2 text-sm text-gray-600">Selected: {file.name}</div>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Select Listing</label>
                <Select value={selectedListingId} onValueChange={setSelectedListingId}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select a listing" />
                  </SelectTrigger>
                  <SelectContent>
                    {listings.length === 0 ? (
                      <SelectItem value="" disabled>No listings available</SelectItem>
                    ) : (
                      listings.map(listing => (
                        <SelectItem key={listing.id} value={listing.id}>
                          {listing.address}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Select Month to Pay For</label>
                <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select a month" />
                  </SelectTrigger>
                  <SelectContent>
                    {unpaidMonths.length === 0 ? (
                      <SelectItem value="" disabled>All months are paid</SelectItem>
                    ) : (
                      unpaidMonths.map(month => (
                        <SelectItem key={month.monthKey} value={month.monthKey}>
                          {month.month} - ${month.amount.toLocaleString()} ({month.status})
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" className="roomzi-gradient w-full" disabled={submitting}>
                {submitting ? 'Submitting...' : 'Submit Payment'}
              </Button>
            </form>
          )}
                    </div>

          {/* Payment Requests Section */}
          <div>
            <h4 className="text-md font-semibold mb-4 text-gray-700">My Payment Requests</h4>
          {loadingPayments ? (
            <div className="text-center text-gray-500 py-4">Loading payment requests...</div>
          ) : paymentRequests.length === 0 ? (
            <div className="text-center text-gray-500 py-4">No payment requests found</div>
          ) : (
            <div className="space-y-4">
              {paymentRequests.map((payment) => (
                <div key={payment.id} className="border rounded-lg p-4 bg-gray-50">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <div className="font-semibold text-lg">${payment.amount.toLocaleString()}</div>
                      <div className="text-sm text-gray-600">
                        {new Date(payment.date).toLocaleDateString()}
                      </div>
                      {payment.month && (
                        <div className="text-sm text-blue-600 font-medium">
                          For: {(() => {
                            const [year, month] = payment.month.split('-');
                            return new Date(parseInt(year), parseInt(month) - 1).toLocaleDateString('en-US', {
                              year: 'numeric',
                              month: 'long'
                            });
                          })()}
                        </div>
                      )}
                    </div>
                    <Badge className={
                      payment.status === 'Approved' ? 'bg-green-100 text-green-800' :
                      payment.status === 'Pending' ? 'bg-yellow-100 text-yellow-800' :
                      payment.status === 'Rejected' ? 'bg-red-100 text-red-800' :
                      'bg-gray-100 text-gray-800'
                    }>
                      {payment.status}
                    </Badge>
                  </div>
                  {payment.proofUrl && (
                    <div className="mt-2">
                      <a 
                        href={`http://localhost:3001${payment.proofUrl}`} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="text-blue-600 hover:underline text-sm flex items-center"
                      >
                        <FileText className="w-4 h-4 mr-1" />
                        View Proof of Payment
                      </a>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
          </div>
        </Card>

        {/* Rental Record Table */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Rental Record</h3>
          <div className="overflow-x-auto">
            {rentHistory.length === 0 ? (
              <div className="text-center text-gray-500 py-8">
                No lease information found. Your rental record will appear here once you have an active lease.
              </div>
            ) : (
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 border-b">
                    <th className="py-2 pr-4">Month</th>
                    <th className="py-2 pr-4">Property</th>
                    <th className="py-2 pr-4">Amount</th>
                    <th className="py-2 pr-4">Status</th>
                    <th className="py-2 pr-4">Payment Date</th>
                  </tr>
                </thead>
                <tbody>
                  {rentHistory.map((rent, i) => (
                    <tr key={i} className="border-b last:border-0">
                      <td className="py-2 pr-4 font-medium">{rent.month}</td>
                      <td className="py-2 pr-4 text-gray-600">{rent.propertyAddress}</td>
                      <td className="py-2 pr-4">${rent.amount.toLocaleString()}</td>
                      <td className="py-2 pr-4">
                        <Badge className={
                          rent.status === 'Paid' ? 'bg-green-100 text-green-800' :
                          rent.status === 'Partial' ? 'bg-orange-100 text-orange-800' :
                          rent.status === 'Due' ? 'bg-yellow-100 text-yellow-800' :
                          rent.status === 'Missed' ? 'bg-red-100 text-red-800' :
                          rent.status === 'Upcoming' ? 'bg-blue-100 text-blue-800' :
                          'bg-gray-100 text-gray-800'
                        }>
                          {rent.status}
                        </Badge>
                      </td>
                      <td className="py-2 pr-4 text-gray-600">
                        {rent.paymentDate || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </Card>

        {/* Contact/Support Button */}
        <Card className="p-6 flex flex-col items-center">
          <div className="text-lg font-semibold mb-2 flex items-center gap-2">
            <User className="w-5 h-5" /> Need help with your account?
          </div>
          <Button className="roomzi-gradient" onClick={() => alert('Contact support coming soon!')}>
            Contact Support
          </Button>
        </Card>

        {/* Helpful Tips/FAQ */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-2">Tips & FAQ</h3>
          <ul className="list-disc pl-5 text-gray-700 space-y-1">
            <li>Rent is due on the 1st of each month.</li>
            <li>Late payments may incur a fee.</li>
            <li>
              If you have payment issues, <button className="text-blue-600 underline hover:text-blue-800" onClick={() => alert('Contact support coming soon!')}>contact support</button>.
            </li>
            <li>Keep your payment information up to date.</li>
            <li>See our <Link to="/faq" className="text-blue-600 underline">full FAQ</Link> for more.</li>
          </ul>
        </Card>
      </div>
    </div>
  );
};

export default FinancialAccount; 