export const mockWorker = {
  id: "WRK-8092",
  name: "Rajesh Kumar",
  role: "Senior Sanitation Technician",
  zone: "Zone 3 - Nashik Municipal Corporation",
  phone: "+91 98765 43210",
  email: "rajesh.worker@sanitrax.gov.in",
  avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80",
  rating: "4.9 ⭐",
  totalResolved: 142,
  shift: "Morning Shift (07:00 AM - 03:00 PM)"
};

export const transformApiComplaint = (item) => {
  const statusMap = {
    'Pending': 'PENDING',
    'PENDING': 'PENDING',
    'Assigned': 'ASSIGNED',
    'ASSIGNED': 'ASSIGNED',
    'Accepted': 'ACCEPTED',
    'ACCEPTED': 'ACCEPTED',
    'In Progress': 'IN_PROGRESS',
    'IN_PROGRESS': 'IN_PROGRESS',
    'Resolved': 'COMPLETED',
    'COMPLETED': 'COMPLETED',
  };

  const priorityMap = {
    'High': 'HIGH',
    'Medium': 'MEDIUM',
    'Low': 'LOW',
  };

  let image = item.before_image || item.image;
  if (image && image.startsWith('/')) {
    image = `http://10.124.40.180:8000${image}`;
  }

  let afterImage = item.after_image;
  if (afterImage && afterImage.startsWith('/')) {
    afterImage = `http://10.124.40.180:8000${afterImage}`;
  }

  let rawStatus = item.status;
  let status = statusMap[rawStatus];
  if (!status && rawStatus) {
    const upper = String(rawStatus).toUpperCase().replace(/\s+/g, '_');
    status = upper === 'RESOLVED' ? 'COMPLETED' : upper;
  }
  if (!status) status = 'ASSIGNED';

  return {
    id: String(item.id),
    title: item.issue_type ? `${item.issue_type} Issue` : 'Sanitation Complaint',
    category: item.issue_type || 'General',
    toilet: item.toilet_name || 'Public Toilet',
    location: item.toilet_location || 'Nashik',
    latitude: item.toilet_latitude || item.latitude || 20.0059,
    longitude: item.toilet_longitude || item.longitude || 73.7652,
    priority: priorityMap[item.priority] || (item.priority ? item.priority.toUpperCase() : 'MEDIUM'),
    assignedDate: item.created_at ? new Date(item.created_at).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Today',
    completedDate: item.resolved_at ? new Date(item.resolved_at).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : null,
    status: status,
    image: image || 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=600&q=80',
    afterImage: afterImage || null,
    description: item.description || 'No description provided.',
    remarks: item.video_verification_reason || item.remarks || null,
  };
};

export const initialComplaints = [
  {
    id: "1024",
    title: "Dirty Floor & Odor",
    category: "Cleanliness",
    toilet: "College Road Public Toilet",
    location: "College Road, Near City Mall, Nashik",
    latitude: 20.0059,
    longitude: 73.7652,
    priority: "HIGH",
    assignedDate: "16 Sep 2026, 10:30 AM",
    status: "ASSIGNED",
    image: "https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=600&q=80",
    description: "The main hall floor requires immediate wet cleaning and sanitization. Strong odor reported by citizens via QR portal."
  },
  {
    id: "1025",
    title: "Dustbin Overflow",
    category: "Waste Disposal",
    toilet: "Nashik Road Railway Station Toilet",
    location: "Platform 1 Exit, Nashik Road, Nashik",
    latitude: 19.9575,
    longitude: 73.8340,
    priority: "MEDIUM",
    assignedDate: "16 Sep 2026, 09:15 AM",
    status: "ASSIGNED",
    image: "https://images.unsplash.com/photo-1532996122724-e3c354a0b15b?auto=format&fit=crop&w=600&q=80",
    description: "Dustbin #2 at entrance is 100% full. Waste disposal and new liner installation required urgently."
  },
  {
    id: "1026",
    title: "Water Supply Interrupted",
    category: "Plumbing",
    toilet: "CBS Main Bus Stand Restroom",
    location: "CBS Central Bus Stand, Nashik",
    latitude: 19.9975,
    longitude: 73.7898,
    priority: "HIGH",
    assignedDate: "16 Sep 2026, 11:00 AM",
    status: "IN_PROGRESS",
    image: "https://images.unsplash.com/photo-1505798577917-a65157d3320a?auto=format&fit=crop&w=600&q=80",
    description: "Overhead tank inlet valve restricted. Water flow stopped in Cubicle 3. Smart IoT sensor flagged low pressure."
  },
  {
    id: "1027",
    title: "Soap Dispenser Empty",
    category: "Supplies",
    toilet: "Panchavati Ghat Smart Washroom",
    location: "Ramkund, Panchavati, Nashik",
    latitude: 20.0091,
    longitude: 73.7925,
    priority: "LOW",
    assignedDate: "16 Sep 2026, 08:00 AM",
    status: "PENDING",
    image: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=600&q=80",
    description: "Liquid soap dispenser #1 in handwash area needs refilling."
  },
  {
    id: "1028",
    title: "Flush Mechanism Jammed",
    category: "Maintenance",
    toilet: "College Road Public Toilet",
    location: "College Road, Near City Mall, Nashik",
    latitude: 20.0059,
    longitude: 73.7652,
    priority: "MEDIUM",
    assignedDate: "15 Sep 2026, 04:30 PM",
    status: "COMPLETED",
    completedDate: "15 Sep 2026, 05:45 PM",
    image: "https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=600&q=80",
    afterImage: "https://images.unsplash.com/photo-1620641788421-7a1c342ea42e?auto=format&fit=crop&w=600&q=80",
    description: "Flush lever stuck in depressed state causing continuous water flow.",
    remarks: "Replaced faulty flush valve spring and cleared lever mechanism. System fully restored."
  },
  {
    id: "1029",
    title: "Exhaust Fan Power Failure",
    category: "Electrical",
    toilet: "CBS Main Bus Stand Restroom",
    location: "CBS Central Bus Stand, Nashik",
    latitude: 19.9975,
    longitude: 73.7898,
    priority: "LOW",
    assignedDate: "14 Sep 2026, 02:00 PM",
    status: "COMPLETED",
    completedDate: "14 Sep 2026, 03:30 PM",
    image: "https://images.unsplash.com/photo-1505798577917-a65157d3320a?auto=format&fit=crop&w=600&q=80",
    afterImage: "https://images.unsplash.com/photo-1620641788421-7a1c342ea42e?auto=format&fit=crop&w=600&q=80",
    description: "Exhaust fan not spinning despite power switch ON.",
    remarks: "Repaired power connection terminal at fan motor box. Airflow verified."
  }
];

export const getStats = (complaints) => {
  return {
    assigned: complaints.filter(c => {
      const s = (c.status || '').toUpperCase().replace(/\s+/g, '_');
      return s === 'ASSIGNED' || s === 'ACCEPTED' || s === 'PENDING';
    }).length,
    pending: complaints.filter(c => {
      const s = (c.status || '').toUpperCase().replace(/\s+/g, '_');
      return s === 'PENDING' || s === 'ASSIGNED';
    }).length,
    inProgress: complaints.filter(c => {
      const s = (c.status || '').toUpperCase().replace(/\s+/g, '_');
      return s === 'IN_PROGRESS' || s === 'ACCEPTED';
    }).length,
    completed: complaints.filter(c => {
      const s = (c.status || '').toUpperCase().replace(/\s+/g, '_');
      return s === 'COMPLETED' || s === 'RESOLVED';
    }).length,
  };
};
