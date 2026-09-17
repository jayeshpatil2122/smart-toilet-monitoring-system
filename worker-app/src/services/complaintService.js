import api from './api';

export const complaintService = {
  // Fetch complaints assigned to the logged-in worker
  getMyComplaints: async () => {
    const response = await api.get('/workers/my-complaints/');
    return response.data;
  },

  // Update complaint status (In Progress / Resolved)
  updateComplaintStatus: async (complaintId, data) => {
    // If uploading files (after_image or after_video), use FormData
    if (data.after_image || data.after_video) {
      const formData = new FormData();
      formData.append('status', data.status);
      
      if (data.after_image) {
        formData.append('after_image', data.after_image);
      }
      if (data.after_video) {
        formData.append('after_video', data.after_video);
      }
      if (data.remarks) {
        formData.append('remarks', data.remarks);
      }
      if (data.skip_ai !== undefined) {
        formData.append('skip_ai', String(data.skip_ai));
      }
      if (data.latitude) {
        formData.append('solving_latitude', String(data.latitude));
      }
      if (data.longitude) {
        formData.append('solving_longitude', String(data.longitude));
      }

      const response = await api.patch(`/workers/my-complaints/${complaintId}/status/`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      return response.data;
    } else {
      // Normal JSON payload
      const response = await api.patch(`/workers/my-complaints/${complaintId}/status/`, {
        status: data.status,
        skip_ai: data.skip_ai ?? true,
        solving_latitude: data.latitude,
        solving_longitude: data.longitude,
      });
      return response.data;
    }
  }
};
