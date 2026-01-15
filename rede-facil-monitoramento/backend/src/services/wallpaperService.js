import api from './api';

export const changeWallpaper = (uuid, file) => {
  const formData = new FormData();
  formData.append('file', file); 

  return api.post(`/api/machines/${uuid}/wallpaper`, formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
};