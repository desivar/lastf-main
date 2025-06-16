// my-pipeline-app/src/App.jsx

import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import Jobs from './pages/Jobs';
import Customers from './pages/Customers';
import Pipelines from './pages/Pipelines';
import Login from './pages/Login';

// Remove or comment out mock data imports/definitions
// import { mockUser, mockPipelines, mockJobs, mockCustomers } from './mockData'; 

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [pipelines, setPipelines] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [dashboardStats, setDashboardStats] = useState({
    activeJobs: 0,
    totalCustomers: 0,
    totalPipelines: 0,
    jobsDueThisWeek: 0,
  });

  const BACKEND_URL = 'http://localhost:5500'; // Define your backend URL

  // Function to fetch all user-specific data from the backend
  const fetchAllUserData = async () => {
    try {
      const [jobsRes, customersRes, pipelinesRes, dashboardStatsRes] = await Promise.all([
        fetch(`${BACKEND_URL}/api/jobs`, { credentials: 'include' }),
        fetch(`${BACKEND_URL}/api/customers`, { credentials: 'include' }),
        fetch(`${BACKEND_URL}/api/pipelines`, { credentials: 'include' }),
        fetch(`${BACKEND_URL}/api/dashboard/stats`, { credentials: 'include' })
      ]);

      if (!jobsRes.ok || !customersRes.ok || !pipelinesRes.ok || !dashboardStatsRes.ok) {
        throw new Error('Failed to fetch all user data');
      }

      const [jobsData, customersData, pipelinesData, dashboardStatsData] = await Promise.all([
        jobsRes.json(),
        customersRes.json(),
        pipelinesRes.json(),
        dashboardStatsRes.json()
      ]);

      setJobs(jobsData);
      setCustomers(customersData);
      setPipelines(pipelinesData);
      setDashboardStats(dashboardStatsData); // Set dashboard stats from backend
      
    } catch (error) {
      console.error('Error fetching all user data:', error);
      // If fetching fails, probably means session expired or invalid
      setIsAuthenticated(false);
      setUser(null);
      setJobs([]);
      setCustomers([]);
      setPipelines([]);
      setDashboardStats({ activeJobs: 0, totalCustomers: 0, totalPipelines: 0, jobsDueThisWeek: 0 });
    }
  };

  useEffect(() => {
    const checkAuthAndLoadData = async () => {
      try {
        // Try to fetch current user to see if a session exists
        const userResponse = await fetch(`${BACKEND_URL}/api/user`, {
          credentials: 'include' // This is crucial for sending session cookies
        });

        if (userResponse.ok) {
          const userData = await userResponse.json();
          setIsAuthenticated(true);
          setUser(userData);
          await fetchAllUserData(); // Fetch all related data
        } else {
          // No active session or authentication failed
          setIsAuthenticated(false);
          setUser(null);
        }
      } catch (error) {
        console.error('Error during initial authentication check:', error);
        setIsAuthenticated(false);
        setUser(null);
      }
    };

    checkAuthAndLoadData();
  }, []); // Run once on component mount

  const handleGitHubLogin = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/auth/github`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // Important to receive session cookie
        body: JSON.stringify({ username: 'desivar' }), // For homework simulation
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setIsAuthenticated(true);
          setUser(data.user);
          await fetchAllUserData(); // Fetch data after successful login
        } else {
          console.error('Login failed:', data.error);
          alert(`Login failed: ${data.error}`);
        }
      } else {
        const errorData = await response.json();
        console.error('Login request failed:', response.status, errorData.error);
        alert(`Login request failed: ${errorData.error || response.statusText}`);
      }
    } catch (error) {
      console.error('Network error during login:', error);
      alert('Network error during login. Please check your backend server.');
    }
  };

  const handleLogout = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/auth/logout`, {
        method: 'POST',
        credentials: 'include', // Send session cookie to log out
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setIsAuthenticated(false);
          setUser(null);
          setPipelines([]);
          setJobs([]);
          setCustomers([]);
          setDashboardStats({ activeJobs: 0, totalCustomers: 0, totalPipelines: 0, jobsDueThisWeek: 0 }); // Reset stats
          // You might also want to clear any local storage items related to auth if they exist
        } else {
          console.error('Logout failed:', data.error);
        }
      } else {
        console.error('Logout request failed:', response.statusText);
      }
    } catch (error) {
      console.error('Error during logout:', error);
    }
  };

  // Add functions for adding/updating jobs, customers, pipelines etc.
  // These will also make API calls to your backend

  // Example: Add Job
  const handleAddJob = async (newJobData) => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/jobs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(newJobData),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          alert('Job added successfully!');
          await fetchAllUserData(); // Re-fetch data to update UI
        } else {
          alert(`Failed to add job: ${data.error}`);
        }
      } else {
        const errorData = await response.json();
        alert(`Error adding job: ${errorData.error || response.statusText}`);
      }
    } catch (error) {
      console.error('Error adding job:', error);
      alert('Network error when adding job.');
    }
  };

  // Example: Add Customer
  const handleAddCustomer = async (newCustomerData) => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/customers`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(newCustomerData),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          alert('Customer added successfully!');
          await fetchAllUserData(); // Re-fetch data to update UI
        } else {
          alert(`Failed to add customer: ${data.error}`);
        }
      } else {
        const errorData = await response.json();
        alert(`Error adding customer: ${errorData.error || response.statusText}`);
      }
    } catch (error) {
      console.error('Error adding customer:', error);
      alert('Network error when adding customer.');
    }
  };

  // Example: Add Pipeline
  const handleAddPipeline = async (newPipelineData) => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/pipelines`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(newPipelineData),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          alert('Pipeline added successfully!');
          await fetchAllUserData(); // Re-fetch data to update UI
        } else {
          alert(`Failed to add pipeline: ${data.error}`);
        }
      } else {
        const errorData = await response.json();
        alert(`Error adding pipeline: ${errorData.error || response.statusText}`);
      }
    } catch (error) {
      console.error('Error adding pipeline:', error);
      alert('Network error when adding pipeline.');
    }
  };


  if (!isAuthenticated) {
    return <Login onGitHubLogin={handleGitHubLogin} />;
  }

  return (
    <Router>
      <div className="flex h-screen bg-gray-100">
        <Sidebar user={user} onLogout={handleLogout} />
        <div className="flex-1 flex flex-col overflow-hidden">
          <Header />
          <main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-100 p-6">
            <Routes>
              <Route path="/" element={<Dashboard stats={dashboardStats} recentJobs={jobs} />} />
              <Route path="/jobs" element={<Jobs jobs={jobs} customers={customers} pipelines={pipelines} onAddJob={handleAddJob} />} />
              <Route path="/customers" element={<Customers customers={customers} onAddCustomer={handleAddCustomer} />} />
              <Route path="/pipelines" element={<Pipelines pipelines={pipelines} onAddPipeline={handleAddPipeline} />} />
              <Route path="*" element={<Navigate to="/" />} />
            </Routes>
          </main>
        </div>
      </div>
    </Router>
  );
}

export default App;