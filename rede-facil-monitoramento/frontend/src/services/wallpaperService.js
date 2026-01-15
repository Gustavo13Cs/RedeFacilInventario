import axios from 'axios';
import { API_URL } from '../config'; 

export const changeWallpaper = (uuid, file) => {
  const formData = new FormData();
  formData.append('file', file); 
  
  const token = localStorage.getItem('token');

  return axios.post(`${API_URL}/machines/${uuid}/wallpaper`, formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
      'Authorization': `Bearer ${token}`
    },
  });
};