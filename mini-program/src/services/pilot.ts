import { apiV1 } from './api';

export const submitCriminalCheck = async (docUrl: string): Promise<void> => {
  await apiV1.post('/pilot/criminal-check', { doc_url: docUrl });
};

export const submitHealthCheck = async (data: {
  doc_url: string;
  expire_date: string;
}): Promise<void> => {
  await apiV1.post('/pilot/health-check', data);
};

export default {
  submitCriminalCheck,
  submitHealthCheck,
};
